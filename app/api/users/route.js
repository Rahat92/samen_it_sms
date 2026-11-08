import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { generatePassword } from "@/lib/password";
import { sendTenantWelcomeEmail } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const { response } = await requireRole("ADMIN");
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

    // Who is creating this account? The very first user becomes ADMIN; after that only admins can add users.
    let role = "USER";
    let createdByAdmin = false;
    const count = await prisma.user.count();

    if (count === 0) {
      role = "ADMIN";
    } else {
      const { response } = await requireRole("ADMIN");
      if (response) return response;

      createdByAdmin = true;
      if (formData.get("role") === "ADMIN") role = "ADMIN";
    }

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    let password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
    const domain = String(formData.get("domain") ?? "").trim();
    const photo = formData.get("photo");

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    // Admins may leave the password blank: one is generated and emailed to the tenant
    const generated = createdByAdmin && !password;
    if (generated) {
      password = generatePassword();
    } else {
      if (!password) {
        return NextResponse.json({ error: "Password is required" }, { status: 400 });
      }
      if (password !== passwordConfirm) {
        return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
    }

    // Photo upload
    let photoPath = null;

    if (photo && photo.size > 0) {
      if (typeof photo.arrayBuffer !== "function") {
        return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
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
        return NextResponse.json({ error: "Photo must be less than 5MB" }, { status: 400 });
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
        // Accounts an admin creates (and emails credentials for) must be able to sign in straight away
        ...(createdByAdmin && { isActive: true }),
      },
      omit: { password: true },
    });

    // Email the credentials. Always for a generated password (otherwise nobody would know it);
    // for a password the admin typed, unless sendEmail=false.
    let emailSent = false;
    if (createdByAdmin && (generated || formData.get("sendEmail") !== "false")) {
      try {
        await sendTenantWelcomeEmail({ to: email, name, password });
        emailSent = true;
      } catch (err) {
        // The account exists, so don't fail the request. Never log the password.
        console.error("Failed to send welcome email to", email, "-", err.message);
      }
    }

    return NextResponse.json(
      {
        ...user,
        emailSent,
        // Only when the email failed, so the admin can pass the password on by hand (shown once)
        ...(generated && !emailSent && { generatedPassword: password }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    console.error(error);

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}