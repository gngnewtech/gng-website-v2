-- ============================================================
-- 可查看全部 DO 的员工（Danny）也可以分配 DO 步骤负责人  (2026-11-25)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
-- 前提：已运行 20261125_do_step_assignee.sql
-- ============================================================

begin;

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
  if not (public.is_admin() or public.is_manager() or public.sees_all_do()
          or v_owner = public.my_employee_id()) then
    raise exception 'no permission';
  end if;
  if p_to is not null and not exists (select 1 from employees where id = p_to) then
    raise exception 'target not found';
  end if;
  update do_steps set assignee_id = p_to where id = p_step;
end;
$function$;

grant execute on function public.set_do_step_assignee(uuid, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
