"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MyItem = { id: string; title: string };

export function AjukanTukar({
  targetId,
  myItems,
  loggedIn,
}: {
  targetId: string;
  myItems: MyItem[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <a
        href="/masuk"
        className="mt-2 block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-2 py-[6px] text-center text-[12px] font-bold"
      >
        Masuk untuk tukar
      </a>
    );
  }

  if (myItems.length === 0) {
    return (
      <a
        href="/tukar/tawarkan"
        className="mt-2 block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-[6px] text-center text-[12px] font-bold"
      >
        Unggah barang dulu
      </a>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const myItem = String(f.get("myItem") ?? "");
    const topup = Number(String(f.get("topup") ?? "").replace(/\D/g, "")) || 0;
    const supabase = createClient();
    const { error } = await supabase.from("barter_deals").insert({
      item_a: myItem,
      item_b: targetId,
      topup_keping: topup,
      status: "proposed",
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-2 py-[6px] text-[12px] font-bold hover:bg-kongsi-beeswax-dark"
      >
        {open ? "Batal" : "Ajukan Tukar"}
      </button>
      {open ? (
        <form
          onSubmit={onSubmit}
          className="mt-2 rounded-[3px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-2"
        >
          <select
            name="myItem"
            className="mb-2 w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]"
          >
            {myItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.title}
              </option>
            ))}
          </select>
          <input
            name="topup"
            inputMode="numeric"
            placeholder="+ keping (opsional)"
            className="mb-2 w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-2 py-[6px] text-[12px] font-bold text-kongsi-parchment"
          >
            {busy ? "Mengirim…" : "Kirim tawaran"}
          </button>
          {msg ? (
            <p className="mt-1 text-[11px] text-kongsi-bad">{msg}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function TutupBarang({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("barter_items").update({ status: "ditutup" }).eq("id", id);
    setBusy(false);
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-2 w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-[6px] text-[12px] font-bold text-kongsi-bad"
    >
      Tutup
    </button>
  );
}

export function DealActions({
  id,
  status,
  iAmRecipient,
  ratedByMe,
}: {
  id: string;
  status: string;
  iAmRecipient: boolean;
  ratedByMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rating, setRating] = useState(0);

  async function setStatus(next: string) {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("barter_deals")
      .update({ status: next })
      .eq("id", id);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.refresh();
  }

  async function submitRating(stars: number) {
    setBusy(true);
    setMsg(null);
    setRating(stars);
    const supabase = createClient();
    const { error } = await supabase.rpc("rate_deal", {
      p_deal: id,
      p_stars: stars,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.refresh();
  }

  const btn =
    "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-1 text-[12px] font-bold disabled:opacity-60";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "proposed" && iAmRecipient ? (
          <>
            <button type="button" disabled={busy} onClick={() => setStatus("agreed")} className={cn(btn, "bg-kongsi-sage")}>
              Terima
            </button>
            <button type="button" disabled={busy} onClick={() => setStatus("ditolak")} className={cn(btn, "bg-kongsi-parchment-3 text-kongsi-bad")}>
              Tolak
            </button>
          </>
        ) : null}
        {status === "agreed" ? (
          <button type="button" disabled={busy} onClick={() => setStatus("done")} className={cn(btn, "bg-kongsi-beeswax")}>
            Tandai selesai
          </button>
        ) : null}
        {status === "agreed" || status === "done" ? (
          <button type="button" disabled={busy} onClick={() => setStatus("disputed")} className={cn(btn, "bg-kongsi-parchment-3 text-kongsi-bad")}>
            Ajukan Sengketa
          </button>
        ) : null}
        {status === "disputed" ? (
          <span className="text-[12px] font-bold text-kongsi-bad">
            ⚖️ Menunggu Syahbandar
          </span>
        ) : null}
      </div>

      {status === "done" ? (
        ratedByMe ? (
          <div className="text-[12px] font-bold text-kongsi-ok">✓ Sudah dinilai</div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-kongsi-ink-soft">Beri nilai:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => submitRating(s)}
                className="cursor-pointer text-[16px] leading-none text-kongsi-beeswax-dark disabled:opacity-60"
                aria-label={`${s} bintang`}
              >
                {s <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        )
      ) : null}

      {msg ? <span className="text-[11px] text-kongsi-bad">{msg}</span> : null}
    </div>
  );
}
