-- 2026-11-26  DO 流程：前面 7 步（DO → DO BACK → 递交发票 → 收款 → 采购 → 入库 → 付款）全部完成，
-- 自动把「完成」这一步和整张 DO 标记为完成；任何一步取消完成，「完成」和整张单也自动取消。
-- 页面上不再显示「完成」格子（数据库里这一步还保留，只由系统自动勾）。
begin;

create or replace function public.toggle_do_step(p_step uuid, p_done boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_order uuid; v_name text; me employees%rowtype; v_all boolean;
begin
  select order_id, name into v_order, v_name from do_steps where id = p_step;
  if v_order is null then raise exception 'step not found'; end if;
  if not public.can_see_do(v_order) then raise exception 'no permission'; end if;
  if v_name = '完成' then return; end if; -- 「完成」由系统自动处理
  select * into me from employees where user_id = auth.uid();

  update do_steps
     set done_at = case when p_done then now() else null end,
         done_by = case when p_done then me.id else null end,
         done_by_name = case when p_done then me.name else null end
   where id = p_step;

  -- 前面 7 步是否全部完成
  select count(*) > 0 and bool_and(done_at is not null) into v_all
    from do_steps where order_id = v_order and name <> '完成';

  update do_steps
     set done_at = case when v_all then coalesce(done_at, now()) else null end,
         done_by = case when v_all then coalesce(done_by, me.id) else null end,
         done_by_name = case when v_all then coalesce(done_by_name, me.name) else null end
   where order_id = v_order and name = '完成';

  update do_orders
     set done_at = case when v_all then coalesce(done_at, now()) else null end
   where id = v_order;
end;
$function$;

grant execute on function public.toggle_do_step(uuid, boolean) to authenticated;

-- 补一次：已经 7 步全完成、但「完成」没勾的旧单子
with fin as (
  select order_id, max(done_at) as t
    from do_steps
   where name <> '完成'
   group by order_id
  having bool_and(done_at is not null)
)
update do_steps s
   set done_at = fin.t, done_by_name = coalesce(s.done_by_name, '系统')
  from fin
 where s.order_id = fin.order_id and s.name = '完成' and s.done_at is null;

update do_orders o
   set done_at = s.done_at
  from do_steps s
 where s.order_id = o.id and s.name = '完成' and s.done_at is not null and o.done_at is null;

commit;
