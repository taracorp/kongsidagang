import { majukanTukar } from "@/lib/domain/tukar";
import { rekonsiliasiPaket } from "@/lib/domain/tukar-kirim";
import { kadaluarsakanVoucher } from "@/lib/domain/belanja";
import { rekonsiliasiPembayaran } from "@/lib/domain/pembayaran";

export const dynamic = "force-dynamic";

/**
 * Dipanggil crontab VPS (mis. tiap 10 menit): kedaluwarsa, konfirmasi otomatis paket sampai,
 * penahanan silang Tukar Guling, rekonsiliasi paket kurir (cek order ragu, minta batal), dan
 * Surat Jalan yang lewat masa berlaku, serta rekonsiliasi pembayaran DOKU yang belum lunas.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const tukar = await majukanTukar();
  const paket = await rekonsiliasiPaket().catch((e: Error) => ({ galat: e.message }));
  const voucherKadaluarsa = await kadaluarsakanVoucher();
  const pembayaran = await rekonsiliasiPembayaran().catch((e: Error) => ({ galat: e.message }));
  return Response.json({ ...tukar, paket, voucherKadaluarsa, pembayaran });
}
