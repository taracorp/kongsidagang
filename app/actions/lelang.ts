"use server";

import * as Lelang from "@/lib/domain/lelang";
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

/** Pengurus membuat lelang (status draf). */
export async function buatLelang(form: FormData) {
  return run(async () => {
    const s = await requireAdminUp();
    await Lelang.buatLelang(s.userId!, {
      productId: String(form.get("product_id") ?? ""),
      type: form.get("type") === "vendu" ? "vendu" : "reguler",
      clueCategory: String(form.get("clue_category") ?? ""),
      clueNameMasked: String(form.get("clue_name_masked") ?? ""),
      normalPrice: toInt(form.get("normal_price")),
      dealPrice: toInt(form.get("deal_price")),
      setPrice: toInt(form.get("set_price")),
      capacity: toInt(form.get("capacity")) || 10,
      facilities: String(form.get("facilities") ?? "").split("\n"),
    });
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
