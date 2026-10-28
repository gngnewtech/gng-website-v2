-- ============================================================
-- 任务「跟进」可以有多条  (2026-10-28)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- · 新表 task_notes：一条任务可有多条跟进，每条记录 谁写的 + 什么时候
-- · 原来 tasks.note 里的内容会搬进来，作为第一条跟进（tasks.note 字段保留不删）
-- · 谁能看/写跟进：能看到这条任务的人
--     管理员：全部；经理：除私密任务外；员工：自己的任务及其下子任务
-- · 删除跟进：本人或管理员
-- ============================================================

begin;

-- 1. 表 ------------------------------------------------------
create table if not exists public.task_notes (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.employees(id) on delete set null,
  author_name text,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index if not exists task_notes_task_idx on public.task_notes (task_id, created_at);

-- 2. 能否看到某条任务（自己或任一上级任务是我的 / 管理员 / 经理且未隐藏）
create or replace function public.can_see_task(p_task uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select
    public.is_admin()
    or (public.is_manager() and not public.task_hidden_from_managers(p_task))
    or exists (
      with recursive up as (
        select id, parent_id, assignee_id, 0 as depth from tasks where id = p_task
        union all
        select t.id, t.parent_id, t.assignee_id, up.depth + 1
        from tasks t join up on t.id = up.parent_id
        where up.depth < 50
      )
      select 1 from up
      where up.assignee_id = (select id from employees where user_id = auth.uid())
    );
$$;

-- 3. 写入时自动填作者（不信任前端传的作者）
create or replace function public.task_notes_set_author()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  select id, name into new.author_id, new.author_name
  from employees where user_id = auth.uid();
  if new.author_id is null then raise exception 'not an employee'; end if;
  new.body := trim(new.body);
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists trg_task_notes_author on public.task_notes;
create trigger trg_task_notes_author
  before insert on public.task_notes
  for each row execute function public.task_notes_set_author();

-- 4. RLS -----------------------------------------------------
alter table public.task_notes enable row level security;

drop policy if exists task_notes_select on public.task_notes;
create policy task_notes_select on public.task_notes for select
  using (public.can_see_task(task_id));

drop policy if exists task_notes_insert on public.task_notes;
create policy task_notes_insert on public.task_notes for insert
  with check (public.can_see_task(task_id));

drop policy if exists task_notes_delete on public.task_notes;
create policy task_notes_delete on public.task_notes for delete
  using (
    public.is_admin()
    or author_id = (select id from employees where user_id = auth.uid())
  );

grant select, insert, delete on public.task_notes to authenticated;

-- 5. 搬旧数据：tasks.note → 第一条跟进（作者未知，显示为空）
alter table public.task_notes disable trigger trg_task_notes_author;
insert into public.task_notes (task_id, author_id, author_name, body, created_at)
select t.id, null, null, trim(t.note), coalesce(t.created_at, now())
from public.tasks t
where coalesce(trim(t.note), '') <> ''
  and not exists (
    select 1 from public.task_notes n where n.task_id = t.id and n.body = trim(t.note)
  );
alter table public.task_notes enable trigger trg_task_notes_author;

commit;
