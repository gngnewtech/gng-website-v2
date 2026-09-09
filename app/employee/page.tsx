import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmployeeBoard from "./EmployeeBoard";

export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("id, name, role, dept, email, is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) redirect("/login");
  if (me.is_admin) redirect("/admin");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, assignee_id, name, state, created_at, done_at")
    .eq("assignee_id", me.id)
    .order("created_at", { ascending: true });

  return <EmployeeBoard me={me} tasks={tasks ?? []} />;
}
