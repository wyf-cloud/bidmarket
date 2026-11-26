/* ============================================================
   页面：管理后台 / 怎么用 / 404
   ============================================================ */
import {
  db, state, esc, toast, zhError, currentUid, needLogin, loadProfile,
  dateText, fullTime, TASK_STATUS, stars
} from './lib.js';
import { empty, renderHeader, openDialog, confirmDialog, refreshTicker } from './ui.js';

const app = () => document.getElementById('app');

export async function viewAdmin() {
  if (!needLogin('请先登录')) return;
  await loadProfile();
  if (!state.profile || !state.profile.is_admin) {
    app().innerHTML = `<div class="panel"><h2>无权访问</h2>
      <p class="muted">该页面仅管理员可见。</p>
      <a class="btn btn-ghost" href="#/">回首页</a></div>`;
    return;
  }

  const tab = (location.hash.split('?')[1] || '').replace('tab=', '') || 'overview';
  app().innerHTML = `
    <section class="section">
      <div class="section-head"><h2>管理后台</h2></div>
      <div class="tabs">
        <button data-atab="pending" class="${tab === 'pending' ? 'active' : ''}">待审核</button>
        <button data-atab="overview" class="${tab === 'overview' ? 'active' : ''}">概览</button>
        <button data-atab="users" class="${tab === 'users' ? 'active' : ''}">用户</button>
        <button data-atab="tasks" class="${tab === 'tasks' ? 'active' : ''}">任务</button>
        <button data-atab="reports" class="${tab === 'reports' ? 'active' : ''}">举报</button>
        <button data-atab="settings" class="${tab === 'settings' ? 'active' : ''}">设置</button>
      </div>
      <div id="admin-body"><div class="empty">加载中…</div></div>
    </section>`;

  document.querySelectorAll('[data-atab]').forEach(btn => {
    btn.onclick = () => {
      location.hash = '#/admin?tab=' + btn.dataset.atab;
    };
  });

  const body = document.getElementById('admin-body');
  if (tab === 'pending') await renderPending(body);
  else if (tab === 'users') await renderUsers(body);
  else if (tab === 'tasks') await renderTasks(body);
  else if (tab === 'reports') await renderReports(body);
  else if (tab === 'settings') await renderSettings(body);
  else await renderOverview(body);
}

async function renderPending(body) {
  const { data, error } = await db.from('tasks')
    .select('*, owner:profiles(nickname)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) { body.innerHTML = empty(zhError(error.message)); return; }
  const tasks = data || [];

  if (!tasks.length) {
    body.innerHTML = empty('没有待审核的任务。');
    return;
  }

  body.innerHTML = `<div class="panel">
    <h2>待审核（${tasks.length}）</h2>
    <p class="sub">通过后立刻出现在任务大厅；驳回后发布者会收到通知，可修改后重新发布。</p>
    <table class="admin-table">
      <thead><tr><th>标题</th><th>发布者</th><th>预算</th><th>提交时间</th><th>操作</th></tr></thead>
      <tbody>${tasks.map(t => `<tr>
        <td><a href="#/task/${esc(t.id)}">${esc(t.title)}</a>
          <div class="muted small">${esc(t.category)}</div></td>
        <td>${esc(t.owner ? t.owner.nickname : '—')}</td>
        <td class="muted small">${t.budget_min || t.budget_max
          ? '¥' + Number(t.budget_min || t.budget_max).toLocaleString('zh-CN') +
            (t.budget_max && t.budget_min ? ' – ¥' + Number(t.budget_max).toLocaleString('zh-CN') : '')
          : '面议'}</td>
        <td class="muted small">${dateText(t.created_at)}</td>
        <td class="row-actions">
          <button class="btn btn-primary btn-sm" data-approve="${esc(t.id)}">通过</button>
          <button class="btn btn-ghost btn-sm" data-reject="${esc(t.id)}">驳回</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;

  body.querySelectorAll('[data-approve]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      const { error: e } = await db.rpc('approve_task', { p_task: btn.dataset.approve });
      if (e) { btn.disabled = false; toast(zhError(e.message), 'error'); return; }
      toast('已通过，任务已上线');
      await viewAdmin();
    };
  });

  body.querySelectorAll('[data-reject]').forEach(btn => {
    btn.onclick = () => {
      openDialog('驳回任务', `
        <div class="field">
          <label>驳回原因（可选，会显示给发布者）</label>
          <textarea name="note" maxlength="200" placeholder="例如：描述过于笼统，请补充评分点和册数"></textarea>
        </div>`, {
        submitText: '确认驳回',
        danger: true,
        onSubmit: async (fd) => {
          const { error: e } = await db.rpc('reject_task', {
            p_task: btn.dataset.reject,
            p_note: String(fd.get('note') || '')
          });
          if (e) { toast(zhError(e.message), 'error'); return false; }
          toast('已驳回');
          await viewAdmin();
        }
      });
    };
  });
}

async function renderOverview(body) {
  const [u, t, o, r] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('tasks').select('id', { count: 'exact', head: true }),
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open')
  ]);

  const stat = (label, value, sub) => `
    <div class="stat"><b>${value}</b><span>${label}</span>${sub ? `<i>${sub}</i>` : ''}</div>`;

  body.innerHTML = `
    <div class="stats">
      ${stat('注册用户', u.count || 0)}
      ${stat('任务总数', t.count || 0)}
      ${stat('待审核', o.count || 0)}
      ${stat('待处理举报', r.count || 0)}
    </div>
    <div class="panel">
      <h2>运营提示</h2>
      <ul class="muted small" style="line-height:1.9;margin:0;padding-left:18px">
        <li>认证用户会在昵称旁显示“已认证”，建议只给核验过营业执照的服务方认证。</li>
        <li>举报处理：任务类可下架，用户类可封禁；封禁后无法发任务、报价、发消息。</li>
        <li>平台不接收文件，任务和沟通全部是文字，涉密资料由双方线下传递。</li>
      </ul>
    </div>`;
}

async function renderUsers(body) {
  const { data, error } = await db.from('profiles')
    .select('*, contacts:profile_contacts(phone, wechat)')
    .order('created_at', { ascending: false }).limit(300);
  if (error) { body.innerHTML = empty(zhError(error.message)); return; }
  const users = data || [];

  body.innerHTML = `<div class="panel">
    <h2>用户（${users.length}）</h2>
    <table class="admin-table">
      <thead><tr><th>昵称</th><th>评分</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td>${esc(u.nickname)}${u.is_admin ? ' <span class="chip">管理员</span>' : ''}
          ${u.contacts && (u.contacts.wechat || u.contacts.phone)
            ? `<div class="muted small">${esc(u.contacts.wechat || '')}${u.contacts.wechat && u.contacts.phone ? ' · ' : ''}${esc(u.contacts.phone || '')}</div>`
            : ''}</td>
        <td>${Number(u.rating || 0).toFixed(1)}</td>
        <td>${u.banned ? '<span class="chip danger">封禁</span>' : (u.verified ? '已认证' : '<span class="muted">未认证</span>')}</td>
        <td class="muted small">${dateText(u.created_at)}</td>
        <td class="row-actions">
          <button class="btn btn-ghost btn-sm" data-verify="${esc(u.id)}" data-cur="${u.verified}">
            ${u.verified ? '取消认证' : '认证'}</button>
          <button class="btn btn-ghost btn-sm" data-ban="${esc(u.id)}" data-cur="${u.banned}">
            ${u.banned ? '解封' : '封禁'}</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;

  body.querySelectorAll('[data-verify]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      const { error: e } = await db.from('profiles')
        .update({ verified: btn.dataset.cur !== 'true' }).eq('id', btn.dataset.verify);
      if (e) { btn.disabled = false; toast(zhError(e.message), 'error'); return; }
      toast('已更新');
      await viewAdmin();
    };
  });

  body.querySelectorAll('[data-ban]').forEach(btn => {
    btn.onclick = async () => {
      const next = btn.dataset.cur !== 'true';
      if (next && !(await confirmDialog('封禁后该用户无法发布任务、报价和发消息', { okText: '封禁', danger: true }))) return;
      btn.disabled = true;
      const { error: e } = await db.from('profiles')
        .update({ banned: next }).eq('id', btn.dataset.ban);
      if (e) { btn.disabled = false; toast(zhError(e.message), 'error'); return; }
      toast(next ? '已封禁' : '已解封');
      await viewAdmin();
    };
  });
}

async function renderTasks(body) {
  const { data, error } = await db.from('tasks')
    .select('*, owner:profiles(nickname)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) { body.innerHTML = empty(zhError(error.message)); return; }
  const tasks = data || [];

  body.innerHTML = `<div class="panel">
    <h2>任务（${tasks.length}）</h2>
    <p class="sub">下架会删除任务及其报价、消息和评价，不可恢复。</p>
    <table class="admin-table">
      <thead><tr><th>标题</th><th>发布者</th><th>状态</th><th>发布时间</th><th></th></tr></thead>
      <tbody>${tasks.map(t => `<tr>
        <td><a href="#/task/${esc(t.id)}">${esc(t.title)}</a></td>
        <td>${esc(t.owner ? t.owner.nickname : '—')}</td>
        <td>${esc(TASK_STATUS[t.status] || t.status)}</td>
        <td class="muted small">${dateText(t.created_at)}</td>
        <td><button class="btn btn-ghost btn-sm" data-del-task="${esc(t.id)}">下架</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;

  body.querySelectorAll('[data-del-task]').forEach(btn => {
    btn.onclick = async () => {
      if (!(await confirmDialog('下架会删除该任务及其报价、消息和评价，不可恢复', { okText: '删除', danger: true }))) return;
      btn.disabled = true;
      const { error: e } = await db.from('tasks').delete().eq('id', btn.dataset.delTask);
      if (e) { btn.disabled = false; toast(zhError(e.message), 'error'); return; }
      toast('已下架');
      await viewAdmin();
    };
  });
}

async function renderReports(body) {
  const { data, error } = await db.from('reports')
    .select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { body.innerHTML = empty(zhError(error.message)); return; }
  const reports = data || [];

  if (!reports.length) { body.innerHTML = empty('没有举报记录。'); return; }

  body.innerHTML = `<div class="panel">
    <h2>举报（${reports.filter(r => r.status === 'open').length} 待处理 / ${reports.length} 总）</h2>
    ${reports.map(r => `<div class="report-row">
      <div>
        <span class="chip ${r.status === 'open' ? 'status-open' : 'status-completed'}">${r.status === 'open' ? '待处理' : (r.status === 'resolved' ? '已处理' : '已忽略')}</span>
        <b>${esc(r.reason)}</b>
        <span class="muted small">${esc(r.target_type)} · ${esc(String(r.target_id).slice(0, 8))} · ${fullTime(r.created_at)}</span>
        ${r.detail ? `<div class="muted small">${esc(r.detail)}</div>` : ''}
        ${r.target_type === 'task' ? `<a class="small" href="#/task/${esc(r.target_id)}">查看任务</a>` : ''}
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-resolve="${esc(r.id)}" data-status="resolved">处理</button>
        <button class="btn btn-ghost btn-sm" data-resolve="${esc(r.id)}" data-status="dismissed">忽略</button>
      </div>
    </div>`).join('')}
  </div>`;

  body.querySelectorAll('[data-resolve]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      const { error: e } = await db.from('reports')
        .update({ status: btn.dataset.status }).eq('id', btn.dataset.resolve);
      if (e) { btn.disabled = false; toast(zhError(e.message), 'error'); return; }
      toast('已更新');
      await viewAdmin();
    };
  });
}

/* ============================================================
   站点设置
   ============================================================ */
async function renderSettings(body) {
  const { data, error } = await db.from('site_settings')
    .select('announcement, announcement_enabled, announcement_speed')
    .eq('id', 1).maybeSingle();

  if (error) {
    body.innerHTML = `<div class="panel">
      <h2>站点设置</h2>
      <p class="muted">读取失败：${esc(zhError(error.message))}</p>
      <p class="muted small">如果提示 site_settings 不存在，先在 SQL Editor 执行
        <code>supabase/migrations/2026-11-26-announcement.sql</code>。</p>
    </div>`;
    return;
  }

  const s = data || {};
  body.innerHTML = `
    <div class="panel">
      <h2>滚动公告</h2>
      <p class="sub">显示在所有页面顶部，一条循环滚动。关闭后整条隐藏。</p>
      <form id="ann-form">
        <label class="check">
          <input type="checkbox" name="enabled" ${s.announcement_enabled ? 'checked' : ''}> 启用滚动公告
        </label>
        <div class="field">
          <label>公告内容（每行一条）</label>
          <textarea name="announcement" rows="4"
            placeholder="例如：新用户首次发布任务，审核通过后赠送一次置顶">${esc(s.announcement || '')}</textarea>
          <div class="hint">多行会用「·」连接成一条循环播放。</div>
        </div>
        <div class="field">
          <label>滚动一圈秒数（10–180，越小越快）</label>
          <input type="number" name="speed" min="10" max="180" step="5"
            value="${Number(s.announcement_speed) || 40}">
        </div>
        <button class="btn btn-primary" type="submit">保存</button>
      </form>
    </div>`;

  const form = document.getElementById('ann-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { error: e2 } = await db.from('site_settings').update({
      announcement: String(fd.get('announcement') || '').trim() || null,
      announcement_enabled: fd.get('enabled') === 'on',
      announcement_speed: Number(fd.get('speed')) || 40,
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    btn.disabled = false;
    if (e2) { toast(zhError(e2.message), 'error'); return; }
    toast('已保存');
    await refreshTicker();
  };
}

/* ============================================================
   怎么用
   ============================================================ */
export function viewHow() {
  app().innerHTML = `
    <section class="section">
      <div class="section-head"><h2>怎么用</h2></div>
      <div class="steps" style="margin-top:0">
        <div class="step"><b>需求方</b><h4>发布任务</h4>
          <p>填标题、类型、预算区间、投标截止时间和需求说明，全部用文字描述。提交后需管理员审核，通过后才会出现在任务大厅。</p></div>
        <div class="step"><b>服务方</b><h4>提交报价</h4>
          <p>挑任务，填金额、工期和方案。每个任务只能报一次，选定前可撤回。</p></div>
        <div class="step"><b>双方</b><h4>沟通与交付</h4>
          <p>选定后用站内消息沟通，中标方线下交付，发布方确认完成后互评。</p></div>
      </div>

      <div class="panel" style="margin-top:28px">
        <h2>费用与规则</h2>
        <p class="muted">当前版本免费发布、免费报价，不抽佣，也不托管资金。平台只提供信息展示与撮合，
        不参与合同签订与履约。</p>
        <p class="muted">标书涉及商业信息，请勿在公开的任务描述里填写投标报价、客户名称等敏感内容；
        涉密材料建议在选定服务方后通过站内消息约定线下传递方式。</p>
        <p class="muted small">遇到虚假信息、诈骗或骚扰，可以在任务页举报，管理员会处理。</p>
      </div>
    </section>`;
}

/* ============================================================
   404
   ============================================================ */
export function viewNotFound() {
  app().innerHTML = `<div class="panel">
    <h2>页面不存在</h2>
    <p class="muted">链接可能已经失效。</p>
    <a class="btn btn-primary" href="#/">回首页</a>
  </div>`;
}
