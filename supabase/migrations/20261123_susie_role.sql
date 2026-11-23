-- 2026-11-23  Susie 的岗位从「测试员工」改为「管理员」
-- 在 Supabase → SQL Editor 运行
update public.employees
set role = '管理员'
where lower(email) = 'susie0577@gmail.com' or username = 'susie0577';

-- 检查结果
select name, username, dept, role, is_admin from public.employees where username = 'susie0577' or lower(email) = 'susie0577@gmail.com';
