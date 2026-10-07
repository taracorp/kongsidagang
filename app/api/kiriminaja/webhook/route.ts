import { timingSafeEqual } from "node:crypto";
import { prosesWebhook, type WebhookData } from "@/lib/domain/tukar-kirim";
import { tokenWebhook } from "@/lib/shipping/kiriminaja";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

function cocok(header: string | null, token: string) {
  const a = Buffer.from(header ?? "");
  const b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Callback status paket KiriminAja (daftarkan URL ini lewat POST /api/mitra/set_callback).
 * KiriminAja mengirim header Authorization: Bearer {api_key}.
 */
export async function POST(req: Request) {
  const token = tokenWebhook();
  if (!token || !cocok(req.headers.get("authorization"), token)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { method?: string; data?: WebhookData[] } | null;
  if (!body?.method || !Array.isArray(body.data)) return Response.json({ ok: true, diproses: 0 });
  const diproses = await prosesWebhook(body.method, body.data);
  // Log callback (sudah terverifikasi token) untuk diagnosa & bukti UAT; disimpan 500 terakhir.
  await prisma.kurirWebhookLog
    .create({ data: { method: body.method.slice(0, 60), payload: body as unknown as Prisma.InputJsonValue, diproses } })
    .catch(() => null);
  return Response.json({ ok: true, diproses });
}
