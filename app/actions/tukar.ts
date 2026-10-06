"use server";

import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { loadCategory } from "@/lib/domain/kategori";
import { taksir } from "@/lib/domain/taksiran";
import { risetHarga, bacaRiset } from "@/lib/taksir/riset";
import * as Tukar from "@/lib/domain/tukar";
import * as Kirim from "@/lib/domain/tukar-kirim";
import * as Alamat from "@/lib/domain/alamat";
import { run, requireUser, requireAdminUp, toInt } from "./_util";

function parseAnswers(raw: unknown, keys: string[]): Record<string, boolean> {
  let obj: unknown = {};
  try {
    obj = JSON.parse(String(raw ?? "{}"));
  } catch {
    // jawaban rusak → anggap tidak ada kekurangan yang diakui
  }
  const out: Record<string, boolean> = {};
  if (obj && typeof obj === "object") {
    for (const k of keys) if ((obj as Record<string, unknown>)[k] === true) out[k] = true;
  }
  return out;
}

/** Nilai barang ditaksir di server dari kategori + atribut + checklist; est_value dari client diabaikan. */
export async function tawarkanBarang(form: FormData) {
  return run(async () => {
    const user = await requireUser();
    const title = String(form.get("title") ?? "").trim();
    if (!title) throw new Error("Isi nama barang.");
    const cat = await loadCategory(String(form.get("category") ?? ""));
    if (!cat) throw new Error("Pilih kategori barang.");

    const answers = parseAnswers(form.get("answers"), cat.checklist.map((c) => c.key));
    const qty = Number(String(form.get("qty") ?? "").replace(",", "."));
    const purchasePrice = toInt(form.get("purchase_price"));
    const purchaseYear = toInt(form.get("purchase_year"));
    const productionYear = toInt(form.get("production_year")) || undefined;
    const boughtCondition = form.get("bought_condition") === "bekas" ? "bekas" : "baru";
    const isCollectible = cat.kind === "aset" && form.get("is_collectible") === "true";
    // Data pasar hanya dari riset tersimpan di DB (angka dari client diabaikan).
    const researchId = String(form.get("research_id") ?? "") || null;
    const riset = researchId ? await bacaRiset(researchId) : null;
    if (researchId && (!riset || riset.kategori !== cat.slug)) throw new Error("Hasil riset harga tidak cocok, cari ulang.");
    const t = taksir(cat, {
      qty,
      purchasePrice,
      purchaseYear,
      productionYear,
      boughtCondition,
      isCollectible,
      answers,
      nowYear: new Date().getFullYear(),
      pasar: riset?.statistik ?? null,
    });

    const serial = String(form.get("serial_number") ?? "").replace(/\s+/g, "").toUpperCase() || null;
    if (cat.needs_serial && !serial) throw new Error(`Isi ${cat.serial_label ?? "nomor seri"}.`);
    if (serial) {
      const dup = await prisma.barterItem.findFirst({
        where: { serial_number: serial, status: "aktif" },
        select: { id: true },
      });
      if (dup) throw new Error(`${cat.serial_label ?? "Nomor seri"} ini sedang ditawarkan di barang lain.`);
    }

    let photo_url: string | null = null;
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      photo_url = await saveUpload("barter", user.id, file);
    }

    await prisma.barterItem.create({
      data: {
        user_id: user.id,
        title,
        category: cat.slug,
        qty: cat.kind === "komoditas" ? qty : null,
        purchase_price: cat.kind === "aset" ? purchasePrice : null,
        purchase_year: cat.kind === "aset" ? purchaseYear : null,
        checklist: answers,
        serial_number: serial,
        est_value: t.mid,
        est_low: t.low,
        est_high: t.high,
        ship_weight_kg: t.shipWeightKg,
        bought_condition: cat.kind === "aset" ? boughtCondition : null,
        production_year: cat.kind === "aset" ? (productionYear ?? null) : null,
        is_collectible: isCollectible,
        research_id: riset?.id ?? null,
        valuation_method: t.metode,
        accuracy: t.akurasi,
        want_text: String(form.get("want_text") ?? "").trim() || null,
        city: String(form.get("city") ?? "").trim() || null,
        tone: String(form.get("tone") ?? "sage"),
        photo_url,
        status: "aktif",
      },
    });
  });
}

/** Juru Taksir: riset harga pasar (BigGo + mesin pencari + loji mitra). Hasil di-cache 7 hari. */
export async function cariHargaPasar(kueri: string, kategori: string, koleksi: boolean) {
  return run(async () => {
    const user = await requireUser();
    const cat = await loadCategory(String(kategori ?? ""));
    if (!cat || cat.kind !== "aset") throw new Error("Pilih kategori barang dulu.");
    const r = await risetHarga(user.id, String(kueri ?? ""), cat.slug, { koleksi: Boolean(koleksi) });
    return {
      id: r.id,
      statistik: r.statistik,
      pembanding: r.pembanding.slice(0, 12),
      jumlah: r.pembanding.length,
      sumberOk: r.sumberOk,
      dariCache: r.dariCache,
    };
  });
}

/** Pemilik minta nilai barangnya ditera Penaksir (admin), dengan catatan/bukti. */
export async function mintaTera(itemId: string, catatan: string) {
  return run(async () => {
    const user = await requireUser();
    const note = String(catatan ?? "").trim().slice(0, 500);
    if (note.length < 5) throw new Error("Tulis alasan / bukti pembanding (min. 5 huruf).");
    const res = await prisma.barterItem.updateMany({
      where: { id: String(itemId), user_id: user.id, status: "aktif", appraisal_status: { not: "diminta" } },
      data: { appraisal_status: "diminta", appraisal_note: note },
    });
    if (res.count === 0) throw new Error("Barang tidak bisa diajukan (sedang dalam tukar, sudah diajukan, atau bukan milikmu).");
  });
}

/** Penaksir (admin) menetapkan nilai barang. Hanya untuk barang aktif (tidak sedang dalam tukar). */
export async function teraPenaksir(itemId: string, nilai: number, catatan: string) {
  return run(async () => {
    await requireAdminUp();
    if (!Number.isInteger(nilai) || nilai < 1_000 || nilai > 10_000_000_000) throw new Error("Nilai tidak valid.");
    const note = String(catatan ?? "").trim().slice(0, 500);
    if (note.length < 5) throw new Error("Tulis dasar penilaian (min. 5 huruf).");
    const res = await prisma.barterItem.updateMany({
      where: { id: String(itemId), status: "aktif" },
      data: {
        est_value: nilai,
        est_low: Math.round(nilai * 0.95),
        est_high: Math.round(nilai * 1.05),
        accuracy: "ditera",
        valuation_method: "penaksir",
        appraisal_status: "ditera",
        appraisal_note: note,
      },
    });
    if (res.count === 0) throw new Error("Barang tidak aktif atau sedang dalam tukar.");
  });
}

/** Admin memperbarui harga komoditas per satuan (riwayat disimpan; terbaru dipakai taksiran). */
export async function aturHargaKomoditas(slug: string, price: number) {
  return run(async () => {
    await requireAdminUp();
    if (!Number.isInteger(price) || price <= 0 || price > 10_000_000) throw new Error("Harga tidak valid.");
    const cat = await prisma.barterCategory.findUnique({ where: { slug }, select: { kind: true } });
    if (!cat || cat.kind !== "komoditas") throw new Error("Kategori komoditas tidak ditemukan.");
    await prisma.commodityPrice.create({ data: { category_slug: slug, price_per_unit: price, source: "admin" } });
  });
}

export async function tutupBarang(itemId: string) {
  return run(async () => {
    const user = await requireUser();
    await Tukar.tutupBarang(user.id, String(itemId));
  });
}

export async function ajukanTukar(
  myItemId: string,
  targetId: string,
  topup: number,
  mode: "cod" | "kirim" = "cod",
  addressId: string | null = null,
) {
  return run(async () => {
    const user = await requireUser();
    return Tukar.ajukan(user.id, String(myItemId), String(targetId), Number(topup), {
      mode: mode === "kirim" ? "kirim" : "cod",
      addressId: addressId ? String(addressId) : null,
    });
  });
}

/** COD: { meetType, meetPlace }. Kirim: { addressId }. */
export async function terimaTukar(
  dealId: string,
  opsi: { meetType?: string; meetPlace?: string; addressId?: string },
) {
  return run(async () => {
    const user = await requireUser();
    if (opsi?.addressId) {
      await Kirim.terimaKirim(user.id, String(dealId), String(opsi.addressId));
    } else {
      await Tukar.terima(user.id, String(dealId), {
        meetType: String(opsi?.meetType ?? ""),
        meetPlace: String(opsi?.meetPlace ?? ""),
      });
    }
  });
}

export async function bayarOngkirTukar(dealId: string) {
  return run(async () => {
    const user = await requireUser();
    await Kirim.bayarOngkir(user.id, String(dealId));
  });
}

/** Coba buat ulang order kurir yang gagal (pihak deal saja). */
export async function cobaKirimLagi(dealId: string) {
  return run(async () => {
    const user = await requireUser();
    const d = await prisma.barterDeal.findUnique({
      where: { id: String(dealId) },
      select: { itemA: { select: { user_id: true } }, itemB: { select: { user_id: true } } },
    });
    if (!d) throw new Error("Tawaran tidak ditemukan.");
    Tukar.pihakDari(d, user.id);
    const r = await Kirim.kirimkanPaket(String(dealId));
    if (r.gagal.length) throw new Error(r.gagal[0]);
    return r;
  });
}

export async function konfirmasiTerima(dealId: string) {
  return run(async () => {
    const user = await requireUser();
    return Tukar.konfirmasi({ userId: user.id }, String(dealId));
  });
}

export async function cariWilayah(q: string) {
  return run(async () => {
    const user = await requireUser();
    return Alamat.cariWilayah(user.id, String(q ?? ""));
  });
}

export async function simpanAlamat(input: Alamat.AlamatInput) {
  return run(async () => {
    const user = await requireUser();
    return Alamat.simpanAlamat(user.id, {
      label: String(input?.label ?? ""),
      name: String(input?.name ?? ""),
      phone: String(input?.phone ?? ""),
      address: String(input?.address ?? ""),
      area: String(input?.area ?? ""),
      district_id: Number(input?.district_id),
      subdistrict_id: Number(input?.subdistrict_id),
      lat: Number(input?.lat),
      lng: Number(input?.lng),
    });
  });
}

export async function hapusAlamat(id: string) {
  return run(async () => {
    const user = await requireUser();
    await Alamat.hapusAlamat(user.id, String(id));
  });
}

export async function tolakTukar(dealId: string) {
  return run(async () => {
    const user = await requireUser();
    await Tukar.tolak(user.id, String(dealId));
  });
}

export async function tarikTukar(dealId: string) {
  return run(async () => {
    const user = await requireUser();
    await Tukar.tarik(user.id, String(dealId));
  });
}

export async function batalDiTempat(dealId: string, alasan: string) {
  return run(async () => {
    const user = await requireUser();
    await Tukar.batalDiTempat(user.id, String(dealId), String(alasan ?? ""));
  });
}

export async function ajukanSengketa(dealId: string, alasan: string) {
  return run(async () => {
    const user = await requireUser();
    await Tukar.sengketa(user.id, String(dealId), String(alasan ?? ""));
  });
}

export async function pindaiKode(dealId: string, kode: string) {
  return run(async () => {
    const user = await requireUser();
    return Tukar.pindai(user.id, String(dealId), String(kode ?? ""));
  });
}

/** Penilaian hanya untuk tukar yang sudah selesai. */
export async function nilaiTukar(dealId: string, stars: number, comment?: string) {
  return run(async () => {
    const user = await requireUser();
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error("Bintang 1–5.");
    const d = await prisma.barterDeal.findUnique({
      where: { id: String(dealId) },
      select: { status: true, itemA: { select: { user_id: true } }, itemB: { select: { user_id: true } } },
    });
    if (!d) throw new Error("Tawaran tidak ditemukan.");
    const p = Tukar.pihakDari(d, user.id);
    if (d.status !== "done" && d.status !== "resolved") throw new Error("Penilaian dibuka setelah tukar selesai.");
    const ratee = p === "a" ? d.itemB.user_id : d.itemA.user_id;
    await prisma.barterRating.upsert({
      where: { deal_id_rater_id: { deal_id: String(dealId), rater_id: user.id } },
      create: { deal_id: String(dealId), rater_id: user.id, ratee_id: ratee, stars, comment: comment ?? null },
      update: { stars, comment: comment ?? null },
    });
  });
}

/** Syahbandar memutus sengketa. */
export async function putusSengketa(dealId: string, keputusan: "selesai" | "batal") {
  return run(async () => {
    await requireAdminUp();
    if (keputusan !== "selesai" && keputusan !== "batal") throw new Error("Putusan tidak dikenal.");
    await Tukar.putus(String(dealId), keputusan);
  });
}
