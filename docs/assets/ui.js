/* ============================================================
   UI 组件：顶栏、任务卡、弹窗、附件列表
   ============================================================ */
import {
  state, db, currentUid, esc, money, budgetText, dateText, sizeText, stars,
  toast, zhError, signOut, go, downloadFile
} from './lib.js';

export function renderHeader() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  const name = (state.profile && state.profile.nickname) || '我';
  const isAdmin = !!(state.profile && state.profile.is_admin);
  const unread = state.unread || 0;

  slot.innerHTML = state.session
    ? `<a class="btn btn-primary btn-sm" href="#/publish">发布任务</a>
       <a class="bell" href="#/notifications" title="通知">通知${unread ? `<i>${unread > 99 ? '99+' : unread}</i>` : ''}</a>
       ${isAdmin ? '<a class="link" href="#/admin">管理</a>' : ''}
       <a class="avatar" href="#/me" title="${esc(name)}">${esc(name.slice(0, 1))}</a>
       <button class="link" id="logout-btn">退出</button>`
    : `<a class="link" href="#/login">登录</a>
       <a class="btn btn-primary btn-sm" href="#/register">注册</a>`;

  const lo = document.getElementById('logout-btn');
  if (lo) {
    lo.onclick = async () => {
      await signOut();
      renderHeader();
      location.hash = '#/';
    };
  }
}

export function taskCard(t) {
  const desc = (t.description || '').replace(/\s+/g, ' ');
  const short = desc.length > 58 ? desc.slice(0, 58) + '…' : desc;
  const owner = t.owner || {};
  const code = 'BM-' + String(t.id).replace(/-/g, '').slice(0, 6).toUpperCase();
  return `<a class="card" href="#/task/${esc(t.id)}">
    <div class="task-top">
      <span class="code">${esc(code)}</span>
      <span class="chip status-${esc(t.status)}">${esc(TASK_STATUS_LABEL[t.status] || t.status)}</span>
    </div>
    <h3>${esc(t.title)}</h3>
    <p class="muted small">${esc(t.category)} · ${esc(short)}</p>
    <div class="task-foot">
      <strong>${budgetText(t)}</strong>
      <span>截止 ${dateText(t.deadline)}</span>
      <span class="owner-line">${esc(owner.nickname || '匿名')}${owner.verified ? ' · 认证' : ''}</span>
    </div>
  </a>`;
}

const TASK_STATUS_LABEL = {
  pending: '待审核', open: '招募中', matched: '已选定', in_progress: '进行中',
  delivered: '已交付', completed: '已完成', cancelled: '已取消', rejected: '未通过'
};

export function empty(text, actionHtml = '') {
  return `<div class="empty">${esc(text)}${actionHtml ? `<div style="margin-top:14px">${actionHtml}</div>` : ''}</div>`;
}

/* ---------- 弹窗 ---------- */
export function closeDialog() {
  const d = document.getElementById('dialog');
  if (d) d.remove();
}

export function openDialog(title, bodyHtml, { submitText = '确定', onSubmit, danger = false } = {}) {
  closeDialog();
  const d = document.createElement('div');
  d.className = 'dialog-backdrop';
  d.id = 'dialog';
  d.innerHTML = `
    <div class="dialog">
      <h3>${esc(title)}</h3>
      <form id="dialog-form">
        ${bodyHtml}
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-close>取消</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitText)}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(d);

  d.addEventListener('click', (e) => {
    if (e.target === d) closeDialog();
    if (e.target.hasAttribute && e.target.hasAttribute('data-close')) closeDialog();
  });

  const form = d.querySelector('#dialog-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const ok = onSubmit ? await onSubmit(new FormData(form), form) : true;
      if (ok === false) { btn.disabled = false; return; }
      closeDialog();
    } catch (err) {
      btn.disabled = false;
      toast(zhError(err.message || err), 'error');
    }
  };

  const first = form.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return d;
}

export function confirmDialog(text, { okText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    closeDialog();
    const d = document.createElement('div');
    d.className = 'dialog-backdrop';
    d.id = 'dialog';
    d.innerHTML = `
      <div class="dialog">
        <h3>请确认</h3>
        <p class="dialog-text">${esc(text)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-no>取消</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okText)}</button>
        </div>
      </div>`;
    document.body.appendChild(d);

    const done = (v) => { closeDialog(); resolve(v); };
    d.querySelector('[data-yes]').onclick = () => done(true);
    d.querySelector('[data-no]').onclick = () => done(false);
    d.addEventListener('click', (e) => { if (e.target === d) done(false); });
    const yes = d.querySelector('[data-yes]');
    if (yes) setTimeout(() => yes.focus(), 30);
  });
}

export function reportDialog(targetType, targetId, onDone) {
  const reasons = targetType === 'task'
    ? ['虚假任务', '违规内容', '涉嫌诈骗', '重复发布', '其他']
    : ['虚假信息', '骚扰谩骂', '涉嫌诈骗', '其他'];

  openDialog('举报', `
    <div class="field">
      <label>举报原因</label>
      <select name="reason" required>
        ${reasons.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>补充说明（可选）</label>
      <textarea name="detail" maxlength="300" placeholder="简要说明发生了什么"></textarea>
    </div>`, {
    submitText: '提交举报',
    onSubmit: async (fd) => {
      const { error } = await db.from('reports').insert({
        reporter_id: currentUid(),
        target_type: targetType,
        target_id: targetId,
        reason: String(fd.get('reason')),
        detail: String(fd.get('detail') || '').trim() || null
      });
      if (error) { toast(zhError(error.message), 'error'); return false; }
      toast('已提交，管理员会尽快处理');
      if (onDone) onDone();
    }
  });
}

/* ---------- 附件 ---------- */
export function fileList(files, { canDelete = false } = {}) {
  if (!files || !files.length) return '<p class="muted small">暂无附件</p>';
  return `<div class="file-list">
    ${files.map(f => `<div class="file-row">
      <span class="file-name">${esc(f.name)}</span>
      <span class="muted small">${sizeText(f.size)}</span>
      <button type="button" class="link small" data-dl="${esc(f.path)}">下载</button>
      ${canDelete ? `<button type="button" class="link small danger" data-delfile="${esc(f.id)}">删除</button>` : ''}
    </div>`).join('')}
  </div>`;
}

export function uploadZone(taskId, kind, label) {
  return `<label class="upload-zone">
    <input type="file" data-upload="${esc(taskId)}" data-kind="${esc(kind)}" multiple hidden>
    <span>${esc(label)}</span>
  </label>`;
}

export function bindDownloads(container, onDelete) {
  container.querySelectorAll('[data-dl]').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      await downloadFile(btn.dataset.dl);
    };
  });
  if (onDelete) {
    container.querySelectorAll('[data-delfile]').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        onDelete(btn.dataset.delfile);
      };
    });
  }
}

export function ratingLine(p) {
  if (!p) return '';
  return `<span class="rating">${stars(p.rating)} <span class="muted small">${Number(p.rating || 0).toFixed(1)}</span></span>`;
}

export { go, money, budgetText, dateText, esc, toast };
