"use client";

import Link from "next/link";
import { CompassRose } from "@/components/kongsi/icons";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { useCart } from "@/components/kongsi/cart";
import { cn, formatKeping } from "@/lib/utils";

const BEA = 2000;
const ONGKIR = 9000;

const toneBg: Record<string, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

export default function KeranjangPage() {
  const { items, subtotal, count, setQty, remove } = useCart();
  const total = items.length ? subtotal + BEA + ONGKIR : 0;

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Keranjang
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Barang bawaanmu
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-6 py-12 text-center">
            <p className="text-kongsi-ink-soft">
              Keranjangmu masih kosong. Keliling dulu di lorong loji.
            </p>
            <KongsiLinkButton href="/loji" variant="gold" className="mt-4">
              Jelajah Loji
            </KongsiLinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6">
            <div>
              {items.map((it) => (
                <div
                  key={it.id}
                  className="mb-3 flex items-center gap-[14px] rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment p-3"
                >
                  <div
                    className={cn(
                      "flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[4px] border-2 border-kongsi-ink text-kongsi-indigo",
                      toneBg[it.tone] ?? "bg-kongsi-sage",
                    )}
                  >
                    <CompassRose size={26} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{it.name}</div>
                    {it.shop ? (
                      <div className="text-[11px] text-kongsi-olive">
                        {it.shop}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex items-center overflow-hidden rounded-[3px] border-2 border-kongsi-ink">
                        <button
                          type="button"
                          aria-label="Kurangi"
                          onClick={() => setQty(it.id, it.qty - 1)}
                          className="cursor-pointer bg-kongsi-parchment-3 px-2 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="min-w-[26px] bg-white px-1 text-center text-sm font-bold">
                          {it.qty}
                        </span>
                        <button
                          type="button"
                          aria-label="Tambah"
                          onClick={() => setQty(it.id, it.qty + 1)}
                          className="cursor-pointer bg-kongsi-parchment-3 px-2 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        className="cursor-pointer text-[12px] font-bold text-kongsi-bad"
                      >
                        Buang
                      </button>
                    </div>
                  </div>
                  <div className="font-fraunces font-black text-kongsi-grenadine">
                    {formatKeping(it.price * it.qty)}
                  </div>
                </div>
              ))}
              <p className="mt-[6px] text-[13px] text-kongsi-ink-soft">
                ◆ Tamu boleh menaruh barang di keranjang tanpa masuk loji.
                Daftar hanya diminta saat menebus.
              </p>
            </div>

            <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
              <h3 className="mb-[14px] font-fraunces text-[19px] font-black text-kongsi-indigo">
                Ringkasan
              </h3>
              <div className="flex justify-between py-[6px] text-sm">
                <span>Subtotal ({count} barang)</span>
                <span>{formatKeping(subtotal)}</span>
              </div>
              <div className="flex justify-between py-[6px] text-sm">
                <span>Bea layanan</span>
                <span>{formatKeping(BEA)}</span>
              </div>
              <div className="flex justify-between py-[6px] text-sm">
                <span>Ongkir</span>
                <span>{formatKeping(ONGKIR)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-kongsi-ink pt-3 font-fraunces text-xl font-black text-kongsi-indigo">
                <span>Total</span>
                <span>{formatKeping(total)}</span>
              </div>
              <KongsiLinkButton
                href="/bayar"
                variant="primary"
                block
                className="mt-[14px]"
              >
                Lanjut Menebus
              </KongsiLinkButton>
              <p className="mt-2 text-center text-[11px] text-kongsi-ink-soft">
                Dibayar dengan Keping (isi Pundi) atau langsung via DOKU.
              </p>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[12px] text-kongsi-ink-soft">
          <Link href="/" className="font-bold text-kongsi-grenadine">
            ← Lanjut belanja
          </Link>
        </p>
      </div>
    </section>
  );
}
