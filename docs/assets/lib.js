/* ============================================================
   公共库：Supabase 客户端、状态、格式化、提示
   ============================================================ */
import { createDemoClient, DEMO as IS_DEMO } from './demo.js';

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

export const CATEGORIES = ['工程类标书', '货物类标书', '服务类标书', '资格预审', '电子标上传', '其他'];

export const TASK_STATUS = {
  pending: '待审核', open: '招募中', matched: '已选定', in_progress: '进行中',
  delivered: '已交付', completed: '已完成', cancelled: '已取消', rejected: '未通过'
};

export const BID_STATUS = {
  submitted: '待选择', accepted: '已中标', rejected: '未中标', withdrawn: '已撤回'
};

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

export async function refreshUnread() {
  if (!currentUid()) { state.unread = 0; return 0; }
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
