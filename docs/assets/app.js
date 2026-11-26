/* ============================================================
   入口：路由 + 登录态 + 实时通知
   ============================================================ */
import {
  db, state, loadProfile, refreshUnread, setRenderer, toast
} from './lib.js';
import { DEMO, demoApi } from './demo.js';
import { renderHeader } from './ui.js';
import { viewHome, viewTasks, viewTask, viewPublish, viewEdit, leaveTask } from './views-feed.js';
import { viewLogin, viewRegister, viewReset, viewMe, viewSettings, viewNotifications } from './views-auth.js';
import { viewAdmin, viewHow, viewNotFound } from './views-admin.js';
import { viewHealth } from './views-health.js';

const app = () => document.getElementById('app');

/* ---------- 路由 ---------- */
function routeInfo() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const seg = path.split('/').filter(Boolean);
  return { page: seg[0] || 'home', param: seg[1] || '', param2: seg[2] || '' };
}

async function render() {
  leaveTask();
  if (!db) { renderSetup(); return; }

  const { page, param, param2 } = routeInfo();

  try {
    if (page === 'home') await viewHome();
    else if (page === 'tasks') await viewTasks();
    else if (page === 'task') {
      if (param2 === 'edit') await viewEdit(param);
      else await viewTask(param);
    }
    else if (page === 'publish') await viewPublish();
    else if (page === 'login') viewLogin();
    else if (page === 'register') viewRegister();
    else if (page === 'reset') viewReset();
    else if (page === 'me') await viewMe();
    else if (page === 'settings') await viewSettings();
    else if (page === 'notifications') await viewNotifications();
    else if (page === 'admin') await viewAdmin();
    else if (page === 'health') await viewHealth();
    else if (page === 'setup') renderSetup();
    else if (page === 'how') viewHow();
    else viewNotFound();
    window.scrollTo(0, 0);
  } catch (e) {
    app().innerHTML = `<div class="panel"><h2>出错了</h2>
      <p class="muted">${(e.message || String(e)).replace(/[<>&]/g, '')}</p>
      <a class="btn btn-ghost" href="#/">回首页</a></div>`;
  }
}

setRenderer(render);

/* ---------- 通知订阅 ---------- */
function subscribeBell() {
  if (state.bellChannel) {
    db.removeChannel(state.bellChannel);
    state.bellChannel = null;
  }
  const uid = state.session && state.session.user ? state.session.user.id : null;
  if (!uid) return;

  state.bellChannel = db.channel('bell-' + uid)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
      (payload) => {
        state.unread = (state.unread || 0) + 1;
        renderHeader();
        if (payload.new && payload.new.body) toast(payload.new.body);
      })
    .subscribe();
}

/* ---------- 演示模式横幅 ---------- */
function renderDemoBar() {
  if (!DEMO || document.getElementById('demo-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'demo-bar';
  bar.className = 'demo-bar';
  bar.innerHTML = `
    <span class="demo-tag">演示模式</span>
    <span class="demo-text">内存假数据，刷新即重置 · 当前身份 <b id="demo-who">—</b></span>
    <span class="demo-actions">
      <button class="btn btn-sm" data-demo="u1">发布方 · 张工</button>
      <button class="btn btn-sm" data-demo="u2">服务方 · 李工</button>
      <button class="btn btn-sm" data-demo="u3">未认证 · 王工</button>
      <a class="btn btn-sm" href="#/setup">接入真实数据库</a>
    </span>`;
  document.body.prepend(bar);
  document.body.classList.add('has-demo-bar');

  const whoLabel = () => {
    const el = document.getElementById('demo-who');
    const u = demoApi.users().find(x => x.id === demoApi.currentId());
    if (el) el.textContent = u ? u.nickname : '未登录';
  };
  whoLabel();

  bar.querySelectorAll('[data-demo]').forEach(btn => {
    btn.onclick = async () => {
      demoApi.switchUser(btn.dataset.demo);
      await loadProfile();
      await refreshUnread();
      renderHeader();
      whoLabel();
      await render();
    };
  });
}

/* ---------- 配置说明 ---------- */
function renderSetup() {
  app().innerHTML = `
    <div class="panel">
      <h2>接入真实数据库</h2>
      <p class="sub">当前是演示模式，数据只存在浏览器内存里。按下面几步接上 Supabase，就是正式环境。</p>
      <ol class="muted" style="line-height:2.1">
        <li>到 <b>supabase.com</b> 建一个免费项目（区域选 Singapore / Tokyo）</li>
        <li>Dashboard → SQL Editor，把 <code>supabase/schema.sql</code> 整段执行</li>
        <li>Authentication → Providers → Email，关闭 <b>Confirm email</b></li>
        <li>Project Settings → API，复制 <b>Project URL</b> 和 <b>anon public key</b></li>
        <li>填进 <code>docs/assets/config.js</code>，刷新页面</li>
      </ol>
      <div class="alert alert-info" style="margin-top:18px">
        如果填完配置页面打不开，多半是 <code>cdn.jsdelivr.net</code> 被网络拦截，
        把 <code>assets/lib.js</code> 里的 CDN 换成 <code>https://esm.sh/@supabase/supabase-js@2</code>。
      </div>
      ${DEMO ? '<a class="btn btn-ghost" href="#/">← 回到演示</a>' : '<a class="btn btn-primary" href="#/health">环境自检 →</a>'}
    </div>`;
}

/* ---------- 启动 ---------- */
async function boot() {
  if (!db) { renderSetup(); return; }

  renderDemoBar();

  // 找回密码 / 邀请链接回跳：清掉 token，落到设置页
  if (!DEMO) {
    const urlAll = location.hash + ' ' + location.search;
    if (/access_token=|type=recovery|[?&]code=/.test(urlAll)) {
      history.replaceState(null, '', location.pathname + '#/settings');
    }
  }

  const { data } = await db.auth.getSession();
  state.session = data.session;
  await loadProfile();
  await refreshUnread();
  renderHeader();
  subscribeBell();

  db.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') {
      location.hash = '#/settings';
    }
    setTimeout(async () => {
      await loadProfile();
      await refreshUnread();
      renderHeader();
      subscribeBell();
    }, 0);
  });

  window.addEventListener('hashchange', render);
  await render();
}

boot();
