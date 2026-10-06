import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// DOKU Checkout (non-SNAP). Rujukan: plugin resmi doku-woocommerce-plugin (JokulCheckoutService,
// JokulNotificationService, JokulCheckStatusService).
// Env:
//   DOKU_CLIENT_ID, DOKU_SECRET_KEY  — dari DOKU Back Office → Integration → API Keys (sandbox & produksi berbeda)
//   DOKU_BASE_URL                    — https://api.doku.com (default, produksi) | https://api-sandbox.doku.com
//   DOKU_MOCK=true                   — tanpa kredensial: driver tiruan untuk dev/uji
// Notifikasi: daftarkan https://<domain>/api/doku/notifikasi di Back Office (Payment Settings → Notification URL).

export const PATH_NOTIFIKASI = "/api/doku/notifikasi";

export type CheckoutInput = {
  invoice: string;
  amount: number;
  itemName: string;
  customer: { id: string; name: string; email: string };
  callbackUrl: string; // kembali ke aplikasi setelah bayar
  dueMinutes: number;
};

export type CheckoutHasil = { url: string; expiresAt: Date };

export type StatusTransaksi = "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" | "UNKNOWN";

export type DokuDriver = {
  nama: "doku" | "tiruan";
  buatCheckout(i: CheckoutInput): Promise<CheckoutHasil>;
  cekStatus(invoice: string): Promise<{ status: StatusTransaksi; amount: number | null; channel: string | null }>;
};

/** Timestamp ISO8601 UTC tanpa milidetik, mis. 2026-10-06T03:00:00Z. */
export function stempelWaktu(d = new Date()) {
  return d.toISOString().slice(0, 19) + "Z";
}

/** Signature non-SNAP: HMACSHA256=base64(HMAC(secret, komponen)). Digest hanya bila ada body. */
export function tandaTangan(
  secret: string,
  h: { clientId: string; requestId: string; timestamp: string; target: string },
  body?: string,
): string {
  let raw = `Client-Id:${h.clientId}\nRequest-Id:${h.requestId}\nRequest-Timestamp:${h.timestamp}\nRequest-Target:${h.target}`;
  if (body !== undefined) raw += `\nDigest:${createHash("sha256").update(body).digest("base64")}`;
  return "HMACSHA256=" + createHmac("sha256", secret).update(raw).digest("base64");
}

/** Verifikasi notifikasi DOKU atas body MENTAH (jangan parse lalu serialisasi ulang). */
export function verifikasiNotifikasi(
  cfg: { clientId: string; secret: string },
  headers: { clientId: string | null; requestId: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  target = PATH_NOTIFIKASI,
): boolean {
  const { clientId, requestId, timestamp, signature } = headers;
  if (!clientId || !requestId || !timestamp || !signature) return false;
  if (clientId !== cfg.clientId) return false;
  const harap = tandaTangan(cfg.secret, { clientId, requestId, timestamp, target }, rawBody);
  const a = Buffer.from(signature);
  const b = Buffer.from(harap);
  return a.length === b.length && timingSafeEqual(a, b);
}

function petaStatus(s: unknown): StatusTransaksi {
  const v = String(s ?? "").toUpperCase();
  return v === "SUCCESS" || v === "FAILED" || v === "PENDING" || v === "EXPIRED" ? v : "UNKNOWN";
}

// ============================================================
// Driver asli
// ============================================================

function driverAsli(clientId: string, secret: string): DokuDriver {
  const base = (process.env.DOKU_BASE_URL || "https://api.doku.com").replace(/\/$/, "");

  async function kirim(method: "GET" | "POST", target: string, payload?: unknown) {
    const requestId = randomUUID();
    const timestamp = stempelWaktu();
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const res = await fetch(base + target, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Request-Id": requestId,
        "Request-Timestamp": timestamp,
        ...(body === undefined ? { "Request-Target": target } : {}),
        Signature: tandaTangan(secret, { clientId, requestId, timestamp, target }, body),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json) {
      const err = (json?.error as { message?: string } | undefined)?.message ?? (json?.message as string[] | undefined)?.join(", ");
      throw new Error(`DOKU: ${err ?? `HTTP ${res.status}`}`);
    }
    return json;
  }

  return {
    nama: "doku",
    async buatCheckout(i) {
      const r = await kirim("POST", "/checkout/v1/payment", {
        order: {
          invoice_number: i.invoice,
          amount: i.amount,
          currency: "IDR",
          callback_url: i.callbackUrl,
          callback_url_result: i.callbackUrl,
          auto_redirect: true,
          line_items: [{ name: i.itemName.slice(0, 64), price: i.amount, quantity: 1 }],
        },
        payment: { payment_due_date: i.dueMinutes },
        customer: { id: i.customer.id, name: i.customer.name.slice(0, 64), email: i.customer.email },
        additional_info: { integration: { name: "kongsidagang", version: "1.0" } },
      });
      const pay = (r.response as { payment?: { url?: string; expired_date?: string } } | undefined)?.payment;
      if (!pay?.url) throw new Error("DOKU: URL pembayaran tidak diterima.");
      return { url: pay.url, expiresAt: new Date(Date.now() + i.dueMinutes * 60_000) };
    },
    async cekStatus(invoice) {
      const r = await kirim("GET", `/orders/v1/status/${encodeURIComponent(invoice)}`);
      const trx = r.transaction as { status?: string } | undefined;
      const order = r.order as { amount?: number } | undefined;
      const channel = (r.channel as { id?: string } | undefined)?.id ?? null;
      return { status: petaStatus(trx?.status), amount: order?.amount != null ? Number(order.amount) : null, channel };
    },
  };
}

// ============================================================
// Driver tiruan: "halaman bayar" lokal yang mensimulasikan DOKU.
// ============================================================

const driverTiruan: DokuDriver = {
  nama: "tiruan",
  async buatCheckout(i) {
    return { url: `/pakhuis/isi/tiruan?invoice=${encodeURIComponent(i.invoice)}`, expiresAt: new Date(Date.now() + i.dueMinutes * 60_000) };
  },
  async cekStatus() {
    return { status: "PENDING", amount: null, channel: null };
  },
};

export function dokuConfig(): { clientId: string; secret: string } | null {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secret = process.env.DOKU_SECRET_KEY;
  return clientId && secret ? { clientId, secret } : null;
}

/** Driver aktif: kredensial → DOKU; DOKU_MOCK=true → tiruan; selain itu null. */
export function doku(): DokuDriver | null {
  if (process.env.DOKU_MOCK === "true") return driverTiruan;
  const c = dokuConfig();
  return c ? driverAsli(c.clientId, c.secret) : null;
}
