-- ============================================================
-- v8：小游戏排行榜
-- 在 Supabase SQL Editor 整段执行，可重复执行
-- ============================================================

create table if not exists public.game_scores (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  score        integer not null check (score >= 0),
  level        integer not null default 1,
  duration_sec integer,
  created_at   timestamptz not null default now()
);

create index if not exists game_scores_score_idx
  on public.game_scores (score desc, created_at asc);

alter table public.game_scores enable row level security;

drop policy if exists "scores_read"        on public.game_scores;
drop policy if exists "scores_insert_self" on public.game_scores;

-- 所有人可看排行榜；只有登录且未被封禁的玩家能提交成绩
create policy "scores_read" on public.game_scores for select using (true);
create policy "scores_insert_self" on public.game_scores for insert
  with check (auth.uid() = user_id and not public.is_banned());
