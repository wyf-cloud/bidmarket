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
