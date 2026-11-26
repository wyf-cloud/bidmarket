-- ============================================================
-- 标书报价接单平台 · 最小可用数据库结构
-- 在 Supabase Dashboard → SQL Editor 里整段执行一次
-- 可重复执行（策略先 drop 再建）
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. 用户资料 ----------
-- 账号密码由 Supabase Auth 负责；这张表只放公开资料。
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null default '新用户',
  role       text not null default 'both' check (role in ('client','provider','both')),
  verified   boolean not null default false,   -- 人工审核通过后置 true
  rating     numeric(2,1) not null default 5.0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_all"    on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_read_all"    on public.profiles for select using (true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);

-- 注册时自动建资料（昵称来自 signUp 的 options.data.nickname）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nickname', ''),
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. 表结构 ----------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  category    text not null,
  budget_min  int,
  budget_max  int,
  deadline    date,
  description text not null,
  status      text not null default 'open'
              check (status in ('open','matched','in_progress','delivered','completed','cancelled')),
  created_at  timestamptz not null default now()
);

create index if not exists tasks_status_created_idx on public.tasks (status, created_at desc);

alter table public.tasks drop constraint if exists tasks_budget_check;
alter table public.tasks add constraint tasks_budget_check
  check (budget_min is null or budget_max is null or budget_max >= budget_min);

create table if not exists public.bids (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  amount      int not null check (amount > 0),
  eta_days    int check (eta_days is null or eta_days between 1 and 365),
  plan        text not null,
  status      text not null default 'submitted'
              check (status in ('submitted','accepted','rejected','withdrawn')),
  created_at  timestamptz not null default now(),
  unique (task_id, provider_id)          -- 一个任务一人只能报一次
);

create index if not exists bids_task_idx on public.bids (task_id);

-- 判断“我是否是该任务的参与方（投过报价）”。
-- security definer：绕过 RLS，避免 tasks ↔ bids 策略互相递归。
create or replace function public.is_task_participant(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bids b
    where b.task_id = p_task and b.provider_id = auth.uid()
  );
$$;

-- ---------- 3. 任务权限 ----------
alter table public.tasks enable row level security;

drop policy if exists "tasks_read"       on public.tasks;
drop policy if exists "tasks_insert"     on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

create policy "tasks_read" on public.tasks for select
  using (status = 'open' or auth.uid() = owner_id or public.is_task_participant(id));
create policy "tasks_insert" on public.tasks for insert
  with check (auth.uid() = owner_id);
create policy "tasks_update_own" on public.tasks for update
  using (auth.uid() = owner_id);
create policy "tasks_delete_own" on public.tasks for delete
  using (auth.uid() = owner_id and status = 'open');

-- ---------- 4. 报价权限 ----------
alter table public.bids enable row level security;

drop policy if exists "bids_read"     on public.bids;
drop policy if exists "bids_insert"   on public.bids;
drop policy if exists "bids_withdraw" on public.bids;

-- 接单方只能看自己的报价；任务发布者能看自己任务下的全部报价
create policy "bids_read" on public.bids for select
  using (
    auth.uid() = provider_id
    or exists (select 1 from public.tasks t where t.id = bids.task_id and t.owner_id = auth.uid())
  );

-- 只能在“招募中”的任务上报价，且不能给自己报价
create policy "bids_insert" on public.bids for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.status = 'open' and t.owner_id <> auth.uid()
    )
  );

-- 只能撤回自己的、还没被处理的报价
create policy "bids_withdraw" on public.bids for update
  using (auth.uid() = provider_id and status = 'submitted')
  with check (status = 'withdrawn');

-- ---------- 5. 选定报价（原子操作）----------
create or replace function public.accept_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_task  uuid;
  v_owner uuid;
begin
  select b.task_id, t.owner_id into v_task, v_owner
  from public.bids b
  join public.tasks t on t.id = b.task_id
  where b.id = p_bid_id;

  if v_task is null then
    raise exception '报价不存在';
  end if;
  if v_owner <> auth.uid() then
    raise exception '只有任务发布者可以选定报价';
  end if;

  update public.bids
     set status = case when id = p_bid_id then 'accepted' else 'rejected' end
   where task_id = v_task and status = 'submitted';

  update public.tasks set status = 'matched' where id = v_task;
end $$;

revoke all on function public.accept_bid(uuid) from public;
grant execute on function public.accept_bid(uuid) to authenticated;

-- ============================================================
-- v2：站内消息 / 交付闭环 / 互评 / 管理审核
-- 已经执行过上面部分的，只需执行这一段
-- ============================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

drop policy if exists "tasks_admin_all" on public.tasks;
create policy "tasks_admin_all" on public.tasks for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 站内消息 ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_task_idx on public.messages (task_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "messages_read"   on public.messages;
drop policy if exists "messages_insert" on public.messages;

create policy "messages_read" on public.messages for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = messages.task_id
        and (t.owner_id = auth.uid() or public.is_task_participant(t.id) or public.is_admin())
    )
  );

create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.owner_id = auth.uid() or public.is_task_participant(t.id))
    )
  );

-- ---------- 互评 ----------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  score      int not null check (score between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (task_id, from_id)          -- 每个任务每人一条，可更新
);

create index if not exists reviews_to_idx on public.reviews (to_id);

alter table public.reviews enable row level security;

drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select
  using (auth.uid() = from_id or auth.uid() = to_id or public.is_admin());

-- 不开放直接 insert：只能走 submit_review()，避免自评/评错人

-- 评分变化后重算对方平均分
create or replace function public.refresh_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_to uuid;
begin
  v_to := coalesce(new.to_id, old.to_id);
  update public.profiles p
     set rating = coalesce(
       (select round(avg(r.score)::numeric, 1) from public.reviews r where r.to_id = v_to),
       5.0
     )
   where p.id = v_to;
  return null;
end $$;

drop trigger if exists trg_refresh_rating on public.reviews;
create trigger trg_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_rating();

-- ---------- 状态流转 ----------
create or replace function public.mark_delivered(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_provider uuid;
begin
  select status into v_status from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_status <> 'matched' then raise exception '当前状态不能标记交付'; end if;

  select provider_id into v_provider
    from public.bids where task_id = p_task and status = 'accepted';
  if v_provider is null or auth.uid() <> v_provider then
    raise exception '只有中标方可以标记交付';
  end if;

  update public.tasks set status = 'delivered' where id = p_task;
end $$;

create or replace function public.confirm_complete(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_owner uuid;
begin
  select status, owner_id into v_status, v_owner from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_owner <> auth.uid() then raise exception '只有发布者可以确认完成'; end if;
  if v_status <> 'delivered' then raise exception '等待对方标记交付后才能确认完成'; end if;

  update public.tasks set status = 'completed' where id = p_task;
end $$;

create or replace function public.cancel_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_owner uuid;
begin
  select status, owner_id into v_status, v_owner from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_owner <> auth.uid() then raise exception '只有发布者可以取消任务'; end if;
  if v_status not in ('open','matched') then raise exception '当前状态不能取消'; end if;

  update public.tasks set status = 'cancelled' where id = p_task;
end $$;

-- ---------- 提交评价 ----------
create or replace function public.submit_review(p_task uuid, p_score int, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner    uuid;
  v_status   text;
  v_provider uuid;
  v_to       uuid;
begin
  select owner_id, status into v_owner, v_status from public.tasks where id = p_task;
  if v_owner is null then raise exception '任务不存在'; end if;
  if v_status <> 'completed' then raise exception '任务完成后才能评价'; end if;

  select provider_id into v_provider
    from public.bids where task_id = p_task and status = 'accepted';
  if v_provider is null then raise exception '该任务没有中标方'; end if;

  if auth.uid() = v_owner then
    v_to := v_provider;
  elsif auth.uid() = v_provider then
    v_to := v_owner;
  else
    raise exception '不是该任务的参与方';
  end if;

  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception '评分需在 1-5 之间';
  end if;

  insert into public.reviews (task_id, from_id, to_id, score, body)
  values (p_task, auth.uid(), v_to, p_score, nullif(btrim(p_body), ''))
  on conflict (task_id, from_id)
  do update set score = excluded.score, body = excluded.body, created_at = now();
end $$;

revoke all on function public.mark_delivered(uuid)   from public;
revoke all on function public.confirm_complete(uuid) from public;
revoke all on function public.cancel_task(uuid)      from public;
revoke all on function public.submit_review(uuid, int, text) from public;

grant execute on function public.mark_delivered(uuid)          to authenticated;
grant execute on function public.confirm_complete(uuid)        to authenticated;
grant execute on function public.cancel_task(uuid)             to authenticated;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- ============================================================
-- v3：附件 / 站内通知 / 举报 / 封禁 / 资料完善
-- 已执行过 v1、v2 的，只需执行这一段
-- ============================================================

alter table public.profiles add column if not exists bio    text;
alter table public.profiles add column if not exists banned boolean not null default false;

-- 联系方式单独存，避免 profiles 的公开读策略把手机号、微信泄露给所有人
create table if not exists public.profile_contacts (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  phone      text,
  wechat     text,
  updated_at timestamptz not null default now()
);

alter table public.profile_contacts enable row level security;

drop policy if exists "contacts_self_select" on public.profile_contacts;
drop policy if exists "contacts_self_insert" on public.profile_contacts;
drop policy if exists "contacts_self_update" on public.profile_contacts;

create policy "contacts_self_select" on public.profile_contacts for select
  using (auth.uid() = user_id or public.is_admin());
create policy "contacts_self_insert" on public.profile_contacts for insert
  with check (auth.uid() = user_id);
create policy "contacts_self_update" on public.profile_contacts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.banned from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_task_owner(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and t.owner_id = auth.uid());
$$;

create or replace function public.is_task_open(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and t.status = 'open');
$$;

-- 被封禁的人不能再发任务、报价、发消息
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert
  with check (auth.uid() = owner_id and not public.is_banned());

drop policy if exists "bids_insert" on public.bids;
create policy "bids_insert" on public.bids for insert
  with check (
    auth.uid() = provider_id
    and not public.is_banned()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.status = 'open' and t.owner_id <> auth.uid()
    )
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not public.is_banned()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.owner_id = auth.uid() or public.is_task_participant(t.id))
    )
  );

-- ---------- 附件 ----------
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'task' check (kind in ('task','deliverable')),
  path        text not null unique,
  name        text not null,
  size        bigint,
  mime        text,
  created_at  timestamptz not null default now()
);

create index if not exists files_task_idx on public.files (task_id);

alter table public.files enable row level security;

drop policy if exists "files_read"   on public.files;
drop policy if exists "files_insert" on public.files;
drop policy if exists "files_delete" on public.files;

create policy "files_read" on public.files for select
  using (
    auth.uid() is not null
    and (
      uploader_id = auth.uid()
      or public.is_task_owner(task_id)
      or public.is_task_participant(task_id)
      or public.is_task_open(task_id)
      or public.is_admin()
    )
  );

create policy "files_insert" on public.files for insert
  with check (
    auth.uid() = uploader_id
    and not public.is_banned()
    and (public.is_task_owner(task_id) or public.is_task_participant(task_id))
  );

create policy "files_delete" on public.files for delete
  using (auth.uid() = uploader_id or public.is_admin());

-- 存储桶（私有）
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "att_insert" on storage.objects;
create policy "att_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  );

drop policy if exists "att_select" on storage.objects;
create policy "att_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.files f
      where f.path = storage.objects.name
        and (
          f.uploader_id = auth.uid()
          or public.is_task_owner(f.task_id)
          or public.is_task_participant(f.task_id)
          or public.is_task_open(f.task_id)
          or public.is_admin()
        )
    )
  );

drop policy if exists "att_delete" on storage.objects;
create policy "att_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.files f
      where f.path = storage.objects.name and f.uploader_id = auth.uid()
    )
  );

-- ---------- 站内通知 ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'system',
  task_id    uuid references public.tasks(id) on delete set null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notif_read"   on public.notifications;
drop policy if exists "notif_update" on public.notifications;

create policy "notif_read" on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- 举报 ----------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('task','user','message')),
  target_id   uuid not null,
  reason      text not null,
  detail      text,
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at  timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert"  on public.reports;
drop policy if exists "reports_read"    on public.reports;
drop policy if exists "reports_update"  on public.reports;

create policy "reports_insert" on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports_read" on public.reports for select
  using (auth.uid() = reporter_id or public.is_admin());

create policy "reports_update" on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 通知触发器 ----------
create or replace function public.notify_on_bid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_title text;
  v_name  text;
begin
  select t.owner_id, left(t.title, 30) into v_owner, v_title
    from public.tasks t where t.id = new.task_id;
  select nickname into v_name from public.profiles where id = new.provider_id;

  if v_owner is not null and v_owner <> new.provider_id then
    insert into public.notifications (user_id, kind, task_id, body)
    values (v_owner, 'bid', new.task_id,
            coalesce(v_name, '有人') || ' 对「' || coalesce(v_title, '任务') || '」报价 ¥' || new.amount);
  end if;
  return null;
end $$;

drop trigger if exists trg_notify_bid on public.bids;
create trigger trg_notify_bid after insert on public.bids
  for each row execute function public.notify_on_bid();

create or replace function public.notify_on_bid_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select left(title, 30) into v_title from public.tasks where id = new.task_id;

  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, kind, task_id, body)
    values (new.provider_id, 'accepted', new.task_id,
            '你的报价被选定：「' || coalesce(v_title, '任务') || '」');
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.notifications (user_id, kind, task_id, body)
    values (new.provider_id, 'rejected', new.task_id,
            '任务已选定其他服务方：「' || coalesce(v_title, '任务') || '」');
  end if;
  return null;
end $$;

drop trigger if exists trg_notify_bid_status on public.bids;
create trigger trg_notify_bid_status after update on public.bids
  for each row execute function public.notify_on_bid_status();

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_other uuid;
  v_name  text;
begin
  select owner_id into v_owner from public.tasks where id = new.task_id;

  if new.sender_id = v_owner then
    select provider_id into v_other
      from public.bids where task_id = new.task_id and status = 'accepted';
  else
    v_other := v_owner;
  end if;

  select nickname into v_name from public.profiles where id = new.sender_id;

  if v_other is not null and v_other <> new.sender_id then
    insert into public.notifications (user_id, kind, task_id, body)
    values (v_other, 'message', new.task_id,
            coalesce(v_name, '对方') || '：' || left(new.body, 40));
  end if;
  return null;
end $$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
  for each row execute function public.notify_on_message();

create or replace function public.notify_on_task_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_label text;
  v_actor uuid := auth.uid();
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  v_label := case new.status
    when 'matched'   then '已选定服务方'
    when 'delivered' then '已交付，等待确认'
    when 'completed' then '已完成'
    when 'cancelled' then '已取消'
    else new.status
  end;

  insert into public.notifications (user_id, kind, task_id, body)
  select x.uid, 'status', new.id,
         '「' || left(new.title, 30) || '」' || v_label
  from (
    select new.owner_id as uid
    union
    select b.provider_id from public.bids b
     where b.task_id = new.id and b.status = 'accepted'
  ) x
  where x.uid is not null
    and x.uid <> coalesce(v_actor, '00000000-0000-0000-0000-000000000000'::uuid);

  return null;
end $$;

drop trigger if exists trg_notify_task_status on public.tasks;
create trigger trg_notify_task_status after update on public.tasks
  for each row execute function public.notify_on_task_status();

-- ---------- 实时推送 ----------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

-- 消息表需要完整行数据做实时推送
alter table public.messages replica identity full;
alter table public.notifications replica identity full;

-- ============================================================
-- 兼容性授权（兜底）
-- 建项目时如果没勾「Grant API access to new tables automatically」，
-- 新表不会自动授权给 anon / authenticated，PostgREST 会报 permission denied。
-- 这里显式补上；行级权限仍然由 RLS 控制。
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- ============================================================
-- v4：任务发布后进入「待审核」，管理员通过才上线
-- 在 Supabase SQL Editor 整段执行，可重复执行
-- ============================================================

-- 1. 状态枚举加上 pending / rejected
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('pending','open','matched','in_progress','delivered','completed','cancelled','rejected'));

-- 2. 新任务默认待审核
alter table public.tasks alter column status set default 'pending';

-- 3. 审核记录
alter table public.tasks add column if not exists reviewed_at timestamptz;
alter table public.tasks add column if not exists review_note text;

-- 4. 状态通知补上新状态的文案
create or replace function public.notify_on_task_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_label text;
  v_actor uuid := auth.uid();
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  v_label := case new.status
    when 'pending'    then '已提交，等待审核'
    when 'open'       then '审核通过，已上线'
    when 'rejected'   then '未通过审核'
    when 'matched'    then '已选定服务方'
    when 'delivered'  then '已交付，等待确认'
    when 'completed'  then '已完成'
    when 'cancelled'  then '已取消'
    else new.status
  end;

  insert into public.notifications (user_id, kind, task_id, body)
  select x.uid, 'status', new.id,
         '「' || left(new.title, 30) || '」' || v_label
  from (
    select new.owner_id as uid
    union
    select b.provider_id from public.bids b
     where b.task_id = new.id and b.status = 'accepted'
  ) x
  where x.uid is not null
    and x.uid <> coalesce(v_actor, '00000000-0000-0000-0000-000000000000'::uuid);

  return null;
end $$;

-- 5. 审核通过
create or replace function public.approve_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception '只有管理员可以审核任务'; end if;

  select status into v_status from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_status <> 'pending' then raise exception '只有待审核的任务可以审核'; end if;

  update public.tasks
     set status = 'open', reviewed_at = now(), review_note = null
   where id = p_task;
end $$;

-- 6. 审核驳回
create or replace function public.reject_task(p_task uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception '只有管理员可以审核任务'; end if;

  select status into v_status from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_status <> 'pending' then raise exception '只有待审核的任务可以审核'; end if;

  update public.tasks
     set status = 'rejected', reviewed_at = now(), review_note = nullif(btrim(p_note), '')
   where id = p_task;
end $$;

-- 7. 待审核的任务也允许发布者撤回
create or replace function public.cancel_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_owner uuid;
begin
  select status, owner_id into v_status, v_owner from public.tasks where id = p_task;
  if v_status is null then raise exception '任务不存在'; end if;
  if v_owner <> auth.uid() then raise exception '只有发布者可以取消任务'; end if;
  if v_status not in ('pending','open','matched') then raise exception '当前状态不能取消'; end if;

  update public.tasks set status = 'cancelled' where id = p_task;
end $$;

-- 8. 权限
revoke all on function public.approve_task(uuid) from public;
revoke all on function public.reject_task(uuid, text) from public;
revoke all on function public.cancel_task(uuid) from public;

grant execute on function public.approve_task(uuid) to authenticated;
grant execute on function public.reject_task(uuid, text) to authenticated;
grant execute on function public.cancel_task(uuid) to authenticated;


-- ============================================================
-- v5：站点设置（目前用于顶部滚动公告）
-- 在 Supabase SQL Editor 整段执行，可重复执行
-- ============================================================

create table if not exists public.site_settings (
  id                   integer primary key default 1 check (id = 1),
  announcement         text,
  announcement_enabled boolean not null default false,
  announcement_speed   integer not null default 40,   -- 滚动一圈的秒数
  updated_at           timestamptz not null default now()
);

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "settings_read"           on public.site_settings;
drop policy if exists "settings_admin_insert"   on public.site_settings;
drop policy if exists "settings_admin_update"   on public.site_settings;

-- 所有人可读（公告要展示给访客），只有管理员能改
create policy "settings_read" on public.site_settings for select using (true);
create policy "settings_admin_insert" on public.site_settings for insert
  with check (public.is_admin());
create policy "settings_admin_update" on public.site_settings for update
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- v6：公告栏升级（多条、颜色、链接、排序、深浅主题）
-- 在 Supabase SQL Editor 整段执行，可重复执行
-- ============================================================

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (char_length(btrim(text)) between 1 and 200),
  href       text,
  color      text not null default 'default'
             check (color in ('default', 'red', 'warm', 'green')),
  sort       integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "ann_read"      on public.announcements;
drop policy if exists "ann_admin_all" on public.announcements;

create policy "ann_read" on public.announcements for select using (true);
create policy "ann_admin_all" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- 公告栏整体主题：dark / light
alter table public.site_settings
  add column if not exists ticker_theme text not null default 'dark';

-- 把原来那条纯文字公告搬进新表（仅当新表为空时）
insert into public.announcements (text, sort)
select btrim(s.announcement), 0
from public.site_settings s
where s.id = 1
  and s.announcement is not null
  and btrim(s.announcement) <> ''
  and not exists (select 1 from public.announcements);


-- ============================================================
-- v7：首页文案可配置
-- 在 Supabase SQL Editor 整段执行，可重复执行
-- ============================================================

alter table public.site_settings
  add column if not exists hero_eyebrow   text,
  add column if not exists hero_title     text,
  add column if not exists hero_lead      text,
  add column if not exists hero_cta1      text,
  add column if not exists hero_cta2      text,
  add column if not exists typing_prefix  text,
  add column if not exists typing_words   text;

