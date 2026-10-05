"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { run, requireUser, toInt } from "./_util";

export async function ikutiLoji(merchantId: string, follow: boolean) {
  return run(async () => {
    const user = await requireUser();
    const key = { user_id_merchant_id: { user_id: user.id, merchant_id: merchantId } };
    if (follow) {
      await prisma.follow.upsert({
        where: key,
        create: { user_id: user.id, merchant_id: merchantId },
        update: {},
      });
    } else {
      await prisma.follow.deleteMany({ where: { user_id: user.id, merchant_id: merchantId } });
    }
    return follow;
  });
}

/** Pengajuan Jadi Saudagar — boleh tamu maupun yang login. */
export async function ajukanSaudagar(payload: {
  loji_name: string;
  category: string;
  owner_name: string;
  whatsapp: string;
  join_flash_sale: boolean;
}) {
  return run(async () => {
    const loji_name = payload.loji_name.trim();
    const owner_name = payload.owner_name.trim();
    const whatsapp = payload.whatsapp.trim();
    if (!loji_name || !owner_name || !whatsapp) {
      throw new Error("Lengkapi nama loji, saudagar, dan WhatsApp.");
    }
    const user = await getSessionUser();
    await prisma.merchantApplication.create({
      data: {
        loji_name,
        owner_name,
        whatsapp,
        category: payload.category,
        join_flash_sale: Boolean(payload.join_flash_sale),
        applicant_id: user?.id ?? null,
      },
    });
  });
}

// ---------- Lapak-ku: hanya pemilik loji (dulu RLS merchant_products_owner_write) ----------

async function assertOwnsMerchant(userId: string, merchantId: string) {
  const m = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { owner_id: true } });
  if (!m || m.owner_id !== userId) throw new Error("Bukan lojimu.");
}

async function assertOwnsProduct(userId: string, productId: string) {
  const p = await prisma.merchantProduct.findUnique({
    where: { id: productId },
    select: { merchant: { select: { owner_id: true } } },
  });
  if (!p || p.merchant.owner_id !== userId) throw new Error("Bukan produkmu.");
}

export async function tambahProduk(merchantId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsMerchant(user.id, merchantId);
    const name = String(form.get("name") ?? "").trim();
    const price = toInt(form.get("price"));
    if (!name || !price) throw new Error("Isi nama & harga.");
    await prisma.merchantProduct.create({
      data: {
        merchant_id: merchantId,
        name,
        price,
        old_price: toInt(form.get("old_price")) || null,
        tone: String(form.get("tone") ?? "sage"),
      },
    });
  });
}

export async function ubahProduk(productId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsProduct(user.id, productId);
    await prisma.merchantProduct.update({
      where: { id: productId },
      data: {
        name: String(form.get("name") ?? "").trim(),
        price: toInt(form.get("price")),
        old_price: toInt(form.get("old_price")) || null,
      },
    });
  });
}

export async function aturProdukAktif(productId: string, isActive: boolean) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsProduct(user.id, productId);
    await prisma.merchantProduct.update({ where: { id: productId }, data: { is_active: isActive } });
  });
}

export async function hapusProduk(productId: string) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsProduct(user.id, productId);
    await prisma.merchantProduct.delete({ where: { id: productId } });
  });
}

// ---------- Juru Tunjuk: cari produk by tag & kisaran harga (publik) ----------

export type HasilJuru = { name: string; price: number; tone: string; shop: string };

export async function cariJuruTunjuk(tags: string[], min: number, max: number) {
  return run(async (): Promise<HasilJuru[]> => {
    const rows = await prisma.merchantProduct.findMany({
      where: { is_active: true, tags: { hasEvery: tags }, price: { gte: min, lte: max } },
      select: { name: true, price: true, tone: true, merchant: { select: { name: true } } },
      orderBy: { price: "asc" },
      take: 6,
    });
    return rows.map((p) => ({ name: p.name, price: p.price, tone: p.tone, shop: p.merchant.name }));
  });
}
