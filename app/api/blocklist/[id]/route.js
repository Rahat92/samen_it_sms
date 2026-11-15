import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const STATUSES = ["BLOCKED", "UNBLOCK_REQUESTED", "UNBLOCKED"]; // BlockStatus enum
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REASON = 500;

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const isAdmin = (s) => ["ADMIN", "SUPERADMIN"].includes(s?.role);

async function parseId(params) {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// PATCH /api/blocklist/:id   (PUT is the same)
// Any of: { email, reason, domain, status }. Only the fields that are sent change.
async function update(request, { params }) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  if (!isAdmin(session)) return fail("Forbidden", 403);

  const id = await parseId(params);
  if (!id) return fail("Invalid blocklist ID");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Request body must be valid JSON");

  const data = {};

  if ("email" in body) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail("Enter a valid email address");
    data.email = email;
  }
  if ("reason" in body) {
    const reason = String(body.reason ?? "").trim();
    if (!reason) return fail("Reason is required");
    if (reason.length > MAX_REASON) return fail(`Reason must be ${MAX_REASON} characters or fewer`);
    data.reason = reason;
  }
  if ("domain" in body) {
    data.domain = String(body.domain ?? "").trim().toLowerCase() || null;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return fail(`Status must be one of: ${STATUSES.join(", ")}`);
    data.status = body.status;
  }
  if (!Object.keys(data).length) return fail("Nothing to update");

  try {
    const entry = await prisma.blockList.update({ where: { id }, data });
    return NextResponse.json({ message: "Blocklist entry updated", data: entry });
  } catch (error) {
    if (error?.code === "P2025") return fail("Blocklist entry not found", 404);
    if (error?.code === "P2002") return fail("That email is already in the blocklist", 409);
    console.error("Failed to update blocklist entry:", error);
    return fail("Failed to update blocklist entry", 500);
  }
}
export const PUT = update;
export const PATCH = update;

// DELETE /api/blocklist/:id  -> removes the entry and its unblock requests
export async function DELETE(_request, { params }) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  if (!isAdmin(session)) return fail("Forbidden", 403);

  const id = await parseId(params);
  if (!id) return fail("Invalid blocklist ID");

  try {
    await prisma.$transaction([
      prisma.unblockRequest.deleteMany({ where: { blockListId: id } }), // requests reference the entry
      prisma.blockList.delete({ where: { id } }),
    ]);
    return NextResponse.json({ message: "Blocklist entry deleted" });
  } catch (error) {
    if (error?.code === "P2025") return fail("Blocklist entry not found", 404);
    console.error("Failed to delete blocklist entry:", error);
    return fail("Failed to delete blocklist entry", 500);
  }
}