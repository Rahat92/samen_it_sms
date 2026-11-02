import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UsersView from "@/components/views/TenantView";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await getCurrentUser();

  // Not signed in -> login. Signed in but not a super admin -> back to the dashboard.
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return <UsersView currentUserId={user.id} />;
}