#!/usr/bin/env node
/**
 * 环境自检（命令行版，不需要浏览器）
 *
 * 用法：
 *   node tools/check.mjs --url https://xxx.supabase.co --key eyJhbGci...
 *   node tools/check.mjs                 # 自动读 docs/assets/config.js
 *
 * 检查：配置、9 张表、5 个数据库函数、存储桶、Auth 服务
 * 退出码：0 全通过，1 有失败项
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback = '') => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

function readConfig() {
  try {
    const src = readFileSync(join(root, 'docs/assets/config.js'), 'utf8');
    return {
      url: (src.match(/url:\s*['"]([^'"]*)['"]/) || [])[1] || '',
      key: (src.match(/anonKey:\s*['"]([^'"]*)['"]/) || [])[1] || ''
    };
  } catch {
    return { url: '', key: '' };
  }
}

const cfg = readConfig();
const URL_BASE = (argOf('url', process.env.SUPABASE_URL || cfg.url) || '').replace(/\/+$/, '');
const ANON = argOf('key', process.env.SUPABASE_ANON_KEY || cfg.key);

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

const results = [];
const push = (ok, name, detail) => {
  results.push({ ok, name, detail });
  const tag = ok ? '[通过]' : '[失败]';
  console.log(`${tag} ${name.padEnd(26)} ${detail}`);
};

async function req(path, { method = 'GET', body, extra = {} } = {}) {
  const res = await fetch(URL_BASE + path, {
    method,
    headers: {
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
      'Content-Type': 'application/json',
      ...extra
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

async function main() {
  console.log('目标：' + (URL_BASE || '（未配置）') + '\n');

  if (!URL_BASE || !ANON) {
    push(false, '配置', '缺少 URL 或 anon key，先填 docs/assets/config.js');
    return finish();
  }
  push(true, '配置', 'URL 与 anon key 已提供');

  // Auth 服务
  try {
    const r = await req('/auth/v1/settings');
    push(r.status === 200, 'Auth 服务', 'HTTP ' + r.status);
  } catch (e) {
    push(false, 'Auth 服务', e.message);
  }

  // 数据表
  for (const t of TABLES) {
    try {
      const r = await req(`/rest/v1/${t}?select=*&limit=0`);
      if (r.status === 404) push(false, '表 ' + t, '不存在（schema.sql 没执行完整）');
      else if (r.status === 401 || r.status === 403) push(false, '表 ' + t, 'HTTP ' + r.status + '：anon key 不对或没有权限');
      else push(r.status < 300, '表 ' + t, 'HTTP ' + r.status);
    } catch (e) {
      push(false, '表 ' + t, e.message);
    }
  }

  // 数据库函数
  for (const [fn, params] of RPCS) {
    try {
      const r = await req('/rest/v1/rpc/' + fn, { method: 'POST', body: params });
      const msg = (r.json && (r.json.message || r.json.error_description)) || '';
      if (r.status === 404 && /Could not find the function|does not exist/i.test(msg)) {
        push(false, '函数 ' + fn, '不存在');
      } else if (r.status === 404) {
        push(false, '函数 ' + fn, 'HTTP 404：' + (msg || '未知'));
      } else {
        push(true, '函数 ' + fn, '存在（HTTP ' + r.status + (msg ? '：' + msg : '') + '）');
      }
    } catch (e) {
      push(false, '函数 ' + fn, e.message);
    }
  }

  // 存储桶
  try {
    const r = await req('/storage/v1/object/list/attachments', {
      method: 'POST',
      body: { prefix: '', limit: 1, offset: 0 }
    });
    const msg = (r.json && (r.json.error || r.json.message)) || '';
    if (r.status === 404 && /Bucket not found/i.test(msg)) push(false, '存储桶 attachments', '不存在');
    else push(r.status < 300, '存储桶 attachments', 'HTTP ' + r.status + (msg ? '：' + msg : ''));
  } catch (e) {
    push(false, '存储桶 attachments', e.message);
  }

  return finish();
}

function finish() {
  const bad = results.filter(r => !r.ok);
  console.log('\n----------------------------------------');
  console.log(bad.length ? `${bad.length} 项未通过，共 ${results.length} 项` : `全部通过（${results.length} 项）`);
  if (bad.length) {
    console.log('\n需要处理的：');
    bad.forEach(r => console.log(' - ' + r.name + '：' + r.detail));
  } else {
    console.log('\n下一步：注册一个账号，访问 #/health 跑写入自检。');
  }
  process.exitCode = bad.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
