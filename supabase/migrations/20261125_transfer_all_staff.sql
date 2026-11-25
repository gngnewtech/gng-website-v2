-- ============================================================
-- 所有员工都能转交任务给任何同事；自己分出去的子任务也能再转交  (2026-11-25)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 规则：
--   · 管理员：可把任何任务转交给任何人
--   · 经理：可把自己看得到的任务转交给任何人
--     （私密任务 / Susie 派给 Mahan 的任务，经理看不到也转不了）
--   · 普通员工：可以转交「自己负责的」任务，或「自己派出去的」任务
--     （任务的「来自」是自己，或上级任务是自己负责的），可转给任何同事
--
-- 转交后：接收人需要重新「确认收到」，「来自」显示为转交人
-- ============================================================

begin;

create or replace function public.transfer_task(p_task uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  caller  employees%rowtype;
  target  employees%rowtype;
  t       tasks%rowtype;
begin
  select * into caller from employees where user_id = auth.uid();
  if caller.id is null then raise exception 'not an employee'; end if;

  select * into target from employees where id = p_to;
  if target.id is null then raise exception 'target not found'; end if;

  select * into t from tasks where id = p_task;
  if t.id is null then raise exception 'task not found'; end if;
  if t.assignee_id = p_to then return; end if;  -- 本来就是他的，不用动

  if coalesce(caller.is_admin, false) then
    null;  -- 管理员：不限
  elsif coalesce(caller.is_manager, false) then
    if t.assignee_id <> caller.id and public.task_hidden_from_managers(p_task) then
      raise exception 'no permission';
    end if;
  else
    if not (
      t.assignee_id = caller.id
      or t.created_by = caller.id
      or exists (select 1 from tasks p where p.id = t.parent_id and p.assignee_id = caller.id)
    ) then
      raise exception 'can only transfer your own task';
    end if;
  end if;

  update tasks
     set assignee_id  = p_to,
         created_by   = caller.id,          -- 「来自」= 转交人
         acknowledged = (p_to = caller.id)  -- 接收人需重新确认
   where id = p_task;
end;
$function$;

-- 可转交对象：所有人都能转给全部员工（不含自己）
create or replace function public.get_transfer_targets()
returns table (id uuid, name text, role text, is_manager boolean, is_admin boolean)
language sql stable security definer
set search_path to 'public'
as $function$
  with me as (select * from employees where user_id = auth.uid())
  select e.id, e.name, e.role, e.is_manager, e.is_admin
  from employees e, me
  where e.id <> me.id
  order by e.is_admin desc, e.is_manager desc, e.name;
$function$;

grant execute on function public.transfer_task(uuid, uuid) to authenticated;
grant execute on function public.get_transfer_targets() to authenticated;

commit;

notify pgrst, 'reload schema';
