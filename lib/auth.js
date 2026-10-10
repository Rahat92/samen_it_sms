import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const s = await getSession();
  if (!s) return null;
  return prisma.user.findUnique({
    where: { id: s.userId },
    omit: { password: true },
  });
}

// For pages: redirects instead of returning an error
export async function requireUserPage(...roles) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect("/");
  return user;
}

export async function requireRole(...roles) {
  const user = await getCurrentUser();
  if (!user) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (roles.length && !roles.includes(user.role)) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}