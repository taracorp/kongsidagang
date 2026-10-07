"use server";

import * as U from "@/lib/domain/kurir-uji";
import type { Wilayah } from "@/lib/shipping/kiriminaja";
import { run, requireAdminUp } from "./_util";

// Uji Kurir KiriminAja — hanya pengurus (admin ke atas).

export async function ujiKoneksi() {
  return run(async () => {
    await requireAdminUp();
    return U.cekKoneksi();
  });
}

export async function ujiWilayah(q: string) {
  return run(async () => {
    await requireAdminUp();
    const k = String(q ?? "").trim();
    if (k.length < 3) throw new Error("Ketik minimal 3 huruf.");
    return U.cariWilayah(k);
  });
}

export async function ujiOngkir(asal: Wilayah, tujuan: Wilayah, paket: U.InputPaket) {
  return run(async () => {
    await requireAdminUp();
    return U.cekOngkir(asal, tujuan, paket);
  });
}

export async function ujiBuatPaket(input: U.InputUji) {
  return run(async () => {
    const s = await requireAdminUp();
    const u = await U.buatPaketUji(s.userId!, input);
    return { id: u.id, order_id: u.order_id, awb: u.awb };
  });
}

export async function ujiLacak(id: string) {
  return run(async () => {
    await requireAdminUp();
    return U.lacakPaketUji(String(id));
  });
}

export async function ujiBatal(id: string, alasan: string) {
  return run(async () => {
    await requireAdminUp();
    return U.batalPaketUji(String(id), String(alasan ?? ""));
  });
}
