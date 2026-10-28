-- ============================================================
-- DO 流程  (2026-10-28)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 一张 DO 单 = 一个负责人 + 7 个步骤：
--   DO → DO BACK → 递交发票 → 收款 → 采购 → 付款 → 完成
-- 每一步勾选时自动记录完成时间和勾选人；单上可填 DO 号、发票号
--
-- 权限：
--   · 管理员 / 经理：看全部、新建、改负责人、删除
--   · 普通员工：只看自己负责的单，可勾选步骤、填 DO 号 / 发票号；
--     也可以给自己新建 DO 单
-- ============================================================

begin;

-- 1. 表 ------------------------------------------------------
create table if not exists public.do_orders (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  do_no       text,
  invoice_no  text,
  assignee_id uuid not null references public.employees(id),
  created_by  uuid references public.employees(id) on delete set null,
  created_at  timestamptz not null default now(),
  done_at     timestamptz            -- 7 步全部勾完的时间；未完成为空
);

create table if not exists public.do_steps (
  id        uuid primary key default gen_random_uuid(),
  order_id  uuid not null references public.do_orders(id) on delete cascade,
  step_no   int  not null check (step_no between 1 and 7),
  name      text not null,
  done_at   timestamptz,
  done_by   uuid references public.employees(id) on delete set null,
  done_by_name text,
  unique (order_id, step_no)
);
create index if not exists do_orders_assignee_idx on public.do_orders (assignee_id);

-- 2. 辅助：当前登录员工 id ----------------------------------
create or replace function public.my_employee_id()
returns uuid
language sql stable security definer
set search_path to 'public'
as $$ select id from employees where user_id = auth.uid(); $$;

create or replace function public.can_see_do(p_order uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select public.is_admin() or public.is_manager()
      or exists (select 1 from do_orders where id = p_order and assignee_id = public.my_employee_id());
$$;

-- 3. 新建 DO 单（自动生成 7 个步骤）--------------------------
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
               (5, '采购'), (6, '付款'), (7, '完成')) as s(n, name);
  return v_id;
end;
$function$;

-- 4. 勾选 / 取消某一步（记录时间和人；7 步全勾完 → 单子完成）--
create or replace function public.toggle_do_step(p_step uuid, p_done boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_order uuid; me employees%rowtype;
begin
  select order_id into v_order from do_steps where id = p_step;
  if v_order is null then raise exception 'step not found'; end if;
  if not public.can_see_do(v_order) then raise exception 'no permission'; end if;
  select * into me from employees where user_id = auth.uid();

  update do_steps
     set done_at = case when p_done then now() else null end,
         done_by = case when p_done then me.id else null end,
         done_by_name = case when p_done then me.name else null end
   where id = p_step;

  update do_orders o
     set done_at = case
       when (select count(*) from do_steps s where s.order_id = o.id and s.done_at is null) = 0
         then coalesce(o.done_at, now())
       else null end
   where o.id = v_order;
end;
$function$;

-- 5. RLS -----------------------------------------------------
alter table public.do_orders enable row level security;
alter table public.do_steps  enable row level security;

drop policy if exists do_orders_select on public.do_orders;
create policy do_orders_select on public.do_orders for select
  using (public.is_admin() or public.is_manager() or assignee_id = public.my_employee_id());

-- 改单：管理员/经理改全部；负责人只能改 DO 号、发票号、标题（负责人字段由下面触发器保护）
drop policy if exists do_orders_update on public.do_orders;
create policy do_orders_update on public.do_orders for update
  using (public.is_admin() or public.is_manager() or assignee_id = public.my_employee_id());

drop policy if exists do_orders_delete on public.do_orders;
create policy do_orders_delete on public.do_orders for delete
  using (public.is_admin() or public.is_manager());

drop policy if exists do_steps_select on public.do_steps;
create policy do_steps_select on public.do_steps for select
  using (public.can_see_do(order_id));

grant select, update, delete on public.do_orders to authenticated;
grant select on public.do_steps to authenticated;
grant execute on function public.create_do_order(text, text, text, uuid) to authenticated;
grant execute on function public.toggle_do_step(uuid, boolean) to authenticated;

-- 6. 普通员工不能改负责人 -----------------------------------
create or replace function public.guard_do_assignee()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.assignee_id is distinct from old.assignee_id
     and not (public.is_admin() or public.is_manager()) then
    raise exception 'only admin/manager can change assignee';
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists trg_guard_do_assignee on public.do_orders;
create trigger trg_guard_do_assignee
  before update on public.do_orders
  for each row execute function public.guard_do_assignee();

commit;
