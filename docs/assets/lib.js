/* ============================================================
   公共库：Supabase 客户端、状态、格式化、提示
   ============================================================ */
import { createDemoClient, DEMO as IS_DEMO } from './demo.js';
import { DEFAULT_COPY } from './content.js';

const CFG = window.__SUPABASE__ || {};

/** 没有配置 Supabase 时进入演示模式（内存假数据，不联网） */
export const DEMO = IS_DEMO;

export let db = null;

if (DEMO) {
  db = createDemoClient();
} else {
  try {
    // 动态引入：这样演示模式完全不依赖 CDN，断网也能看界面
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    db = createClient(CFG.url, CFG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  } catch (e) {
    console.error('[bidmarket] Supabase SDK 加载失败：', e);
    db = null;
  }
}

export const state = {
  session: null,
  profile: null,
  unread: 0,
  taskChannel: null,
  bellChannel: null
};

export const CATEGORIES = [
  '工程类标书', '货物类标书', '服务类标书',
  '成套报价', '资格预审', '电子标上传', '其他'
];

export const TASK_STATUS = {
  pending: '待审核', open: '招募中', matched: '已选定', in_progress: '进行中',
  delivered: '已交付', completed: '已完成', cancelled: '已取消', rejected: '未通过'
};

export const BID_STATUS = {
  submitted: '待选择', accepted: '已中标', rejected: '未中标', withdrawn: '已撤回'
};

/* ---------- 招聘 ---------- */
export const JOB_CATEGORIES = [
  '标书编制', '造价/预算', '招标代理', '工程资料', '商务投标', '其他'
];

export const JOB_TYPE = {
  fulltime: '全职', parttime: '兼职', remote: '远程', project: '项目制'
};

export const JOB_STATUS = {
  pending: '待审核', open: '招聘中', closed: '已关闭', rejected: '未通过'
};

export const APP_STATUS = {
  submitted: '已投递', viewed: '已查看', invited: '邀面试',
  hired: '已录用', rejected: '不合适', withdrawn: '已撤回'
};

export const JOB_EXPERIENCE = ['不限', '1 年以内', '1-3 年', '3-5 年', '5 年以上'];
export const JOB_EDUCATION = ['不限', '大专', '本科', '硕士及以上'];
export const SALARY_UNIT = { month: '/ 月', day: '/ 天', project: '/ 项目' };

export const STATUS_HINT = {
  pending: '已提交，等待管理员审核。审核通过后会出现在任务大厅。',
  open: '还在招募，等报价。',
  matched: '已选定服务方。中标方可标记交付，发布方可确认完成或取消。',
  delivered: '已标记交付，等待发布方确认。',
  completed: '任务已完成，可以互评。',
  cancelled: '任务已取消。',
  rejected: '未通过审核，可以修改后重新发布。'
};

/* ---------- 文本 ---------- */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function money(n) {
  return (n === null || n === undefined || n === '') ? '面议' : '¥' + Number(n).toLocaleString('zh-CN');
}

export function budgetText(t) {
  if (t.budget_min && t.budget_max && t.budget_min !== t.budget_max) {
    return money(t.budget_min) + ' – ' + money(t.budget_max);
  }
  return money(t.budget_max || t.budget_min);
}

export function dateText(d) {
  if (!d) return '不限';
  const s = String(d);
  return s.length >= 10 ? s.slice(5, 10) : s;
}

/** 今天的 YYYY-MM-DD（本地时区） */
export function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 投标截止时间已过即视为过期；没填截止时间不算过期 */
export function isExpired(t) {
  if (!t || !t.deadline) return false;
  return String(t.deadline).slice(0, 10) < todayStr();
}

/* ---------- 招聘 ---------- */
export function jobCode(id) {
  return 'JOB-' + String(id).replace(/-/g, '').slice(0, 6).toUpperCase();
}

function kNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '面议';
  if (v < 1000) return String(v);
  return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k';
}

/** 列表用：12k–18k / 月，或 面议 */
export function salaryText(j) {
  if (!j) return '面议';
  const min = j.salary_min, max = j.salary_max;
  if (!min && !max) return '面议';
  if (min && max && min !== max) return kNum(min) + '–' + kNum(max);
  return kNum(max || min);
}

/** 详情用：¥12,000 – 18,000 / 月，或 面议 */
export function salaryFull(j) {
  if (!j) return '面议';
  const min = j.salary_min, max = j.salary_max;
  const unit = SALARY_UNIT[j.salary_unit] || '';
  if (!min && !max) return '面议';
  if (min && max && min !== max) {
    return '¥' + Number(min).toLocaleString('zh-CN') + ' – ' +
      Number(max).toLocaleString('zh-CN') + ' ' + unit;
  }
  return '¥' + Number(max || min).toLocaleString('zh-CN') + ' ' + unit;
}

/** 招聘有效期已过（当天仍算有效） */
export function isJobExpired(j) {
  if (!j || !j.expires_at) return false;
  return String(j.expires_at).slice(0, 10) < todayStr();
}

export function employerName(j) {
  if (!j) return '个人';
  const e = j.employer || {};
  return j.company || e.company || e.nickname || '个人';
}

/** 投递状态 → 复用现有 chip 配色 */
export function appChipClass(status) {
  if (status === 'hired') return 'status-open';
  if (status === 'invited') return 'status-matched';
  if (status === 'viewed') return 'status-delivered';
  if (status === 'rejected') return 'status-rejected';
  if (status === 'withdrawn') return 'status-completed';
  return 'status-pending';
}


export function timeText(s) {
  if (!s) return '';
  const d = new Date(s);
  const now = new Date();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return hm;
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + hm;
}

export function fullTime(s) {
  if (!s) return '';
  const d = new Date(s);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export function sizeText(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function stars(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

/* ---------- 提示 ---------- */
let toastTimer = null;
export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3400);
}

export function zhError(msg = '') {
  const m = String(msg);
  if (/Invalid login credentials/i.test(m)) return '账号或密码不正确';
  if (/invalid.*email|email.*invalid|Unable to validate email/i.test(m)) {
    return '账号格式不被接受，请改用真实邮箱注册';
  }
  if (/User already registered/i.test(m)) return '该账号已注册，请直接登录';
  if (/Password should be at least/i.test(m)) return '密码至少 6 位';
  if (/Email not confirmed/i.test(m)) return '账号未确认，请检查邮箱';
  if (/JWT|not authenticated/i.test(m)) return '登录状态已过期，请重新登录';
  if (/duplicate key/i.test(m)) return '已经提交过了';
  if (/row-level security/i.test(m)) return '没有权限执行这个操作';
  if (/new row violates check constraint/i.test(m)) return '内容不符合要求，请检查后重试';
  if (/Failed to fetch|NetworkError/i.test(m)) return '网络异常，请稍后重试';
  if (/请先完善在线简历/.test(m)) return '请先建一份在线简历再投递';
  if (/已经投递过/.test(m)) return '你已经投递过这个岗位了';
  if (/暂不接受重复投递/.test(m)) return '对方已处理过你的投递，暂不能再投';
  if (/未上线或已关闭/.test(m)) return '该岗位已关闭或还没上线';
  if (/岗位已过期/.test(m)) return '该岗位已过有效期';
  if (/先邀面试/.test(m)) return '请先邀面试，再确认录用';
  return m || '操作失败，请重试';
}

export function toEmail(account) {
  const a = String(account).trim();
  return a.includes('@') ? a : a + '@example.com';
}

/* ---------- 登录态 ---------- */
export function currentUid() {
  return (state.session && state.session.user) ? state.session.user.id : null;
}

export async function loadProfile() {
  const uid = currentUid();
  if (!uid) { state.profile = null; return null; }
  const { data } = await db.from('profiles').select('*').eq('id', uid).maybeSingle();
  state.profile = data || null;
  return state.profile;
}

/** 首页文案：后台可改，没填的字段回退到默认值 */
export async function loadSiteCopy() {
  const out = { ...DEFAULT_COPY };
  try {
    const { data } = await db.from('site_settings')
      .select('*')
      .eq('id', 1).maybeSingle();
    if (data) {
      for (const k of Object.keys(out)) {
        if (data[k] != null && String(data[k]).trim() !== '') out[k] = String(data[k]);
      }
    }
  } catch { /* 表还没建时用默认值 */ }
  return out;
}

export async function refreshUnread() {  if (!currentUid()) { state.unread = 0; return 0; }
  const { count } = await db.from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  state.unread = count || 0;
  return state.unread;
}

export function needLogin(msg) {
  if (currentUid()) return true;
  toast(msg || '请先登录', 'error');
  location.hash = '#/login';
  return false;
}

export async function signOut() {
  await db.auth.signOut();
  state.session = null;
  state.profile = null;
  state.unread = 0;
}

/* ---------- 附件 ---------- */
const MAX_SIZE = 20 * 1024 * 1024;

export async function uploadAttachment(taskId, file, kind = 'task') {
  if (!currentUid()) throw new Error('请先登录');
  if (file.size > MAX_SIZE) throw new Error('单个文件不能超过 20MB');

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
  const path = taskId + '/' + crypto.randomUUID() + '.' + ext;

  const { error: upErr } = await db.storage.from('attachments')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;

  const { error } = await db.from('files').insert({
    task_id: taskId,
    uploader_id: currentUid(),
    kind,
    path,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream'
  });
  if (error) throw error;
}

export async function fileUrl(path) {
  const { data, error } = await db.storage.from('attachments')
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadFile(path) {
  try {
    const url = await fileUrl(path);
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    toast(zhError(e.message || e), 'error');
  }
}

export async function deleteAttachment(f) {
  await db.storage.from('attachments').remove([f.path]).catch(() => {});
  const { error } = await db.from('files').delete().eq('id', f.id);
  if (error) throw error;
}

/* ---------- 小工具 ---------- */
export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function debounce(fn, ms = 260) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// 由 app.js 注入，避免循环依赖
export let render = () => {};
export function setRenderer(fn) { render = fn; }
