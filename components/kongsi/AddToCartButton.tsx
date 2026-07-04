"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart, itemId, type CartItem } from "./cart";

export function AddToCartButton({
  item,
  className,
}: {
  item: Omit<CartItem, "qty" | "id"> & { id?: string };
  className?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function onAdd() {
    add({ ...item, id: item.id ?? itemId(item.name, item.shop) });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "mt-2 w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-[12px] font-bold transition-colors",
        added
          ? "bg-kongsi-ok text-kongsi-parchment"
          : "bg-kongsi-beeswax text-kongsi-ink hover:bg-kongsi-beeswax-dark",
        className,
      )}
    >
      {added ? "✓ Masuk keranjang" : "+ Keranjang"}
    </button>
  );
}
