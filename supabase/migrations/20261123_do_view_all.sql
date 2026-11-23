-- 2026-11-23  指定员工可查看全部 DO 单（Danny）
-- 在 Supabase → SQL Editor 整段运行一次（可重复运行）
--
-- 打开 can_see_all_do 的员工：能看到所有 DO 单、步骤和附件，
-- 并可以像负责人一样勾选步骤、填 DO 号 / 发票号、上传附件；
-- 但不能改负责人、不能删除 DO 单（仍只限管理员 / 经理）。

begin;

alter table public.employees add column if not exists can_see_all_do boolean not null default false;

create or replace function public.sees_all_do()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce((select can_see_all_do from employees where user_id = auth.uid()), false);
$$;

-- 能看某张 DO 单（步骤、附件、存储文件都走这个函数）
create or replace function public.can_see_do(p_order uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select public.is_admin() or public.is_manager() or public.sees_all_do()
      or exists (select 1 from do_orders where id = p_order and assignee_id = public.my_employee_id());
$$;

drop policy if exists do_orders_select on public.do_orders;
create policy do_orders_select on public.do_orders for select
  using (public.is_admin() or public.is_manager() or public.sees_all_do() or assignee_id = public.my_employee_id());

drop policy if exists do_orders_update on public.do_orders;
create policy do_orders_update on public.do_orders for update
  using (public.is_admin() or public.is_manager() or public.sees_all_do() or assignee_id = public.my_employee_id());

-- 给 Danny 打开
update public.employees set can_see_all_do = true where lower(username) = 'danny';

commit;

-- 检查：Danny 这一行 can_see_all_do 应为 true
select name, username, can_see_all_do from public.employees where can_see_all_do;
