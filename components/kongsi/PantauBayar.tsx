"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";

/**
 * Halaman hasil Bayar Langsung: muat ulang berkala selama menunggu (maks ±3 menit),
 * atau kosongkan keranjang setelah belanja berhasil.
 */
export function PantauBayar({ kosongkanKeranjang }: { kosongkanKeranjang?: boolean }) {
  const router = useRouter();
  const { clear } = useCart();
  useEffect(() => {
    if (kosongkanKeranjang) {
      clear();
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      if (++n > 60) return clearInterval(t);
      router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [kosongkanKeranjang, clear, router]);
  return null;
}
