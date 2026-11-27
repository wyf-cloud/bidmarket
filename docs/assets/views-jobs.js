/* ============================================================
   招聘模块：大厅 / 岗位详情 / 发布编辑 / 投递管理 / 投递会话 / 简历
   ============================================================ */
import {
  db, state, esc, toast, zhError, currentUid, needLogin, debounce,
  JOB_CATEGORIES, JOB_TYPE, JOB_STATUS, APP_STATUS,
  JOB_EXPERIENCE, JOB_EDUCATION, SALARY_UNIT,
  salaryFull, isJobExpired, dateText, timeText, todayStr,
  employerName, appChipClass
} from './lib.js';
import { jobCard, empty, reportDialog, confirmDialog } from './ui.js';

const app = () => document.getElementById('app');
const PAGE = 8;

/* ---------- 小工具 ---------- */
const opts = (list, cur) => list.map(v =>
  `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(v)}</option>`
).join('');

const empOpts = (cur) => Object.entries(JOB_TYPE).map(([k, v]) =>
  `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`
).join('');

function datePlus(n) {
  const d = new Date();
  d.setDate(d.getDate() + (n || 0));
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function splitTags(v) {
  return String(v || '').split(/[\n,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 10);
}

function companyMark(name) {
  return String(name || '标').trim().slice(0, 1) || '标';
}

function notFound(text, href = '#/jobs', link = '返回招聘大厅') {
  app().innerHTML = `<div class="panel"><h2>${esc(text)}</h2>
    <p class="muted">可能已下架、已关闭，或仅对投递双方可见。</p>
    <a class="btn btn-ghost" href="${href}">${link}</a></div>`;
}

function canWithdraw(a) {
  return !!a && ['submitted', 'viewed', 'invited'].includes(a.status);
}

/* ============================================================
   招聘大厅
   ============================================================ */
export async function viewJobs() {
  const uid = currentUid();

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>在招岗位</h2>
        <span class="muted small" id="jobs-count"></span>
      </div>
      <p class="sub" style="color:var(--muted);margin:-12px 0 24px;font-size:13px">
        标书、造价、招标代理、工程资料方向的长期用工。岗位经人工审核，投递后可直接在站内沟通。
      </p>
      <div class="filters filters-3">
        <input id="job-q" placeholder="搜索岗位关键词…" autocomplete="off">
        <select id="job-cat"><option value="">全部类别</option>${JOB_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
        <select id="job-emp"><option value="">全部形式</option>${empOpts('')}</select>
      </div>
      <div class="filters filters-sub">
        <input id="job-city" placeholder="城市，例如 杭州" autocomplete="off">
        <select id="job-sort">
          <option value="new">最新发布</option>
          <option value="salary">薪资从高到低</option>
          <option value="deadline">快截止</option>
        </select>
        <div class="muted small hint-line">薪资、经验、学历都在卡片上，点进去看职责与要求。</div>
      </div>
      <div id="jobs-list"></div>
      <div class="hall-foot"><button class="btn btn-ghost" id="jobs-more" hidden>加载更多</button></div>
      <div class="section-head" style="margin-top:32px">
        <span class="muted small">有团队在招人？</span>
        <a class="btn btn-primary btn-sm" href="#/jobs/new">发布岗位</a>
      </div>
    </section>`;

  const st = { q: '', cat: '', emp: '', city: '', sort: 'new', offset: 0, done: false };
  const listEl = document.getElementById('jobs-list');
  const moreBtn = document.getElementById('jobs-more');
  const countEl = document.getElementById('jobs-count');

  async function load(reset) {
    if (reset) { st.offset = 0; st.done = false; listEl.innerHTML = ''; }

    let q = db.from('job_posts')
      .select('*, employer:profiles(nickname, company, verified)', { count: 'exact' })
      .eq('status', 'open')
      .gte('expires_at', todayStr());

    if (st.q) q = q.ilike('title', '%' + st.q + '%');
    if (st.cat) q = q.eq('category', st.cat);
    if (st.emp) q = q.eq('employment', st.emp);
    if (st.city) q = q.ilike('city', '%' + st.city + '%');

    if (st.sort === 'salary') q = q.order('salary_max', { ascending: false, nullsFirst: false });
    else if (st.sort === 'deadline') q = q.order('expires_at', { ascending: true });
    else q = q.order('created_at', { ascending: false });

    const { data, error, count } = await q.range(st.offset, st.offset + PAGE - 1);
    if (error) { listEl.innerHTML = empty(zhError(error.message)); return; }

    const rows = data || [];
    st.offset += rows.length;
    st.done = rows.length < PAGE;
    if (countEl) countEl.textContent = count ? '共 ' + count + ' 个岗位' : '';

    if (!rows.length && st.offset === 0) {
      listEl.innerHTML = empty('还没有在招岗位。',
        '<a class="btn btn-primary btn-sm" href="#/jobs/new">发布第一个岗位</a>');
      moreBtn.hidden = true;
      return;
    }

    let applied = {};
    if (uid && rows.length) {
      const r = await db.from('job_applications').select('job_id, status').in('job_id', rows.map(j => j.id));
      (r.data || []).forEach(a => { applied[a.job_id] = a.status; });
    }

    const grid = document.createElement('div');
    grid.className = 'task-grid';
    grid.innerHTML = rows.map(j => jobCard(j, { appStatus: applied[j.id] })).join('');
    listEl.appendChild(grid);
    moreBtn.hidden = st.done;
  }

  const qEl = document.getElementById('job-q');
  const cityEl = document.getElementById('job-city');
  const catEl = document.getElementById('job-cat');
  const empEl = document.getElementById('job-emp');
  const sortEl = document.getElementById('job-sort');

  const reloadSoon = debounce(() => load(true), 280);
  qEl.oninput = () => { st.q = qEl.value.trim(); reloadSoon(); };
  cityEl.oninput = () => { st.city = cityEl.value.trim(); reloadSoon(); };
  catEl.onchange = () => { st.cat = catEl.value; load(true); };
  empEl.onchange = () => { st.emp = empEl.value; load(true); };
  sortEl.onchange = () => { st.sort = sortEl.value; load(true); };
  moreBtn.onclick = () => load(false);

  await load(true);
}

/* ============================================================
   岗位详情
   ============================================================ */
export async function viewJob(id) {
  if (!id) { location.hash = '#/jobs'; return; }

  const { data: j, error } = await db.from('job_posts')
    .select('*, employer:profiles(nickname, company, verified, bio, created_at)')
    .eq('id', id).maybeSingle();

  if (error) throw error;
  if (!j) { notFound('岗位不存在或无权查看'); return; }

  const uid = currentUid();
  const isOwner = !!uid && j.employer_id === uid;
  const expired = isJobExpired(j);

  let myApp = null;
  let resume = null;
  let stats = null;

  if (isOwner) {
    const r = await db.from('job_applications').select('status').eq('job_id', id);
    const rows = r.data || [];
    stats = {
      total: rows.length,
      fresh: rows.filter(x => x.status === 'submitted').length,
      invited: rows.filter(x => x.status === 'invited').length,
      hired: rows.filter(x => x.status === 'hired').length
    };
  } else if (uid) {
    const r = await db.from('job_applications').select('*')
      .eq('job_id', id).eq('applicant_id', uid).maybeSingle();
    myApp = r.data || null;
    if (!myApp) {
      const rr = await db.from('resumes').select('*').eq('user_id', uid).maybeSingle();
      resume = rr.data || null;
    }
  }

  const company = employerName(j);
  const emp = j.employer || {};

  app().innerHTML = `
    <section class="detail-head">
      <div class="task-top">
        <span class="chip">${esc(j.category)}</span>
        <span class="chip">${esc(JOB_TYPE[j.employment] || j.employment)}</span>
        <span class="chip status-${esc(j.status)}">${esc(JOB_STATUS[j.status] || j.status)}</span>
        ${expired ? '<span class="chip danger">已过期</span>' : ''}
      </div>
      <h1>${esc(j.title)}</h1>
      <div class="meta-row">
        <span>薪资 <b>${esc(salaryFull(j))}</b></span>
        <span>城市 <b>${esc(j.city)}</b></span>
        <span>经验 <b>${esc(j.experience)}</b></span>
        <span>学历 <b>${esc(j.education)}</b></span>
        <span>招聘 <b>${Number(j.headcount) || 1} 人</b></span>
        <span>有效期至 <b>${esc(dateText(j.expires_at))}</b></span>
      </div>
    </section>

    ${j.status === 'pending' ? `<div class="alert alert-info" style="margin-top:20px">
      ${isOwner ? '岗位已提交，等待管理员审核；通过后会出现在招聘大厅。' : '该岗位正在审核中。'}
    </div>` : ''}
    ${j.status === 'rejected' ? `<div class="alert alert-error" style="margin-top:20px">
      该岗位未通过审核${j.review_note ? '：' + esc(j.review_note) : ''}。
      ${isOwner ? '修改内容后会自动重新提交审核。' : ''}
    </div>` : ''}
    ${j.status === 'closed' ? `<div class="alert alert-info" style="margin-top:20px">
      该岗位已关闭，不再接收投递。${myApp ? '你投递过这个岗位，仍可查看投递记录。' : ''}
    </div>` : ''}
    ${expired && j.status === 'open' ? `<div class="alert alert-info" style="margin-top:20px">
      该岗位已过有效期（${esc(dateText(j.expires_at))}），不再接收新的投递。
    </div>` : ''}

    <div class="detail-grid">
      <div>
        <div class="panel" style="margin-top:0">
          <h2>岗位职责</h2>
          <div class="prose" style="padding-top:8px">${esc(j.description)}</div>
        </div>

        <div class="panel">
          <h2>任职要求</h2>
          <div class="prose" style="padding-top:8px">${esc(j.requirement)}</div>
          ${splitTags(j.perks).length ? `<div class="tag-list" style="margin-top:16px">
            ${splitTags(j.perks).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
          </div>` : ''}
        </div>

        ${isOwner ? ownerPanel(j, stats) : applicantPanel(j, { uid, myApp, resume, expired })}
      </div>

      <aside class="side-card">
        <div class="panel">
          <div class="company">
            <div class="company-mark">${esc(companyMark(company))}</div>
            <div>
              <b>${esc(company)}</b>
              <span class="muted small">${emp.verified ? '已认证' : '未认证'}${emp.bio ? ' · ' + esc(emp.bio.slice(0, 18)) : ''}</span>
            </div>
          </div>
          <div style="margin-top:18px">
            <div class="kv"><span>发布者</span><b>${esc(emp.nickname || '招聘方')}</b></div>
            <div class="kv"><span>岗位类别</span><b>${esc(j.category)}</b></div>
            <div class="kv"><span>用工形式</span><b>${esc(JOB_TYPE[j.employment] || j.employment)}</b></div>
            <div class="kv"><span>发布时间</span><b>${esc(dateText(j.created_at))}</b></div>
          </div>
        </div>

        <div class="panel">
          <h2>提示</h2>
          <ul class="muted small" style="line-height:1.9;margin:0;padding-left:18px">
            <li>岗位信息经人工审核后展示，平台只提供信息撮合。</li>
            <li>任何以培训费、押金、体检费名义收费的招聘都是诈骗。</li>
            <li>邀面试后双方才能看到联系方式。</li>
          </ul>
          ${uid && !isOwner ? '<button class="link small danger" id="report-job" style="margin-top:14px">举报这个岗位</button>' : ''}
        </div>
      </aside>
    </div>`;

  bindJob(j, { uid, isOwner, myApp, resume, expired });
  subscribeJob(j.id);
}

function ownerPanel(j, stats) {
  return `<div class="panel">
    <h2>投递概况</h2>
    <div class="meta-row" style="gap:24px">
      <span>收到 <b>${stats.total}</b></span>
      <span>待查看 <b>${stats.fresh}</b></span>
      <span>已邀面试 <b>${stats.invited}</b></span>
      <span>已录用 <b>${stats.hired}</b></span>
    </div>
    <div class="actions" style="margin-top:20px">
      <a class="btn btn-primary btn-sm" href="#/job/${esc(j.id)}/applications">管理投递</a>
      ${j.status !== 'closed' ? `<a class="btn btn-ghost btn-sm" href="#/job/${esc(j.id)}/edit">编辑岗位</a>` : ''}
      ${(j.status === 'open' || j.status === 'pending') ? '<button class="btn btn-ghost btn-sm" id="close-job">关闭岗位</button>' : ''}
    </div>
    <p class="muted small" style="margin-top:14px">修改岗位内容会自动回到待审核，审核期间前台暂时下架。</p>
  </div>`;
}

function applicantPanel(j, c) {
  if (!c.uid) {
    return `<div class="panel">
      <h2>投递这个岗位</h2>
      <p class="muted">登录后可以建简历、投递，并在站内和招聘方沟通。</p>
      <a class="btn btn-primary" href="#/login">登录 / 注册</a>
    </div>`;
  }

  if (c.myApp) {
    const a = c.myApp;
    return `<div class="panel">
      <h2>你的投递</h2>
      <p class="sub">投递于 ${esc(dateText(a.created_at))}，招聘方看到的是当时的简历快照。</p>
      <div class="meta-row">
        <span>状态 <b>${esc(APP_STATUS[a.status] || a.status)}</b></span>
        ${a.viewed_at ? `<span>查看于 <b>${esc(dateText(a.viewed_at))}</b></span>` : ''}
      </div>
      <div class="actions" style="margin-top:20px">
        <a class="btn btn-primary btn-sm" href="#/application/${esc(a.id)}">查看投递与沟通</a>
        ${canWithdraw(a) ? '<button class="btn btn-ghost btn-sm" id="withdraw-app">撤回投递</button>' : ''}
      </div>
    </div>`;
  }

  if (j.status !== 'open') {
    return `<div class="panel"><p class="muted">该岗位已停止招聘，无法投递。</p></div>`;
  }
  if (c.expired) {
    return `<div class="panel"><p class="muted">该岗位已过有效期，无法投递。</p></div>`;
  }

  if (!c.resume) {
    return `<div class="panel">
      <h2>先建一份在线简历</h2>
      <p class="muted">投递前需要先填写在线简历。招聘方只能看到你投递时的版本。</p>
      <a class="btn btn-primary" href="#/resume">去建简历</a>
    </div>`;
  }

  return `<div class="panel">
    <h2>投递简历</h2>
    <p class="sub">招聘方会看到你投递时的简历快照；邀面试后双方才能看到联系方式。</p>
    <div class="alert alert-info" style="margin-bottom:16px">
      你的在线简历：<b>${esc(c.resume.title)}</b> · <a href="#/resume">修改</a>
    </div>
    <form id="apply-form">
      <div class="field">
        <label>求职信（可选，最多 300 字）</label>
        <textarea name="cover" maxlength="300" placeholder="用两句话说明你的经验与到岗时间"></textarea>
      </div>
      <button class="btn btn-primary" type="submit">投递简历</button>
      <p class="muted small" style="margin-top:14px">
        投递后可以撤回。任何以培训费、押金、体检费名义收费的招聘都是诈骗，请立即举报。
      </p>
    </form>
  </div>`;
}

/* ---------- 详情页事件 ---------- */
function bindJob(j, c) {
  const applyForm = document.getElementById('apply-form');
  if (applyForm) {
    applyForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(applyForm);
      const btn = applyForm.querySelector('button[type=submit]');
      btn.disabled = true;
      const { error } = await db.rpc('apply_job', {
        p_job: j.id,
        p_cover: String(fd.get('cover') || '').trim()
      });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已投递，招聘方会收到通知');
      await viewJob(j.id);
    };
  }

  const withdraw = document.getElementById('withdraw-app');
  if (withdraw) {
    withdraw.onclick = async () => {
      if (!(await confirmDialog('确认撤回这次投递？撤回后岗位仍开放时可以重新投递。', { okText: '撤回' }))) return;
      const { error } = await db.rpc('job_app_set_status', { p_app: c.myApp.id, p_status: 'withdrawn' });
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已撤回');
      await viewJob(j.id);
    };
  }

  const closeBtn = document.getElementById('close-job');
  if (closeBtn) {
    closeBtn.onclick = async () => {
      if (!(await confirmDialog('关闭后不能再接收投递，已投递的人仍可查看记录。', { okText: '关闭岗位', danger: true }))) return;
      const { error } = await db.rpc('close_job', { p_job: j.id });
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('岗位已关闭');
      await viewJob(j.id);
    };
  }

  const report = document.getElementById('report-job');
  if (report) report.onclick = () => reportDialog('job', j.id);
}

/* ---------- 实时 ---------- */
let jobSub = null;
let appSub = null;

function subscribeJob(id) {
  leaveJobs();
  jobSub = db.channel('job-' + id)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'job_posts', filter: 'id=eq.' + id },
      () => { viewJob(id); })
    .subscribe();
}

export function leaveJobs() {
  if (jobSub) { db.removeChannel(jobSub); jobSub = null; }
  if (appSub) { db.removeChannel(appSub); appSub = null; }
}

/* ============================================================
   发布 / 编辑岗位
   ============================================================ */
export async function viewJobForm(id) {
  if (!needLogin('发布岗位需要先登录')) return;

  let j = null;
  if (id) {
    const { data } = await db.from('job_posts').select('*').eq('id', id).maybeSingle();
    if (!data) { toast('岗位不存在', 'error'); location.hash = '#/jobs'; return; }
    if (data.employer_id !== currentUid()) { toast('只有发布者可以编辑', 'error'); location.hash = '#/job/' + id; return; }
    if (data.status === 'closed') { toast('已关闭的岗位不能再修改', 'error'); location.hash = '#/job/' + id; return; }
    j = data;
  }

  const isEdit = !!j;
  const neg = !isEdit || (!j.salary_min && !j.salary_max);

  app().innerHTML = `
    <div class="panel">
      <h2>${isEdit ? '编辑岗位' : '发布岗位'}</h2>
      <p class="sub">岗位信息会经人工审核。写清职责、要求和薪资区间，匹配度更高。</p>
      <form id="job-form">
        <div class="field">
          <label>岗位名称</label>
          <input name="title" required maxlength="80" value="${isEdit ? esc(j.title) : ''}"
                 placeholder="例如：标书编制（工程类）/ 造价员（兼职 · 远程）">
        </div>
        <div class="row">
          <div class="field"><label>岗位类别</label>
            <select name="category" required>${opts(JOB_CATEGORIES, isEdit ? j.category : '标书编制')}</select></div>
          <div class="field"><label>用工形式</label>
            <select name="employment">${empOpts(isEdit ? j.employment : 'fulltime')}</select></div>
        </div>
        <div class="row">
          <div class="field"><label>工作城市</label>
            <input name="city" required maxlength="24" value="${isEdit ? esc(j.city) : ''}" placeholder="例如 杭州，或填「不限」"></div>
          <div class="field"><label>招聘人数</label>
            <input name="headcount" type="number" min="1" max="99" value="${isEdit ? Number(j.headcount) || 1 : 1}"></div>
        </div>

        <div class="field">
          <label>薪资</label>
          <label class="check" style="margin-bottom:10px">
            <input type="checkbox" id="salary-neg" ${neg ? 'checked' : ''}> 面议
          </label>
          <div class="row">
            <div class="field" style="margin-bottom:0"><label>下限</label>
              <input name="salary_min" type="number" min="0" step="100"
                     value="${isEdit && j.salary_min != null ? j.salary_min : ''}" placeholder="例如 12000"></div>
            <div class="field" style="margin-bottom:0"><label>上限</label>
              <input name="salary_max" type="number" min="0" step="100"
                     value="${isEdit && j.salary_max != null ? j.salary_max : ''}" placeholder="例如 18000"></div>
          </div>
          <div class="row" style="margin-top:16px">
            <div class="field" style="margin-bottom:0"><label>薪资单位</label>
              <select name="salary_unit">
                ${Object.entries(SALARY_UNIT).map(([k, v]) =>
                  `<option value="${k}"${(isEdit ? j.salary_unit : 'month') === k ? ' selected' : ''}>元${esc(v)}</option>`).join('')}
              </select></div>
            <div class="field" style="margin-bottom:0"><label>有效期至</label>
              <input name="expires_at" type="date" value="${isEdit ? esc(j.expires_at) : datePlus(30)}"></div>
          </div>
        </div>

        <div class="row">
          <div class="field"><label>经验要求</label>
            <select name="experience">${opts(JOB_EXPERIENCE, isEdit ? j.experience : '不限')}</select></div>
          <div class="field"><label>学历要求</label>
            <select name="education">${opts(JOB_EDUCATION, isEdit ? j.education : '不限')}</select></div>
        </div>

        <div class="field">
          <label>岗位职责</label>
          <textarea name="description" required placeholder="例如：独立完成市政项目商务标、技术标编制，按评分办法逐条响应…">${isEdit ? esc(j.description) : ''}</textarea>
          <div class="hint">至少 10 字。写清要做哪些事、交付什么。</div>
        </div>
        <div class="field">
          <label>任职要求</label>
          <textarea name="requirement" required placeholder="例如：3 年以上标书编制经验，熟悉评分办法与电子标流程…">${isEdit ? esc(j.requirement) : ''}</textarea>
        </div>
        <div class="field">
          <label>福利标签（可选，一行一个，最多 8 个）</label>
          <textarea name="perks" rows="3" placeholder="五险一金&#10;双休&#10;投标季补贴">${isEdit && j.perks ? esc(j.perks) : ''}</textarea>
        </div>

        <div class="alert alert-info">
          请勿填写「押金、培训费、服装费、体检费」等任何收费项目，也不要限定性别、年龄、地域或要求证件原件。
        </div>

        <button class="btn btn-primary" type="submit">${isEdit ? '保存修改' : '提交审核'}</button>
        ${isEdit ? `<a class="btn btn-ghost" href="#/job/${esc(j.id)}">取消</a>` : ''}
      </form>
    </div>`;

  const form = document.getElementById('job-form');
  const negEl = document.getElementById('salary-neg');
  const minEl = form.querySelector('[name="salary_min"]');
  const maxEl = form.querySelector('[name="salary_max"]');

  const syncSalary = () => {
    minEl.disabled = negEl.checked;
    maxEl.disabled = negEl.checked;
    if (negEl.checked) { minEl.value = ''; maxEl.value = ''; }
  };
  negEl.onchange = syncSalary;
  syncSalary();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const description = String(fd.get('description') || '').trim();
    const requirement = String(fd.get('requirement') || '').trim();
    const bmin = negEl.checked || !fd.get('salary_min') ? null : Number(fd.get('salary_min'));
    const bmax = negEl.checked || !fd.get('salary_max') ? null : Number(fd.get('salary_max'));

    if (title.length < 2) { toast('岗位名称至少 2 个字', 'error'); return; }
    if (description.length < 10) { toast('岗位职责至少 10 个字', 'error'); return; }
    if (requirement.length < 5) { toast('任职要求至少 5 个字', 'error'); return; }
    if (bmin != null && bmax != null && bmax < bmin) { toast('薪资上限不能低于下限', 'error'); return; }

    const expires = String(fd.get('expires_at') || '');
    if (expires && (expires < todayStr() || expires > datePlus(90))) {
      toast('有效期需在今天到 90 天之间', 'error');
      return;
    }

    const payload = {
      title,
      category: String(fd.get('category')),
      employment: String(fd.get('employment')),
      city: String(fd.get('city') || '').trim() || '不限',
      headcount: Math.max(1, Math.min(99, Number(fd.get('headcount')) || 1)),
      salary_min: bmin,
      salary_max: bmax,
      salary_unit: String(fd.get('salary_unit') || 'month'),
      experience: String(fd.get('experience')),
      education: String(fd.get('education')),
      description,
      requirement,
      perks: splitTags(fd.get('perks')).join('，') || null,
      expires_at: expires || datePlus(30)
    };

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;

    if (isEdit) {
      const { error } = await db.from('job_posts').update(payload).eq('id', j.id);
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已保存，修改后需要重新审核');
      location.hash = '#/job/' + j.id;
    } else {
      const { data, error } = await db.from('job_posts')
        .insert({ ...payload, employer_id: currentUid() }).select('id').single();
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已提交，审核通过后会出现在招聘大厅');
      location.hash = '#/job/' + data.id;
    }
  };
}

/* ============================================================
   某个岗位的投递管理（招聘方）
   ============================================================ */
export async function viewJobApplications(id) {
  if (!needLogin('请先登录')) return;

  const { data: j } = await db.from('job_posts').select('*').eq('id', id).maybeSingle();
  if (!j) { notFound('岗位不存在'); return; }
  if (j.employer_id !== currentUid()) { notFound('无权查看这个岗位的投递'); return; }

  const { data, error } = await db.from('job_applications').select('*')
    .eq('job_id', id).order('created_at', { ascending: false });
  if (error) { app().innerHTML = empty(zhError(error.message)); return; }

  const rows = data || [];
  const ids = [...new Set(rows.map(r => r.applicant_id))];
  let people = {};
  if (ids.length) {
    const r = await db.from('profiles').select('id, nickname, verified, company').in('id', ids);
    (r.data || []).forEach(p => { people[p.id] = p; });
  }

  const count = s => rows.filter(r => r.status === s).length;
  const stats = { total: rows.length, fresh: count('submitted'), invited: count('invited'), hired: count('hired') };

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>${esc(j.title)}</h2>
        <a class="small muted" href="#/job/${esc(j.id)}">← 返回岗位</a>
      </div>
      <div class="meta-row" style="margin-bottom:24px">
        <span>收到 <b>${stats.total}</b></span>
        <span>待查看 <b>${stats.fresh}</b></span>
        <span>已邀面试 <b>${stats.invited}</b></span>
        <span>已录用 <b>${stats.hired}</b></span>
      </div>
      <div class="apps-toolbar" id="app-filter">
        <button data-f="" class="active">全部</button>
        <button data-f="submitted">待查看</button>
        <button data-f="viewed">已查看</button>
        <button data-f="invited">已邀面试</button>
        <button data-f="hired">已录用</button>
        <button data-f="rejected">不合适</button>
        <button data-f="withdrawn">已撤回</button>
      </div>
      <div id="app-list"></div>
    </section>`;

  const listEl = document.getElementById('app-list');

  function render(filter) {
    const list = filter ? rows.filter(r => r.status === filter) : rows;
    if (!list.length) {
      listEl.innerHTML = empty(filter ? '这个状态下没有投递。'
        : '还没有人投递。把岗位分享出去，或等审核通过后自然曝光。');
      return;
    }
    listEl.innerHTML = `<div class="panel">${list.map(a => {
      const p = people[a.applicant_id] || {};
      const s = a.resume_snapshot || {};
      return `<div class="app-row">
        <div class="who">
          <b>${a.status === 'submitted' ? '<span class="dot-new"></span>' : ''}${esc(p.nickname || '求职者')}</b>
          ${p.verified ? ' <span class="chip small">已认证</span>' : ''}
          <p>${esc(s.title || '在线简历')} · ${esc(s.city || '城市未填')} · ${Number(s.years) || 0} 年经验</p>
        </div>
        <span class="chip ${appChipClass(a.status)}">${esc(APP_STATUS[a.status] || a.status)}</span>
        <span class="muted small">${esc(dateText(a.created_at))}</span>
        <a class="btn btn-ghost btn-sm" href="#/application/${esc(a.id)}">查看</a>
      </div>`;
    }).join('')}</div>`;
  }

  document.querySelectorAll('#app-filter button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#app-filter button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.f);
    };
  });

  render('');
}

/* ============================================================
   单条投递：简历快照 + 状态 + 会话
   ============================================================ */
export async function viewApplication(id) {
  if (!needLogin('请先登录')) return;

  const { data: a, error } = await db.from('job_applications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!a) { notFound('投递不存在或无权查看'); return; }

  const uid = currentUid();
  const isAdmin = !!(state.profile && state.profile.is_admin);
  const isEmployer = uid === a.employer_id;
  const isApplicant = uid === a.applicant_id;
  if (!isEmployer && !isApplicant && !isAdmin) { notFound('无权查看这条投递'); return; }

  if (isEmployer && a.status === 'submitted') {
    const r = await db.rpc('job_app_set_status', { p_app: a.id, p_status: 'viewed' });
    if (!r.error) {
      a.status = 'viewed';
      a.viewed_at = new Date().toISOString();
    }
  }

  const [jobRes, applicantRes, employerRes] = await Promise.all([
    db.from('job_posts').select('id, title, category, city, status, employer_id, expires_at').eq('id', a.job_id).maybeSingle(),
    db.from('profiles').select('id, nickname, verified, company').eq('id', a.applicant_id).maybeSingle(),
    db.from('profiles').select('id, nickname, verified, company').eq('id', a.employer_id).maybeSingle()
  ]);

  const job = jobRes.data || {};
  const applicant = applicantRes.data || {};
  const employer = employerRes.data || {};
  const s = a.resume_snapshot || {};

  const canSeeContact = ['invited', 'hired'].includes(a.status);
  const otherId = isEmployer ? a.applicant_id : a.employer_id;
  let contact = null;
  if (canSeeContact || isAdmin) {
    const r = await db.from('profile_contacts').select('*').eq('user_id', otherId).maybeSingle();
    contact = r.data || null;
  }

  let note = null;
  if (isEmployer || isAdmin) {
    const r = await db.from('application_notes').select('*').eq('application_id', a.id).maybeSingle();
    note = r.data || null;
  }

  const { data: msgs } = await db.from('application_messages').select('*')
    .eq('application_id', a.id).order('created_at', { ascending: true });

  const partner = isEmployer ? applicant : employer;
  const partnerName = partner.nickname || '对方';

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>投递详情</h2>
        <a class="small muted" href="${isEmployer ? '#/job/' + esc(a.job_id) + '/applications' : '#/job/' + esc(a.job_id)}">
          ← 返回${isEmployer ? '投递列表' : '岗位'}</a>
      </div>

      <div class="detail-grid" style="margin-top:0">
        <div>
          <div class="panel" style="margin-top:0">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <b style="font-size:16px;font-weight:500">${esc(applicant.nickname || '求职者')}</b>
              <span class="chip ${appChipClass(a.status)}">${esc(APP_STATUS[a.status] || a.status)}</span>
              <span class="muted small">投递于 ${esc(dateText(a.created_at))} · 简历快照</span>
            </div>
            <div class="tag-list" style="margin-top:14px">
              ${s.category ? `<span class="chip">${esc(s.category)}</span>` : ''}
              ${s.employment ? `<span class="chip">${esc(JOB_TYPE[s.employment] || s.employment)}</span>` : ''}
              ${s.city ? `<span class="chip">${esc(s.city)}</span>` : ''}
              <span class="chip">${Number(s.years) || 0} 年经验</span>
              ${s.education ? `<span class="chip">${esc(s.education)}</span>` : ''}
            </div>
            ${s.summary ? `<div class="prose" style="padding-top:14px;padding-bottom:0">${esc(s.summary)}</div>` : ''}
          </div>

          ${s.experience ? `<div class="panel">
            <h2>工作经历</h2>
            <div class="prose" style="padding-top:8px">${esc(s.experience)}</div>
          </div>` : ''}

          ${s.portfolio ? `<div class="panel">
            <h2>代表项目</h2>
            <div class="prose" style="padding-top:8px">${esc(s.portfolio)}</div>
          </div>` : ''}

          <div class="panel">
            <h2>站内沟通</h2>
            <p class="sub">只有投递双方能看到这段对话；邀面试后可以交换联系方式。</p>
            <div class="msg-list" id="app-msg-list">${(msgs || []).map(m => msgHtml(m, uid, m.sender_id === uid ? '我' : partnerName)).join('')
              || '<div class="empty small">还没有消息。可以先问清楚职责、薪资和到岗时间。</div>'}</div>
            <form class="msg-form" id="app-msg-form">
              <input id="app-msg-body" maxlength="1000" autocomplete="off" placeholder="输入消息，回车发送">
              <button class="btn btn-primary btn-sm" type="submit">发送</button>
            </form>
          </div>
        </div>

        <aside class="side-card">
          <div class="panel" style="margin-top:0">
            <h2>进度</h2>
            ${timelineHtml(a)}
            ${statusActions(a, { isEmployer, isApplicant })}
          </div>

          <div class="panel">
            <h2>联系方式</h2>
            ${canSeeContact
              ? `<div class="contact-card">
                   ${contact && (contact.phone || contact.wechat)
                     ? `${contact.phone ? '手机 <b>' + esc(contact.phone) + '</b>' : ''}
                        ${contact.phone && contact.wechat ? ' · ' : ''}
                        ${contact.wechat ? '微信 <b>' + esc(contact.wechat) + '</b>' : ''}`
                     : '对方还没有填写联系方式，可以在站内继续沟通。'}
                   <div class="muted small" style="margin-top:6px">邀面试后已解锁，双方可见。</div>
                 </div>`
              : `<div class="contact-card" style="border-color:var(--line);background:rgba(255,255,255,.35);color:var(--muted)">
                   邀面试后可查看${esc(partnerName)}的手机号与微信。
                 </div>`}
          </div>

          ${isEmployer || isAdmin ? `<div class="panel">
            <h2>内部备注</h2>
            <p class="sub">只有招聘方看得到，求职者不可见。</p>
            <textarea id="note-body" rows="3" maxlength="600" placeholder="例如：11-28 线上面聊，重点问电子标经验">${note ? esc(note.body) : ''}</textarea>
            <button class="btn btn-ghost btn-sm" id="note-save" style="margin-top:12px">保存备注</button>
          </div>` : ''}

          <div class="panel">
            <h2>岗位</h2>
            <p class="muted small" style="margin:0 0 12px">${esc(job.title || '岗位已删除')}</p>
            ${job.id ? `<a class="btn btn-ghost btn-sm" href="#/job/${esc(job.id)}">查看岗位</a>` : ''}
          </div>
        </aside>
      </div>
    </section>`;

  bindApplication(a, { isEmployer, isApplicant, isAdmin, partnerName, otherId });
  subscribeApplication(a.id);
}

function msgHtml(m, mine, name) {
  return `<div class="msg ${m.sender_id === mine ? 'mine' : ''}">
    <div class="msg-meta">${esc(name || '用户')} · ${timeText(m.created_at)}</div>
    <div class="msg-body">${esc(m.body)}</div>
  </div>`;
}

function timelineHtml(a) {
  const rank = { submitted: 0, viewed: 1, invited: 2, hired: 3 };
  const cur = a.status === 'rejected' ? 1 : a.status === 'withdrawn' ? 0 : (rank[a.status] ?? 0);
  const steps = [
    ['投递简历', a.created_at, 0],
    ['招聘方已查看', a.viewed_at, 1],
    ['邀面试', a.status === 'invited' || a.status === 'hired' ? a.updated_at : null, 2],
    ['录用', a.status === 'hired' ? a.updated_at : null, 3]
  ];

  return `<ul class="timeline">
    ${steps.map(([label, time, idx]) =>
      `<li class="${cur >= idx ? 'done' : ''}"><b>${esc(label)}</b>${time ? `<time>${esc(dateText(time))}</time>` : ''}</li>`).join('')}
    ${a.status === 'rejected' ? '<li class="done"><b>不合适</b><time>' + esc(dateText(a.updated_at)) + '</time></li>' : ''}
    ${a.status === 'withdrawn' ? '<li class="done"><b>已撤回</b><time>' + esc(dateText(a.updated_at)) + '</time></li>' : ''}
  </ul>`;
}

function statusActions(a, c) {
  const acts = [];
  if (c.isEmployer) {
    if (['submitted', 'viewed'].includes(a.status)) {
      acts.push('<button class="btn btn-primary btn-sm" data-app-act="invited">邀面试</button>');
      acts.push('<button class="btn btn-ghost btn-sm" data-app-act="rejected">不合适</button>');
    } else if (a.status === 'invited') {
      acts.push('<button class="btn btn-primary btn-sm" data-app-act="hired">确认录用</button>');
      acts.push('<button class="btn btn-ghost btn-sm" data-app-act="rejected">不合适</button>');
    }
  }
  if (c.isApplicant && canWithdraw(a)) {
    acts.push('<button class="btn btn-ghost btn-sm" data-app-act="withdrawn">撤回投递</button>');
  }
  if (!acts.length) return '';
  return `<div class="actions" style="margin-top:18px">${acts.join('')}</div>`;
}

function bindApplication(a, c) {
  document.querySelectorAll('[data-app-act]').forEach(btn => {
    btn.onclick = async () => {
      const next = btn.dataset.appAct;
      const ask = next === 'hired' ? '确认录用这个人？'
        : next === 'rejected' ? '标记为不合适？对方会收到通知。'
        : next === 'withdrawn' ? '确认撤回这次投递？'
        : '邀请对方面试？邀面试后双方会看到联系方式。';
      if (!(await confirmDialog(ask, { okText: '确定', danger: next === 'rejected' || next === 'withdrawn' }))) return;
      btn.disabled = true;
      const { error } = await db.rpc('job_app_set_status', { p_app: a.id, p_status: next });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('已更新');
      await viewApplication(a.id);
    };
  });

  const msgForm = document.getElementById('app-msg-form');
  if (msgForm) {
    msgForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('app-msg-body');
      const body = input.value.trim();
      if (!body) return;
      const btn = msgForm.querySelector('button');
      btn.disabled = true;
      const { error } = await db.from('application_messages')
        .insert({ application_id: a.id, sender_id: currentUid(), body });
      btn.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      input.value = '';
      await refreshAppMessages(a.id, c);
    };
  }

  const noteSave = document.getElementById('note-save');
  if (noteSave) {
    noteSave.onclick = async () => {
      const body = document.getElementById('note-body').value.trim();
      if (!body) { toast('备注不能为空', 'error'); return; }
      noteSave.disabled = true;
      const { error } = await db.from('application_notes')
        .upsert({ application_id: a.id, employer_id: a.employer_id, body }, { onConflict: 'application_id' });
      noteSave.disabled = false;
      if (error) { toast(zhError(error.message), 'error'); return; }
      toast('备注已保存');
    };
  }
}

async function refreshAppMessages(appId, c) {
  const list = document.getElementById('app-msg-list');
  if (!list) return;
  const { data } = await db.from('application_messages').select('*')
    .eq('application_id', appId).order('created_at', { ascending: true });
  list.innerHTML = (data || []).map(m => msgHtml(m, currentUid(), m.sender_id === currentUid() ? '我' : c.partnerName)).join('')
    || '<div class="empty small">还没有消息。</div>';
  list.scrollTop = list.scrollHeight;
}

function subscribeApplication(appId) {
  leaveJobs();
  appSub = db.channel('app-' + appId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'application_messages', filter: 'application_id=eq.' + appId },
      () => { refreshAppMessages(appId, { partnerName: '对方' }); })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'job_applications', filter: 'id=eq.' + appId },
      (payload) => {
        if (payload.new && payload.new.status) viewApplication(appId);
      })
    .subscribe();
}

/* ============================================================
   在线简历
   ============================================================ */
export async function viewResume(uid) {
  const me = currentUid();
  if (!me) { needLogin('请先登录'); return; }
  const target = uid || me;

  const readonly = target !== me;
  const [profileRes, resumeRes] = await Promise.all([
    db.from('profiles').select('id, nickname, company, verified, bio').eq('id', target).maybeSingle(),
    db.from('resumes').select('*').eq('user_id', target).maybeSingle()
  ]);

  const profile = profileRes.data || {};
  const r = resumeRes.data || null;

  if (readonly && !r) {
    app().innerHTML = `<div class="panel"><h2>对方还没有填写在线简历</h2>
      <a class="btn btn-ghost" href="#/jobs">返回招聘大厅</a></div>`;
    return;
  }

  if (readonly) {
    app().innerHTML = `
      <section class="section">
        <div class="section-head">
          <h2>${esc(profile.nickname || '求职者')} 的简历</h2>
          <a class="small muted" href="#/jobs">← 招聘大厅</a>
        </div>
        <div class="panel" style="max-width:760px">
          ${previewHtml(r)}
          <p class="muted small" style="margin-top:22px">简历内容由求职者本人填写，平台不做实质核验。</p>
        </div>
      </section>`;
    return;
  }

  const v = r || {};

  app().innerHTML = `
    <section class="section">
      <div class="section-head">
        <h2>我的在线简历</h2>
        <span class="muted small">一人一份 · 纯文字 · 不接收附件</span>
      </div>
      <div class="resume-layout">
        <div class="panel" style="margin-top:0">
          <h2>${r ? '编辑简历' : '填写简历'}</h2>
          <p class="sub">招聘方只能看到你投递时的版本；修改不会影响已投出的记录。</p>
          <form id="resume-form">
            <div class="field">
              <label>求职意向标题</label>
              <input name="title" required maxlength="60" value="${esc(v.title || '')}"
                     placeholder="例如：标书编制 · 8 年 · 杭州">
            </div>
            <div class="row">
              <div class="field"><label>期望岗位</label>
                <select name="category">${opts(JOB_CATEGORIES, v.category || '标书编制')}</select></div>
              <div class="field"><label>期望形式</label>
                <select name="employment">${empOpts(v.employment || 'fulltime')}</select></div>
            </div>
            <div class="row">
              <div class="field"><label>期望城市</label>
                <input name="city" maxlength="24" value="${esc(v.city || '')}" placeholder="例如 杭州，或填「不限」"></div>
              <div class="field"><label>从业年限</label>
                <input name="years" type="number" min="0" max="50" value="${v.years != null ? Number(v.years) : ''}"></div>
            </div>
            <div class="row">
              <div class="field"><label>期望月薪下限（可不填）</label>
                <input name="salary_min" type="number" min="0" step="500" value="${v.salary_min != null ? v.salary_min : ''}"></div>
              <div class="field"><label>期望月薪上限（可不填）</label>
                <input name="salary_max" type="number" min="0" step="500" value="${v.salary_max != null ? v.salary_max : ''}"></div>
            </div>
            <div class="row">
              <div class="field"><label>学历</label>
                <select name="education">${opts(JOB_EDUCATION, v.education || '不限')}</select></div>
              <div class="field"><label>可见范围</label>
                <select name="visible">
                  <option value="applied"${(v.visible || 'applied') === 'applied' ? ' selected' : ''}>仅投递后可见（推荐）</option>
                  <option value="public"${v.visible === 'public' ? ' selected' : ''}>公开到人才库</option>
                </select></div>
            </div>
            <div class="field">
              <label>技能标签（一行一个，最多 10 个）</label>
              <textarea name="skills" rows="4" maxlength="300" placeholder="商务标&#10;技术标&#10;电子标上传">${esc(v.skills || '')}</textarea>
            </div>
            <div class="field">
              <label>自我介绍（最多 800 字）</label>
              <textarea name="summary" maxlength="800" placeholder="做过哪些类型的标书、擅长行业、能什么时候到岗">${esc(v.summary || '')}</textarea>
            </div>
            <div class="field">
              <label>工作经历（公司｜职位｜时间｜主要工作）</label>
              <textarea name="experience" maxlength="3000" placeholder="宏远建设｜标书主管｜2021–2026｜负责市政项目商务标与技术标">${esc(v.experience || '')}</textarea>
              <div class="hint">不要写客户名称与项目涉密信息，代表项目请脱敏。</div>
            </div>
            <div class="field">
              <label>代表项目（可选，最多 2000 字）</label>
              <textarea name="portfolio" maxlength="2000" placeholder="类型、规模、你负责的部分、结果">${esc(v.portfolio || '')}</textarea>
            </div>
            <button class="btn btn-primary" type="submit">${r ? '保存简历' : '创建简历'}</button>
            ${r ? `<a class="btn btn-ghost" href="#/resume/${esc(me)}">预览</a>` : ''}
          </form>
        </div>

        <div class="resume-preview" id="resume-preview">${previewHtml(v)}</div>
      </div>
    </section>`;

  const form = document.getElementById('resume-form');
  const preview = document.getElementById('resume-preview');

  const syncPreview = () => {
    const fd = new FormData(form);
    preview.innerHTML = previewHtml({
      title: String(fd.get('title') || '').trim(),
      category: fd.get('category'),
      employment: fd.get('employment'),
      city: String(fd.get('city') || '').trim(),
      years: Number(fd.get('years') || 0),
      education: fd.get('education'),
      salary_min: fd.get('salary_min') ? Number(fd.get('salary_min')) : null,
      salary_max: fd.get('salary_max') ? Number(fd.get('salary_max')) : null,
      skills: String(fd.get('skills') || ''),
      summary: String(fd.get('summary') || ''),
      experience: String(fd.get('experience') || ''),
      portfolio: String(fd.get('portfolio') || ''),
      visible: fd.get('visible')
    });
  };
  form.addEventListener('input', syncPreview);
  form.addEventListener('change', syncPreview);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const smin = fd.get('salary_min') ? Number(fd.get('salary_min')) : null;
    const smax = fd.get('salary_max') ? Number(fd.get('salary_max')) : null;
    if (title.length < 2) { toast('求职意向标题至少 2 个字', 'error'); return; }
    if (smin != null && smax != null && smax < smin) { toast('期望薪资上限不能低于下限', 'error'); return; }

    const payload = {
      user_id: me,
      title,
      category: String(fd.get('category')),
      employment: String(fd.get('employment')),
      city: String(fd.get('city') || '').trim() || '不限',
      years: Math.max(0, Math.min(50, Number(fd.get('years')) || 0)),
      education: String(fd.get('education')),
      salary_min: smin,
      salary_max: smax,
      skills: splitTags(fd.get('skills')).join('\n') || null,
      summary: String(fd.get('summary') || '').trim() || null,
      experience: String(fd.get('experience') || '').trim() || null,
      portfolio: String(fd.get('portfolio') || '').trim() || null,
      visible: String(fd.get('visible')) === 'public' ? 'public' : 'applied'
    };

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await db.from('resumes').upsert(payload, { onConflict: 'user_id' });
    btn.disabled = false;
    if (error) { toast(zhError(error.message), 'error'); return; }
    toast(r ? '简历已保存' : '简历已创建');
    await viewResume();
  };
}

function previewHtml(r) {
  if (!r) return '<div class="empty">还没有内容</div>';
  const tags = splitTags(r.skills);
  const salary = (r.salary_min || r.salary_max)
    ? '期望 ' + kRange(r.salary_min, r.salary_max) + ' / 月'
    : '期望薪资面议';
  return `
    <h3>${esc(r.title || '未填写求职意向')}</h3>
    <div class="sub-line">
      ${esc(JOB_TYPE[r.employment] || '')} · ${esc(r.city || '城市未填')} · ${Number(r.years) || 0} 年 ·
      ${esc(r.education || '学历未填')} · ${esc(salary)} ·
      ${r.visible === 'public' ? '公开到人才库' : '仅投递后可见'}
    </div>
    ${tags.length ? `<div class="tag-list">${tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    ${r.summary ? `<h4>自我介绍</h4><p>${esc(r.summary)}</p>` : ''}
    ${r.experience ? `<h4>工作经历</h4><p>${esc(r.experience)}</p>` : ''}
    ${r.portfolio ? `<h4>代表项目</h4><p>${esc(r.portfolio)}</p>` : ''}`;
}

function kRange(a, b) {
  const f = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  if (a && b) return f(a) + '–' + f(b);
  return f(b || a || 0);
}

/* 供其它视图复用 */
export { previewHtml };
