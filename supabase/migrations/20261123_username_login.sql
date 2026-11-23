-- 2026-11-23  用户名登录
-- 在 Supabase → SQL Editor 整段运行一次（可重复运行）
-- 每个员工一个唯一的用户名（不区分大小写），登录时用 用户名 + 密码。

alter table public.employees add column if not exists username text;

-- 现有员工：先用邮箱 @ 前面的部分当默认用户名（重名自动加数字），之后可在「设置员工」里修改
with base as (
  select id,
         lower(regexp_replace(split_part(coalesce(email, ''), '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) as u,
         created_at
  from public.employees
  where username is null or username = ''
),
named as (
  select id,
         case when u = '' then 'user' else u end as u,
         row_number() over (partition by case when u = '' then 'user' else u end order by created_at) as n
  from base
)
update public.employees e
set username = case when n.n = 1 then n.u else n.u || n.n end
from named n
where e.id = n.id;

create unique index if not exists employees_username_unique on public.employees (lower(username));

-- 查看每个人的用户名
select name, username, email, is_admin, is_manager from public.employees order by is_admin desc, is_manager desc, name;

-- 新员工用用户名登录、可以没有邮箱
alter table public.employees alter column email drop not null;
