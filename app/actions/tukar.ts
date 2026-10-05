"use server";

import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { loadCategory } from "@/lib/domain/kategori";
import { taksir } from "@/lib/domain/taksiran";
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
    const t = taksir(cat, { qty, purchasePrice, purchaseYear, answers, nowYear: new Date().getFullYear() });

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
        want_text: String(form.get("want_text") ?? "").trim() || null,
        city: String(form.get("city") ?? "").trim() || null,
        tone: String(form.get("tone") ?? "sage"),
        photo_url,
        status: "aktif",
      },
    });
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
    const res = await prisma.barterItem.updateMany({
      where: { id: itemId, user_id: user.id },
      data: { status: "ditutup" },
    });
    if (res.count === 0) throw new Error("Barang tidak ditemukan.");
  });
}

export async function ajukanTukar(myItemId: string, targetId: string, topup: number) {
  return run(async () => {
    const user = await requireUser();
    if (!Number.isInteger(topup) || topup < 0) throw new Error("Tambahan Keteng tidak valid.");
    const [mine, target] = await Promise.all([
      prisma.barterItem.findUnique({ where: { id: myItemId }, select: { user_id: true, status: true } }),
      prisma.barterItem.findUnique({ where: { id: targetId }, select: { user_id: true, status: true } }),
    ]);
    if (!mine || mine.user_id !== user.id) throw new Error("Pilih barangmu sendiri.");
    if (!target || target.status !== "aktif") throw new Error("Barang tujuan tidak tersedia.");
    if (target.user_id === user.id) throw new Error("Tidak bisa menukar dengan barang sendiri.");
    await prisma.barterDeal.create({
      data: { item_a: myItemId, item_b: targetId, topup_keping: topup, status: "proposed" },
    });
  });
}

/** Dua pihak dalam deal saja yang boleh mengubah status (dulu: RLS barter_deals_involved_update). */
async function dealParties(dealId: string) {
  const d = await prisma.barterDeal.findUnique({
    where: { id: dealId },
    select: { itemA: { select: { user_id: true } }, itemB: { select: { user_id: true } } },
  });
  if (!d) throw new Error("Kesepakatan tidak ditemukan.");
  return { a: d.itemA.user_id, b: d.itemB.user_id };
}

const PARTY_STATUSES = ["agreed", "ditolak", "done", "disputed"];

export async function ubahStatusTukar(dealId: string, next: string) {
  return run(async () => {
    const user = await requireUser();
    if (!PARTY_STATUSES.includes(next)) throw new Error("Status tidak dikenal.");
    const { a, b } = await dealParties(dealId);
    if (user.id !== a && user.id !== b) throw new Error("Bukan pihak deal ini");
    await prisma.barterDeal.update({ where: { id: dealId }, data: { status: next } });
  });
}

export async function nilaiTukar(dealId: string, stars: number, comment?: string) {
  return run(async () => {
    const user = await requireUser();
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error("Bintang 1–5.");
    const { a, b } = await dealParties(dealId);
    if (user.id !== a && user.id !== b) throw new Error("Bukan pihak deal ini");
    const ratee = user.id === a ? b : a;
    await prisma.barterRating.upsert({
      where: { deal_id_rater_id: { deal_id: dealId, rater_id: user.id } },
      create: { deal_id: dealId, rater_id: user.id, ratee_id: ratee, stars, comment: comment ?? null },
      update: { stars, comment: comment ?? null },
    });
  });
}

/** Syahbandar memutus sengketa. */
export async function putusSengketa(dealId: string, next: "done" | "dibatalkan") {
  return run(async () => {
    await requireAdminUp();
    if (next !== "done" && next !== "dibatalkan") throw new Error("Putusan tidak dikenal.");
    await prisma.barterDeal.update({ where: { id: dealId }, data: { status: next } });
  });
}
