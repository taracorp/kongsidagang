"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Tone } from "./ProdukCard";

// Keranjang tamu (localStorage). Menyimpan ID produk + cabang; harga di sini hanya untuk tampilan —
// server menghitung ulang dari DB saat bayar.

export type CartItem = {
  key: string; // productId + branchId
  productId: string;
  branchId: string | null;
  branchName: string | null;
  name: string;
  shop?: string;
  price: number;
  tone: Tone;
  qty: number;
};

export type CartInput = Omit<CartItem, "key" | "qty">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: CartInput, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
// v2: item wajib punya productId. Isi versi lama (tanpa ID produk) tidak dipakai lagi.
const STORAGE_KEY = "kongsi.cart.v2";
const MAKS_QTY = 20;

export const kunciItem = (productId: string, branchId: string | null) => `${productId}__${branchId ?? "-"}`;

function sah(x: unknown): x is CartItem {
  const i = x as CartItem;
  return !!i && typeof i.productId === "string" && i.productId.length > 0 && typeof i.qty === "number" && i.qty > 0;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem("kongsi.cart"); // keranjang lama tanpa ID produk
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- muat dari localStorage setelah mount (aman hidrasi)
      setItems(Array.isArray(parsed) ? parsed.filter(sah) : []);
    } catch {
      // abaikan penyimpanan rusak
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // abaikan kuota penuh
    }
  }, [items, loaded]);

  const add = useCallback((item: CartInput, qty = 1) => {
    const key = kunciItem(item.productId, item.branchId);
    setItems((prev) => {
      const found = prev.find((i) => i.key === key);
      if (found) return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(MAKS_QTY, i.qty + qty) } : i));
      return [...prev, { ...item, key, qty: Math.min(MAKS_QTY, qty) }];
    });
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, qty: Math.min(MAKS_QTY, qty) } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
    return { items, count, subtotal, add, remove, setQty, clear };
  }, [items, add, remove, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus dipakai di dalam CartProvider");
  return ctx;
}
