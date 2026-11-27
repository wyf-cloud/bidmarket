/* ============================================================
   演示客户端：没有配置 Supabase 时接管 db，用内存假数据跑通全部界面
   只用于预览，数据刷新即重置，不会写入任何服务器
   ============================================================ */

const DAY = 864e5;
const MIN = 6e4;

const daysFromNow = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const minsAgo = (n) => new Date(Date.now() - n * MIN).toISOString();

/* ---------- 种子数据 ---------- */
const profiles = [
  {
    id: 'u1', nickname: '张工', email: 'zhang@example.com', role: 'client',
    verified: true, rating: 4.8, bio: '市政与房建项目，常年需要标书外包。',
    company: '宏远建设有限公司',
    is_admin: true, banned: false, created_at: minsAgo(60 * 24 * 40)
  },
  {
    id: 'u2', nickname: '李工', email: 'li@example.com', role: 'provider',
    verified: true, rating: 4.9, bio: '8 年标书编制，擅长工程类商务标、技术标。',
    company: null,
    is_admin: false, banned: false, created_at: minsAgo(60 * 24 * 30)
  },
  {
    id: 'u3', nickname: '王工', email: 'wang@example.com', role: 'provider',
    verified: false, rating: 4.5, bio: '货物类、服务类标书，电子标上传。',
    company: null,
    is_admin: false, banned: false, created_at: minsAgo(60 * 24 * 12)
  },
  {
    id: 'u4', nickname: '陈经理', email: 'chen@example.com', role: 'client',
    verified: true, rating: 4.7, bio: '中联工程咨询，常年招造价与标书人员。',
    company: '中联工程咨询',
    is_admin: false, banned: false, created_at: minsAgo(60 * 24 * 20)
  }
];

const contacts = [
  { user_id: 'u1', phone: '138****0001', wechat: 'zhang_bid' },
  { user_id: 'u2', phone: '139****0002', wechat: 'li_bid' },
  { user_id: 'u3', phone: '137****0003', wechat: 'wang_bid' }
];

const tasks = [
  {
    id: 't1', owner_id: 'u1', title: '市政道路工程投标文件编制（商务+技术）',
    category: '工程类标书', budget_min: 2500, budget_max: 4000,
    deadline: daysFromNow(4),
    description: '某市政道路改造项目，需要编制商务标和技术标各一正两副，含资格证明材料整理。\n投标截止 4 天后，希望 2 天内出初稿。',
    status: 'open', created_at: minsAgo(180)
  },
  {
    id: 't2', owner_id: 'u1', title: '设备采购标书 · 技术参数响应表',
    category: '货物类标书', budget_min: 1200, budget_max: 2000,
    deadline: daysFromNow(7),
    description: '一批实验室设备采购，需要按招标文件逐条做技术参数响应，并提供偏离表。',
    status: 'open', created_at: minsAgo(60 * 20)
  },
  {
    id: 't3', owner_id: 'u3', title: '物业服务项目资格预审文件',
    category: '资格预审', budget_min: 800, budget_max: 1500,
    deadline: daysFromNow(9),
    description: '园区物业服务项目资格预审，需要整理业绩、人员证书和财务材料。',
    status: 'open', created_at: minsAgo(60 * 30)
  },
  {
    id: 't4', owner_id: 'u1', title: '某学校食堂服务标书（已选定服务方）',
    category: '服务类标书', budget_min: 2000, budget_max: 3000,
    deadline: daysFromNow(2),
    description: '学校食堂托管服务，需要服务方案、人员配置和食品安全承诺。',
    status: 'matched', created_at: minsAgo(60 * 50)
  },
  {
    id: 't5', owner_id: 'u1', title: '电子标上传 + CA 办理协助',
    category: '电子标上传', budget_min: 500, budget_max: 800,
    deadline: daysFromNow(-2),
    description: '已完成，仅保留记录用于展示评价。',
    status: 'completed', created_at: minsAgo(60 * 24 * 6)
  }
];

const bids = [
  { id: 'b1', task_id: 't1', provider_id: 'u2', amount: 3200, eta_days: 3, plan: '商务标 + 技术标全套，含两次修改，可协助电子标上传。', status: 'submitted', created_at: minsAgo(120) },
  { id: 'b2', task_id: 't1', provider_id: 'u3', amount: 3600, eta_days: 2, plan: '两天出初稿，技术标按评分点逐条对应，附偏离表。', status: 'submitted', created_at: minsAgo(90) },
  { id: 'b3', task_id: 't4', provider_id: 'u2', amount: 2800, eta_days: 4, plan: '食堂服务方案 + 人员配置 + 食安承诺，含排版。', status: 'accepted', created_at: minsAgo(60 * 40) },
  { id: 'b4', task_id: 't5', provider_id: 'u2', amount: 600, eta_days: 1, plan: 'CA 办理 + 电子标上传全流程协助。', status: 'accepted', created_at: minsAgo(60 * 24 * 6) }
];

const messages = [
  { id: 'm1', task_id: 't4', sender_id: 'u1', body: '李工你好，食堂这边的评分点主要看服务方案和人员配置，麻烦重点写。', created_at: minsAgo(60 * 22) },
  { id: 'm2', task_id: 't4', sender_id: 'u2', body: '收到，我先出人员配置表和服务流程，今晚给你初稿。', created_at: minsAgo(60 * 21) },
  { id: 'm3', task_id: 't4', sender_id: 'u2', body: '初稿已经发你微信了，麻烦看下第三章的食安承诺。', created_at: minsAgo(40) }
];

const reviews = [
  { id: 'r1', task_id: 't5', from_id: 'u1', to_id: 'u2', score: 5, body: '响应快，电子标一次上传成功。', created_at: minsAgo(60 * 24 * 5) },
  { id: 'r2', task_id: 't5', from_id: 'u2', to_id: 'u1', score: 5, body: '需求清楚，付款爽快。', created_at: minsAgo(60 * 24 * 5 + 30) }
];

const files = [
  { id: 'f1', task_id: 't1', uploader_id: 'u1', kind: 'task', path: 't1/demo.pdf', name: '招标文件（脱敏）.pdf', size: 2_400_000, mime: 'application/pdf', created_at: minsAgo(175) },
  { id: 'f2', task_id: 't4', uploader_id: 'u2', kind: 'deliverable', path: 't4/demo.docx', name: '食堂服务标书-初稿.docx', size: 860_000, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', created_at: minsAgo(41) }
];

const notifications = [
  { id: 'n1', user_id: 'u1', kind: 'bid', task_id: 't1', body: '李工 对「市政道路工程投标文件编制」报价 ¥3,200', read_at: null, created_at: minsAgo(120) },
  { id: 'n2', user_id: 'u1', kind: 'bid', task_id: 't1', body: '王工 对「市政道路工程投标文件编制」报价 ¥3,600', read_at: null, created_at: minsAgo(90) },
  { id: 'n3', user_id: 'u1', kind: 'message', task_id: 't4', body: '李工：初稿已经发你微信了，麻烦看下第三章的食安承诺。', read_at: null, created_at: minsAgo(40) }
];

const reports = [
  { id: 'rp1', reporter_id: 'u3', target_type: 'task', target_id: 't2', reason: '虚假任务', detail: '描述与预算明显不匹配，疑似套方案。', status: 'open', created_at: minsAgo(200) }
];

/* ---------- 招聘种子 ---------- */
const resumes = [
  {
    user_id: 'u2', title: '标书编制 · 8 年 · 杭州', category: '标书编制',
    employment: 'fulltime', city: '杭州', years: 8, education: '本科',
    salary_min: 12000, salary_max: 16000,
    skills: '商务标\n技术标\n电子标上传\n广联达\n资格预审',
    summary: '8 年工程类标书编制经验，独立完成 60 余个项目，熟悉市政、房建、水利的评分办法。',
    experience: '宏远建设｜标书主管｜2021–2026｜带 3 人小组，负责市政项目商务标与技术标\n中天咨询｜标书专员｜2018–2021｜工程类标书编制与电子标上传',
    portfolio: '某市政道路改造项目商务标（一正两副，一次通过初审）\n某学校食堂服务项目技术标（含人员配置与食安承诺）',
    visible: 'applied',
    created_at: minsAgo(60 * 24 * 10), updated_at: minsAgo(60 * 24 * 3)
  },
  {
    user_id: 'u3', title: '造价员 · 4 年 · 远程', category: '造价/预算',
    employment: 'remote', city: '远程', years: 4, education: '大专',
    salary_min: 8000, salary_max: 12000,
    skills: '广联达\n清单编制\n预算审核',
    summary: '4 年安装与土建造价经验，可远程做清单编制与预算审核。',
    experience: '中联咨询｜造价员｜2022–2026｜安装工程清单与预算\n个人接单｜2020–2022｜土建预算编制',
    portfolio: '某园区安装工程清单编制（含 3000 余条清单项）',
    visible: 'public',
    created_at: minsAgo(60 * 24 * 6), updated_at: minsAgo(60 * 24 * 2)
  }
];

const job_posts = [
  {
    id: 'j1', employer_id: 'u1', title: '标书编制（工程类）', category: '标书编制',
    employment: 'fulltime', city: '杭州', headcount: 1,
    salary_min: 12000, salary_max: 18000, salary_unit: 'month',
    experience: '3-5 年', education: '本科',
    description: '1. 独立完成市政、房建项目的商务标、技术标编制，按评分办法逐条响应；\n2. 整理资格证明材料、业绩合同、人员证书，完成标书排版与装订；\n3. 配合电子标上传、CA 办理与开标前的答疑澄清；\n4. 与项目部对接，跟进招标文件澄清与补遗。',
    requirement: '1. 3 年以上工程类标书编制经验，能独立完成一正两副；\n2. 熟悉《招标投标法》与常见评分办法，能识别废标风险点；\n3. 熟练使用 Word、Excel、PDF 排版工具，会电子标平台操作；\n4. 细致、抗压，能接受投标季的短期加班（可调休）。',
    perks: '五险一金，双休，投标季补贴',
    status: 'open', expires_at: daysFromNow(20),
    created_at: minsAgo(60 * 24 * 5), updated_at: minsAgo(60 * 24 * 5)
  },
  {
    id: 'j2', employer_id: 'u4', title: '造价员（兼职 · 远程）', category: '造价/预算',
    employment: 'parttime', city: '远程', headcount: 2,
    salary_min: 400, salary_max: 600, salary_unit: 'day',
    experience: '1-3 年', education: '大专',
    description: '清单编制与预算审核，远程协作，按项目结算。\n每周投入 2–3 天，时间可协商。',
    requirement: '熟悉广联达，能独立完成安装或土建清单编制；\n有造价员证优先，能接受线上对账。',
    perks: '远程，时间灵活',
    status: 'open', expires_at: daysFromNow(12),
    created_at: minsAgo(60 * 24 * 2), updated_at: minsAgo(60 * 24 * 2)
  },
  {
    id: 'j3', employer_id: 'u4', title: '工程资料员', category: '工程资料',
    employment: 'fulltime', city: '苏州', headcount: 1,
    salary_min: 6000, salary_max: 8000, salary_unit: 'month',
    experience: '不限', education: '大专',
    description: '整理竣工资料、备案材料与过程验收记录，配合项目部完成归档。',
    requirement: '细心、有耐心，会用资料软件；应届生可培养。',
    perks: '包住，双休',
    status: 'open', expires_at: daysFromNow(30),
    created_at: minsAgo(60 * 20), updated_at: minsAgo(60 * 20)
  },
  {
    id: 'j4', employer_id: 'u4', title: '标书助理（应届）', category: '标书编制',
    employment: 'fulltime', city: '南京', headcount: 1,
    salary_min: 5000, salary_max: 7000, salary_unit: 'month',
    experience: '1 年以内', education: '大专',
    description: '协助标书排版、材料整理与电子标上传，有老师带。',
    requirement: '应届或 1 年内经验，愿意长期做标书；细心、能加班。',
    perks: '带薪培训，双休',
    status: 'pending', expires_at: daysFromNow(30),
    created_at: minsAgo(180), updated_at: minsAgo(180)
  }
];

const job_applications = [
  {
    id: 'a1', job_id: 'j1', employer_id: 'u1', applicant_id: 'u2',
    resume_snapshot: resumes[0], cover_letter: '做过 6 个市政项目的商务标，熟悉杭州交易中心电子标流程，可两周内到岗。',
    status: 'invited', viewed_at: minsAgo(60 * 24 * 2), created_at: minsAgo(60 * 24 * 2), updated_at: minsAgo(60 * 24)
  },
  {
    id: 'a2', job_id: 'j2', employer_id: 'u4', applicant_id: 'u3',
    resume_snapshot: resumes[1], cover_letter: '可远程，每周能投入 3 天。',
    status: 'submitted', viewed_at: null, created_at: minsAgo(60 * 5), updated_at: minsAgo(60 * 5)
  },
  {
    id: 'a3', job_id: 'j1', employer_id: 'u1', applicant_id: 'u3',
    resume_snapshot: resumes[1], cover_letter: null,
    status: 'viewed', viewed_at: minsAgo(60 * 20), created_at: minsAgo(60 * 30), updated_at: minsAgo(60 * 20)
  },
  {
    id: 'a4', job_id: 'j3', employer_id: 'u4', applicant_id: 'u2',
    resume_snapshot: resumes[0], cover_letter: '想转资料方向，可以接受苏州驻场。',
    status: 'hired', viewed_at: minsAgo(60 * 14), created_at: minsAgo(60 * 16), updated_at: minsAgo(60 * 10)
  }
];

const application_messages = [
  { id: 'am1', application_id: 'a1', sender_id: 'u2', body: '张工您好，我做过 6 个市政项目，想问下这个岗位主要做商务标还是技术标？', created_at: minsAgo(60 * 40) },
  { id: 'am2', application_id: 'a1', sender_id: 'u1', body: '偏商务标，技术标有模板，偶尔要配合电子标上传。你什么时候能到岗？', created_at: minsAgo(60 * 36) },
  { id: 'am3', application_id: 'a1', sender_id: 'u2', body: '两周内可以。方便的话约个线上面聊？', created_at: minsAgo(60 * 30) },
  { id: 'am4', application_id: 'a2', sender_id: 'u3', body: '您好，我每周能投入 3 天，清单和预算都可以做。', created_at: minsAgo(60 * 4) }
];

const application_notes = [
  { application_id: 'a1', employer_id: 'u1', body: '11-28 线上面聊，重点问电子标与杭州交易中心流程。', updated_at: minsAgo(60 * 20) }
];

/* ---------- 内存 store ---------- */
const store = {
  profiles, profile_contacts: contacts, tasks, bids, messages,
  reviews, files, notifications, reports, game_scores: [],
  job_posts, resumes, job_applications, application_messages, application_notes
};

let currentUserId = 'u1';
let authCb = null;

const sessionFor = (uid) => {
  if (!uid) return null;
  const p = profiles.find(x => x.id === uid);
  return { user: { id: uid, email: p ? p.email : uid + '@example.com' } };
};

/* ---------- 查询构建器 ---------- */
const clone = (v) => JSON.parse(JSON.stringify(v));

function matchOrCond(row, part) {
  const m = String(part || '').trim().match(/^([a-zA-Z0-9_]+)\.(is|eq|neq|gte|lte|gt|lt|ilike)\.(.*)$/);
  if (!m) return false;
  const [, col, op, val] = m;
  const cur = row[col];
  if (op === 'is') return val === 'null' ? (cur === null || cur === undefined) : cur === val;
  if (op === 'eq') return cur === val;
  if (op === 'neq') return cur !== val;
  if (op === 'ilike') {
    return String(cur || '').toLowerCase().includes(String(val).replace(/%/g, '').toLowerCase());
  }
  if (op === 'gte') return cur >= val;
  if (op === 'lte') return cur <= val;
  if (op === 'gt') return cur > val;
  if (op === 'lt') return cur < val;
  return false;
}

function decorate(table, row, cols) {
  if (!row) return row;
  const out = { ...row };
  if (table === 'tasks' && /owner\s*:/.test(cols)) {
    out.owner = profiles.find(p => p.id === row.owner_id) || null;
  }
  if (table === 'bids') {
    if (/provider\s*:/.test(cols)) out.provider = profiles.find(p => p.id === row.provider_id) || null;
    if (/task\s*:/.test(cols)) out.task = tasks.find(t => t.id === row.task_id) || null;
  }
  if (table === 'messages' && /sender\s*:/.test(cols)) {
    out.sender = profiles.find(p => p.id === row.sender_id) || null;
  }
  if (table === 'profiles' && /contacts\s*:/.test(cols)) {
    out.contacts = contacts.find(c => c.user_id === row.id) || null;
  }
  if (table === 'game_scores' && /user\s*:/.test(cols)) {
    const profile = profiles.find(p => p.id === row.user_id);
    out.user = profile ? { nickname: profile.nickname } : null;
  }
  if (table === 'job_posts' && /employer\s*:/.test(cols)) {
    out.employer = profiles.find(p => p.id === row.employer_id) || null;
  }
  if (table === 'job_applications') {
    if (/applicant\s*:/.test(cols)) out.applicant = profiles.find(p => p.id === row.applicant_id) || null;
    if (/employer\s*:/.test(cols)) out.employer = profiles.find(p => p.id === row.employer_id) || null;
    if (/\bjob\s*:/.test(cols)) out.job = job_posts.find(j => j.id === row.job_id) || null;
  }
  if (table === 'resumes' && /\buser\s*:/.test(cols)) {
    out.user = profiles.find(p => p.id === row.user_id) || null;
  }
  if (table === 'application_messages' && /sender\s*:/.test(cols)) {
    out.sender = profiles.find(p => p.id === row.sender_id) || null;
  }
  return out;
}

class Query {
  constructor(table, op = 'select', payload = null) {
    this.table = table;
    this.op = op;
    this.payload = payload;
    this.filters = [];
    this._orders = [];
    this.cols = '*';
    this._count = null;
    this._head = false;
    this._order = null;
    this._limit = null;
    this._range = null;
    this._single = null;
    this._or = null;
  }

  select(cols = '*', opts) {
    this.cols = cols || '*';
    if (opts && opts.count) this._count = opts.count;
    if (opts && opts.head) this._head = true;
    return this;
  }

  insert(payload) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload) { this.op = 'update'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(payload) { this.op = 'upsert'; this.payload = payload; return this; }

  eq(c, v) { this.filters.push([c, 'eq', v]); return this; }
  neq(c, v) { this.filters.push([c, 'neq', v]); return this; }
  in(c, v) { this.filters.push([c, 'in', v]); return this; }
  is(c, v) { this.filters.push([c, 'is', v]); return this; }
  ilike(c, v) { this.filters.push([c, 'ilike', v]); return this; }
  gte(c, v) { this.filters.push([c, 'gte', v]); return this; }
  lte(c, v) { this.filters.push([c, 'lte', v]); return this; }
  gt(c, v) { this.filters.push([c, 'gt', v]); return this; }
  lt(c, v) { this.filters.push([c, 'lt', v]); return this; }
  or(expr) { this._or = String(expr || ''); return this; }

  order(col, opts) { this._orders.push({ col, ascending: opts?.ascending !== false, nullsFirst: opts?.nullsFirst === true }); return this; }
  limit(n) { this._limit = n; return this; }
  range(a, b) { this._range = [a, b]; return this; }
  single() { this._single = 'one'; return this; }
  maybeSingle() { this._single = 'maybe'; return this; }

  _match(row) {
    const base = this.filters.every(([col, op, val]) => {
      const cur = row[col];
      if (op === 'eq') return cur === val;
      if (op === 'neq') return cur !== val;
      if (op === 'in') return Array.isArray(val) && val.includes(cur);
      if (op === 'is') return val === null ? (cur === null || cur === undefined) : cur === val;
      if (op === 'ilike') {
        const needle = String(val).replace(/%/g, '').toLowerCase();
        return String(cur || '').toLowerCase().includes(needle);
      }
      if (op === 'gte') return cur >= val;
      if (op === 'lte') return cur <= val;
      if (op === 'gt') return cur > val;
      if (op === 'lt') return cur < val;
      return true;
    });
    if (!base) return false;
    if (!this._or) return true;
    return this._or.split(',').some(part => matchOrCond(row, part));
  }

  async _run() {
    const rows = store[this.table];
    if (!rows) return { data: null, error: { message: '未知数据表：' + this.table } };

    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      const created = list.map((item, i) => {
        const row = {
          id: item.id || 'x' + Date.now() + i,
          created_at: item.created_at || new Date().toISOString(),
          ...item
        };
        if (this.table === 'tasks' && !row.status) row.status = 'pending';
        if (this.table === 'job_posts') {
          if (!row.status) row.status = 'pending';
          if (!row.expires_at) row.expires_at = daysFromNow(30);
          row.updated_at = row.updated_at || row.created_at;
        }
        if (['resumes', 'job_applications', 'application_notes'].includes(this.table)) {
          row.updated_at = row.updated_at || row.created_at || new Date().toISOString();
        }
        if (this.table === 'application_notes') row.id = row.application_id;
        rows.push(row);
        return clone(decorate(this.table, row, this.cols));
      });

      // 模拟数据库触发器产生的站内通知
      if (this.table === 'bids' && created[0]) {
        const b = created[0];
        const task = findTask(b.task_id);
        const me = profiles.find(p => p.id === b.provider_id);
        if (task && task.owner_id !== b.provider_id) {
          notify(task.owner_id, 'bid', task.id,
            (me ? me.nickname : '有人') + ' 对「' + task.title + '」报价 ¥' + b.amount);
        }
      }
      if (this.table === 'messages' && created[0]) {
        const m = created[0];
        const task = findTask(m.task_id);
        const me = profiles.find(p => p.id === m.sender_id);
        if (task) {
          const other = m.sender_id === task.owner_id
            ? (bids.find(x => x.task_id === task.id && x.status === 'accepted') || {}).provider_id
            : task.owner_id;
          if (other && other !== m.sender_id) {
            notify(other, 'message', task.id,
              (me ? me.nickname : '对方') + '：' + String(m.body).slice(0, 40));
          }
        }
      }

      // 投递会话：模拟通知触发器
      if (this.table === 'application_messages' && created[0]) {
        const m = created[0];
        const app = findApp(m.application_id);
        if (app) {
          const other = m.sender_id === app.employer_id ? app.applicant_id : app.employer_id;
          const sender = profiles.find(p => p.id === m.sender_id);
          if (other && other !== m.sender_id) {
            notifyJob(other, 'job_message', app.job_id, app.id,
              (sender ? sender.nickname : '对方') + '：' + String(m.body).slice(0, 40));
          }
        }
      }

      return { data: this._single ? created[0] : created, error: null, count: created.length };
    }

    if (this.op === 'upsert') {
      const item = this.payload;
      const key = (this.table === 'profile_contacts' || this.table === 'resumes') ? 'user_id'
        : this.table === 'application_notes' ? 'application_id'
        : 'id';
      const idx = rows.findIndex(r => r[key] === item[key]);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...item, updated_at: new Date().toISOString() };
      else rows.push({ id: item.id || item[key] || 'x' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item });
      return { data: [clone(item)], error: null };
    }

    const matched = rows.filter(r => this._match(r));

    if (this.op === 'update') {
      for (const r of matched) {
        Object.assign(r, this.payload);
        if (['job_posts', 'resumes', 'job_applications', 'application_notes'].includes(this.table)) {
          r.updated_at = new Date().toISOString();
        }
      }
      return { data: matched.map(r => clone(r)), error: null };
    }

    if (this.op === 'delete') {
      for (const r of matched) {
        const idx = rows.indexOf(r);
        if (idx >= 0) rows.splice(idx, 1);
      }
      return { data: matched.map(r => clone(r)), error: null };
    }

    // select
    let list = matched;
    if (this._orders.length) {
      list = [...list].sort((a, b) => {
        for (const { col, ascending, nullsFirst } of this._orders) {
          const av = a[col], bv = b[col];
          if (av === bv || (av == null && bv == null)) continue;
          if (av == null) return nullsFirst ? -1 : 1;
          if (bv == null) return nullsFirst ? 1 : -1;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        }
        return 0;
      });
    }

    const total = list.length;

    if (this._range) {
      const [a, b] = this._range;
      list = list.slice(a, b + 1);
    }
    if (this._limit != null) list = list.slice(0, this._limit);

    if (this._head) return { data: null, error: null, count: total };

    const decorated = list.map(r => clone(decorate(this.table, r, this.cols)));

    if (this._single === 'one') {
      if (decorated.length !== 1) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      }
      return { data: decorated[0], error: null, count: total };
    }
    if (this._single === 'maybe') {
      return { data: decorated[0] || null, error: null, count: total };
    }

    return { data: decorated, error: null, count: this._count ? total : null };
  }

  then(resolve, reject) {
    return Promise.resolve().then(() => this._run()).then(resolve, reject);
  }
}

/* ---------- RPC ---------- */
function notify(userId, kind, taskId, body) {
  if (!userId) return;
  store.notifications.unshift({
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
    user_id: userId,
    kind,
    task_id: taskId || null,
    body,
    read_at: null,
    created_at: new Date().toISOString()
  });
}

function notifyJob(userId, kind, jobId, appId, body) {
  if (!userId) return;
  store.notifications.unshift({
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
    user_id: userId,
    kind,
    job_id: jobId || null,
    application_id: appId || null,
    body,
    read_at: null,
    created_at: new Date().toISOString()
  });
}

const nowIso = () => new Date().toISOString();
const todayStr = () => nowIso().slice(0, 10);
const meProfile = () => profiles.find(p => p.id === currentUserId) || {};
const findJob = (id) => job_posts.find(j => j.id === id) || null;
const findApp = (id) => job_applications.find(a => a.id === id) || null;

function findTask(id) { return tasks.find(t => t.id === id) || null; }
function findBid(id) { return bids.find(b => b.id === id) || null; }

function ok() { return { data: null, error: null }; }
function fail(msg) { return { data: null, error: { message: msg } }; }

async function rpc(name, params) {
  if (name === 'approve_task') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    if (task.status !== 'pending') return fail('只有待审核的任务可以审核');
    task.status = 'open';
    notify(task.owner_id, 'status', task.id, '审核通过，已上线');
    return ok();
  }

  if (name === 'reject_task') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    if (task.status !== 'pending') return fail('只有待审核的任务可以审核');
    task.status = 'rejected';
    task.review_note = params.p_note || null;
    notify(task.owner_id, 'status', task.id, '未通过审核');
    return ok();
  }

  if (name === 'accept_bid') {
    const bid = findBid(params.p_bid_id);
    if (!bid) return fail('报价不存在');
    const task = findTask(bid.task_id);
    if (!task) return fail('任务不存在');
    bids.filter(b => b.task_id === task.id).forEach(b => {
      b.status = b.id === bid.id ? 'accepted' : 'rejected';
    });
    task.status = 'matched';
    notify(bid.provider_id, 'accepted', task.id, '你的报价被选定：' + task.title);
    notify(task.owner_id, 'status', task.id, '已选定服务方');
    return ok();
  }

  if (name === 'mark_delivered') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    const bid = bids.find(b => b.task_id === task.id && b.status === 'accepted');
    if (!bid || bid.provider_id !== currentUserId) return fail('只有中标方可以标记交付');
    if (task.status !== 'matched') return fail('当前状态不能标记交付');
    task.status = 'delivered';
    notify(task.owner_id, 'status', task.id, '「' + task.title + '」已交付，等待确认');
    return ok();
  }

  if (name === 'confirm_complete') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    if (task.owner_id !== currentUserId) return fail('只有发布者可以确认完成');
    if (task.status !== 'delivered') return fail('等待对方标记交付后才能确认完成');
    task.status = 'completed';
    const bid = bids.find(b => b.task_id === task.id && b.status === 'accepted');
    if (bid) notify(bid.provider_id, 'status', task.id, '「' + task.title + '」已完成');
    return ok();
  }

  if (name === 'cancel_task') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    if (task.owner_id !== currentUserId) return fail('只有发布者可以取消任务');
    if (!['open', 'matched'].includes(task.status)) return fail('当前状态不能取消');
    task.status = 'cancelled';
    return ok();
  }

  if (name === 'submit_review') {
    const task = findTask(params.p_task);
    if (!task) return fail('任务不存在');
    if (task.status !== 'completed') return fail('任务完成后才能评价');
    const bid = bids.find(b => b.task_id === task.id && b.status === 'accepted');
    if (!bid) return fail('该任务没有中标方');
    let to = null;
    if (currentUserId === task.owner_id) to = bid.provider_id;
    else if (currentUserId === bid.provider_id) to = task.owner_id;
    else return fail('不是该任务的参与方');

    const existing = reviews.find(r => r.task_id === task.id && r.from_id === currentUserId);
    if (existing) {
      existing.score = params.p_score;
      existing.body = params.p_body || null;
    } else {
      reviews.push({
        id: 'r' + Date.now(),
        task_id: task.id,
        from_id: currentUserId,
        to_id: to,
        score: params.p_score,
        body: params.p_body || null,
        created_at: new Date().toISOString()
      });
    }
    const target = profiles.find(p => p.id === to);
    if (target) {
      const rs = reviews.filter(r => r.to_id === to);
      target.rating = Math.round((rs.reduce((s, r) => s + r.score, 0) / rs.length) * 10) / 10;
    }
    return ok();
  }

  if (name === 'approve_job') {
    if (!meProfile().is_admin) return fail('只有管理员可以审核岗位');
    const job = findJob(params.p_job);
    if (!job) return fail('岗位不存在');
    if (job.status !== 'pending') return fail('只有待审核的岗位可以审核');
    job.status = 'open';
    job.reviewed_at = nowIso();
    job.review_note = null;
    job.updated_at = nowIso();
    notifyJob(job.employer_id, 'job_status', job.id, null, '「' + job.title + '」审核通过，已上线');
    return ok();
  }

  if (name === 'reject_job') {
    if (!meProfile().is_admin) return fail('只有管理员可以审核岗位');
    const job = findJob(params.p_job);
    if (!job) return fail('岗位不存在');
    if (job.status !== 'pending') return fail('只有待审核的岗位可以审核');
    job.status = 'rejected';
    job.reviewed_at = nowIso();
    job.review_note = params.p_note || null;
    job.updated_at = nowIso();
    notifyJob(job.employer_id, 'job_status', job.id, null, '「' + job.title + '」未通过审核');
    return ok();
  }

  if (name === 'close_job') {
    const job = findJob(params.p_job);
    if (!job) return fail('岗位不存在');
    const actor = meProfile();
    if (!actor.is_admin && job.employer_id !== currentUserId) return fail('只有发布者可以关闭岗位');
    if (!['open', 'pending'].includes(job.status)) return fail('当前状态不能关闭');
    job.status = 'closed';
    job.updated_at = nowIso();
    if (currentUserId !== job.employer_id) {
      notifyJob(job.employer_id, 'job_status', job.id, null, '「' + job.title + '」已关闭');
    }
    return ok();
  }

  if (name === 'apply_job') {
    const user = meProfile();
    if (!user.id) return fail('请先登录');
    if (user.banned) return fail('账号已被限制，无法投递');
    const job = findJob(params.p_job);
    if (!job) return fail('岗位不存在');
    if (job.employer_id === currentUserId) return fail('不能投递自己发布的岗位');
    if (job.status !== 'open') return fail('该岗位未上线或已关闭');
    if (String(job.expires_at).slice(0, 10) < todayStr()) return fail('该岗位已过期');

    const resume = resumes.find(r => r.user_id === currentUserId);
    if (!resume) return fail('请先完善在线简历');

    const existing = job_applications.find(a => a.job_id === job.id && a.applicant_id === currentUserId);
    if (existing) {
      if (['submitted', 'viewed', 'invited', 'hired'].includes(existing.status)) {
        return fail('你已经投递过该岗位');
      }
      if (existing.status === 'rejected') return fail('该岗位暂不接受重复投递');
      existing.status = 'submitted';
      existing.resume_snapshot = clone(resume);
      existing.cover_letter = params.p_cover || null;
      existing.viewed_at = null;
      existing.created_at = nowIso();
      existing.updated_at = nowIso();
      notifyJob(job.employer_id, 'job_apply', job.id, existing.id, '求职者重新投递了「' + job.title + '」');
      return { data: existing.id, error: null };
    }

    const app = {
      id: 'a' + Date.now(),
      job_id: job.id,
      employer_id: job.employer_id,
      applicant_id: currentUserId,
      resume_snapshot: clone(resume),
      cover_letter: params.p_cover || null,
      status: 'submitted',
      viewed_at: null,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    job_applications.push(app);
    notifyJob(job.employer_id, 'job_apply', job.id, app.id,
      (user.nickname || '有人') + ' 投递了「' + job.title + '」');
    return { data: app.id, error: null };
  }

  if (name === 'job_app_set_status') {
    const app = findApp(params.p_app);
    if (!app) return fail('投递不存在');
    const next = params.p_status;
    if (!['viewed', 'invited', 'hired', 'rejected', 'withdrawn'].includes(next)) {
      return fail('不支持的处理动作');
    }
    const actor = meProfile();
    const job = findJob(app.job_id) || {};

    if (actor.is_admin) {
      app.status = next;
      app.updated_at = nowIso();
      return ok();
    }

    if (currentUserId === app.employer_id) {
      if (next === 'withdrawn') return fail('招聘方不能撤回投递');
      if (['hired', 'rejected', 'withdrawn'].includes(app.status)) return fail('该投递已结束，不能再处理');
      if (next === 'viewed' && app.status !== 'submitted') return ok();
      if (next === 'invited' && !['submitted', 'viewed'].includes(app.status)) return fail('当前状态不能邀面试');
      if (next === 'hired' && app.status !== 'invited') return fail('请先邀面试，再确认录用');

      if (['viewed', 'invited'].includes(next)) app.viewed_at = app.viewed_at || nowIso();
      app.status = next;
      app.updated_at = nowIso();

      const label = {
        viewed: '已查看你的投递', invited: '邀请你面试',
        hired: '已确认录用', rejected: '认为暂不合适'
      }[next] || next;
      notifyJob(app.applicant_id, 'job_status', app.job_id, app.id,
        '「' + (job.title || '岗位') + '」' + label);
      return ok();
    }

    if (currentUserId === app.applicant_id) {
      if (next !== 'withdrawn') return fail('求职者只能撤回投递');
      if (!['submitted', 'viewed', 'invited'].includes(app.status)) return fail('当前状态不能撤回');
      app.status = 'withdrawn';
      app.updated_at = nowIso();
      notifyJob(app.employer_id, 'job_status', app.job_id, app.id,
        '求职者撤回了「' + (job.title || '岗位') + '」的投递');
      return ok();
    }

    return fail('无权操作该投递');
  }

  return fail('演示模式不支持这个操作：' + name);
}

/* ---------- auth ---------- */
const auth = {
  async getSession() {
    return { data: { session: sessionFor(currentUserId) } };
  },
  onAuthStateChange(cb) {
    authCb = cb;
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signInWithPassword({ email }) {
    const account = String(email || '').split('@')[0];
    const p = profiles.find(x => x.email === email || x.email.split('@')[0] === account);
    if (!p) return { data: null, error: { message: 'Invalid login credentials' } };
    currentUserId = p.id;
    if (authCb) authCb('SIGNED_IN', sessionFor(p.id));
    return { data: { user: sessionFor(p.id).user, session: sessionFor(p.id) }, error: null };
  },
  async signUp({ email, options }) {
    const account = String(email || '').split('@')[0];
    let p = profiles.find(x => x.email.split('@')[0] === account);
    if (!p) {
      p = {
        id: 'u' + (profiles.length + 1) + Date.now().toString(36).slice(-3),
        nickname: (options && options.data && options.data.nickname) || account,
        email,
        role: 'both',
        verified: false,
        rating: 5,
        bio: null,
        company: null,
        is_admin: false,
        banned: false,
        created_at: new Date().toISOString()
      };
      profiles.push(p);
    }
    currentUserId = p.id;
    if (authCb) authCb('SIGNED_IN', sessionFor(p.id));
    return { data: { user: sessionFor(p.id).user, session: sessionFor(p.id) }, error: null };
  },
  async signOut() {
    currentUserId = null;
    if (authCb) authCb('SIGNED_OUT', null);
  },
  async updateUser() { return { data: { user: null }, error: null }; },
  async resetPasswordForEmail() { return { data: null, error: null }; }
};

/* ---------- storage ---------- */
const storage = {
  from() {
    return {
      // 真实环境这里会写对象存储；演示模式只返回成功，文件行由 lib 单独插入
      async upload(path) { return { data: { path }, error: null }; },
      async remove() { return { data: null, error: null }; },
      async createSignedUrl() { return { data: { signedUrl: '#' }, error: null }; }
    };
  }
};

const channelStub = {
  on() { return this; },
  subscribe() { return this; }
};

/* ---------- 对外接口 ---------- */
export const DEMO = !(window.__SUPABASE__ && window.__SUPABASE__.url && window.__SUPABASE__.anonKey);

export const demoApi = {
  switchUser(uid) {
    currentUserId = uid;
    if (authCb) authCb('SIGNED_IN', sessionFor(uid));
    return sessionFor(uid);
  },
  currentId() { return currentUserId; },
  users() { return profiles.map(p => ({ id: p.id, nickname: p.nickname, role: p.role })); }
};

export function createDemoClient() {
  return {
    from(table) { return new Query(table); },
    rpc,
    auth,
    storage,
    channel() { return channelStub; },
    removeChannel() {}
  };
}
