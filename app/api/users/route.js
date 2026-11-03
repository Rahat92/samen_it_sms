import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
export async function GET() {
  const { response } = await requireRole("ADMIN");
  console.log('RESPONSE', response)
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    omit: { password: true },
  });

  return Response.json(users);
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    const password = String(formData.get("password") ?? "");
    const domain = String(formData.get("domain") ?? "").trim();
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
    const photo = formData.get("photo");

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    let role = "USER";
    const count = await prisma.user.count();

    if (count === 0) {
      role = "ADMIN";
    } else {
      const { response } = await requireRole("ADMIN");
      if (response) return response;

      if (formData.get("role") === "ADMIN") role = "ADMIN";
    }

    // Photo upload
    let photoPath = null;

    if (photo && photo.size > 0) {
      if (typeof photo.arrayBuffer !== "function") {
        return NextResponse.json(
          { error: "Invalid photo" },
          { status: 400 }
        );
      }

      const allowedTypes = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      if (!allowedTypes[photo.type]) {
        return NextResponse.json(
          { error: "Only JPG, PNG and WEBP images are allowed" },
          { status: 400 }
        );
      }

      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Photo must be less than 5MB" },
          { status: 400 }
        );
      }

      const uploadDir = path.join(process.cwd(), "public", "users");

      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${crypto.randomUUID()}.${allowedTypes[photo.type]}`;

      const buffer = Buffer.from(await photo.arrayBuffer());

      await fs.writeFile(path.join(uploadDir, filename), buffer);

      photoPath = `/users/${filename}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role,
        photo: photoPath,
        domain: domain || null,
      },
      omit: { password: true },
    });

    return NextResponse.json(user, { status: 201 });

  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}