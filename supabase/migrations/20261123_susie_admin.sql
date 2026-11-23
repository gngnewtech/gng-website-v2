-- 2026-11-23  把 Susie 设为管理员（可添加 / 删除员工、管理账号）
-- 在 Supabase → SQL Editor 运行
update public.employees
set is_admin = true, is_manager = false
where lower(email) = 'susie0577@gmail.com';

-- 检查结果：Susie 的 is_admin 应为 true
select name, email, is_admin, is_manager from public.employees order by is_admin desc, name;
