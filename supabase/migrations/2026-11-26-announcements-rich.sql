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
