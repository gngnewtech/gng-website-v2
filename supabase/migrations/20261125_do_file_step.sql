-- 2026-11-25  DO 附件可以挂在某一个步骤上（详情页每个步骤格子里显示自己的附件）
-- 在 Supabase → SQL Editor 运行一次即可（可重复运行）
alter table public.do_files
  add column if not exists step_id uuid references public.do_steps(id) on delete set null;
create index if not exists do_files_step_idx on public.do_files (step_id);
