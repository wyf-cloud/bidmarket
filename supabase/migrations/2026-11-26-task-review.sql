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
