"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { bayarKeranjang } from "@/app/actions/belanja";
import { PilihMetode } from "./PilihMetode";
import { KongsiButton, KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { useCart } from "@/components/kongsi/cart";
import { GoogleButton } from "@/components/kongsi/GoogleButton";
import { cn, formatKeping } from "@/lib/utils";
import { METODE, platformFee, rincianBayar } from "@/lib/payment/biaya";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

type Tab = "daftar" | "masuk";
type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };

function GateForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("daftar");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    if (!email || !password) {
      setStatus({ kind: "error", message: "Isi surel & kata sandi." });
      return;
    }
    if (tab === "daftar") {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: name || email.split("@")[0],
      });
      if (error)
        return setStatus({ kind: "error", message: error.message ?? "Gagal mendaftar." });
    } else {
      const { error } = await authClient.signIn.email({ email, password });
      if (error)
        return setStatus({ kind: "error", message: error.message ?? "Gagal masuk." });
    }
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
      <div className="border-b-2 border-kongsi-grenadine bg-[#FBE3D5] px-[18px] py-4 text-[13px] text-kongsi-grenadine-dark">
        🔑 <b className="text-kongsi-grenadine">Daftar dulu untuk menebus.</b>{" "}
        Keliling &amp; isi keranjang bebas — akun cuma dibutuhkan saat bayar.
      </div>
      <div className="flex border-b-2 border-kongsi-ink">
        {(
          [
            ["daftar", "Daftar Kilat"],
            ["masuk", "Sudah punya akun"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              setTab(val);
              setStatus({ kind: "idle" });
            }}
            className={cn(
              "flex-1 cursor-pointer p-[13px] font-fraunces text-[15px] font-black",
              tab === val
                ? "bg-kongsi-parchment text-kongsi-indigo shadow-[inset_0_-3px_0_var(--color-kongsi-grenadine)]"
                : "bg-kongsi-parchment-2 text-kongsi-ink-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="p-[22px]">
        {tab === "daftar" ? (
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="name">
              Nama panggilan
            </label>
            <input id="name" name="name" className={fieldInput} placeholder="cth. Tara D." />
          </div>
        ) : null}
        <div className="mb-[14px]">
          <label className={fieldLabel} htmlFor="email">
            Surel
          </label>
          <input id="email" name="email" type="email" className={fieldInput} placeholder="nama@surel.com" />
        </div>
        <div className="mb-[14px]">
          <label className={fieldLabel} htmlFor="password">
            Kata sandi
          </label>
          <input id="password" name="password" type="password" className={fieldInput} placeholder="••••••••" />
        </div>
        {status.kind === "error" ? (
          <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
            {status.message}
          </p>
        ) : null}
        {status.kind === "notice" ? (
          <p className="mb-3 rounded-[4px] border-2 border-kongsi-olive bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-ink-soft">
            {status.message}
          </p>
        ) : null}
        <KongsiButton type="submit" variant="primary" block disabled={status.kind === "loading"}>
          {status.kind === "loading"
            ? "Memproses…"
            : tab === "daftar"
              ? "Daftar & Lanjut Bayar"
              : "Masuk & Lanjut Bayar"}
        </KongsiButton>
        <div className="my-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[1px] text-kongsi-olive">
          <span className="h-px flex-1 bg-kongsi-ink/20" />
          atau
          <span className="h-px flex-1 bg-kongsi-ink/20" />
        </div>
        <GoogleButton next="/bayar" />
      </form>
    </div>
  );
}

export function BayarClient({
  loggedIn,
  pkp,
  tersedia,
}: {
  loggedIn: boolean;
  pkp: boolean; // platform fee + PPN bila Kongsi sudah PKP
  tersedia: boolean; // pembayaran DOKU (atau demo) aktif
}) {
  const { items, subtotal } = useCart();
  const [metode, setMetode] = useState("QRIS");
  const [pay, setPay] = useState<{ k: "idle" } | { k: "paying" } | { k: "error"; m: string }>({ k: "idle" });

  // Perkiraan untuk tampilan; server menghitung ulang dari harga di DB dengan rumus yang sama.
  const pf = platformFee(pkp);
  const neto = subtotal + pf.total;
  const { total, biaya } = subtotal > 0 ? rincianBayar(neto, metode) : { total: 0, biaya: 0 };
  const namaMetode = (METODE.find((m) => m.kode === metode)?.nama ?? metode).split(" (")[0];

  async function bayar() {
    setPay({ k: "paying" });
    const { error, data } = await bayarKeranjang(
      items.map((it) => ({ productId: it.productId, branchId: it.branchId, qty: it.qty })),
      metode,
    );
    if (error || !data) return setPay({ k: "error", m: error ?? "Gagal membuka pembayaran." });
    window.location.assign(data.url); // halaman bayar DOKU (atau halaman hasil pada mode demo)
  }

  const baris = "flex justify-between gap-3 py-[6px] text-sm";
  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Gerbang Tebus</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Satu langkah lagi</h2>
        </div>

        {items.length === 0 ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-6 py-12 text-center">
            <p className="text-kongsi-ink-soft">Belum ada yang ditebus.</p>
            <KongsiLinkButton href="/lapak" variant="gold" className="mt-4">
              Jelajah Lapak
            </KongsiLinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6">
            {loggedIn ? (
              <div className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
                <div className="border-b-2 border-kongsi-ink bg-kongsi-sage/30 px-[18px] py-3 text-[13px]">
                  💳 Pilih cara bayar. Biaya pembayaran mengikuti metode yang kamu pilih.
                </div>
                <div className="space-y-4 p-[22px]">
                  {tersedia ? (
                    <>
                      <PilihMetode neto={neto} value={metode} onChange={setMetode} />
                      <KongsiButton variant="primary" block onClick={bayar} disabled={pay.k === "paying"}>
                        {pay.k === "paying" ? "Membuka pembayaran…" : `Bayar ${formatKeping(total)} · ${namaMetode}`}
                      </KongsiButton>
                    </>
                  ) : (
                    <p className="text-[13px] text-kongsi-ink-soft">Pembayaran sedang tidak tersedia. Coba lagi nanti.</p>
                  )}
                  {pay.k === "error" ? (
                    <p className="rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
                      {pay.m}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <GateForm />
            )}
            <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
              <h3 className="mb-[14px] font-fraunces text-[19px] font-black text-kongsi-indigo">Yang ditebus</h3>
              {items.map((it) => (
                <div key={it.key} className={baris}>
                  <span>
                    {it.name}
                    {it.qty > 1 ? ` ×${it.qty}` : ""}
                    {it.branchName ? <span className="block text-[11px] text-kongsi-olive">{it.branchName}</span> : null}
                  </span>
                  <span>{formatKeping(it.price * it.qty)}</span>
                </div>
              ))}
              <div className={baris}>
                <span>Platform fee</span>
                <span>{formatKeping(pf.fee)}</span>
              </div>
              {pf.ppn ? (
                <div className={baris}>
                  <span>PPN platform fee (11%)</span>
                  <span>{formatKeping(pf.ppn)}</span>
                </div>
              ) : null}
              {loggedIn && tersedia ? (
                <div className={baris}>
                  <span>
                    Biaya pembayaran
                    <span className="block text-[11px] text-kongsi-olive">{namaMetode}</span>
                  </span>
                  <span>{formatKeping(biaya)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t-2 border-kongsi-ink pt-3 font-fraunces text-xl font-black text-kongsi-indigo">
                <span>Total</span>
                <span>{formatKeping(loggedIn && tersedia ? total : neto)}</span>
              </div>
              {!loggedIn || !tersedia ? (
                <div className="mt-2 text-[11px] text-kongsi-ink-soft">+ biaya pembayaran sesuai metode yang dipilih.</div>
              ) : null}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[12px] text-kongsi-ink-soft">
          <Link href="/keranjang" className="font-bold text-kongsi-grenadine">
            ← Kembali ke keranjang
          </Link>
        </p>
      </div>
    </section>
  );
}
