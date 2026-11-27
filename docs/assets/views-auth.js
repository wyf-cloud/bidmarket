/* ============================================================
   页面：注册 / 登录 / 找回密码 / 我的 / 设置 / 通知
   ============================================================ */
import {
  db, state, esc, toast, zhError, toEmail, currentUid, loadProfile,
  refreshUnread, needLogin, signOut, dateText, timeText, fullTime,
  TASK_STATUS, BID_STATUS, APP_STATUS, JOB_STATUS, money, stars, salaryFull, employerName
} from './lib.js';
import { taskCard, jobCard, empty, renderHeader, ratingLine } from './ui.js';

const app = () => document.getElementById('app');

async function afterAuth() {
  await loadProfile();
  await refreshUnread();
  renderHeader();
}

/* ============================================================
   注册
   ============================================================ */
export function viewRegister() {
  app().innerHTML = `
    <div class="panel narrow">
      <h2>注册账号</h2>
      <p class="sub">账号可以是手机号或邮箱，密码直接注册，不需要验证码。</p>
      <div id="reg-err"></div>
      <form id="reg-form">
        <div class="field"><label>账号</label>
          <input name="account" required autocomplete="username" placeholder="手机号或邮箱">
          <div class="hint">建议填邮箱：只有真实邮箱才能自助找回密码。</div></div>
        <div class="field"><label>昵称</label>
          <input name="nickname" required maxlength="20" placeholder="展示在任务和报价里"></div>
        <div class="field"><label>密码</label>
          <input name="password" type="password" required minlength="6"
                 autocomplete="new-password" placeholder="至少 6 位"></div>
        <button class="btn btn-primary btn-block" type="submit">注册并登录</button>
      </form>
      <p class="muted small" style="margin-top:16px">
        已有账号？<a href="#/login">去登录</a>
      </p>
    </div>`;

  const form = document.getElementById('reg-form');
  const errBox = document.getElementById('reg-err');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { data, error } = await db.auth.signUp({
      email: toEmail(String(fd.get('account')).trim()),
      password: String(fd.get('password')),
      options: { data: { nickname: String(fd.get('nickname')).trim() } }
    });
    btn.disabled = false;

    if (error) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(zhError(error.message))}</div>`;
      return;
    }
    if (!data.session) {
      errBox.innerHTML = `<div class="alert alert-info">
        注册成功，但项目开启了邮箱确认。请到 Supabase 关闭 Confirm email，或先查收邮件。</div>`;
      return;
    }
    state.session = data.session;
    await afterAuth();
    toast('注册成功');
    location.hash = '#/tasks';
  };
}

/* ============================================================
   登录
   ============================================================ */
export function viewLogin() {
  app().innerHTML = `
    <div class="panel narrow">
      <h2>登录</h2>
      <p class="sub">用注册时的账号和密码登录。</p>
      <div id="login-err"></div>
      <form id="login-form">
        <div class="field"><label>账号</label>
          <input name="account" required autocomplete="username" placeholder="手机号或邮箱"></div>
        <div class="field"><label>密码</label>
          <input name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block" type="submit">登录</button>
      </form>
      <p class="muted small" style="margin-top:16px">
        忘记密码？<a href="#/reset">找回</a> · 还没有账号？<a href="#/register">去注册</a>
      </p>
    </div>`;

  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-err');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { data, error } = await db.auth.signInWithPassword({
      email: toEmail(String(fd.get('account')).trim()),
      password: String(fd.get('password'))
    });
    btn.disabled = false;
    if (error) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(zhError(error.message))}</div>`;
      return;
    }
    state.session = data.session;
    await afterAuth();
    toast('已登录');
    location.hash = '#/me';
  };
}

/* ============================================================
   找回密码
   ============================================================ */
export function viewReset() {
  app().innerHTML = `
    <div class="panel narrow">
      <h2>找回密码</h2>
      <p class="sub">输入注册时用的真实邮箱，会收到一封重置链接。</p>
      <div id="reset-msg"></div>
      <form id="reset-form">
        <div class="field"><label>邮箱</label>
          <input name="email" type="email" required placeholder="you@example.com">
          <div class="hint">如果注册时填的是手机号（内部邮箱 @example.com），收不到邮件，
            请联系管理员在后台重置。</div></div>
        <button class="btn btn-primary btn-block" type="submit">发送重置邮件</button>
      </form>
      <p class="muted small" style="margin-top:16px"><a href="#/login">返回登录</a></p>
    </div>`;

  const form = document.getElementById('reset-form');
  const msg = document.getElementById('reset-msg');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email')).trim();
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { error } = await db.auth.resetPasswordForEmail(email, {
      // 不要带 #/settings：Supabase 会在后面拼 #access_token，带 hash 会拼坏
      redirectTo: location.origin + location.pathname
    });
    btn.disabled = false;
    if (error) {
      msg.innerHTML = `<div class="alert alert-error">${esc(zhError(error.message))}</div>`;
      return;
    }
    msg.innerHTML = `<div class="alert alert-info">
      如果该邮箱已注册，重置邮件会在几分钟内送达。点开链接后回到本站设置新密码。</div>`;
  };
}

/* ============================================================
   我的
   ============================================================ */
export async function viewMe() {
  if (!needLogin('请先登录')) return;
  const p = state.profile || {};

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>${esc(p.nickname || '我的')}
          ${p.verified ? '<span class="chip">已认证</span>' : ''}
          ${p.banned ? '<span class="chip danger">已被封禁</span>' : ''}
        </h2>
        <div>
          <a class="btn btn-ghost btn-sm" href="#/resume">我的简历</a>
          <a class="btn btn-ghost btn-sm" href="#/settings">资料设置</a>
          <a class="btn btn-primary btn-sm" href="#/publish">发布任务</a>
        </div>
      </div>
      ${p.banned ? '<div class="alert alert-error">账号已被封禁，无法发布任务、报价、投递或发消息。</div>' : ''}
      <div class="profile-strip">
        <span>评分 ${ratingLine(p)}</span>
        ${p.company ? `<span>${esc(p.company)}</span>` : ''}
        <span class="muted small">${esc(p.bio || '还没有填写简介')}</span>
      </div>
      <div class="tabs">
        <button data-tab="published" class="active">我发布的任务</button>
        <button data-tab="bids">我提交的报价</button>
        <button data-tab="taken">我接的单</button>
        <button data-tab="jobs">我发布的岗位</button>
        <button data-tab="apps">我的投递</button>
      </div>
      <div id="me-list"><div class="empty">加载中…</div></div>
    </section>`;

  const listEl = document.getElementById('me-list');
  const tabs = Array.from(document.querySelectorAll('.tabs button'));
  const uid = currentUid();

  async function loadPublished() {
    const { data, error } = await db.from('tasks')
      .select('*, owner:profiles(nickname, verified, rating)')
      .eq('owner_id', uid).order('created_at', { ascending: false });
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }
    listEl.innerHTML = data.length
      ? `<div class="task-grid">${data.map(taskCard).join('')}</div>`
      : empty('还没发布过任务。', '<a class="btn btn-primary btn-sm" href="#/publish">去发布</a>');
  }

  async function loadBids(onlyAccepted) {
    let q = db.from('bids')
      .select('*, task:tasks(id,title,status)')
      .eq('provider_id', uid)
      .order('created_at', { ascending: false });
    if (onlyAccepted) q = q.in('status', ['accepted']);
    const { data, error } = await q;
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }
    if (!data.length) {
      listEl.innerHTML = empty(onlyAccepted ? '还没有接过单。' : '还没报过价。',
        '<a class="btn btn-ghost btn-sm" href="#/tasks">去任务大厅</a>');
      return;
    }
    listEl.innerHTML = `<div class="task-grid">${data.map(b => `
      <a class="card" href="#/task/${esc(b.task_id)}">
        <div class="task-top">
          <span class="chip">${esc(BID_STATUS[b.status] || b.status)}</span>
          <span class="chip">${esc(b.task ? (TASK_STATUS[b.task.status] || b.task.status) : '—')}</span>
        </div>
        <h3>${esc(b.task ? b.task.title : '任务已不可见')}</h3>
        <div class="task-foot">
          <strong>${money(b.amount)}</strong>
          <span class="muted">${b.eta_days ? b.eta_days + ' 天' : '工期未填'}</span>
        </div>
      </a>`).join('')}</div>`;
  }

  async function loadMyJobs() {
    const { data, error } = await db.from('job_posts')
      .select('*, employer:profiles(nickname, company, verified)')
      .eq('employer_id', uid).order('created_at', { ascending: false });
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }
    const rows = data || [];
    if (!rows.length) {
      listEl.innerHTML = empty('还没发布过岗位。',
        '<a class="btn btn-primary btn-sm" href="#/jobs/new">发布岗位</a>');
      return;
    }
    let counts = {};
    const r = await db.from('job_applications').select('job_id').in('job_id', rows.map(j => j.id));
    (r.data || []).forEach(a => { counts[a.job_id] = (counts[a.job_id] || 0) + 1; });
    listEl.innerHTML = `<div class="task-grid">${rows.map(j => jobCard(j, { count: counts[j.id] || 0 })).join('')}</div>`;
  }

  async function loadMyApps() {
    const { data, error } = await db.from('job_applications').select('*')
      .eq('applicant_id', uid).order('created_at', { ascending: false });
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }
    const rows = data || [];
    if (!rows.length) {
      listEl.innerHTML = empty('还没投递过岗位。',
        '<a class="btn btn-ghost btn-sm" href="#/jobs">去招聘大厅</a>');
      return;
    }
    const ids = [...new Set(rows.map(a => a.job_id))];
    const jr = await db.from('job_posts')
      .select('*, employer:profiles(nickname, company)').in('id', ids);
    const jobs = {};
    (jr.data || []).forEach(j => { jobs[j.id] = j; });

    listEl.innerHTML = `<div class="task-grid">${rows.map(a => {
      const j = jobs[a.job_id] || {};
      return `<a class="card" href="#/application/${esc(a.id)}">
        <div class="task-top">
          <span class="chip ${a.status === 'hired' ? 'status-open' : a.status === 'invited' ? 'status-matched' : a.status === 'rejected' ? 'status-rejected' : 'status-pending'}">${esc(APP_STATUS[a.status] || a.status)}</span>
          <span class="chip">${esc(JOB_STATUS[j.status] || '岗位已删除')}</span>
        </div>
        <h3>${esc(j.title || '岗位已不可见')}</h3>
        <p class="muted small">${esc(employerName(j))} · ${esc(j.city || '—')}</p>
        <div class="task-foot">
          <strong>${esc(salaryFull(j))}</strong>
          <span>${esc(dateText(a.created_at))} 投递</span>
        </div>
      </a>`;
    }).join('')}</div>`;
  }

  tabs.forEach(btn => {
    btn.onclick = async () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'published') await loadPublished();
      else if (tab === 'bids') await loadBids(false);
      else if (tab === 'taken') await loadBids(true);
      else if (tab === 'jobs') await loadMyJobs();
      else await loadMyApps();
    };
  });

  await loadPublished();
}

/* ============================================================
   资料设置
   ============================================================ */
export async function viewSettings() {
  if (!needLogin('请先登录')) return;
  await loadProfile();
  const p = state.profile || {};
  const { data: contact } = await db.from('profile_contacts')
    .select('*').eq('user_id', currentUid()).maybeSingle();
  const c = contact || {};
  const email = (state.session && state.session.user) ? state.session.user.email : '';
  const synthetic = /@bid\.local$/i.test(email || '');

  app().innerHTML = `
    <div class="panel">
      <h2>资料设置</h2>
      <p class="sub">这些信息会展示在任务页和报价里，联系方式只有在你们选定彼此后才有意义，请自行判断是否公开。</p>
      <div id="set-msg"></div>
      <form id="profile-form">
        <div class="row">
          <div class="field"><label>昵称</label>
            <input name="nickname" required maxlength="20" value="${esc(p.nickname || '')}"></div>
          <div class="field"><label>手机号（可选，仅自己和管理员可见）</label>
            <input name="phone" maxlength="20" value="${esc(c.phone || '')}"></div>
        </div>
        <div class="field"><label>微信号（可选，仅自己和管理员可见）</label>
          <input name="wechat" maxlength="40" value="${esc(c.wechat || '')}"></div>
        <div class="field"><label>公司 / 团队名（可选，发布岗位时展示）</label>
          <input name="company" maxlength="40" value="${esc(p.company || '')}" placeholder="例如 宏远建设有限公司"></div>
        <div class="field"><label>简介（可选）</label>
          <textarea name="bio" maxlength="300" placeholder="做过哪些类型的标书、擅长行业…">${esc(p.bio || '')}</textarea></div>
        <button class="btn btn-primary" type="submit">保存资料</button>
      </form>
    </div>

    <div class="panel">
      <h2>修改密码</h2>
      <p class="sub">当前账号：${esc(email || '—')}${synthetic ? '（手机号注册，收不到重置邮件）' : ''}</p>
      <form id="pwd-form">
        <div class="row">
          <div class="field"><label>新密码</label>
            <input name="password" type="password" required minlength="6" autocomplete="new-password"></div>
          <div class="field"><label>确认新密码</label>
            <input name="password2" type="password" required minlength="6" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-primary" type="submit">更新密码</button>
      </form>
    </div>

    <div class="panel">
      <h2>其他</h2>
      <p class="muted small">注销会退出登录，账号数据不会自动删除。如需删除账号联系管理员。</p>
      <button class="btn btn-ghost" id="logout2">退出登录</button>
    </div>`;

  document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;

    const { error } = await db.from('profiles').update({
      nickname: String(fd.get('nickname')).trim(),
      company: String(fd.get('company') || '').trim() || null,
      bio: String(fd.get('bio') || '').trim() || null
    }).eq('id', currentUid());

    if (error) { btn.disabled = false; toast(zhError(error.message), 'error'); return; }

    const { error: ce } = await db.from('profile_contacts').upsert({
      user_id: currentUid(),
      phone: String(fd.get('phone') || '').trim() || null,
      wechat: String(fd.get('wechat') || '').trim() || null,
      updated_at: new Date().toISOString()
    });
    btn.disabled = false;
    if (ce) { toast(zhError(ce.message), 'error'); return; }

    await loadProfile();
    renderHeader();
    toast('资料已保存');
  };

  document.getElementById('pwd-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pwd = String(fd.get('password'));
    if (pwd !== String(fd.get('password2'))) { toast('两次输入的密码不一致', 'error'); return; }
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await db.auth.updateUser({ password: pwd });
    btn.disabled = false;
    if (error) { toast(zhError(error.message), 'error'); return; }
    e.target.reset();
    toast('密码已更新');
  };

  document.getElementById('logout2').onclick = async () => {
    await signOut();
    renderHeader();
    location.hash = '#/';
  };
}

/* ============================================================
   通知
   ============================================================ */
function notifHref(n) {
  if (n.application_id) return '#/application/' + n.application_id;
  if (n.job_id) return '#/job/' + n.job_id;
  if (n.task_id) return '#/task/' + n.task_id;
  return '#/notifications';
}

export async function viewNotifications() {
  if (!needLogin('请先登录')) return;

  const { data, error } = await db.from('notifications')
    .select('*').order('created_at', { ascending: false }).limit(100);
  if (error) { app().innerHTML = empty(zhError(error.message)); return; }
  const list = data || [];

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>通知</h2>
        <button class="btn btn-ghost btn-sm" id="read-all">全部标为已读</button>
      </div>
      ${list.length ? `<div class="notice-list">
        ${list.map(n => `<a class="notice ${n.read_at ? '' : 'unread'}" href="${esc(notifHref(n))}" data-id="${esc(n.id)}">
          <span class="notice-dot"></span>
          <span class="notice-body">${esc(n.body)}</span>
          <span class="muted small">${fullTime(n.created_at)}</span>
        </a>`).join('')}
      </div>` : empty('还没有通知。')}
    </section>`;

  document.querySelectorAll('.notice').forEach(a => {
    a.onclick = async () => {
      await db.from('notifications')
        .update({ read_at: new Date().toISOString() }).eq('id', a.dataset.id);
      await refreshUnread();
      renderHeader();
    };
  });

  const readAll = document.getElementById('read-all');
  if (readAll) {
    readAll.onclick = async () => {
      const { error: e2 } = await db.from('notifications')
        .update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (e2) { toast(zhError(e2.message), 'error'); return; }
      await refreshUnread();
      renderHeader();
      await viewNotifications();
    };
  }
}
