"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton, KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { useCart } from "@/components/kongsi/cart";
import { GoogleButton } from "@/components/kongsi/GoogleButton";
import { cn, formatKeping } from "@/lib/utils";

const BEA = 2000;
const ONGKIR = 9000;

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
    const supabase = createClient();
    if (tab === "daftar") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) return setStatus({ kind: "error", message: error.message });
      if (!data.session)
        return setStatus({
          kind: "notice",
          message: "Cek surel untuk konfirmasi akun, lalu masuk untuk menebus.",
        });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setStatus({ kind: "error", message: error.message });
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
  level,
  stamps,
}: {
  loggedIn: boolean;
  level: string;
  stamps: number;
}) {
  const { items, subtotal, clear } = useCart();
  const [pay, setPay] = useState<
    { k: "idle" } | { k: "paying" } | { k: "ok" } | { k: "error"; m: string }
  >({ k: "idle" });

  const beaFree =
    loggedIn && (["tuan_besar", "juragan"].includes(level) || stamps >= 10);
  const bea = beaFree ? 0 : BEA;
  const total = subtotal + ONGKIR + bea;

  async function bayarPundi() {
    setPay({ k: "paying" });
    const supabase = createClient();
    const { error } = await supabase.rpc("checkout_keping", {
      p_subtotal: subtotal,
      p_ongkir: ONGKIR,
    });
    if (error) return setPay({ k: "error", m: error.message });
    clear();
    setPay({ k: "ok" });
  }

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Gerbang Tebus
          </div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">
            Satu langkah lagi
          </h2>
        </div>

        {pay.k === "ok" ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-kongsi-ok bg-[#E4EFE5] px-6 py-12 text-center">
            <div className="font-fraunces text-xl font-black text-kongsi-ok">
              ✓ Pembayaran berhasil
            </div>
            <p className="mt-2 text-sm text-kongsi-ink-soft">
              Keping terpotong. Surat Jalan &amp; riwayat ada di Pakhuis.
            </p>
            <KongsiLinkButton href="/pakhuis" variant="primary" className="mt-4">
              Ke Pakhuis
            </KongsiLinkButton>
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-6 py-12 text-center">
            <p className="text-kongsi-ink-soft">Belum ada yang ditebus.</p>
            <KongsiLinkButton href="/loji" variant="gold" className="mt-4">
              Jelajah Loji
            </KongsiLinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6">
            {loggedIn ? (
              <div className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
                <div className="border-b-2 border-kongsi-ink bg-kongsi-sage/30 px-[18px] py-3 text-[13px]">
                  🔑 Kamu sudah masuk loji — tebus pakai <b>Pundi (Keping)</b>.
                </div>
                <div className="p-[22px]">
                  <KongsiButton variant="primary" block onClick={bayarPundi} disabled={pay.k === "paying"}>
                    {pay.k === "paying"
                      ? "Memproses…"
                      : `Bayar ${formatKeping(total)} dengan Keping`}
                  </KongsiButton>
                  {pay.k === "error" ? (
                    <p className="mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
                      {pay.m}{" "}
                      <Link href="/pakhuis" className="font-bold underline">
                        Isi Pundi
                      </Link>
                    </p>
                  ) : null}
                  <p className="mt-[10px] text-center text-[11px] text-kongsi-ink-soft">
                    Pembayaran via DOKU (kartu/VA) segera hadir.
                  </p>
                </div>
              </div>
            ) : (
              <GateForm />
            )}
            <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
              <h3 className="mb-[14px] font-fraunces text-[19px] font-black text-kongsi-indigo">
                Yang ditebus
              </h3>
              {items.map((it) => (
                <div key={it.id} className="flex justify-between py-[6px] text-sm">
                  <span>
                    {it.name}
                    {it.qty > 1 ? ` ×${it.qty}` : ""}
                  </span>
                  <span>{formatKeping(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between py-[6px] text-sm">
                <span>Bea layanan</span>
                <span>
                  {beaFree ? (
                    <>
                      <span className="mr-1 text-kongsi-ink-soft line-through">
                        {formatKeping(BEA)}
                      </span>
                      <b className="text-kongsi-ok">Gratis</b>
                    </>
                  ) : (
                    formatKeping(BEA)
                  )}
                </span>
              </div>
              <div className="flex justify-between py-[6px] text-sm">
                <span>Ongkir</span>
                <span>{formatKeping(ONGKIR)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-kongsi-ink pt-3 font-fraunces text-xl font-black text-kongsi-indigo">
                <span>Total</span>
                <span>{formatKeping(total)}</span>
              </div>
              {beaFree ? (
                <div className="mt-2 text-[11px] font-bold text-kongsi-ok">
                  ✓ Bea gratis — hak level / tukar Cap
                </div>
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
