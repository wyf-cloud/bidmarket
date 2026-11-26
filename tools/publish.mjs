#!/usr/bin/env node
/**
 * 一键发布到 GitHub Pages（走 REST API，不依赖本机 git）
 *
 * 用法：
 *   node tools/publish.mjs --token ghp_xxx --repo bidmarket
 *   node tools/publish.mjs --token github_pat_xxx --repo bidmarket --owner yourname --private
 *
 * 需要 token 权限：
 *   classic PAT: repo（公开仓库也可只给 public_repo）+ workflow 不需要
 *   fine-grained: Contents 读写 + Pages 读写 + Administration 读写（建仓库）
 *
 * 做的事：建仓库 → 上传全部文件（单个提交）→ 开启 Pages(/docs) → 等待构建 → 打印网址
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback = '') => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes('--' + name);

const TOKEN = argOf('token', process.env.GITHUB_TOKEN || '');
const REPO = argOf('repo', 'bidmarket');
const OWNER = argOf('owner', '');
const PRIVATE = flag('private');
let branch = 'main';
const SKIP = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);

if (!TOKEN) {
  console.error('缺少 --token（GitHub Personal Access Token）');
  process.exit(1);
}

const API = 'https://api.github.com';

async function gh(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bidmarket-publisher',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || text.slice(0, 200);
    const err = new Error(`GitHub API ${method} ${path} -> ${res.status} ${msg}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

/* ---------- 收集文件 ---------- */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && st.size < 5 * 1024 * 1024) out.push(full);
  }
  return out;
}

function repoPath(full) {
  return relative(root, full).split(sep).join('/');
}

async function main() {
  console.log('1/6 校验 token…');
  const me = await gh('/user');
  const owner = OWNER || me.login;
  console.log(`    账号：${me.login}` + (owner !== me.login ? `（目标 owner：${owner}）` : ''));

  console.log(`2/6 创建仓库 ${owner}/${REPO}…`);
  let repo;
  try {
    repo = await gh('/user/repos', {
      method: 'POST',
      body: { name: REPO, private: PRIVATE, auto_init: false, description: '标书报价 · 任务撮合平台' }
    });
    console.log('    已创建');
  } catch (e) {
    if (e.status === 422) {
      repo = await gh(`/repos/${owner}/${REPO}`);
      console.log('    仓库已存在，继续上传');
    } else {
      throw e;
    }
  }

  console.log('3/6 收集文件…');
  const files = walk(root);
  console.log(`    ${files.length} 个文件`);

  // 空仓库不能直接建 blob（409 Git Repository is empty），先用 Contents API 打一个占位提交
  let parentSha = null;
  try {
    const ref = await gh(`/repos/${owner}/${REPO}/git/ref/heads/${branch}`);
    parentSha = ref.object.sha;
  } catch {
    console.log('    空仓库，先创建初始提交…');
    await gh(`/repos/${owner}/${REPO}/contents/.bootstrap`, {
      method: 'PUT',
      body: {
        message: 'chore: bootstrap',
        content: Buffer.from('init').toString('base64')
      }
    });
    const info = await gh(`/repos/${owner}/${REPO}`);
    branch = info.default_branch || branch;
    const ref = await gh(`/repos/${owner}/${REPO}/git/ref/heads/${branch}`);
    parentSha = ref.object.sha;
  }

  console.log('4/6 上传文件内容…');
  const tree = [];
  let done = 0;
  for (const full of files) {
    const content = readFileSync(full).toString('base64');
    const blob = await gh(`/repos/${owner}/${REPO}/git/blobs`, {
      method: 'POST',
      body: { content, encoding: 'base64' }
    });
    tree.push({ path: repoPath(full), mode: '100644', type: 'blob', sha: blob.sha });
    done++;
    if (done % 5 === 0 || done === files.length) process.stdout.write(`    ${done}/${files.length}\r`);
  }
  console.log(`    ${files.length}/${files.length} 完成`);

  console.log('5/6 生成提交并建分支…');

  const treeRes = await gh(`/repos/${owner}/${REPO}/git/trees`, {
    method: 'POST',
    body: { tree }
  });
  const commitRes = await gh(`/repos/${owner}/${REPO}/git/commits`, {
    method: 'POST',
    body: {
      message: 'init: 标书报价平台',
      tree: treeRes.sha,
      parents: parentSha ? [parentSha] : []
    }
  });

  if (parentSha) {
    await gh(`/repos/${owner}/${REPO}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: { sha: commitRes.sha, force: true }
    });
  } else {
    await gh(`/repos/${owner}/${REPO}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: commitRes.sha }
    });
  }
  try {
    await gh(`/repos/${owner}/${REPO}`, { method: 'PATCH', body: { default_branch: branch } });
  } catch { /* 可选 */ }
  console.log('    提交完成：' + commitRes.sha.slice(0, 7) + (parentSha ? '（覆盖已有分支）' : ''));

  console.log('6/6 开启 GitHub Pages…');
  const pagesBody = { source: { branch, path: '/docs' } };
  try {
    await gh(`/repos/${owner}/${REPO}/pages`, { method: 'POST', body: pagesBody });
  } catch (e) {
    if (e.status === 409 || e.status === 422) {
      await gh(`/repos/${owner}/${REPO}/pages`, { method: 'PUT', body: pagesBody });
    } else {
      throw e;
    }
  }

  const base = `https://${owner}.github.io/${REPO}/`;
  console.log('    构建中，通常 1–3 分钟…');

  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 10000));
    try {
      const p = await gh(`/repos/${owner}/${REPO}/pages`);
      if (p.status === 'built' || p.html_url) {
        console.log('\n已上线：' + (p.html_url || base));
        console.log('记得把 Supabase 的 URL 和 anon key 填进 docs/assets/config.js 再推一次。');
        return;
      }
      process.stdout.write(`    状态：${p.status || 'building'}\r`);
    } catch {
      process.stdout.write('    等待中…\r');
    }
  }

  console.log('\nPages 还在构建，稍后访问：' + base);
}

main().catch(e => {
  console.error('\n失败：' + e.message);
  if (e.status === 401) console.error('检查 token 是否有效、是否勾选了 repo / Contents 权限。');
  if (e.status === 403) console.error('token 权限不足，或触发了 GitHub 的权限限制。');
  process.exitCode = 1;
});
