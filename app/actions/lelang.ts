"use server";

import * as Lelang from "@/lib/domain/lelang";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { run, requireUser, requireAdminUp, toInt } from "./_util";

export async function ikutLelang(auctionId: string) {
  return run(async () => {
    const user = await requireUser();
    await Lelang.ikut(user.id, String(auctionId));
  });
}

export async function tebakLelang(auctionId: string, guess: number) {
  return run(async () => {
    const user = await requireUser();
    await Lelang.tebak(user.id, String(auctionId), Number(guess));
  });
}

/** Pemenang membayar (pilih cabang + metode) → URL DOKU. */
export async function bayarLelang(auctionId: string, branchId: string, metode: string) {
  return run(async () => {
    const user = await requireUser();
    const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const { url } = await Lelang.mulaiBayarLelang({ id: user.id, name: user.name ?? "", email: user.email }, String(auctionId), String(branchId), String(metode), site);
    return { url };
  });
}

/** Pengurus membuat lelang (status draf). Bila `slides`/`usulan_id` ada → materi slide + suara dibuat. */
export async function buatLelang(form: FormData) {
  return run(async () => {
    const s = await requireAdminUp();
    const slidesRaw = String(form.get("slides") ?? "");
    const usulanId = String(form.get("usulan_id") ?? "") || undefined;
    await Lelang.buatLelang(s.userId!, {
      productId: String(form.get("product_id") ?? ""),
      type: form.get("type") === "vendu" ? "vendu" : "reguler",
      clueCategory: String(form.get("clue_category") ?? ""),
      clueNameMasked: String(form.get("clue_name_masked") ?? ""),
      normalPrice: toInt(form.get("normal_price")),
      dealPrice: toInt(form.get("deal_price")),
      setPrice: toInt(form.get("set_price")),
      capacity: toInt(form.get("capacity")) || 10,
      durasiKumpul: toInt(form.get("durasi_kumpul")) || 30,
      durasiTebak: toInt(form.get("durasi_tebak")) || 60,
      facilities: String(form.get("facilities") ?? "").split("\n"),
      slides: slidesRaw ? (JSON.parse(slidesRaw) as unknown) : undefined,
      usulanId,
    });
  });
}

/** Lapak (pemilik) atau pengurus (atas nama lapak) mengajukan usulan lelang. `slides` = JSON. */
export async function ajukanLelang(input: { productId: string; slides: unknown; usulDeal: number }) {
  return run(async () => {
    const user = await requireUser();
    const staff = await getStaffSession();
    await Lelang.ajukanUsulan(user.id, isAdminUp(staff.role), {
      productId: String(input.productId),
      slides: input.slides,
      usulDeal: Number(input.usulDeal),
    });
  });
}

export async function ubahUsulan(usulanId: string, input: { slides: unknown; usulDeal: number }) {
  return run(async () => {
    const s = await requireAdminUp();
    await Lelang.ubahUsulan(s.userId!, String(usulanId), { slides: input.slides, usulDeal: Number(input.usulDeal) });
  });
}

export async function tolakUsulan(usulanId: string, catatan: string) {
  return run(async () => {
    const s = await requireAdminUp();
    await Lelang.tolakUsulan(s.userId!, String(usulanId), String(catatan ?? ""));
  });
}

export async function mulaiLelang(auctionId: string) {
  return run(async () => {
    const s = await requireAdminUp();
    await Lelang.mulaiLelang(s.userId!, String(auctionId));
  });
}

export async function batalkanLelang(auctionId: string, alasan: string) {
  return run(async () => {
    const s = await requireAdminUp();
    await Lelang.batalkanLelang(s.userId!, String(auctionId), String(alasan ?? ""));
  });
}
