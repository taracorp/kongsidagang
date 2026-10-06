"use server";

import { prisma } from "@/lib/db";
import { cariProdukTag, getKotaCabang } from "@/lib/queries-lapak";
import { getSessionUser } from "@/lib/auth";
import { getStaffSession, isAdminUp } from "@/lib/roles";
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
      throw new Error("Lengkapi nama lapak, saudagar, dan WhatsApp.");
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

// ---------- Kelola Lapak: pemilik lapak atau admin Kongsi (pengganti RLS) ----------

async function bolehKelola(userId: string, ownerId: string | null) {
  if (ownerId === userId) return true;
  const s = await getStaffSession();
  return isAdminUp(s.role);
}

async function assertOwnsMerchant(userId: string, merchantId: string) {
  const m = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { owner_id: true } });
  if (!m || !(await bolehKelola(userId, m.owner_id))) throw new Error("Bukan lapakmu.");
}

async function assertOwnsProduct(userId: string, productId: string) {
  const p = await prisma.merchantProduct.findUnique({
    where: { id: productId },
    select: { merchant: { select: { owner_id: true } } },
  });
  if (!p || !(await bolehKelola(userId, p.merchant.owner_id))) throw new Error("Bukan produkmu.");
}

async function assertOwnsBranch(userId: string, branchId: string) {
  const b = await prisma.merchantBranch.findUnique({
    where: { id: branchId },
    select: { merchant: { select: { owner_id: true } } },
  });
  if (!b || !(await bolehKelola(userId, b.merchant.owner_id))) throw new Error("Bukan cabangmu.");
}

const teks = (v: FormDataEntryValue | null, maks = 500) => String(v ?? "").trim().slice(0, maks) || null;

/** Baca isian produk dari form (dipakai tambah & ubah). */
function dataProduk(form: FormData) {
  const name = teks(form.get("name"), 120);
  const price = toInt(form.get("price"));
  if (!name || !price) throw new Error("Isi nama & harga.");
  const valid = toInt(form.get("valid_days")) || 90;
  if (valid < 1 || valid > 730) throw new Error("Masa berlaku 1–730 hari.");
  const tags = String(form.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
  return {
    name,
    price,
    old_price: toInt(form.get("old_price")) || null,
    category: teks(form.get("category"), 60),
    description: teks(form.get("description"), 500),
    valid_days: valid,
    tags,
    is_featured: form.get("is_featured") === "on" || form.get("is_featured") === "true",
  };
}

export async function tambahProduk(merchantId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsMerchant(user.id, merchantId);
    await prisma.merchantProduct.create({
      data: { merchant_id: merchantId, kind: "evoucher", tone: String(form.get("tone") ?? "sage"), ...dataProduk(form) },
    });
  });
}

export async function ubahProduk(productId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsProduct(user.id, productId);
    await prisma.merchantProduct.update({ where: { id: productId }, data: dataProduk(form) });
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
    const terjual = await prisma.voucher.count({ where: { product_id: productId } });
    if (terjual > 0) throw new Error("Produk sudah punya voucher terbit — nonaktifkan saja, jangan dihapus.");
    await prisma.merchantProduct.delete({ where: { id: productId } });
  });
}

export async function tambahCabang(merchantId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsMerchant(user.id, merchantId);
    const name = teks(form.get("name"), 100);
    const address = teks(form.get("address"), 300);
    if (!name || !address) throw new Error("Isi nama & alamat cabang.");
    const urut = await prisma.merchantBranch.count({ where: { merchant_id: merchantId } });
    await prisma.merchantBranch.create({
      data: { merchant_id: merchantId, name, address, city: teks(form.get("city"), 60), sort: urut },
    });
  });
}

export async function ubahCabang(branchId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsBranch(user.id, branchId);
    const name = teks(form.get("name"), 100);
    const address = teks(form.get("address"), 300);
    if (!name || !address) throw new Error("Isi nama & alamat cabang.");
    await prisma.merchantBranch.update({ where: { id: branchId }, data: { name, address, city: teks(form.get("city"), 60) } });
  });
}

export async function aturCabangAktif(branchId: string, isActive: boolean) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsBranch(user.id, branchId);
    await prisma.merchantBranch.update({ where: { id: branchId }, data: { is_active: isActive } });
  });
}

const STATUS_LAPAK = ["buka", "tutup", "segera"];

export async function ubahProfilLapak(merchantId: string, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertOwnsMerchant(user.id, merchantId);
    const status = String(form.get("status") ?? "buka");
    if (!STATUS_LAPAK.includes(status)) throw new Error("Status tidak dikenal.");
    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        description: teks(form.get("description"), 600),
        whatsapp: teks(form.get("whatsapp"), 30),
        hours: teks(form.get("hours"), 80),
        website: teks(form.get("website"), 200),
        status,
      },
    });
  });
}

// ---------- Juru Tunjuk: cari produk by tag & kisaran harga (publik) ----------


/** Juru Tunjuk: perawatan sesuai kebutuhan (tag), anggaran, dan kota cabang. Terbuka untuk tamu. */
export async function cariJuruTunjuk(tag: string, min: number, max: number, kota: string | null) {
  return run(async () => {
    const lo = Math.max(0, Math.floor(Number(min) || 0));
    const hi = Math.min(100_000_000, Math.floor(Number(max) || 100_000_000));
    return cariProdukTag(String(tag ?? "").slice(0, 30), lo, hi, kota ? String(kota).slice(0, 60) : null);
  });
}

export async function kotaJuruTunjuk() {
  return run(() => getKotaCabang());
}
