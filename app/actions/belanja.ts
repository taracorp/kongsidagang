"use server";

import { prisma } from "@/lib/db";
import { belanja, tebusVoucherLapak, tebusVoucherAdmin, type BarisBelanja } from "@/lib/domain/belanja";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { run, requireUser, requireAdminUp } from "./_util";

/** Bayar keranjang dengan Keteng. Hanya ID produk, cabang, dan jumlah yang dikirim — harga dari DB. */
export async function bayarKeranjang(baris: BarisBelanja[]) {
  return run(async () => {
    const user = await requireUser();
    const bersih = (Array.isArray(baris) ? baris : []).map((b) => ({
      productId: String(b?.productId ?? ""),
      branchId: b?.branchId ? String(b.branchId) : null,
      qty: Number(b?.qty),
    }));
    return belanja(user.id, bersih);
  });
}

/** Petugas menebus voucher di lapak miliknya (pemilik lapak atau admin Kongsi). */
export async function tebusVoucher(merchantId: string, branchId: string, kode: string) {
  return run(async () => {
    const user = await requireUser();
    const m = await prisma.merchant.findUnique({ where: { id: String(merchantId) }, select: { owner_id: true } });
    if (!m) throw new Error("Lapak tidak ditemukan.");
    if (m.owner_id !== user.id) {
      const s = await getStaffSession();
      if (!isAdminUp(s.role)) throw new Error("Hanya pengelola lapak ini.");
    }
    return tebusVoucherLapak(user.id, String(merchantId), String(branchId ?? ""), String(kode ?? ""));
  });
}

/** Admin Kantor Kongsi menebus voucher hadiah lelang. */
export async function tebusVoucherKantor(kode: string) {
  return run(async () => {
    const s = await requireAdminUp();
    return tebusVoucherAdmin(s.userId!, String(kode ?? ""));
  });
}
