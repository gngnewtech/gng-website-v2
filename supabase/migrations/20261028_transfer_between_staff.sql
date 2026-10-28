-- ============================================================
-- 员工 ⇄ 经理 互相转交任务  (2026-10-28)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 规则：
--   · 管理员（Susie）：可把任何任务转交给任何人
--   · 经理（朱威、周乐）：可把自己看得到的任务转交给任何人
--     （私密任务 / Susie 派给 Mahan 的任务，经理看不到也转不了）
--   · 普通员工：只能转交「自己负责的」任务，且只能转给经理或管理员
--
-- 转交后：接收人需要重新「确认收到」，「来自」显示为转交人
-- ============================================================

begin;

-- 1. 转交任务 ------------------------------------------------
create or replace function public.transfer_task(p_task uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  caller  employees%rowtype;
  target  employees%rowtype;
  t_owner uuid;
begin
  select * into caller from employees where user_id = auth.uid();
  if caller.id is null then raise exception 'not an employee'; end if;

  select * into target from employees where id = p_to;
  if target.id is null then raise exception 'target not found'; end if;

  select assignee_id into t_owner from tasks where id = p_task;
  if t_owner is null then raise exception 'task not found'; end if;
  if t_owner = p_to then return; end if;  -- 本来就是他的，不用动

  if coalesce(caller.is_admin, false) then
    null;  -- 管理员：不限
  elsif coalesce(caller.is_manager, false) then
    if t_owner <> caller.id and public.task_hidden_from_managers(p_task) then
      raise exception 'no permission';
    end if;
  else
    if t_owner <> caller.id then raise exception 'can only transfer your own task'; end if;
    if not (coalesce(target.is_manager, false) or coalesce(target.is_admin, false)) then
      raise exception 'employees can only transfer to a manager';
    end if;
  end if;

  update tasks
     set assignee_id  = p_to,
         created_by   = caller.id,          -- 「来自」= 转交人
         acknowledged = (p_to = caller.id)  -- 接收人需重新确认
   where id = p_task;
end;
$function$;

-- 2. 可转交对象名单 ------------------------------------------
--   管理员 / 经理：全部员工（不含自己）
--   普通员工：经理 + 管理员（不含自己）
create or replace function public.get_transfer_targets()
returns table (id uuid, name text, role text, is_manager boolean, is_admin boolean)
language sql stable security definer
set search_path to 'public'
as $function$
  with me as (select * from employees where user_id = auth.uid())
  select e.id, e.name, e.role, e.is_manager, e.is_admin
  from employees e, me
  where e.id <> me.id
    and (
      coalesce(me.is_admin, false) or coalesce(me.is_manager, false)
      or coalesce(e.is_manager, false) or coalesce(e.is_admin, false)
    )
  order by e.is_admin desc, e.is_manager desc, e.name;
$function$;

grant execute on function public.transfer_task(uuid, uuid) to authenticated;
grant execute on function public.get_transfer_targets() to authenticated;

commit;
