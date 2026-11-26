/* ============================================================
   页面：首页 / 任务大厅 / 任务详情 / 发布与编辑
   ============================================================ */
import {
  db, state, CATEGORIES, TASK_STATUS, BID_STATUS, STATUS_HINT,
  esc, money, budgetText, dateText, timeText, sizeText, stars,
  toast, zhError, currentUid, needLogin, uploadAttachment, deleteAttachment, go
} from './lib.js';
import {
  taskCard, empty, openDialog, reportDialog, fileList, uploadZone,
  bindDownloads, renderHeader, closeDialog
} from './ui.js';
import { CONTENT } from './content.js';

const PAGE_SIZE = 10;

/* ============================================================
   首页
   ============================================================ */
export async function viewHome() {
  const { data } = await db.from('tasks')
    .select('*, owner:profiles(nickname, verified, rating)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(6);

  const list = data || [];
  const c = CONTENT.contact;

  const contactHtml = (c.phone || c.wechat)
    ? `<div class="contact-lines">
         ${c.phone ? `<a class="contact-item" href="tel:${esc(c.phone)}"><b>电话</b>${esc(c.phone)}</a>` : ''}
         ${c.wechat ? `<span class="contact-item"><b>微信</b>${esc(c.wechat)}</span>` : ''}
         <span class="muted small">服务时间 ${esc(c.hours)}</span>
       </div>`
    : `<p class="muted">${esc(c.note)}</p>`;

  app().innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">标书代写 · 报价撮合</p>
        <h1>把标书任务发出来，<br>让会做的人<em>直接报价</em>。</h1>
        <p class="lead">工程、货物、服务类标书与报价文件，发布需求后由服务方报价，
        你挑一个开始合作。账号密码注册，不需要手机验证码。</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/publish">发布任务</a>
          <a class="btn btn-ghost" href="#/tasks">去接单</a>
        </div>
      </div>
      <div class="hero-visual">
        <article class="doc">
          <div class="doc-head">
            <span class="doc-code">BM-2026-0142</span>
            <span class="doc-tag">投标文件</span>
          </div>
          <h2 class="doc-title">某市政道路改造工程</h2>
          <p class="doc-sub">商务标 · 技术标 · 一正两副</p>
          <div class="doc-rows">
            <div><span>投标人</span><b>宏远建设有限公司</b></div>
            <div><span>项目编号</span><b>SZ-2026-1103</b></div>
            <div><span>投标日期</span><b>2026-11-30</b></div>
          </div>
          <div class="doc-price"><span>投标报价</span><b>¥ 3,286,400</b></div>
          <div class="doc-seal">标书报价<br>专用章</div>
          <div class="doc-foot">样张展示 · 非真实项目</div>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>最新任务</h2>
        <a href="#/tasks">查看全部 →</a>
      </div>
      ${list.length
        ? `<div class="task-grid">${list.map(taskCard).join('')}</div>`
        : empty('还没有任务，成为第一个发布的人。', '<a class="btn btn-primary btn-sm" href="#/publish">发布任务</a>')}
    </section>

    <section class="section">
      <div class="section-head"><h2>三条承诺</h2></div>
      <div class="guarantee-grid">
        ${CONTENT.guarantees.map(g => `<div class="guarantee">
          <h3>${esc(g.title)}</h3><p>${esc(g.desc)}</p>
        </div>`).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>常见问题</h2></div>
      <div class="faq">
        ${CONTENT.faq.map(f => `<details>
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`).join('')}
      </div>
    </section>

    <section class="section">
      <div class="contact-box">
        <div>
          <h2>需要报价？</h2>
          <p class="muted">把项目情况写清楚，服务方会给出具体报价。</p>
        </div>
        <div class="contact-right">
          ${contactHtml}
          <a class="btn btn-primary" href="#/publish">发布任务</a>
        </div>
      </div>
    </section>`;
}

function app() { return document.getElementById('app'); }

/* ============================================================
   任务大厅
   ============================================================ */
export async function viewTasks() {
  const f = { q: '', cat: '', sort: 'new', offset: 0, done: false, total: 0 };

  app().innerHTML = `
    <section class="section">
      <div class="section-head"><h2>任务大厅</h2><span class="muted small" id="count"></span></div>
      <div class="filters">
        <input id="f-q" placeholder="搜索标题关键词…">
        <select id="f-cat">
          <option value="">全部类型</option>
          ${CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <select id="f-sort">
          <option value="new">最新发布</option>
          <option value="budget">预算从高到低</option>
          <option value="deadline">截止时间最近</option>
        </select>
      </div>
      <div id="list"></div>
      <div style="text-align:center;margin-top:22px"><button class="btn btn-ghost" id="more" hidden>加载更多</button></div>
    </section>`;

  const listEl = document.getElementById('list');
  const moreBtn = document.getElementById('more');
  const countEl = document.getElementById('count');

  async function load(reset) {
    if (reset) { f.offset = 0; f.done = false; listEl.innerHTML = ''; }

    let q = db.from('tasks')
      .select('*, owner:profiles(nickname, verified, rating)', { count: 'exact' })
      .eq('status', 'open');

    if (f.q) q = q.ilike('title', '%' + f.q + '%');
    if (f.cat) q = q.eq('category', f.cat);
    if (f.sort === 'budget') q = q.order('budget_max', { ascending: false, nullsFirst: false });
    else if (f.sort === 'deadline') q = q.order('deadline', { ascending: true, nullsFirst: false });
    else q = q.order('created_at', { ascending: false });

    const { data, error, count } = await q.range(f.offset, f.offset + PAGE_SIZE - 1);
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }

    f.total = count || 0;
    f.offset += (data || []).length;
    f.done = (data || []).length < PAGE_SIZE;
    countEl.textContent = f.total ? '共 ' + f.total + ' 个' : '';

    const grid = document.createElement('div');
    grid.className = 'task-grid';
    grid.innerHTML = (data || []).map(taskCard).join('');
    listEl.appendChild(grid);

    if (!listEl.children.length) listEl.innerHTML = empty('没有匹配的任务。');
    moreBtn.hidden = f.done;
  }

  const reload = () => load(true);
  document.getElementById('f-q').oninput = () => {
    clearTimeout(f._t);
    f._t = setTimeout(() => { f.q = document.getElementById('f-q').value.trim(); reload(); }, 280);
  };
  document.getElementById('f-cat').onchange = () => { f.cat = document.getElementById('f-cat').value; reload(); };
  document.getElementById('f-sort').onchange = () => { f.sort = document.getElementById('f-sort').value; reload(); };
  moreBtn.onclick = () => load(false);

  await load(true);
}

/* ============================================================
   任务详情
   ============================================================ */
export async function viewTask(id) {
  if (!id) { location.hash = '#/tasks'; return; }

  const { data: t, error } = await db.from('tasks')
    .select('*, owner:profiles(nickname, verified, rating, bio, created_at)')
    .eq('id', id).maybeSingle();

  if (error) throw error;
  if (!t) {
    app().innerHTML = `<div class="panel"><h2>任务不存在或无权查看</h2>
      <p class="muted">可能已被删除，或仅对发布者与报价方可见。</p>
      <a class="btn btn-ghost" href="#/tasks">返回任务大厅</a></div>`;
    return;
  }

  const uid = currentUid();
  const isOwner = !!uid && t.owner_id === uid;

  let bids = [];
  let myBid = null;
  if (isOwner) {
    const r = await db.from('bids')
      .select('*, provider:profiles(nickname, rating, verified, bio)')
      .eq('task_id', id).order('amount', { ascending: true });
    if (r.error) throw r.error;
    bids = r.data || [];
  } else if (uid) {
    const r = await db.from('bids').select('*').eq('task_id', id).eq('provider_id', uid).maybeSingle();
    myBid = r.data || null;
  }

  const participant = isOwner || !!myBid;
  const isProvider = !!(myBid && myBid.status === 'accepted');

  const { data: files } = await db.from('files')
    .select('*').eq('task_id', id).eq('kind', 'deliverable').order('created_at');
  const allFiles = files || [];
  const deliverables = allFiles;

  let msgs = [];
  let reviews = [];
  if (participant) {
    const [mr, rr] = await Promise.all([
      db.from('messages').select('*, sender:profiles(nickname)')
        .eq('task_id', id).order('created_at', { ascending: true }),
      db.from('reviews').select('*').eq('task_id', id)
    ]);
    msgs = mr.data || [];
    reviews = rr.data || [];
  }

  const canBid = !isOwner && !!uid && t.status === 'open' && !myBid;

  app().innerHTML = `
    <section class="detail-head">
      <div class="task-top">
        <span class="chip">${esc(t.category)}</span>
        <span class="chip status-${esc(t.status)}">${esc(TASK_STATUS[t.status] || t.status)}</span>
      </div>
      <h1>${esc(t.title)}</h1>
      <div class="meta-row">
        <span>预算 <b>${budgetText(t)}</b></span>
        <span>投标截止 <b>${dateText(t.deadline)}</b></span>
        <span>发布者 <b>${esc(t.owner ? t.owner.nickname : '匿名')}</b>
          ${t.owner && t.owner.verified ? '· 已认证' : ''}
          ${t.owner ? `<span class="rating">${stars(t.owner.rating)}</span>` : ''}</span>
        ${isOwner ? `<span>报价数 <b>${bids.length}</b></span>` : ''}
        <span class="muted small">发布于 ${dateText(t.created_at)}</span>
      </div>
    </section>

    <div class="prose">${esc(t.description)}</div>

    ${isOwner ? ownerBlock(t, bids) : bidderBlock(t, myBid, canBid)}
    ${statusPanel(t, { isOwner, isProvider })}
    ${deliverableBlock(t, deliverableSides(t, isOwner, isProvider), deliverables)}
    ${participant ? messagePanel(msgs) : ''}
    ${t.status === 'completed' && participant ? reviewPanel(reviews, uid) : ''}

    <div class="page-foot">
      ${isOwner && t.status === 'open' ? `<a class="link small" href="#/task/${esc(t.id)}/edit">编辑任务</a>` : ''}
      ${uid && !isOwner ? `<button class="link small" id="report-task">举报任务</button>` : ''}
    </div>
  `;

  bindTask(t, { uid, isOwner, isProvider, participant, bids, myBid, files: allFiles, reviews });
  subscribeTask(t.id, participant);
}

function deliverableSides(t, isOwner, isProvider) {
  return (isOwner || isProvider) && ['matched', 'delivered', 'completed'].includes(t.status);
}

/* ---------- 报价区 ---------- */
function ownerBlock(t, bids) {
  if (!bids.length) {
    return `<div class="panel"><h2>收到的报价</h2>
      <p class="muted">暂时还没有人报价。任务在“招募中”状态下对所有人可见。</p></div>`;
  }
  return `<div class="panel">
    <h2>收到的报价（${bids.length}）</h2>
    <p class="sub">选定后其余报价自动置为未中标。</p>
    ${bids.map(b => `
      <div class="bid-row">
        <div class="bid-amount">${money(b.amount)}</div>
        <div class="bid-plan">
          <b>${esc(b.provider ? b.provider.nickname : '服务方')}</b>
          ${b.provider && b.provider.verified ? '<span class="chip small">已认证</span>' : ''}
          ${b.provider ? `<span class="rating small">${stars(b.provider.rating)}</span>` : ''}
          ${b.eta_days ? `<span class="muted small"> · ${b.eta_days} 天</span>` : ''}
          <div class="muted small">${esc(b.plan)}</div>
        </div>
        <div>
          ${b.status === 'submitted' && (t.status === 'open' || t.status === 'matched')
            ? `<button class="btn btn-primary btn-sm accept" data-bid="${esc(b.id)}">选定 TA</button>`
            : `<span class="chip status-${b.status === 'accepted' ? 'open' : 'completed'}">${esc(BID_STATUS[b.status] || b.status)}</span>`}
        </div>
      </div>`).join('')}
  </div>`;
}

function bidderBlock(t, myBid, canBid) {
  if (!currentUid()) {
    return `<div class="panel"><h2>想接这个任务？</h2>
      <p class="muted">登录后即可提交报价。</p>
      <a class="btn btn-primary" href="#/login">登录 / 注册</a></div>`;
  }
  if (myBid) {
    return `<div class="panel">
      <h2>你的报价</h2>
      <p class="sub">${esc(BID_STATUS[myBid.status] || myBid.status)}</p>
      <div class="meta-row">
        <span>金额 <b>${money(myBid.amount)}</b></span>
        <span>工期 <b>${myBid.eta_days ? myBid.eta_days + ' 天' : '未填'}</b></span>
      </div>
      <p class="muted" style="margin-top:14px">${esc(myBid.plan)}</p>
      ${myBid.status === 'submitted'
        ? '<button class="btn btn-ghost btn-sm" id="withdraw">撤回报价</button>' : ''}
    </div>`;
  }
  if (t.status !== 'open') {
    return '<div class="panel"><p class="muted">该任务已停止招募，无法再报价。</p></div>';
  }
  if (!canBid) return '';

  return `<div class="panel">
    <h2>提交报价</h2>
    <p class="sub">一个任务只能报一次，提交前请确认金额与工期。</p>
    <form id="bid-form">
      <div class="row">
        <div class="field"><label>报价金额（元）</label>
          <input name="amount" type="number" min="1" step="1" required placeholder="例如 2800"></div>
        <div class="field"><label>预计工期（天）</label>
          <input name="eta" type="number" min="1" max="365" placeholder="例如 3"></div>
      </div>
      <div class="field"><label>方案说明</label>
        <textarea name="plan" required placeholder="写清交付内容、修改次数、是否含电子标上传等"></textarea></div>
      <button class="btn btn-primary" type="submit">提交报价</button>
    </form>
  </div>`;
}

function statusPanel(t, c) {
  const acts = [];
  if (c.isOwner && (t.status === 'open' || t.status === 'matched')) {
    acts.push('<button class="btn btn-ghost btn-sm" data-act="cancel">取消任务</button>');
  }
  if (c.isOwner && t.status === 'delivered') {
    acts.push('<button class="btn btn-primary btn-sm" data-act="complete">确认完成</button>');
  }
  if (c.isProvider && t.status === 'matched') {
    acts.push('<button class="btn btn-primary btn-sm" data-act="deliver">标记已交付</button>');
  }
  if (!acts.length) return '';
  return `<div class="panel"><h2>任务操作</h2>
    <p class="sub">${esc(STATUS_HINT[t.status] || '')}</p>
    <div class="actions">${acts.join('')}</div></div>`;
}

function deliverableBlock(t, show, deliverables) {
  if (!show) return '';
  const canUpload = !!currentUid() && ['matched', 'delivered'].includes(t.status);
  const canDelete = deliverables.some(f => f.uploader_id === currentUid());
  return `<div class="panel">
    <h2>交付文件</h2>
    <p class="sub">中标方上传成稿，发布方下载验收。单个文件不超过 20MB。</p>
    ${fileList(deliverables, { canDelete })}
    ${canUpload ? `<div style="margin-top:12px">${uploadZone(t.id, 'deliverable', '上传交付文件')}</div>` : ''}
  </div>`;
}

function messagePanel(msgs) {
  const mine = currentUid();
  return `<div class="panel">
    <h2>站内消息</h2>
    <p class="sub">只有任务双方能看到这段对话。</p>
    <div class="msg-list" id="msg-list">${msgs.map(m => msgHtml(m, mine)).join('') ||
      '<div class="empty small">还没有消息。先说明需求细节或报价依据。</div>'}</div>
    <form id="msg-form" class="msg-form">
      <input id="msg-body" maxlength="1000" autocomplete="off" placeholder="输入消息，回车发送">
      <button class="btn btn-primary btn-sm" type="submit">发送</button>
    </form>
  </div>`;
}

function msgHtml(m, mine, name) {
  return `<div class="msg ${m.sender_id === mine ? 'mine' : ''}">
    <div class="msg-meta">${esc(name || (m.sender && m.sender.nickname) || '用户')} · ${timeText(m.created_at)}</div>
    <div class="msg-body">${esc(m.body)}</div>
  </div>`;
}

function reviewPanel(reviews, uid) {
  const mine = reviews.find(r => r.from_id === uid);
  const other = reviews.find(r => r.from_id !== uid);
  const opts = [5, 4, 3, 2, 1].map(n => {
    const label = { 5: '非常满意', 4: '满意', 3: '一般', 2: '不满意', 1: '很差' }[n];
    return `<option value="${n}"${mine && mine.score === n ? ' selected' : ''}>${n} 分 · ${label}</option>`;
  }).join('');

  const otherHtml = other
    ? `<div class="review"><div class="review-head">对方的评价 <b>${stars(other.score)}</b></div>
        ${other.body ? `<p class="muted">${esc(other.body)}</p>` : ''}</div>`
    : '<p class="muted small">对方还没有评价。</p>';

  return `<div class="panel">
    <h2>互相评价</h2>
    <p class="sub">评价会累计到对方的信用评分，影响后续接单。</p>
    ${otherHtml}
    <div style="margin-top:18px">
      <form id="review-form">
        <div class="field"><label>你的评分</label>
          <select name="score" required>${opts}</select></div>
        <div class="field"><label>评价内容（可选）</label>
          <textarea name="body" maxlength="300" placeholder="交付质量、沟通、时效…">${mine && mine.body ? esc(mine.body) : ''}</textarea></div>
        <button class="btn btn-primary btn-sm" type="submit">${mine ? '更新评价' : '提交评价'}</button>
      </form>
    </div>
  </div>`;
}

/* ---------- 详情页事件 ---------- */
function bindTask(t, ctx) {
  const bidForm = document.getElementById('bid-form');
  if (bidForm) {
    bidForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(bidForm);
      const btn = bidForm.querySelector('button');
      btn.disabled = true;
      const { error } = await db.from('bids').insert({
        task_id: t.id,
        provider_id: currentUid(),
        amount: Number(fd.get('amount')),
        eta_days: fd.get('eta') ? Number(fd.get('eta')) : null,
        plan: String(fd.get('plan')).trim()
      });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('报价已提交');
      await viewTask(t.id);
    };
  }

  const withdraw = document.getElementById('withdraw');
  if (withdraw) {
    withdraw.onclick = async () => {
      if (!confirm('确认撤回这次报价？')) return;
      const { error } = await db.from('bids').update({ status: 'withdrawn' })
        .eq('task_id', t.id).eq('provider_id', currentUid());
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已撤回');
      await viewTask(t.id);
    };
  }

  document.querySelectorAll('.accept').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('选定这个报价？其余报价会自动置为未中标。')) return;
      btn.disabled = true;
      const { error } = await db.rpc('accept_bid', { p_bid_id: btn.dataset.bid });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已选定');
      await viewTask(t.id);
    };
  });

  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const act = btn.dataset.act;
      const ask = act === 'deliver' ? '确认已交付？'
        : act === 'complete' ? '确认任务完成？确认后进入互评。'
        : '确认取消任务？';
      if (!confirm(ask)) return;
      const fn = act === 'deliver' ? 'mark_delivered'
        : act === 'complete' ? 'confirm_complete' : 'cancel_task';
      btn.disabled = true;
      const { error } = await db.rpc(fn, { p_task: t.id });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已更新');
      await viewTask(t.id);
    };
  });

  // 附件上传
  const uploads = document.querySelectorAll('[data-upload]');
  uploads.forEach(input => {
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const kind = input.dataset.kind || 'task';
      const label = input.closest('.upload-zone').querySelector('span');
      const old = label.textContent;
      label.textContent = '上传中…';
      try {
        for (const file of files) await uploadAttachment(t.id, file, kind);
        toast('上传完成');
        await viewTask(t.id);
      } catch (e) {
        label.textContent = old;
        toast(zhError(e.message || e), 'error');
      }
    };
  });

  // 附件删除
  bindDownloads(document, async (fileId) => {
    const f = ctx.files.find(x => x.id === fileId);
    if (!f) return;
    if (!confirm('删除这个附件？')) return;
    try {
      await deleteAttachment(f);
      toast('已删除');
      await viewTask(t.id);
    } catch (e) {
      toast(zhError(e.message || e), 'error');
    }
  });

  // 消息
  const msgForm = document.getElementById('msg-form');
  if (msgForm) {
    msgForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('msg-body');
      const body = input.value.trim();
      if (!body) return;
      const btn = msgForm.querySelector('button');
      btn.disabled = true;
      const { error } = await db.from('messages')
        .insert({ task_id: t.id, sender_id: currentUid(), body });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      input.value = '';
      await refreshMessages(t.id);
    };
  }

  // 评价
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(reviewForm);
      const btn = reviewForm.querySelector('button');
      btn.disabled = true;
      const { error } = await db.rpc('submit_review', {
        p_task: t.id,
        p_score: Number(fd.get('score')),
        p_body: String(fd.get('body') || '')
      });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('评价已提交');
      await viewTask(t.id);
    };
  }

  const reportBtn = document.getElementById('report-task');
  if (reportBtn) reportBtn.onclick = () => reportDialog('task', t.id);
}

async function refreshMessages(taskId) {
  const listEl = document.getElementById('msg-list');
  if (!listEl) return;
  const { data } = await db.from('messages')
    .select('*, sender:profiles(nickname)')
    .eq('task_id', taskId).order('created_at', { ascending: true });
  const mine = currentUid();
  listEl.innerHTML = (data || []).map(m => msgHtml(m, mine)).join('') ||
    '<div class="empty small">还没有消息。</div>';
  listEl.scrollTop = listEl.scrollHeight;
}

/* ---------- 实时订阅 ---------- */
let taskSub = null;

function subscribeTask(taskId, participant) {
  if (taskSub) { db.removeChannel(taskSub); taskSub = null; }
  if (!participant) return;

  taskSub = db.channel('task-' + taskId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'task_id=eq.' + taskId },
      () => { refreshMessages(taskId); })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tasks', filter: 'id=eq.' + taskId },
      (payload) => {
        const st = payload.new && payload.new.status;
        if (st) { toast('任务状态更新：' + (TASK_STATUS[st] || st)); viewTask(taskId); }
      })
    .subscribe();
}

export function leaveTask() {
  if (taskSub) { db.removeChannel(taskSub); taskSub = null; }
}

/* ============================================================
   发布 / 编辑任务
   ============================================================ */
export async function viewPublish() {
  if (!needLogin('发布任务需要先登录')) return;
  await renderTaskForm(null);
}

export async function viewEdit(id) {
  if (!needLogin('请先登录')) return;
  const { data: t } = await db.from('tasks').select('*').eq('id', id).maybeSingle();
  if (!t) { toast('任务不存在', 'error'); location.hash = '#/tasks'; return; }
  if (t.owner_id !== currentUid()) { toast('只有发布者可以编辑', 'error'); location.hash = '#/task/' + id; return; }
  if (t.status !== 'open') { toast('只有招募中的任务可以编辑', 'error'); location.hash = '#/task/' + id; return; }
  await renderTaskForm(t);
}

async function renderTaskForm(t) {
  const isEdit = !!t;
  app().innerHTML = `
    <div class="panel">
      <h2>${isEdit ? '编辑任务' : '发布任务'}</h2>
      <p class="sub">写清需求，服务方才能报出准确价格。</p>
      <form id="task-form">
        <div class="field"><label>任务标题</label>
          <input name="title" required maxlength="80" value="${isEdit ? esc(t.title) : ''}"
                 placeholder="例如：某市政道路工程投标文件编制"></div>
        <div class="row">
          <div class="field"><label>标书类型</label>
            <select name="category" required>
              ${CATEGORIES.map(c => `<option value="${esc(c)}"${isEdit && t.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            </select></div>
          <div class="field"><label>投标截止时间</label>
            <input name="deadline" type="date" value="${isEdit && t.deadline ? esc(t.deadline) : ''}"></div>
        </div>
        <div class="row">
          <div class="field"><label>预算下限（元，可不填）</label>
            <input name="budget_min" type="number" min="0" step="100" value="${isEdit && t.budget_min != null ? t.budget_min : ''}"></div>
          <div class="field"><label>预算上限（元，可不填）</label>
            <input name="budget_max" type="number" min="0" step="100" value="${isEdit && t.budget_max != null ? t.budget_max : ''}"></div>
        </div>
        <div class="field"><label>需求说明</label>
          <textarea name="description" required placeholder="项目概况、标书册数、是否含电子标上传、期望交付时间…">${isEdit ? esc(t.description) : ''}</textarea>
          <div class="hint">平台不接收招标文件。请用文字写清评分点、册数和截止时间；涉密资料在选定服务方后再沟通。</div></div>
        <button class="btn btn-primary" type="submit">${isEdit ? '保存修改' : '发布'}</button>
        ${isEdit ? `<a class="btn btn-ghost" href="#/task/${esc(t.id)}">取消</a>` : ''}
      </form>
    </div>`;

  const form = document.getElementById('task-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const bmin = fd.get('budget_min') ? Number(fd.get('budget_min')) : null;
    const bmax = fd.get('budget_max') ? Number(fd.get('budget_max')) : null;
    if (bmin !== null && bmax !== null && bmax < bmin) { toast('预算上限不能低于下限', 'error'); return; }

    const payload = {
      title: String(fd.get('title')).trim(),
      category: fd.get('category'),
      budget_min: bmin,
      budget_max: bmax,
      deadline: fd.get('deadline') || null,
      description: String(fd.get('description')).trim()
    };

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;

    if (isEdit) {
      const { error } = await db.from('tasks').update(payload).eq('id', t.id);
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已保存');
      location.hash = '#/task/' + t.id;
    } else {
      const { data, error } = await db.from('tasks')
        .insert({ ...payload, owner_id: currentUid() }).select('id').single();
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('任务已发布');
      location.hash = '#/task/' + data.id;
    }
  };
}

export { closeDialog };
