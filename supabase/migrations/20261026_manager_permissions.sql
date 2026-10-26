-- ============================================================
-- 经理角色 + 私密任务  (2026-10-26)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 规则：
--   · 管理员（Susie）：看全部任务
--   · 经理（朱威、周乐）：可给全公司员工派任务（含 Susie），看全公司任务，
--     但看不到 ① 勾选了「私密」的任务  ② Susie 派给 Mahan 的任务
--     （这两类任务下面的子任务也一并隐藏）
--   · 普通员工：和以前一样，只看自己的任务及其子任务
-- ============================================================

begin;

-- 1. 新字段 --------------------------------------------------
alter table public.employees add column if not exists is_manager boolean not null default false;
alter table public.tasks     add column if not exists is_private boolean not null default false;

-- 2. 「对经理隐藏」的派任务线：谁派给谁的任务经理看不到 -----------
create table if not exists public.private_lines (
  creator_id  uuid not null references public.employees(id) on delete cascade,
  assignee_id uuid not null references public.employees(id) on delete cascade,
  primary key (creator_id, assignee_id)
);
alter table public.private_lines enable row level security;
drop policy if exists private_lines_admin on public.private_lines;
create policy private_lines_admin on public.private_lines
  for all using (public.is_admin()) with check (public.is_admin());

-- Susie → Mahan
insert into public.private_lines (creator_id, assignee_id)
select c.id, a.id
from public.employees c, public.employees a
where c.email = 'susie0577@gmail.com' and a.email = 'soxibagng@gmail.com'
on conflict do nothing;

-- 3. 辅助函数 ------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce((select is_manager from employees where user_id = auth.uid()), false);
$$;

-- 任务本身或任一上级任务是私密 / 属于隐藏派任务线 → 对经理隐藏
create or replace function public.task_hidden_from_managers(p_task uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  with recursive up as (
    select id, parent_id, is_private, created_by, assignee_id, 0 as depth
    from tasks where id = p_task
    union all
    select t.id, t.parent_id, t.is_private, t.created_by, t.assignee_id, up.depth + 1
    from tasks t join up on t.id = up.parent_id
    where up.depth < 50
  )
  select exists (
    select 1 from up
    where up.is_private
       or exists (select 1 from private_lines pl
                  where pl.creator_id = up.created_by and pl.assignee_id = up.assignee_id)
  );
$$;

-- 4. 只有管理员能设置 / 取消「私密」 ---------------------------
create or replace function public.guard_task_private()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.is_private is distinct from (case when tg_op = 'INSERT' then false else old.is_private end)
     and not public.is_admin() then
    raise exception 'only admin can change is_private';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_task_private on public.tasks;
create trigger trg_guard_task_private
  before insert or update on public.tasks
  for each row execute function public.guard_task_private();

-- 5. create_task：增加 p_private 参数（旧签名先删掉，避免重载冲突） --
drop function if exists public.create_task(text, uuid, uuid, boolean, boolean, timestamp with time zone);
create or replace function public.create_task(
  p_name text, p_assignee uuid, p_parent uuid,
  p_important boolean, p_urgent boolean,
  p_start_at timestamp with time zone default null,
  p_private boolean default false
)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare caller uuid;
begin
  select id into caller from employees where user_id = auth.uid();
  if caller is null then raise exception 'not an employee'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'empty name'; end if;
  if coalesce(p_private, false) and not public.is_admin() then
    raise exception 'only admin can create private tasks';
  end if;
  insert into tasks (assignee_id, name, state, important, urgent, parent_id, created_by, acknowledged, start_at, is_private)
  values (
    coalesce(p_assignee, caller), trim(p_name), 'todo',
    coalesce(p_important, false), coalesce(p_urgent, false),
    p_parent, caller,
    coalesce(p_assignee, caller) = caller,
    p_start_at,
    coalesce(p_private, false)
  );
end;
$function$;

-- 6. get_my_tasks：修漏洞 —— 不再信任传入的 p_uid，只按当前登录人查 --
create or replace function public.get_my_tasks(p_uid uuid)
returns setof tasks
language sql stable security definer
set search_path to 'public'
as $function$
  with recursive mine as (
    select t.* from tasks t
    where t.assignee_id = (select id from employees where user_id = auth.uid())
    union
    select c.* from tasks c join mine m on c.parent_id = m.id
  )
  select * from mine;
$function$;

-- 7. RLS 策略 ------------------------------------------------
-- employees：经理能看到全公司员工
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (user_id = auth.uid() or public.is_admin() or public.is_manager());

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
  using (
    public.is_admin()
    or assignee_id in (select id from employees where user_id = auth.uid())
    or (public.is_manager() and not public.task_hidden_from_managers(id))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (
    public.is_admin()
    or assignee_id in (select id from employees where user_id = auth.uid())
    or (public.is_manager() and not public.task_hidden_from_managers(id))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (
    public.is_admin()
    or public.is_manager()
    or assignee_id in (select id from employees where user_id = auth.uid())
  );

-- 原来有两条删除策略，合并成一条
drop policy if exists tasks_delete on public.tasks;
drop policy if exists tasks_delete_own_or_admin on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (
    public.is_admin()
    or assignee_id in (select id from employees where user_id = auth.uid())
    or (public.is_manager() and not public.task_hidden_from_managers(id))
  );

-- 8. 账号角色 ------------------------------------------------
-- Susie 设为管理员
update public.employees set is_admin = true where email = 'susie0577@gmail.com';

-- 朱威、周乐：经理
insert into public.employees (name, email, is_manager)
select v.name, v.email, true
from (values ('朱威', 'zhuweify@gmail.com'), ('周乐', 'samuel.zhoule@gmail.com')) as v(name, email)
where not exists (select 1 from public.employees e where lower(e.email) = v.email);
update public.employees set is_manager = true
where lower(email) in ('zhuweify@gmail.com', 'samuel.zhoule@gmail.com');

-- 如果他们已经注册过登录账号，把账号关联上
update public.employees e set user_id = u.id
from auth.users u
where lower(e.email) in ('zhuweify@gmail.com', 'samuel.zhoule@gmail.com')
  and lower(u.email) = lower(e.email) and e.user_id is null;

commit;

-- ============================================================
-- 9. Johnny、Dany（拿到邮箱后，替换邮箱、去掉行首 -- 再运行）
--
-- insert into public.employees (name, email, is_manager) values
--   ('Johnny', 'johnny@example.com',  false),
--   ('Dany',   'dany@example.com',    false);
--
-- update public.employees e set user_id = u.id
-- from auth.users u
-- where lower(u.email) = lower(e.email) and e.user_id is null;
-- ============================================================
