"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { StaffUser } from "@/lib/queries";

const roleLabel: Record<string, string> = {
  pewarta: "Pewarta",
  admin: "Admin Kongsi",
  ketua: "Ketua Kongsi",
};
const roleColor: Record<string, string> = {
  pewarta: "bg-kongsi-sage",
  admin: "bg-kongsi-beeswax",
  ketua: "bg-kongsi-grenadine text-kongsi-parchment",
};

export function RoleManager({
  users,
  meId,
}: {
  users: StaffUser[];
  meId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const ketuaCount = users.filter((u) => u.role === "ketua").length;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.full_name ?? "").toLowerCase().includes(s),
    );
  }, [q, users]);

  async function setRole(u: StaffUser, next: string) {
    setBusy(u.user_id);
    setMsg(null);
    const supabase = createClient();
    let error;
    if (next === "") {
      ({ error } = await supabase
        .from("staff_roles")
        .delete()
        .eq("user_id", u.user_id));
    } else {
      ({ error } = await supabase
        .from("staff_roles")
        .upsert({ user_id: u.user_id, role: next, granted_by: meId }));
    }
    setBusy(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari email / nama…"
          className="w-full max-w-[320px] rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-2 text-sm outline-none"
        />
        <span className="text-[12px] text-kongsi-ink-soft">
          Ketua: <b className="text-kongsi-grenadine">{ketuaCount}/2</b>
        </span>
      </div>
      {msg ? (
        <p className="rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {msg}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
              <th className="p-[11px_14px]">Nama</th>
              <th className="p-[11px_14px]">Email</th>
              <th className="p-[11px_14px]">Peran</th>
              <th className="p-[11px_14px]">Ubah</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isSelf = u.user_id === meId;
              const isKetuaRow = u.role === "ketua";
              const locked = isSelf || isKetuaRow;
              const ketuaFull = ketuaCount >= 2 && u.role !== "ketua";
              return (
                <tr key={u.user_id} className="even:bg-kongsi-sage/10">
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-semibold">
                    {u.full_name || "—"}
                    {isSelf ? (
                      <span className="ml-1 text-[11px] text-kongsi-olive">(kamu)</span>
                    ) : null}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] text-kongsi-ink-soft">
                    {u.email}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    {u.role ? (
                      <span
                        className={cn(
                          "rounded-full border-[1.5px] border-kongsi-ink px-[9px] py-[2px] text-[11px] font-bold",
                          roleColor[u.role],
                        )}
                      >
                        {roleLabel[u.role]}
                      </span>
                    ) : (
                      <span className="text-[12px] text-kongsi-ink-soft">Pelanggan</span>
                    )}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    <select
                      defaultValue={u.role ?? ""}
                      disabled={locked || busy === u.user_id}
                      onChange={(e) => setRole(u, e.target.value)}
                      className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-xs font-bold disabled:opacity-50"
                    >
                      <option value="">Pelanggan</option>
                      <option value="pewarta">Pewarta</option>
                      <option value="admin">Admin Kongsi</option>
                      <option value="ketua" disabled={ketuaFull}>
                        Ketua Kongsi{ketuaFull ? " (penuh)" : ""}
                      </option>
                    </select>
                    {locked ? (
                      <span className="ml-2 text-[11px] text-kongsi-ink-soft">
                        {isSelf ? "diri sendiri" : "terkunci"}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-kongsi-ink-soft">
        ◆ Ketua lain &amp; dirimu sendiri terkunci. Maksimal 2 Ketua.
      </p>
    </div>
  );
}
