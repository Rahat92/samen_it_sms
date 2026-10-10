import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const { response } = await requireRole("ADMIN");
  console.log(response)
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    omit: { password: true },
  });

  return Response.json(users);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    const passwordConfirm = String(body.passwordConfirm ?? ""); 
    if (!name || !email || !password) {
      return Response.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return Response.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    let role = "USER";
    const count = await prisma.user.count();

    if (count === 0) {
      role = "ADMIN";
    } else {
      const { response } = await requireRole("ADMIN");
      if (response) return response;
      if (body.role === "ADMIN") role = "ADMIN";
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password:passwordHash, role },
      omit: { password: true },
    });

    return Response.json(user, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return Response.json({ error: "Email already exists" }, { status: 409 });
    }
    console.error(error);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}