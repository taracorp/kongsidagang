"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function onClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-[13px] py-2 text-[13px] font-bold text-kongsi-ink transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
    >
      Keluar
    </button>
  );
}
