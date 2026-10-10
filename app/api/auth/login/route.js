import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

// Used so a missing user takes the same time as a wrong password
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5V6xk6Zb0nJ1kq0Xq3Y3m3nq6Z1zQ0W";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    const ok = await bcrypt.compare(String(password), user?.password ?? DUMMY_HASH);

    if (!user || !ok) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user);

    return Response.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}