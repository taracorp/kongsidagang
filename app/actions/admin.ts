"use server";

import { prisma } from "@/lib/db";
import { approveMerchantApplication } from "@/lib/domain/saudagar";
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

export async function buatArtikel(input: {
  title: string;
  tag: string;
  excerpt: string;
  cover_tone: string;
  body: string[];
  publish: boolean;
}) {
  return run(async () => {
    await requireKabarEditor();
    const title = input.title.trim();
    if (!title) throw new Error("Judul wajib.");
    const exists = await prisma.article.findUnique({ where: { slug: slugify(title) } });
    if (exists) throw new Error("Judul serupa sudah ada — ubah sedikit judulnya.");
    await prisma.article.create({
      data: {
        slug: slugify(title) || `artikel-${Date.now()}`,
        title,
        tag: input.tag,
        excerpt: input.excerpt.trim() || null,
        cover_tone: input.cover_tone,
        body: input.body,
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
