#!/usr/bin/env node
/**
 * 端到端冒烟测试：真实注册两个账号，把一个任务从发布走到互评
 *
 *   node tools/smoke.mjs
 *
 * 会创建：2 个测试用户（smoke...@example.com）、1 个任务、2 条报价、消息、互评。
 * 测完可以在 Supabase → Authentication → Users 里把 smoke 开头的用户删掉，
 * 相关任务/报价/消息/评价会级联删除。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'docs/assets/config.js'), 'utf8');
const URL_BASE = (src.match(/url:\s*['"]([^'"]+)['"]/) || [])[1];
const KEY = (src.match(/anonKey:\s*['"]([^'"]+)['"]/) || [])[1];

if (!URL_BASE || !KEY) {
  console.error('config.js 里没有 URL / anonKey');
  process.exit(1);
}

const stamp = Date.now().toString(36);
const emailA = `smoke-a-${stamp}@example.com`;
const emailB = `smoke-b-${stamp}@example.com`;
const PASS = 'Test123456!';

const results = [];
const step = (ok, name, detail = '') => {
  results.push({ ok, name });
  console.log(`${ok ? '[通过]' : '[失败]'} ${name}${detail ? '  ' + detail : ''}`);
};

async function call(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = {
    apikey: KEY,
    'Content-Type': 'application/json'
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(URL_BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

async function signup(email, nickname) {
  const r = await call('/auth/v1/signup', {
    method: 'POST',
    body: { email, password: PASS, data: { nickname } }
  });
  return r;
}

async function login(email) {
  const r = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password: PASS }
  });
  return r.json && r.json.access_token;
}

async function main() {
  console.log('项目：' + URL_BASE + '\n');

  const sa = await signup(emailA, '冒烟-需求方');
  if (sa.status >= 300) { step(false, '注册用户 A', JSON.stringify(sa.json).slice(0, 160)); return done(); }
  if (!sa.json.access_token) {
    step(false, '注册用户 A', '注册成功但没有 session —— Confirm email 还开着');
    return done();
  }
  step(true, '注册用户 A', emailA);

  const sb = await signup(emailB, '冒烟-服务方');
  if (sb.status >= 300) { step(false, '注册用户 B', JSON.stringify(sb.json).slice(0, 160)); return done(); }
  step(true, '注册用户 B', emailB);

  const tokenA = sa.json.access_token;
  const tokenB = sb.json.access_token;
  const uidA = sa.json.user.id;
  const uidB = sb.json.user.id;

  // 触发器是否建了资料行
  const pa = await call(`/rest/v1/profiles?select=id,nickname&id=eq.${uidA}`, { token: tokenA });
  step(Array.isArray(pa.json) && pa.json.length === 1, '注册触发器生成 profiles 行',
    Array.isArray(pa.json) && pa.json[0] ? pa.json[0].nickname : '');

  // A 发任务
  const task = await call('/rest/v1/tasks', {
    method: 'POST',
    token: tokenA,
    prefer: 'return=representation',
    body: {
      owner_id: uidA,
      title: `【冒烟】标书编制 ${stamp}`,
      category: '其他',
      budget_min: 1000,
      budget_max: 2000,
      description: '自动冒烟测试任务，可删除。'
    }
  });
  if (task.status >= 300) { step(false, '发布任务', JSON.stringify(task.json).slice(0, 200)); return done(); }
  const taskId = task.json[0].id;
  step(true, '发布任务', taskId.slice(0, 8));

  // B 能看到
  const list = await call('/rest/v1/tasks?select=id&status=eq.open', { token: tokenB });
  step(Array.isArray(list.json) && list.json.some(x => x.id === taskId), 'B 在任务大厅看到该任务');

  // B 报价
  const bid = await call('/rest/v1/bids', {
    method: 'POST',
    token: tokenB,
    prefer: 'return=representation',
    body: { task_id: taskId, provider_id: uidB, amount: 1500, eta_days: 2, plan: '冒烟测试方案' }
  });
  if (bid.status >= 300) { step(false, '提交报价', JSON.stringify(bid.json).slice(0, 200)); return done(); }
  const bidId = bid.json[0].id;
  step(true, '提交报价', bidId.slice(0, 8));

  // A 能看报价，B 看不到别的（这里只看 A）
  const bidsA = await call(`/rest/v1/bids?select=id&task_id=eq.${taskId}`, { token: tokenA });
  step(Array.isArray(bidsA.json) && bidsA.json.length === 1, '发布方能查看报价');

  // A 选定
  const acc = await call('/rest/v1/rpc/accept_bid', { method: 'POST', token: tokenA, body: { p_bid_id: bidId } });
  step(acc.status < 300, '选定报价 accept_bid', acc.status >= 300 ? JSON.stringify(acc.json).slice(0, 160) : '');

  // B 标记交付
  const del = await call('/rest/v1/rpc/mark_delivered', { method: 'POST', token: tokenB, body: { p_task: taskId } });
  step(del.status < 300, '标记交付 mark_delivered', del.status >= 300 ? JSON.stringify(del.json).slice(0, 160) : '');

  // A 确认完成
  const fin = await call('/rest/v1/rpc/confirm_complete', { method: 'POST', token: tokenA, body: { p_task: taskId } });
  step(fin.status < 300, '确认完成 confirm_complete', fin.status >= 300 ? JSON.stringify(fin.json).slice(0, 160) : '');

  // 互评
  const rv = await call('/rest/v1/rpc/submit_review', {
    method: 'POST', token: tokenA, body: { p_task: taskId, p_score: 5, p_body: '冒烟测试评价' }
  });
  step(rv.status < 300, '提交评价 submit_review', rv.status >= 300 ? JSON.stringify(rv.json).slice(0, 160) : '');

  // 评分是否更新
  const pr = await call(`/rest/v1/profiles?select=rating&id=eq.${uidB}`, { token: tokenA });
  step(Array.isArray(pr.json) && Number(pr.json[0].rating) === 5, '评分自动累计', pr.json ? String(pr.json[0].rating) : '');

  // 通知是否生成
  const nt = await call('/rest/v1/notifications?select=id&limit=5', { token: tokenB });
  step(Array.isArray(nt.json) && nt.json.length > 0, '通知触发器写入', (nt.json || []).length + ' 条');

  // 消息
  const msg = await call('/rest/v1/messages', {
    method: 'POST', token: tokenB, prefer: 'return=representation',
    body: { task_id: taskId, sender_id: uidB, body: '冒烟测试消息' }
  });
  step(msg.status < 300, '发送站内消息', msg.status >= 300 ? JSON.stringify(msg.json).slice(0, 160) : '');

  // 越权检查：B 不该能删 A 的任务
  const bad = await call(`/rest/v1/tasks?id=eq.${taskId}`, { method: 'DELETE', token: tokenB });
  const stillThere = await call(`/rest/v1/tasks?select=id&id=eq.${taskId}`, { token: tokenA });
  step(Array.isArray(stillThere.json) && stillThere.json.length === 1, '越权删除被 RLS 拒绝');

  done();
}

function done() {
  const bad = results.filter(r => !r.ok);
  console.log('\n----------------------------------------');
  console.log(bad.length ? `${bad.length} 项失败，共 ${results.length} 项` : `全部通过（${results.length} 项）`);
  if (bad.length) bad.forEach(r => console.log(' - ' + r.name));
  else console.log('\n测试数据可以保留，也可以在 Authentication → Users 删掉 smoke 开头的两个账号。');
  process.exitCode = bad.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
