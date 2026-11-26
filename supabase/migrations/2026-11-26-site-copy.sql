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
