import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
export async function PUT(request, { params }) {
  let uploadedFile = null;
  try {
    const { id } = await params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const { response } = await requireRole("ADMIN");
    if (response) return response;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const domain = String(formData.get("domain") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .toLowerCase()
      .trim();

    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(
      formData.get("passwordConfirm") ?? ""
    );

    const role = String(formData.get("role") ?? existingUser.role);
    const photo = formData.get("photo");

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    if (password && password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!["ADMIN", "USER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const data = { name, email, role, domain };

    // Update password only when provided
    if (password) {
      data.password = await bcrypt.hash(password, 12);
    }

    // Photo upload
    if (photo && photo.size > 0) {
      const allowedTypes = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      if (!photo.arrayBuffer || !allowedTypes[photo.type]) {
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

      uploadedFile = path.join(uploadDir, filename);

      await fs.writeFile(
        uploadedFile,
        Buffer.from(await photo.arrayBuffer())
      );

      data.photo = `/users/${filename}`;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      omit: { password: true },
    });

    // Remove old photo after successful database update
    if (data.photo && existingUser.photo) {
      const oldFilename = path.basename(existingUser.photo);

      if (oldFilename === existingUser.photo.replace("/users/", "")) {
        await fs.unlink(
          path.join(process.cwd(), "public", "users", oldFilename)
        ).catch(() => {});
      }
    }

    return NextResponse.json(user);

  } catch (error) {
    // Remove newly uploaded photo if database update fails
    if (uploadedFile) {
      await fs.unlink(uploadedFile).catch(() => {});
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}