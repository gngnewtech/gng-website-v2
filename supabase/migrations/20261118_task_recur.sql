-- ============================================================
-- 任务日期可设置「重复」：每天 / 每周 / 每月  (2026-11-18)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
--
-- 规则：
--   · tasks.recur = 'daily' | 'weekly' | 'monthly'（null = 不重复）
--   · 重复任务被标记「已完成」时，自动生成下一次的新任务（待开始），
--     原任务保留为已完成记录；跟进记录不复制
--   · 下一次日期：按原定日期的规律往后推，且一定晚于「今天」和原定日期
--       每天：原定日期/今天 的下一天
--       每周：同一个星期几
--       每月：同一个几号（31 号遇到小月 → 当月最后一天，下个月仍回到 31 号）
--   · 按迪拜时间（Asia/Dubai）计算日期
--   · 同一条任务只会生成一次下一次（重复点不会多出来）
-- ============================================================

begin;

-- 1. 新字段 --------------------------------------------------
alter table public.tasks add column if not exists recur        text;
alter table public.tasks add column if not exists recur_anchor date;   -- 每月/每周的基准日期（防止月底漂移）
alter table public.tasks add column if not exists recur_from   uuid references public.tasks(id) on delete set null;

alter table public.tasks drop constraint if exists tasks_recur_check;
alter table public.tasks add constraint tasks_recur_check
  check (recur is null or recur in ('daily', 'weekly', 'monthly'));

create index if not exists tasks_recur_from_idx on public.tasks (recur_from);

-- 2. 私密校验：自动生成下一次重复任务时放行 ---------------------
create or replace function public.guard_task_private()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('app.recur_spawn', true), '') = '1' then
    return new;
  end if;
  if new.is_private is distinct from (case when tg_op = 'INSERT' then false else old.is_private end)
     and not public.is_admin() then
    raise exception 'only admin can change is_private';
  end if;
  return new;
end;
$$;

-- 3. 计算下一次日期 ------------------------------------------
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
    else
      d := (p_anchor + make_interval(months => n))::date;
    end if;
    exit when d > floor_d or n > 2000;
    n := n + 1;
  end loop;
  return d;
end;
$$;

-- 4. 生成下一次重复任务（完成后由接口调用） ----------------------
create or replace function public.spawn_recur_task(p_task uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  t      tasks%rowtype;
  caller uuid;
  base   date;
  anchor date;
  nd     date;
  new_id uuid;
begin
  select id into caller from employees where user_id = auth.uid();
  if caller is null then raise exception 'not an employee'; end if;

  select * into t from tasks where id = p_task;
  if t.id is null or t.recur is null or t.state <> 'done' then return null; end if;
  if not public.can_see_task(p_task) then raise exception 'no permission'; end if;

  -- 已经生成过就不再生成
  if exists (select 1 from tasks where recur_from = p_task) then return null; end if;

  base   := coalesce((t.start_at at time zone 'Asia/Dubai')::date, (now() at time zone 'Asia/Dubai')::date);
  anchor := coalesce(t.recur_anchor, base);
  nd     := public.recur_next_date(anchor, base, t.recur);

  perform set_config('app.recur_spawn', '1', true);
  insert into tasks (assignee_id, name, state, important, urgent, parent_id, created_by,
                     acknowledged, start_at, is_private, recur, recur_anchor, recur_from)
  values (t.assignee_id, t.name, 'todo', t.important, t.urgent, t.parent_id, t.created_by,
          t.acknowledged, (nd::timestamp at time zone 'Asia/Dubai'), t.is_private,
          t.recur, anchor, t.id)
  returning id into new_id;
  perform set_config('app.recur_spawn', '', true);

  return new_id;
end;
$function$;

-- 5. create_task：增加 p_recur 参数（旧签名先删掉，避免重载冲突） ---
drop function if exists public.create_task(text, uuid, uuid, boolean, boolean, timestamp with time zone, boolean);
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
  if p_recur is not null and p_recur not in ('daily', 'weekly', 'monthly') then
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

grant execute on function public.create_task(text, uuid, uuid, boolean, boolean, timestamp with time zone, boolean, text) to authenticated;
grant execute on function public.spawn_recur_task(uuid) to authenticated;
grant execute on function public.recur_next_date(date, date, text) to authenticated;

commit;
