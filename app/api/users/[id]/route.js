// Replace the PATCH export in app/api/users/[id]/route.js with this one (keep your DELETE as it is).
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { generatePassword } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/mailer";

const ROLES = ["SUPERADMIN", "ADMIN", "USER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bad = (error, status = 400) => NextResponse.json({ error }, { status });
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

export async function PATCH(request, { params }) {
    const { response } = await requireRole("ADMIN");
    if (response) return response;

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) return bad("Invalid id");

    try {
        const body = await request.json().catch(() => ({}));
        const data = {};

        if ("name" in body) {
            const name = String(body.name ?? "").trim();
            if (!name) return bad("Name is required");
            data.name = name;
        }
        if ("email" in body) {
            const email = String(body.email ?? "").trim().toLowerCase();
            if (!EMAIL_RE.test(email)) return bad("Enter a valid email address");
            data.email = email;
        }
        if ("domain" in body) {
            data.domain = String(body.domain ?? "").trim().toLowerCase() || null;
        }
        if ("role" in body) {
            if (!ROLES.includes(body.role)) return bad("Invalid role");
            data.role = body.role;
        }
        if ("isActive" in body) {
            if (typeof body.isActive !== "boolean") return bad("isActive must be true or false");
            data.isActive = body.isActive;
        }

        // Password: typed by the admin, or generated here
        let newPassword = null;
        let generated = false;
        if (body.generatePassword === true) {
            newPassword = generatePassword();
            generated = true;
        } else if (body.password) {
            newPassword = String(body.password);
            if (newPassword.length < 8) return bad("Password must be at least 8 characters");
        }
        if (newPassword) data.password = await bcrypt.hash(newPassword, 12);

        if (!Object.keys(data).length) return bad("Nothing to update");

        const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!target) return bad("User not found", 404);

        const session = await getSession();
        const selfId = session?.id ?? session?.userId;

        // Nobody can lock themselves out of the admin area
        if (selfId === userId && ("role" in data || data.isActive === false)) {
            return bad("You can't change your own role or deactivate your own account", 403);
        }
        // Only a super admin can grant, or change, the super admin role
        if ((data.role === "SUPERADMIN" || target.role === "SUPERADMIN") && session?.role !== "SUPERADMIN") {
            return bad("Only a super admin can grant or change the super admin role", 403);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            omit: { password: true },
        });

        // Email the new password: always when generated, otherwise only if the admin asked
        let emailSent = false;
        if (newPassword && (generated || body.sendEmail === true)) {
            try {
                await sendPasswordResetEmail({ to: user.email, name: user.name, password: newPassword });
                emailSent = true;
            } catch (err) {
                console.error("Failed to send password email to", user.email, "-", err.message); // never log the password
            }
        }

        return NextResponse.json({
            data: user,
            emailSent,
            // Only if a generated password couldn't be emailed: shown once so the admin can pass it on
            ...(generated && !emailSent && { generatedPassword: newPassword }),
        });
    } catch (error) {
        if (error.code === "P2002") return bad("Email already exists", 409);
        if (error.code === "P2025") return bad("User not found", 404);
        console.error("Error updating user:", error);
        return bad("Failed to update user", 500);
    }
}

// change user role
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    await requireRole("ADMIN");
    const { role } = await request.json();
    if (!role) {
      return NextResponse.json(
        { error: "Role is required" },
        { status: 400 }
      );
    }
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      omit: { password: true },
    });
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to change user role" },
      { status: 500 }
    );
  }
}

// delete user
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    await requireRole("ADMIN");
    console.log("DELETE request received for user deletion");
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    await prisma.user.delete({
      where: { id: userId },
    });
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
