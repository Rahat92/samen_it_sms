import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/jwt";

const COOKIE = "session";

export async function createSession(user) {
  const token = await encrypt({ userId: user.id, role: user.role });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decrypt(token) : null;
}