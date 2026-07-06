"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pill } from "./Pill";
import type { AdminApplication } from "@/lib/queries";

const statusPill: Record<string, "gold" | "sage" | "indigo"> = {
  pending: "gold",
  approved: "sage",
  rejected: "indigo",
};

export function ApplicationsAdmin({ items }: { items: AdminApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const supabase = createClient();
    if (status === "approved") {
      await supabase.rpc("approve_merchant_application", { app_id: id });
    } else {
      await supabase
        .from("merchant_applications")
        .update({ status })
        .eq("id", id);
    }
    setBusy(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
        Belum ada pengajuan Saudagar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment text-xs">
        <thead>
          <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
            <th className="p-[10px_12px]">Loji</th>
            <th className="p-[10px_12px]">Kategori</th>
            <th className="p-[10px_12px]">Saudagar</th>
            <th className="p-[10px_12px]">WhatsApp</th>
            <th className="p-[10px_12px]">Status</th>
            <th className="p-[10px_12px]">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold">
                {a.loji_name}
              </td>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                {a.category}
              </td>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                {a.owner_name}
              </td>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                {a.whatsapp}
              </td>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                <Pill variant={statusPill[a.status] ?? "indigo"}>{a.status}</Pill>
              </td>
              <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                {a.status === "pending" ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => setStatus(a.id, "approved")}
                      className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-sage px-2 py-1 font-bold disabled:opacity-60"
                    >
                      Terima (segel)
                    </button>
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => setStatus(a.id, "rejected")}
                      className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-1 font-bold disabled:opacity-60"
                    >
                      Tolak
                    </button>
                  </span>
                ) : (
                  <span className="text-kongsi-ink-soft">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
