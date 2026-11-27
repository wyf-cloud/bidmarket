/* ============================================================
   页面：环境自检（连接 Supabase 后用来判断哪一步没配好）
   ============================================================ */
import { db, DEMO, state, esc, toast, currentUid } from './lib.js';
import { renderHeader } from './ui.js';

const app = () => document.getElementById('app');

const NIL = '00000000-0000-0000-0000-000000000000';

const TABLES = [
  'profiles', 'profile_contacts', 'tasks', 'bids',
  'messages', 'reviews', 'files', 'notifications', 'reports',
  'job_posts', 'resumes', 'job_applications', 'application_messages', 'application_notes'
];

const RPCS = [
  ['accept_bid', { p_bid_id: NIL }],
  ['mark_delivered', { p_task: NIL }],
  ['confirm_complete', { p_task: NIL }],
  ['cancel_task', { p_task: NIL }],
  ['submit_review', { p_task: NIL, p_score: 5, p_body: 'health-check' }],
  ['approve_job', { p_job: NIL }],
  ['reject_job', { p_job: NIL, p_note: '' }],
  ['apply_job', { p_job: NIL, p_cover: '' }],
  ['job_app_set_status', { p_app: NIL, p_status: 'viewed' }],
  ['close_job', { p_job: NIL }]
];

let results = [];
let running = false;

export async function viewHealth() {
  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>环境自检</h2>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" id="recheck">重新检测</button>
          <button class="btn btn-ghost btn-sm" id="copy">复制结果</button>
        </div>
      </div>
      <p class="sub">检查配置、数据表、数据库函数、存储桶、实时订阅是否都正常。只读检查，不会改动数据。</p>
      ${DEMO ? `<div class="alert alert-info">
        当前是演示模式，没有连接真实数据库，下面的检查会被跳过。
        填好 <code>docs/assets/config.js</code> 后刷新页面再来。
      </div>` : ''}
      <div id="health-body"><div class="empty">检测中…</div></div>
    </section>`;

  document.getElementById('recheck').onclick = () => run();
  document.getElementById('copy').onclick = async () => {
    const text = results.map(r => `${r.ok ? '[通过]' : '[失败]'} ${r.name}：${r.detail}`).join('\n');
    try {
      await navigator.clipboard.writeText(text || '（还没有结果）');
      toast('结果已复制，可直接粘贴给别人排查');
    } catch {
      toast('复制失败，请手动选中表格内容', 'error');
    }
  };

  await run();
}

async function run() {
  if (running) return;
  running = true;
  const body = document.getElementById('health-body');
  if (body) body.innerHTML = '<div class="empty">检测中…</div>';

  results = [];

  if (DEMO) {
    results.push({ name: '运行模式', ok: false, detail: '演示模式：未配置 Supabase，检查已跳过' });
    render();
    running = false;
    return;
  }

  const cfg = window.__SUPABASE__ || {};
  results.push({
    name: '配置 config.js',
    ok: !!(cfg.url && cfg.anonKey),
    detail: cfg.url ? '已配置：' + cfg.url.replace(/^https?:\/\//, '').split('.')[0] + '…' : '缺少 URL 或 anonKey'
  });

  // 会话
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const u = data.session && data.session.user;
    results.push({ name: '登录会话', ok: true, detail: u ? '已登录：' + (u.email || u.id) : '未登录（部分检查需要登录）' });
  } catch (e) {
    results.push({ name: '登录会话', ok: false, detail: e.message || String(e) });
  }

  // 数据表
  for (const t of TABLES) {
    try {
      const { error, count } = await db.from(t).select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      results.push({ name: '数据表 ' + t, ok: true, detail: '可访问，当前可见 ' + (count ?? 0) + ' 行' });
    } catch (e) {
      results.push({ name: '数据表 ' + t, ok: false, detail: e.message || String(e) });
    }
  }

  // RPC
  for (const [fn, params] of RPCS) {
    try {
      const { error } = await db.rpc(fn, params);
      if (!error) {
        results.push({ name: '函数 ' + fn, ok: true, detail: '可调用' });
      } else {
        const m = error.message || '';
        if (/Could not find the function|does not exist|schema cache/i.test(m)) {
          results.push({ name: '函数 ' + fn, ok: false, detail: '不存在：' + m });
        } else {
          results.push({ name: '函数 ' + fn, ok: true, detail: '存在（返回业务提示：' + m + '）' });
        }
      }
    } catch (e) {
      results.push({ name: '函数 ' + fn, ok: false, detail: e.message || String(e) });
    }
  }

  // 存储桶
  try {
    const { error } = await db.storage.from('attachments').list('', { limit: 1 });
    if (error) throw new Error(error.message);
    results.push({ name: '存储桶 attachments', ok: true, detail: '可访问' });
  } catch (e) {
    results.push({ name: '存储桶 attachments', ok: false, detail: e.message || String(e) });
  }

  // 当前用户资料
  if (currentUid()) {
    try {
      const { data, error } = await db.from('profiles').select('id, nickname, is_admin, banned')
        .eq('id', currentUid()).maybeSingle();
      if (error) throw new Error(error.message);
      results.push({
        name: '我的资料行',
        ok: !!data,
        detail: data ? '昵称：' + data.nickname + (data.is_admin ? '（管理员）' : '') : 'profiles 里没有当前用户，注册触发器可能没建'
      });
    } catch (e) {
      results.push({ name: '我的资料行', ok: false, detail: e.message || String(e) });
    }
  } else {
    results.push({ name: '我的资料行', ok: false, detail: '未登录，跳过' });
  }

  // 实时
  try {
    const detail = await new Promise((resolve, reject) => {
      const ch = db.channel('health-' + Date.now());
      const timer = setTimeout(() => {
        db.removeChannel(ch);
        reject(new Error('4 秒内未连上（检查表是否加入 supabase_realtime publication）'));
      }, 4000);
      ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {})
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer); db.removeChannel(ch); resolve('已连接');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer); db.removeChannel(ch); reject(new Error('订阅失败：' + status));
          }
        });
    });
    results.push({ name: '实时订阅', ok: true, detail });
  } catch (e) {
    results.push({ name: '实时订阅', ok: false, detail: e.message || String(e) });
  }

  render();
  running = false;
}

function render() {
  const body = document.getElementById('health-body');
  if (!body) return;

  const failed = results.filter(r => !r.ok).length;

  body.innerHTML = `
    <div class="panel">
      <div class="health-summary ${failed ? 'bad' : 'good'}">
        ${failed ? failed + ' 项未通过' : '全部通过'}
        <span class="muted small">共 ${results.length} 项</span>
      </div>
      <table class="admin-table">
        <thead><tr><th style="width:56px">结果</th><th style="width:220px">项目</th><th>详情</th></tr></thead>
        <tbody>
          ${results.map(r => `<tr>
            <td>${r.ok ? '<span class="chip status-open">通过</span>' : '<span class="chip danger">失败</span>'}</td>
            <td>${esc(r.name)}</td>
            <td class="muted small">${esc(r.detail)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${currentUid() ? `<div class="panel">
      <h2>写入自检（可选）</h2>
      <p class="sub">会创建一条「【自检】可删除」的任务再立即删掉，用来验证写权限；如果删除失败会把任务 ID 显示出来。</p>
      <button class="btn btn-ghost btn-sm" id="writecheck">运行写入自检</button>
      <div id="write-result" style="margin-top:12px"></div>
    </div>` : ''}
  `;

  const wc = document.getElementById('writecheck');
  if (wc) {
    wc.onclick = async () => {
      wc.disabled = true;
      const box = document.getElementById('write-result');
      try {
        const { data, error } = await db.from('tasks').insert({
          owner_id: currentUid(),
          title: '【自检】可删除',
          category: '其他',
          description: '环境自检自动创建，可删除。',
          budget_min: null,
          budget_max: null,
          deadline: null
        }).select('id').single();
        if (error) throw error;

        const { error: e2 } = await db.from('tasks').delete().eq('id', data.id);
        if (e2) throw new Error('创建成功但删除失败，请手动删除任务 ID：' + data.id);
        box.innerHTML = '<span class="chip status-open">通过</span> 任务创建与删除都正常';
      } catch (e) {
        box.innerHTML = `<span class="chip danger">失败</span> ${esc(e.message || String(e))}`;
      }
      wc.disabled = false;
    };
  }
}
