"use server";

import { prisma } from "@/lib/db";
import { approveMerchantApplication } from "@/lib/domain/saudagar";
import { isSuperadminEmail } from "@/lib/roles";
import { run, requireAdminUp, requireKabarEditor, requireKetua } from "./_util";

export async function putuskanPengajuan(appId: string, status: "approved" | "rejected") {
  return run(async () => {
    await requireAdminUp();
    if (status === "approved") {
      await approveMerchantApplication(appId);
    } else {
      await prisma.merchantApplication.update({ where: { id: appId }, data: { status: "rejected" } });
    }
  });
}

export async function simpanPariwara(video: string, image: string) {
  return run(async () => {
    await requireAdminUp();
    const now = new Date();
    await prisma.$transaction(
      [
        ["ad_video_url", video.trim()],
        ["ad_image_url", image.trim()],
      ].map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value, updated_at: now },
          update: { value, updated_at: now },
        }),
      ),
    );
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type IsiArtikel = {
  title: string;
  tag: string;
  excerpt: string;
  cover_tone: string;
  body: string[];
  publish: boolean;
};

const MIN_PARAGRAF = 3;

/** Validasi isi artikel: judul, ringkasan, dan minimal 3 paragraf (artikel kosong tidak boleh terbit). */
function bersihkanArtikel(input: IsiArtikel) {
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (!title) throw new Error("Judul wajib.");
  const body = (Array.isArray(input.body) ? input.body : []).map((p) => String(p).trim()).filter(Boolean);
  if (body.length < MIN_PARAGRAF) throw new Error(`Isi minimal ${MIN_PARAGRAF} paragraf (1 paragraf per baris).`);
  return {
    title,
    tag: String(input.tag ?? "Tips Belanja"),
    excerpt: String(input.excerpt ?? "").trim().slice(0, 240) || null,
    cover_tone: String(input.cover_tone ?? "indigo"),
    body,
  };
}

export async function ubahArtikel(slug: string, input: IsiArtikel) {
  return run(async () => {
    await requireKabarEditor();
    const data = bersihkanArtikel(input);
    const lama = await prisma.article.findUnique({ where: { slug: String(slug) }, select: { published_at: true } });
    if (!lama) throw new Error("Artikel tidak ditemukan.");
    await prisma.article.update({
      where: { slug: String(slug) },
      data: { ...data, published_at: input.publish ? (lama.published_at ?? new Date()) : null },
    });
  });
}

export async function buatArtikel(input: IsiArtikel) {
  return run(async () => {
    await requireKabarEditor();
    const { title, ...isi } = bersihkanArtikel(input);
    const exists = await prisma.article.findUnique({ where: { slug: slugify(title) } });
    if (exists) throw new Error("Judul serupa sudah ada — ubah sedikit judulnya.");
    await prisma.article.create({
      data: {
        slug: slugify(title) || `artikel-${Date.now()}`,
        title,
        ...isi,
        published_at: input.publish ? new Date() : null,
      },
    });
  });
}

export async function aturTerbitArtikel(slug: string, publish: boolean) {
  return run(async () => {
    await requireKabarEditor();
    await prisma.article.update({
      where: { slug },
      data: { published_at: publish ? new Date() : null },
    });
  });
}

export async function hapusArtikel(slug: string) {
  return run(async () => {
    await requireKabarEditor();
    await prisma.article.delete({ where: { slug } });
  });
}

/** Atur peran staf — khusus Ketua. "" = cabut peran. Maks 2 Ketua dijaga trigger DB. */
export async function aturPeran(userId: string, role: "" | "pewarta" | "admin" | "ketua") {
  return run(async () => {
    const me = await requireKetua();
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    if (isSuperadminEmail(target.email)) throw new Error("Peran Superadmin tidak bisa diubah.");
    if (role === "") {
      await prisma.staffRole.deleteMany({ where: { user_id: userId } });
      return;
    }
    await prisma.staffRole.upsert({
      where: { user_id: userId },
      create: { user_id: userId, role, granted_by: me.userId },
      update: { role, granted_by: me.userId },
    });
  });
}
