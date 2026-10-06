import { gagalkanIsiPundi, lunasiIsiPundi } from "@/lib/domain/pundi";
import { dokuConfig, verifikasiNotifikasi, PATH_NOTIFIKASI } from "@/lib/payment/doku";

export const dynamic = "force-dynamic";

/** Notifikasi pembayaran DOKU Checkout. Tanda tangan diverifikasi atas body mentah. */
export async function POST(req: Request) {
  const cfg = dokuConfig();
  if (!cfg) return new Response("DOKU belum dikonfigurasi", { status: 503 });
  const raw = await req.text();
  const ok = verifikasiNotifikasi(
    cfg,
    {
      clientId: req.headers.get("client-id"),
      requestId: req.headers.get("request-id"),
      timestamp: req.headers.get("request-timestamp"),
      signature: req.headers.get("signature"),
    },
    raw,
    PATH_NOTIFIKASI,
  );
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let body: { order?: { invoice_number?: string; amount?: number }; transaction?: { status?: string }; channel?: { id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const invoice = body.order?.invoice_number;
  const status = String(body.transaction?.status ?? "").toUpperCase();
  if (!invoice) return new Response("Bad request", { status: 400 });

  if (status === "SUCCESS") {
    const hasil = await lunasiIsiPundi(invoice, Number(body.order?.amount), body.channel?.id ?? null);
    if (hasil === "tolak") console.error(`[doku] notifikasi ditolak: ${invoice} nominal/pesanan tidak cocok`);
  } else if (status === "FAILED" || status === "EXPIRED") {
    await gagalkanIsiPundi(invoice, status === "FAILED" ? "failed" : "expired");
  }
  return Response.json({ responseCode: "2000000", responseMessage: "Successful" });
}
