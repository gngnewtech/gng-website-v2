-- ============================================================
-- DO 附件：截图 / 图片 / PDF  (2026-10-29)
-- 在 Supabase → SQL Editor 里整段运行一次即可（可重复运行）
-- 需要先跑过 20261028_do_flow.sql
--
-- · 文件存在 Supabase Storage 私有桶 do-files，路径：<DO单id>/<文件id>.<后缀>
-- · 能看到这张 DO 单的人，就能看、能上传附件
-- · 删除附件：上传人自己，或管理员 / 经理
-- · 只接受图片和 PDF，单个文件最大 10MB
-- ============================================================

begin;

-- 1. 存储桶（私有）-------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('do-files', 'do-files', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. 附件表 --------------------------------------------------
create table if not exists public.do_files (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.do_orders(id) on delete cascade,
  path         text not null unique,          -- storage 里的路径
  name         text not null,                 -- 原始文件名
  mime         text,
  size         bigint,
  uploaded_by  uuid references public.employees(id) on delete set null,
  uploaded_by_name text,
  created_at   timestamptz not null default now()
);
create index if not exists do_files_order_idx on public.do_files (order_id);

-- 上传人由数据库自动填，前端改不了
create or replace function public.fill_do_file_uploader()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare me employees%rowtype;
begin
  select * into me from employees where user_id = auth.uid();
  new.uploaded_by := me.id;
  new.uploaded_by_name := me.name;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists trg_fill_do_file_uploader on public.do_files;
create trigger trg_fill_do_file_uploader
  before insert on public.do_files
  for each row execute function public.fill_do_file_uploader();

alter table public.do_files enable row level security;

drop policy if exists do_files_select on public.do_files;
create policy do_files_select on public.do_files for select
  using (public.can_see_do(order_id));

drop policy if exists do_files_insert on public.do_files;
create policy do_files_insert on public.do_files for insert
  with check (public.can_see_do(order_id) and path like order_id::text || '/%');

drop policy if exists do_files_delete on public.do_files;
create policy do_files_delete on public.do_files for delete
  using (public.is_admin() or public.is_manager() or uploaded_by = public.my_employee_id());

grant select, insert, delete on public.do_files to authenticated;

-- 3. Storage 权限 -------------------------------------------
-- 路径第一段是 DO 单 id；格式不对一律拒绝
create or replace function public.can_see_do_path(p_name text)
returns boolean
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  return public.can_see_do(((storage.foldername(p_name))[1])::uuid);
exception when others then
  return false;
end;
$$;
grant execute on function public.can_see_do_path(text) to authenticated;

drop policy if exists do_files_obj_select on storage.objects;
create policy do_files_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'do-files' and public.can_see_do_path(name));

drop policy if exists do_files_obj_insert on storage.objects;
create policy do_files_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'do-files' and public.can_see_do_path(name));

drop policy if exists do_files_obj_delete on storage.objects;
create policy do_files_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'do-files' and (
    public.is_admin() or public.is_manager() or owner = auth.uid()
  ));

commit;
