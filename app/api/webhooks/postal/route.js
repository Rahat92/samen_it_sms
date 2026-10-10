import { prisma } from "@/lib/prisma";

export async function POST(request) {
//   const secret = new URL(request.url).searchParams.get("secret");
//   if (secret !== process.env.POSTAL_WEBHOOK_SECRET) {
//     return Response.json({ error: "Unauthorized" }, { status: 401 });
//   }

  try {
    const body = await request.json();
    const p = body.payload ?? {};
    const m = p.message ?? {};

    const data = {
      uuid: body.uuid,
      event: body.event,
      occurredAt: new Date((body.timestamp ?? p.timestamp) * 1000),
      postalMsgId: m.id ?? null,
      token: m.token ?? null,
      direction: m.direction ?? null,
      messageId: m.message_id ?? null,
      toAddress: m.to ?? null,
      fromAddress: m.from ?? null,
      subject: m.subject ?? null,
      status: p.status ?? null,
      details: p.details ?? null,
      output: p.output ?? null,
      sentWithSsl: p.sent_with_ssl ?? null,
      durationSec: p.time ?? null,
      payload: body,
    };

    await prisma.mailEvent.upsert({
      where: { uuid: body.uuid },
      create: data,
      update: {},
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to save event" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const events = await prisma.mailEvent.findMany();
    return Response.json({ events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}