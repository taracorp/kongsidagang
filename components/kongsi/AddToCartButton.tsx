"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useCart } from "./cart";
import type { Tone } from "./ProdukCard";

export type CabangPilihan = { id: string; name: string; city: string | null };

export type ProdukKeranjang = {
  productId: string;
  name: string;
  shop?: string;
  price: number;
  tone: Tone;
  branches: CabangPilihan[];
};

const pilihan =
  "w-full cursor-pointer rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment px-4 py-3 text-left text-[14px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-kongsi-beeswax";

/** "+ Keranjang". E-voucher wajib pilih cabang; satu cabang → langsung, lebih → lembar pilihan cabang. */
export function AddToCartButton({ item, className }: { item: ProdukKeranjang; className?: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const tanpaCabang = item.branches.length === 0;

  function masukkan(branch: CabangPilihan) {
    add({
      productId: item.productId,
      branchId: branch.id,
      branchName: branch.name,
      name: item.name,
      shop: item.shop,
      price: item.price,
      tone: item.tone,
    });
    setOpen(false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  function onAdd() {
    if (item.branches.length === 1) masukkan(item.branches[0]);
    else setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        disabled={tanpaCabang}
        className={cn(
          "mt-2 w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          added ? "bg-kongsi-ok text-kongsi-parchment" : "bg-kongsi-beeswax text-kongsi-ink hover:bg-kongsi-beeswax-dark",
          className,
        )}
      >
        {tanpaCabang ? "Belum ada cabang" : added ? "✓ Masuk keranjang" : "+ Keranjang"}
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-kongsi-ink/50 sm:items-center"
              onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Pilih cabang"
                className="max-h-[85vh] w-full max-w-[440px] space-y-2 overflow-y-auto rounded-t-[8px] border-2 border-kongsi-ink bg-kongsi-parchment-3 p-4 shadow-hard sm:rounded-[8px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b className="font-fraunces text-lg font-black text-kongsi-indigo">Pilih cabang</b>
                    <div className="text-[12px] text-kongsi-ink-soft">
                      {item.name} — voucher hanya berlaku di cabang yang dipilih.
                    </div>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="cursor-pointer text-xl font-bold">
                    ×
                  </button>
                </div>
                {item.branches.map((b) => (
                  <button key={b.id} type="button" onClick={() => masukkan(b)} className={pilihan}>
                    {b.name}
                    {b.city ? <span className="block text-[12px] font-normal text-kongsi-ink-soft">{b.city}</span> : null}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
