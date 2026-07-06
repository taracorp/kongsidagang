"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton } from "./KongsiButton";
import { kategoriDagangan } from "@/lib/dummy";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function SaudagarForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "loading" });
    const form = new FormData(e.currentTarget);

    const payload = {
      loji_name: String(form.get("loji_name") ?? "").trim(),
      category: String(form.get("category") ?? ""),
      owner_name: String(form.get("owner_name") ?? "").trim(),
      whatsapp: String(form.get("whatsapp") ?? "").trim(),
      join_flash_sale: form.get("join_flash_sale") === "ya",
    };

    if (!payload.loji_name || !payload.owner_name || !payload.whatsapp) {
      setState({ kind: "error", message: "Lengkapi nama loji, saudagar, dan WhatsApp." });
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("merchant_applications")
      .insert({ ...payload, applicant_id: user?.id ?? null });

    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }
    setState({ kind: "ok" });
  }

  if (state.kind === "ok") {
    return (
      <div className="rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment-3 p-6 text-center shadow-hard">
        <div className="font-fraunces text-xl font-black text-kongsi-indigo">
          Pengajuan terkirim 🎉
        </div>
        <p className="mt-2 text-sm text-kongsi-ink-soft">
          Tim Kongsi meninjau 1×24 jam untuk memberi cap segel. Kami hubungi via
          WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment p-6 shadow-hard"
    >
      <h3 className="mb-[14px] font-fraunces text-[19px] font-black text-kongsi-indigo">
        Daftarkan lojimu
      </h3>

      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="loji_name">
          Nama loji
        </label>
        <input
          id="loji_name"
          name="loji_name"
          className={fieldInput}
          placeholder="cth. Loji Sari Ayu"
        />
      </div>

      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="category">
          Jenis dagangan
        </label>
        <select id="category" name="category" className={fieldInput} defaultValue={kategoriDagangan[0]}>
          {kategoriDagangan.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="owner_name">
          Nama saudagar (penanggung jawab)
        </label>
        <input
          id="owner_name"
          name="owner_name"
          className={fieldInput}
          placeholder="Nama lengkap"
        />
      </div>

      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="whatsapp">
          No. WhatsApp
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          inputMode="numeric"
          className={fieldInput}
          placeholder="08xx"
        />
      </div>

      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="join_flash_sale">
          Mau ikut Obral Kilat pertama?
        </label>
        <select id="join_flash_sale" name="join_flash_sale" className={fieldInput}>
          <option value="ya">Ya, sekalian flash sale</option>
          <option value="tidak">Belum, buka lapak biasa dulu</option>
        </select>
      </div>

      {state.kind === "error" ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {state.message}
        </p>
      ) : null}

      <KongsiButton type="submit" variant="primary" block disabled={state.kind === "loading"}>
        {state.kind === "loading" ? "Mengirim…" : "Ajukan Jadi Saudagar"}
      </KongsiButton>
      <p className="mt-[10px] text-center text-[12px] text-kongsi-ink-soft">
        Ditinjau tim Kongsi 1×24 jam untuk dapat cap segel.
      </p>
    </form>
  );
}
