-- ============================================================
-- v9：招聘模块（标书人才市场）
--   岗位发布 → 管理员审核 → 投递 → 查看简历 → 邀面试 → 录用
-- 在 Supabase Dashboard → SQL Editor 整段执行；可重复执行。
-- 依赖：schema.sql 的 v1–v8 已执行
--   （is_admin() / is_banned() / notifications / reports / profile_contacts）
--
-- 设计要点：
--   1. 岗位、简历、投递、面试消息全部是纯文字，不接收任何文件。
--   2. 岗位公开写走 RLS；状态流转（审核、投递状态、关闭岗位）只走
--      security definer 函数，客户端不能直接 UPDATE status 绕过规则。
--   3. 投递时把简历快照写进 job_applications.resume_snapshot，
--      招聘方看到的是投递当天的版本，候选人之后改简历不会影响已投记录。
--   4. 招聘方把投递置为 invited / hired 之后，双方的 profile_contacts
--      才互相可见（联系方式不写进岗位/简历正文）。
-- ============================================================


-- ============================================================
-- 1. 资料补充：公司名
--    一个账号 = 一家公司 / 一个团队；个人招聘方可以留空，前台回退到昵称。
--    profiles 本来就是所有人可读，公司名也属于公开信息。
-- ============================================================

alter table public.profiles add column if not exists company text;


-- ============================================================
-- 2. 岗位
-- ============================================================

create table if not exists public.job_posts (
  id          uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 80),
  category    text not null
              check (category in ('标书编制','造价/预算','招标代理','工程资料','商务投标','其他')),
  employment  text not null default 'fulltime'
              check (employment in ('fulltime','parttime','remote','project')),
  city        text not null default '不限'
              check (char_length(btrim(city)) between 1 and 24),
  headcount   int  not null default 1 check (headcount between 1 and 99),
  salary_min  int  check (salary_min is null or salary_min >= 0),
  salary_max  int  check (salary_max is null or salary_max >= 0),
  salary_unit text not null default 'month'
              check (salary_unit in ('month','day','project')),
  experience  text not null default '不限'
              check (experience in ('不限','1 年以内','1-3 年','3-5 年','5 年以上')),
  education   text not null default '不限'
              check (education in ('不限','大专','本科','硕士及以上')),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  requirement text not null check (char_length(btrim(requirement)) between 5 and 4000),
  perks       text,
  status      text not null default 'pending'
              check (status in ('pending','open','closed','rejected')),
  expires_at  date not null default (current_date + 30),
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.job_posts drop constraint if exists job_posts_salary_check;
alter table public.job_posts add constraint job_posts_salary_check
  check (salary_min is null or salary_max is null or salary_max >= salary_min);

create index if not exists job_posts_status_idx  on public.job_posts (status, created_at desc);
create index if not exists job_posts_employer_idx on public.job_posts (employer_id, created_at desc);
create index if not exists job_posts_city_idx    on public.job_posts (city);
create index if not exists job_posts_expires_idx on public.job_posts (expires_at);


-- ============================================================
-- 3. 在线简历（一人一份，纯文字）
--    不接收简历附件：平台的产品边界是不接收任何文件。
-- ============================================================

create table if not exists public.resumes (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 60),
  category    text not null default '标书编制'
              check (category in ('标书编制','造价/预算','招标代理','工程资料','商务投标','其他')),
  employment  text not null default 'fulltime'
              check (employment in ('fulltime','parttime','remote','project')),
  city        text not null default '不限'
              check (char_length(btrim(city)) between 1 and 24),
  years       int  not null default 0 check (years between 0 and 50),
  education   text not null default '不限'
              check (education in ('不限','大专','本科','硕士及以上')),
  salary_min  int check (salary_min is null or salary_min >= 0),
  salary_max  int check (salary_max is null or salary_max >= 0),
  skills      text,
  summary     text check (char_length(coalesce(summary, '')) <= 800),
  experience  text check (char_length(coalesce(experience, '')) <= 3000),
  portfolio   text check (char_length(coalesce(portfolio, '')) <= 2000),
  visible     text not null default 'applied'
              check (visible in ('public','applied')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.resumes drop constraint if exists resumes_salary_check;
alter table public.resumes add constraint resumes_salary_check
  check (salary_min is null or salary_max is null or salary_max >= salary_min);

create index if not exists resumes_visible_idx on public.resumes (visible, updated_at desc);
create index if not exists resumes_category_idx on public.resumes (category);


-- ============================================================
-- 4. 投递
--    employer_id 冗余一列：RLS、通知、列表都不必再 join job_posts。
--    resume_snapshot：投递当天的简历 JSON，保证记录不被事后修改。
-- ============================================================

create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.job_posts(id) on delete cascade,
  employer_id     uuid not null references public.profiles(id) on delete cascade,
  applicant_id    uuid not null references public.profiles(id) on delete cascade,
  resume_snapshot jsonb not null,
  cover_letter    text check (char_length(coalesce(cover_letter, '')) <= 600),
  status          text not null default 'submitted'
                  check (status in ('submitted','viewed','invited','hired','rejected','withdrawn')),
  viewed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create index if not exists job_applications_job_idx
  on public.job_applications (job_id, status);
create index if not exists job_applications_employer_idx
  on public.job_applications (employer_id, status, created_at desc);
create index if not exists job_applications_applicant_idx
  on public.job_applications (applicant_id, created_at desc);


-- ============================================================
-- 5. 投递会话（一条投递一条会话，不新建 IM）
-- ============================================================

create table if not exists public.application_messages (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  sender_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at     timestamptz not null default now()
);

create index if not exists application_messages_idx
  on public.application_messages (application_id, created_at);


-- ============================================================
-- 5b. 招聘方内部备注
--    单独一张表，因为 job_applications 的行对求职者可见，
--    备注不能放在那一行上，否则求职者能直接读到。
-- ============================================================

create table if not exists public.application_notes (
  application_id uuid primary key references public.job_applications(id) on delete cascade,
  employer_id    uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 600),
  updated_at     timestamptz not null default now()
);


-- ============================================================
-- 6. 站内通知与举报的扩展
--    通知仍然一张表，只加两个可空外键；历史行不受影响。
-- ============================================================

alter table public.notifications
  add column if not exists job_id uuid references public.job_posts(id) on delete set null;
alter table public.notifications
  add column if not exists application_id uuid references public.job_applications(id) on delete set null;

create index if not exists notifications_job_idx on public.notifications (job_id);

-- 举报对象增加岗位 / 简历
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('task','user','message','job','resume'));


-- ============================================================
-- 7. 通用工具
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_job_touch on public.job_posts;
create trigger trg_job_touch before update on public.job_posts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_resume_touch on public.resumes;
create trigger trg_resume_touch before update on public.resumes
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_app_touch on public.job_applications;
create trigger trg_app_touch before update on public.job_applications
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_note_touch on public.application_notes;
create trigger trg_note_touch before update on public.application_notes
  for each row execute function public.touch_updated_at();


-- ============================================================
-- 8. 权限判断函数（security definer，避免 RLS 策略互相递归）
-- ============================================================

-- 我是不是这个岗位的发布者
create or replace function public.is_job_employer(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_posts j
    where j.id = p_job and j.employer_id = auth.uid()
  );
$$;

-- 我是否投递过这个岗位（岗位关闭后仍可回看）
create or replace function public.has_applied_job(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_applications a
    where a.job_id = p_job and a.applicant_id = auth.uid()
  );
$$;

-- 我是不是这条投递的双方之一
create or replace function public.is_app_participant(p_app uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_applications a
    where a.id = p_app
      and (a.applicant_id = auth.uid() or a.employer_id = auth.uid())
  );
$$;

-- 我是不是这条投递的招聘方（比 is_app_participant 更严，用于内部备注）
create or replace function public.is_app_employer(p_app uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_applications a
    where a.id = p_app and a.employer_id = auth.uid()
  );
$$;

-- 我能不能看 p_user 的联系方式：仅当双方因这条投递进入邀面试 / 已录用
create or replace function public.has_invite_relation(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_applications a
    where a.status in ('invited','hired')
      and (
        (a.applicant_id = auth.uid() and a.employer_id = p_user)
        or (a.employer_id = auth.uid() and a.applicant_id = p_user)
      )
  );
$$;

-- 我能不能看 p_user 的简历：公开简历，或对方投递过我发布的岗位
create or replace function public.can_view_resume(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.resumes r
    where r.user_id = p_user and r.visible = 'public'
  )
  or exists (
    select 1 from public.job_applications a
    where a.applicant_id = p_user
      and a.employer_id = auth.uid()
      and a.status in ('submitted','viewed','invited','hired','rejected')
  );
$$;


-- ============================================================
-- 9. RLS
-- ============================================================

alter table public.job_posts           enable row level security;
alter table public.resumes            enable row level security;
alter table public.job_applications   enable row level security;
alter table public.application_messages enable row level security;
alter table public.application_notes  enable row level security;

-- ---------- 岗位 ----------
drop policy if exists "jobs_read"       on public.job_posts;
drop policy if exists "jobs_insert"     on public.job_posts;
drop policy if exists "jobs_update_own" on public.job_posts;
drop policy if exists "jobs_delete_own" on public.job_posts;
drop policy if exists "jobs_admin_all"  on public.job_posts;

-- 在招的公开；自己的全部；投递过的可回看；管理员全部
create policy "jobs_read" on public.job_posts for select
  using (
    status = 'open'
    or auth.uid() = employer_id
    or public.is_admin()
    or public.has_applied_job(id)
  );

create policy "jobs_insert" on public.job_posts for insert
  with check (auth.uid() = employer_id and not public.is_banned());

-- 只允许改自己的岗位；status 字段由触发器把关（见第 10 节）
create policy "jobs_update_own" on public.job_posts for update
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id and not public.is_banned());

-- 上线中的岗位不能硬删，先关闭；待审核 / 驳回 / 已关闭可以删
create policy "jobs_delete_own" on public.job_posts for delete
  using (auth.uid() = employer_id and status in ('pending','rejected','closed'));

create policy "jobs_admin_all" on public.job_posts for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 简历 ----------
drop policy if exists "resumes_read"       on public.resumes;
drop policy if exists "resumes_upsert_own" on public.resumes;
drop policy if exists "resumes_update_own" on public.resumes;
drop policy if exists "resumes_delete_own" on public.resumes;
drop policy if exists "resumes_admin_all"  on public.resumes;

create policy "resumes_read" on public.resumes for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (auth.uid() is not null and public.can_view_resume(user_id))
  );

create policy "resumes_upsert_own" on public.resumes for insert
  with check (user_id = auth.uid() and not public.is_banned());

create policy "resumes_update_own" on public.resumes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned());

create policy "resumes_delete_own" on public.resumes for delete
  using (user_id = auth.uid());

create policy "resumes_admin_all" on public.resumes for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 投递 ----------
drop policy if exists "apps_read"     on public.job_applications;

-- 只读：写入与状态变更只能走 apply_job / job_app_set_status
create policy "apps_read" on public.job_applications for select
  using (
    applicant_id = auth.uid()
    or employer_id = auth.uid()
    or public.is_admin()
  );

-- ---------- 投递会话 ----------
drop policy if exists "app_msg_read"   on public.application_messages;
drop policy if exists "app_msg_insert" on public.application_messages;

create policy "app_msg_read" on public.application_messages for select
  using (public.is_app_participant(application_id) or public.is_admin());

create policy "app_msg_insert" on public.application_messages for insert
  with check (
    auth.uid() = sender_id
    and not public.is_banned()
    and public.is_app_participant(application_id)
    and exists (
      select 1 from public.job_applications a
      where a.id = application_id
        and a.status in ('submitted','viewed','invited','hired')
    )
  );

-- ---------- 招聘方内部备注：只有招聘方和管理员 ----------
drop policy if exists "app_notes_read"   on public.application_notes;
drop policy if exists "app_notes_insert" on public.application_notes;
drop policy if exists "app_notes_update" on public.application_notes;
drop policy if exists "app_notes_admin"  on public.application_notes;

create policy "app_notes_read" on public.application_notes for select
  using (public.is_app_employer(application_id) or public.is_admin());

create policy "app_notes_insert" on public.application_notes for insert
  with check (employer_id = auth.uid() and public.is_app_employer(application_id));

create policy "app_notes_update" on public.application_notes for update
  using (employer_id = auth.uid() and public.is_app_employer(application_id))
  with check (employer_id = auth.uid() and public.is_app_employer(application_id));

create policy "app_notes_admin" on public.application_notes for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 联系方式：邀面试 / 录用后才互相可见 ----------
drop policy if exists "contacts_recruit_select" on public.profile_contacts;
create policy "contacts_recruit_select" on public.profile_contacts for select
  using (public.has_invite_relation(user_id));


-- ============================================================
-- 10. 写入保护：客户端不能直接改岗位状态
--     1) 不能改 employer_id
--     2) 非管理员不能改 status；关闭岗位走 close_job()
--     3) 已上线岗位改内容 → 自动回到 pending 重新审核
--     4) 被驳回的岗位改内容 → 自动回到 pending 重新提交
-- ============================================================

create or replace function public.guard_job_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changed boolean;
begin
  -- 管理员，或受信任的业务函数（close_job 会在事务内打开这个标记）
  if public.is_admin() or current_setting('bidmarket.job_transition', true) = 'on' then
    return new;
  end if;

  if new.employer_id is distinct from old.employer_id then
    raise exception '不能变更岗位发布者';
  end if;

  v_changed :=
       new.title       is distinct from old.title
    or new.category    is distinct from old.category
    or new.employment  is distinct from old.employment
    or new.city        is distinct from old.city
    or new.headcount   is distinct from old.headcount
    or new.salary_min  is distinct from old.salary_min
    or new.salary_max  is distinct from old.salary_max
    or new.salary_unit is distinct from old.salary_unit
    or new.experience  is distinct from old.experience
    or new.education   is distinct from old.education
    or new.description is distinct from old.description
    or new.requirement is distinct from old.requirement
    or new.perks       is distinct from old.perks
    or new.expires_at  is distinct from old.expires_at;

  if old.status = 'closed' then
    raise exception '岗位已关闭，不能再修改';
  end if;

  -- 审核字段只由审核函数写
  new.reviewed_at := old.reviewed_at;
  new.review_note := old.review_note;

  if new.status is distinct from old.status then
    -- 唯一允许的“状态变化”是触发器自己把 open/rejected 打回 pending
    if not (v_changed and new.status = 'pending' and old.status in ('open','rejected')) then
      raise exception '岗位状态不能直接修改，请使用审核 / 关闭岗位操作';
    end if;
  end if;

  if v_changed and old.status in ('open','rejected') then
    new.status := 'pending';
    new.reviewed_at := null;
    new.review_note := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_job_guard on public.job_posts;
create trigger trg_job_guard before update on public.job_posts
  for each row execute function public.guard_job_update();


-- ============================================================
-- 11. 业务动作（全部 security definer + 内部校验）
-- ============================================================

-- ---------- 投递 ----------
-- 有撤回记录时可以重新投递；被驳回的不允许重复投递，避免反复骚扰。
create or replace function public.apply_job(p_job uuid, p_cover text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job    public.job_posts;
  v_resume public.resumes;
  v_app    public.job_applications;
  v_new_id uuid;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if public.is_banned() then raise exception '账号已被限制，无法投递'; end if;

  select * into v_job from public.job_posts where id = p_job;
  if v_job.id is null then raise exception '岗位不存在'; end if;
  if v_job.employer_id = auth.uid() then raise exception '不能投递自己发布的岗位'; end if;
  if v_job.status <> 'open' then raise exception '该岗位未上线或已关闭'; end if;
  if v_job.expires_at < current_date then raise exception '该岗位已过期'; end if;

  select * into v_resume from public.resumes where user_id = auth.uid();
  if v_resume.user_id is null then raise exception '请先完善在线简历'; end if;

  select * into v_app from public.job_applications
  where job_id = p_job and applicant_id = auth.uid();

  if v_app.id is not null then
    if v_app.status in ('submitted','viewed','invited','hired') then
      raise exception '你已经投递过该岗位';
    end if;
    if v_app.status = 'rejected' then
      raise exception '该岗位暂不接受重复投递';
    end if;

    -- withdrawn：允许再次投递，用最新简历刷新快照
    update public.job_applications
       set status = 'submitted',
           resume_snapshot = to_jsonb(v_resume),
           cover_letter = nullif(btrim(p_cover), ''),
           viewed_at = null,
           created_at = now()
     where id = v_app.id;
    return v_app.id;
  end if;

  insert into public.job_applications (job_id, employer_id, applicant_id, resume_snapshot, cover_letter)
  values (p_job, v_job.employer_id, auth.uid(), to_jsonb(v_resume), nullif(btrim(p_cover), ''))
  returning id into v_new_id;

  return v_new_id;
end $$;

-- ---------- 投递状态流转 ----------
-- 招聘方：submitted → viewed → invited → hired / rejected
-- 求职者：submitted / viewed / invited → withdrawn
-- 管理员：任意（用于纠错）
create or replace function public.job_app_set_status(p_app uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app  public.job_applications;
  v_next text := p_status;
  v_view boolean := false;
begin
  select * into v_app from public.job_applications where id = p_app;
  if v_app.id is null then raise exception '投递不存在'; end if;
  if p_status not in ('viewed','invited','hired','rejected','withdrawn') then
    raise exception '不支持的处理动作';
  end if;

  if public.is_admin() then
    update public.job_applications set status = v_next where id = p_app;
    return;
  end if;

  if auth.uid() = v_app.employer_id then
    if p_status = 'withdrawn' then raise exception '招聘方不能撤回投递'; end if;
    if v_app.status in ('hired','rejected','withdrawn') then
      raise exception '该投递已结束，不能再处理';
    end if;

    if p_status = 'viewed' then
      if v_app.status <> 'submitted' then return; end if;
      v_view := true;
    elsif p_status = 'invited' then
      if v_app.status not in ('submitted','viewed') then raise exception '当前状态不能邀面试'; end if;
      v_view := true;
    elsif p_status = 'hired' then
      if v_app.status <> 'invited' then raise exception '请先邀面试，再确认录用'; end if;
    end if;

    update public.job_applications
       set status = v_next,
           viewed_at = case when v_view then coalesce(viewed_at, now()) else viewed_at end
     where id = p_app;
    return;
  end if;

  if auth.uid() = v_app.applicant_id then
    if p_status <> 'withdrawn' then raise exception '求职者只能撤回投递'; end if;
    if v_app.status not in ('submitted','viewed','invited') then
      raise exception '当前状态不能撤回';
    end if;
    update public.job_applications set status = 'withdrawn' where id = p_app;
    return;
  end if;

  raise exception '无权操作该投递';
end $$;

-- ---------- 岗位审核（管理员） ----------
create or replace function public.approve_job(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception '只有管理员可以审核岗位'; end if;

  select status into v_status from public.job_posts where id = p_job;
  if v_status is null then raise exception '岗位不存在'; end if;
  if v_status <> 'pending' then raise exception '只有待审核的岗位可以审核'; end if;

  update public.job_posts
     set status = 'open', reviewed_at = now(), review_note = null
   where id = p_job;
end $$;

create or replace function public.reject_job(p_job uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception '只有管理员可以审核岗位'; end if;

  select status into v_status from public.job_posts where id = p_job;
  if v_status is null then raise exception '岗位不存在'; end if;
  if v_status <> 'pending' then raise exception '只有待审核的岗位可以审核'; end if;

  update public.job_posts
     set status = 'rejected', reviewed_at = now(), review_note = nullif(btrim(p_note), '')
   where id = p_job;
end $$;

-- ---------- 关闭岗位（招聘方） ----------
create or replace function public.close_job(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_employer uuid; v_status text;
begin
  select employer_id, status into v_employer, v_status
    from public.job_posts where id = p_job;

  if v_employer is null then raise exception '岗位不存在'; end if;
  if not public.is_admin() and v_employer <> auth.uid() then
    raise exception '只有发布者可以关闭岗位';
  end if;
  if v_status not in ('open','pending') then raise exception '当前状态不能关闭'; end if;

  -- 允许本次事务内修改状态（guard_job_update 会检查这个标记）
  perform set_config('bidmarket.job_transition', 'on', true);

  update public.job_posts set status = 'closed' where id = p_job;
end $$;

revoke all on function public.apply_job(uuid, text)             from public;
revoke all on function public.job_app_set_status(uuid, text)    from public;
revoke all on function public.approve_job(uuid)                 from public;
revoke all on function public.reject_job(uuid, text)            from public;
revoke all on function public.close_job(uuid)                   from public;

grant execute on function public.apply_job(uuid, text)          to authenticated;
grant execute on function public.job_app_set_status(uuid, text) to authenticated;
grant execute on function public.approve_job(uuid)              to authenticated;
grant execute on function public.reject_job(uuid, text)         to authenticated;
grant execute on function public.close_job(uuid)                to authenticated;


-- ============================================================
-- 12. 通知触发器
-- ============================================================

-- 收到投递 / 重新投递
create or replace function public.notify_on_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_name  text;
begin
  select left(title, 30) into v_title from public.job_posts where id = new.job_id;
  select nickname into v_name from public.profiles where id = new.applicant_id;

  insert into public.notifications (user_id, kind, job_id, application_id, body)
  values (
    new.employer_id, 'job_apply', new.job_id, new.id,
    coalesce(v_name, '有人') || ' 投递了「' || coalesce(v_title, '岗位') || '」'
  );
  return null;
end $$;

drop trigger if exists trg_notify_application on public.job_applications;
create trigger trg_notify_application after insert on public.job_applications
  for each row execute function public.notify_on_application();

-- 投递状态变化：给求职者，撤回则给招聘方
create or replace function public.notify_on_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_label text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  select left(title, 30) into v_title from public.job_posts where id = new.job_id;

  if new.status = 'withdrawn' then
    insert into public.notifications (user_id, kind, job_id, application_id, body)
    values (
      new.employer_id, 'job_status', new.job_id, new.id,
      '求职者撤回了「' || coalesce(v_title, '岗位') || '」的投递'
    );
    return null;
  end if;

  if new.status = 'submitted' then
    -- 撤回后重新投递
    insert into public.notifications (user_id, kind, job_id, application_id, body)
    values (
      new.employer_id, 'job_apply', new.job_id, new.id,
      '求职者重新投递了「' || coalesce(v_title, '岗位') || '」'
    );
    return null;
  end if;

  v_label := case new.status
    when 'viewed'   then '已查看你的投递'
    when 'invited'  then '邀请你面试'
    when 'hired'    then '已确认录用'
    when 'rejected' then '认为暂不合适'
    else new.status
  end;

  insert into public.notifications (user_id, kind, job_id, application_id, body)
  values (
    new.applicant_id, 'job_status', new.job_id, new.id,
    '「' || coalesce(v_title, '岗位') || '」' || v_label
  );
  return null;
end $$;

drop trigger if exists trg_notify_application_status on public.job_applications;
create trigger trg_notify_application_status after update on public.job_applications
  for each row execute function public.notify_on_application_status();

-- 岗位审核结果 / 关闭
create or replace function public.notify_on_job_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_label text;
  v_actor uuid := auth.uid();
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  v_label := case new.status
    when 'pending'  then '已提交，等待审核'
    when 'open'     then '审核通过，已上线'
    when 'rejected' then '未通过审核'
    when 'closed'   then '已关闭'
    else new.status
  end;

  if v_actor is not null and v_actor = new.employer_id then
    return null;   -- 自己的操作（改内容回到待审核、关闭岗位）不给自己发通知
  end if;

  insert into public.notifications (user_id, kind, job_id, body)
  values (
    new.employer_id, 'job_status', new.id,
    '「' || left(new.title, 30) || '」' || v_label
  );
  return null;
end $$;

drop trigger if exists trg_notify_job_status on public.job_posts;
create trigger trg_notify_job_status after update on public.job_posts
  for each row execute function public.notify_on_job_status();

-- 投递会话新消息
create or replace function public.notify_on_application_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_app  public.job_applications;
  v_other uuid;
  v_name  text;
begin
  select * into v_app from public.job_applications where id = new.application_id;
  if v_app.id is null then return null; end if;

  v_other := case when new.sender_id = v_app.employer_id then v_app.applicant_id
                  else v_app.employer_id end;

  select nickname into v_name from public.profiles where id = new.sender_id;

  if v_other is not null and v_other <> new.sender_id then
    insert into public.notifications (user_id, kind, job_id, application_id, body)
    values (
      v_other, 'job_message', v_app.job_id, new.application_id,
      coalesce(v_name, '对方') || '：' || left(new.body, 40)
    );
  end if;
  return null;
end $$;

drop trigger if exists trg_notify_application_message on public.application_messages;
create trigger trg_notify_application_message after insert on public.application_messages
  for each row execute function public.notify_on_application_message();


-- ============================================================
-- 13. 实时推送
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.job_posts;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.job_applications;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.application_messages;
exception when others then null;
end $$;

alter table public.application_messages replica identity full;
alter table public.job_applications replica identity full;


-- ============================================================
-- 14. 授权兜底（RLS 仍然控制行级权限）
-- ============================================================

grant select, insert, update, delete
  on public.job_posts, public.resumes, public.job_applications,
     public.application_messages, public.application_notes
  to anon, authenticated;

grant usage on schema public to anon, authenticated;
