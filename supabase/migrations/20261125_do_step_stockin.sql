-- 2026-11-25  DO 流程加一步「入库」：DO → DO BACK → 递交发票 → 收款 → 采购 → 入库 → 付款 → 完成（共 8 步）
-- 在 Supabase → SQL Editor 整段运行一次（可重复运行）
begin;

-- 1. 先去掉步骤号范围限制（挪号时临时用到 100+），最后再加回 1~8
alter table public.do_steps drop constraint if exists do_steps_step_no_check;

-- 2. 已有的 DO 单：付款 6→7、完成 7→8，再插入 入库 = 6（只处理还没有「入库」的单子）
--    先挪到 100+ 避免 (order_id, step_no) 唯一约束冲突
update public.do_steps s set step_no = s.step_no + 100
 where s.name in ('付款', '完成') and s.step_no < 100
   and not exists (select 1 from public.do_steps x where x.order_id = s.order_id and x.name = '入库');
update public.do_steps set step_no = case name when '付款' then 7 when '完成' then 8 end
 where step_no > 100 and name in ('付款', '完成');
insert into public.do_steps (order_id, step_no, name)
select o.id, 6, '入库' from public.do_orders o
 where not exists (select 1 from public.do_steps x where x.order_id = o.id and x.name = '入库');

-- 步骤号范围改为 1~8
alter table public.do_steps add constraint do_steps_step_no_check check (step_no between 1 and 8);

-- 3. 新建 DO 单自动生成 8 步
create or replace function public.create_do_order(
  p_title text, p_do_no text default null, p_invoice_no text default null, p_assignee uuid default null
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare caller uuid; v_assignee uuid; v_id uuid;
begin
  caller := public.my_employee_id();
  if caller is null then raise exception 'not an employee'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'empty title'; end if;
  v_assignee := coalesce(p_assignee, caller);
  if v_assignee <> caller and not (public.is_admin() or public.is_manager()) then
    raise exception 'only admin/manager can assign to others';
  end if;

  insert into do_orders (title, do_no, invoice_no, assignee_id, created_by)
  values (trim(p_title), nullif(trim(p_do_no), ''), nullif(trim(p_invoice_no), ''), v_assignee, caller)
  returning id into v_id;

  insert into do_steps (order_id, step_no, name)
  select v_id, s.n, s.name
  from (values (1, 'DO'), (2, 'DO BACK'), (3, '递交发票'), (4, '收款'),
               (5, '采购'), (6, '入库'), (7, '付款'), (8, '完成')) as s(n, name);
  return v_id;
end;
$function$;

commit;

-- 检查：每张单应有 8 步
select o.title, count(s.*) as steps from public.do_orders o left join public.do_steps s on s.order_id = o.id group by o.title order by steps;
