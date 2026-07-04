"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

type Tab = "masuk" | "daftar";
type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };

export function AuthForm({ redirectTo = "/pakhuis" }: { redirectTo?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("masuk");
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
      if (!data.session) {
        return setStatus({
          kind: "notice",
          message: "Cek surel untuk konfirmasi akun, lalu masuk.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return setStatus({ kind: "error", message: error.message });
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[390px] overflow-hidden rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
      <div className="flex border-b-2 border-kongsi-ink">
        {(
          [
            ["masuk", "Masuk"],
            ["daftar", "Daftar"],
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
      <form onSubmit={onSubmit} className="p-6">
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
        {status.kind === "notice" ? (
          <p className="mb-3 rounded-[4px] border-2 border-kongsi-olive bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-ink-soft">
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
              ? "Daftar & Masuk"
              : "Masuk Loji"}
        </KongsiButton>
        <p className="mt-3 text-center text-[12px] text-kongsi-ink-soft">
          Keliling &amp; isi keranjang tak perlu akun. Masuk hanya untuk
          menebus, ikut Vendu, &amp; menyimpan Surat Jalan.
        </p>
      </form>
    </div>
  );
}
