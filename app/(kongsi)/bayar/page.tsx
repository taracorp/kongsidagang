"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { useCart } from "@/components/kongsi/cart";
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
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

function GateForm() {
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
      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }
      setStatus({
        kind: "ok",
        message: data.session
          ? "Akun siap — lanjut pembayaran (DOKU/Pundi menyusul)."
          : "Cek surel untuk konfirmasi akun, lalu masuk untuk menebus.",
      });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Berhasil masuk — lanjut pembayaran (DOKU/Pundi menyusul).",
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
      <div className="border-b-2 border-kongsi-grenadine bg-[#FBE3D5] px-[18px] py-4 text-[13px] text-kongsi-grenadine-dark">
        🔑 <b className="text-kongsi-grenadine">Daftar dulu untuk menebus.</b>{" "}
        Keliling &amp; isi keranjang bebas — akun cuma dibutuhkan saat bayar,
        biar barang &amp; Surat Jalan-mu tersimpan aman.
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

      {status.kind === "ok" ? (
        <div className="p-[22px] text-center">
          <div className="font-fraunces text-lg font-black text-kongsi-ok">
            ✓ {status.message}
          </div>
        </div>
      ) : (
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
            <input
              id="email"
              name="email"
              type="email"
              className={fieldInput}
              placeholder="nama@surel.com"
            />
          </div>
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="password">
              Kata sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={fieldInput}
              placeholder="••••••••"
            />
          </div>
          {status.kind === "error" ? (
            <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
              {status.message}
            </p>
          ) : null}
          <KongsiButton
            type="submit"
            variant="primary"
            block
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading"
              ? "Memproses…"
              : tab === "daftar"
                ? "Daftar & Lanjut Bayar"
                : "Masuk & Lanjut Bayar"}
          </KongsiButton>
          {tab === "daftar" ? (
            <p className="mt-[10px] text-center text-[11px] text-kongsi-ink-soft">
              Dengan daftar, kamu jadi <b>Pelanggan Kecil</b> — level naik
              seiring transaksi.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

export default function BayarPage() {
  const { items, subtotal, clear } = useCart();
  const total = subtotal + BEA + ONGKIR;
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setLoggedIn(Boolean(session?.user)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const [pay, setPay] = useState<
    { k: "idle" } | { k: "paying" } | { k: "ok" } | { k: "error"; m: string }
  >({ k: "idle" });

  async function bayarPundi() {
    setPay({ k: "paying" });
    const supabase = createClient();
    const { error } = await supabase.rpc("spend_keping", {
      amt: total,
      note: "Belanja Kongsi",
    });
    if (error) {
      setPay({ k: "error", m: error.message });
      return;
    }
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
                  <KongsiButton
                    variant="primary"
                    block
                    onClick={bayarPundi}
                    disabled={pay.k === "paying"}
                  >
                    {pay.k === "paying"
                      ? "Memproses…"
                      : `Bayar ${formatKeping(total)} dengan Keping`}
                  </KongsiButton>
                  {pay.k === "error" ? (
                    <p className="mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
                      {pay.m}{" "}
                      <a href="/pakhuis" className="font-bold underline">
                        Isi Pundi
                      </a>
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
                <div
                  key={it.id}
                  className="flex justify-between py-[6px] text-sm"
                >
                  <span>
                    {it.name}
                    {it.qty > 1 ? ` ×${it.qty}` : ""}
                  </span>
                  <span>{formatKeping(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between py-[6px] text-sm">
                <span>Bea + ongkir</span>
                <span>{formatKeping(BEA + ONGKIR)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-kongsi-ink pt-3 font-fraunces text-xl font-black text-kongsi-indigo">
                <span>Total</span>
                <span>{formatKeping(total)}</span>
              </div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">
                Metode: Pundi (Keping) / DOKU
              </div>
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
