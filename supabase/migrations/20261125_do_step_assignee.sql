-- ============================================================
-- DO 单的每个步骤都可以单独分配负责人  (2026-11-25)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 规则：
--   · do_steps.assignee_id = 这一步的负责人（空 = 跟 DO 单负责人一致）
--   · 谁能分配：管理员 / 经理 / 这张 DO 单的负责人
--   · 被分配到某一步的员工：能看到这张 DO 单（步骤、附件），可以勾选步骤、上传附件
-- ============================================================

begin;

-- 1. 新字段 --------------------------------------------------
alter table public.do_steps add column if not exists assignee_id uuid references public.employees(id) on delete set null;
create index if not exists do_steps_assignee_idx on public.do_steps (assignee_id);

-- 2. 我是否被分配到这张 DO 单的某一步 --------------------------
create or replace function public.is_do_step_assignee(p_order uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from do_steps where order_id = p_order and assignee_id = public.my_employee_id());
$$;

-- 3. 能看某张 DO 单：加上「被分配到某一步的人」 ------------------
create or replace function public.can_see_do(p_order uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select public.is_admin() or public.is_manager() or public.sees_all_do()
      or exists (select 1 from do_orders where id = p_order and assignee_id = public.my_employee_id())
      or public.is_do_step_assignee(p_order);
$$;

drop policy if exists do_orders_select on public.do_orders;
create policy do_orders_select on public.do_orders for select
  using (public.is_admin() or public.is_manager() or public.sees_all_do()
         or assignee_id = public.my_employee_id() or public.is_do_step_assignee(id));

drop policy if exists do_orders_update on public.do_orders;
create policy do_orders_update on public.do_orders for update
  using (public.is_admin() or public.is_manager() or public.sees_all_do()
         or assignee_id = public.my_employee_id() or public.is_do_step_assignee(id));

-- 4. 分配 / 取消分配某一步 ------------------------------------
create or replace function public.set_do_step_assignee(p_step uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_order uuid; v_owner uuid;
begin
  select s.order_id, o.assignee_id into v_order, v_owner
    from do_steps s join do_orders o on o.id = s.order_id
   where s.id = p_step;
  if v_order is null then raise exception 'step not found'; end if;
  if not (public.is_admin() or public.is_manager() or v_owner = public.my_employee_id()) then
    raise exception 'no permission';
  end if;
  if p_to is not null and not exists (select 1 from employees where id = p_to) then
    raise exception 'target not found';
  end if;
  update do_steps set assignee_id = p_to where id = p_step;
end;
$function$;

grant execute on function public.is_do_step_assignee(uuid) to authenticated;
grant execute on function public.set_do_step_assignee(uuid, uuid) to authenticated;

commit;
