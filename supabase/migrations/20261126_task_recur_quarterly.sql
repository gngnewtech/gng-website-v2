-- ============================================================
-- 重复任务增加「每 3 个月」  (2026-11-26)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
--   · tasks.recur 新增取值 'quarterly'
--   · 下一次日期：同一个几号，往后推 3 个月
--     （31 号遇到小月 → 当月最后一天，之后仍回到 31 号）
-- ============================================================

begin;

-- 1. 允许 quarterly ------------------------------------------
alter table public.tasks drop constraint if exists tasks_recur_check;
alter table public.tasks add constraint tasks_recur_check
  check (recur is null or recur in ('daily', 'weekly', 'monthly', 'quarterly'));

-- 2. 计算下一次日期：加上每 3 个月 -----------------------------
create or replace function public.recur_next_date(p_anchor date, p_base date, p_recur text)
returns date
language plpgsql stable
set search_path to 'public'
as $$
declare
  today   date := (now() at time zone 'Asia/Dubai')::date;
  floor_d date := greatest(p_base, today);
  n       int  := 1;
  d       date;
begin
  if p_recur = 'daily' then
    return floor_d + 1;
  end if;
  loop
    if p_recur = 'weekly' then
      d := p_anchor + 7 * n;
    elsif p_recur = 'quarterly' then
      d := (p_anchor + make_interval(months => 3 * n))::date;
    else
      d := (p_anchor + make_interval(months => n))::date;
    end if;
    exit when d > floor_d or n > 2000;
    n := n + 1;
  end loop;
  return d;
end;
$$;

-- 3. create_task：允许 quarterly（签名不变） --------------------
create or replace function public.create_task(
  p_name text, p_assignee uuid, p_parent uuid,
  p_important boolean, p_urgent boolean,
  p_start_at timestamp with time zone default null,
  p_private boolean default false,
  p_recur text default null
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
  if p_recur is not null and p_recur not in ('daily', 'weekly', 'monthly', 'quarterly') then
    raise exception 'invalid recur';
  end if;
  insert into tasks (assignee_id, name, state, important, urgent, parent_id, created_by, acknowledged, start_at, is_private, recur)
  values (
    coalesce(p_assignee, caller), trim(p_name), 'todo',
    coalesce(p_important, false), coalesce(p_urgent, false),
    p_parent, caller,
    coalesce(p_assignee, caller) = caller,
    -- 设了重复但没填日期 → 从今天开始
    coalesce(p_start_at, case when p_recur is not null
                              then ((now() at time zone 'Asia/Dubai')::date::timestamp at time zone 'Asia/Dubai') end),
    coalesce(p_private, false),
    p_recur
  );
end;
$function$;

commit;
