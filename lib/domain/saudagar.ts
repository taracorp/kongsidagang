import "server-only";
import { prisma } from "@/lib/db";

// Port dari plpgsql approve_merchant_application (migrasi Supabase 0012).

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Setujui pengajuan → buat loji (owner = pemohon, bersegel) dengan slug unik. */
export async function approveMerchantApplication(appId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const app = await tx.merchantApplication.findUnique({ where: { id: appId } });
    if (!app) throw new Error("Pengajuan tidak ditemukan");

    const base = slugify(app.loji_name) || "loji";
    let slug = base;
    for (let n = 1; await tx.merchant.findUnique({ where: { slug }, select: { id: true } }); n++) {
      slug = `${base}-${n}`;
    }

    const m = await tx.merchant.create({
      data: {
        slug,
        name: app.loji_name,
        category: app.category,
        owner_id: app.applicant_id,
        is_sealed: true,
        status: "buka",
        tone: "indigo",
        cover_from: "indigo",
        cover_to: "beeswax",
      },
    });
    await tx.merchantApplication.update({
      where: { id: appId },
      data: { status: "approved" },
    });
    return m.id;
  });
}
