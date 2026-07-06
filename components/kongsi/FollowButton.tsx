"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton, KongsiLinkButton } from "./KongsiButton";

export function FollowButton({
  merchantId,
  loggedIn,
  initialFollowing,
}: {
  merchantId: string;
  loggedIn: boolean;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return (
      <KongsiLinkButton href="/masuk" variant="gold" block>
        Ikuti Loji
      </KongsiLinkButton>
    );
  }

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("user_id", user.id)
        .eq("merchant_id", merchantId);
      setFollowing(false);
    } else {
      await supabase
        .from("follows")
        .upsert({ user_id: user.id, merchant_id: merchantId });
      setFollowing(true);
    }
    setBusy(false);
  }

  return (
    <KongsiButton
      variant={following ? "ghost" : "gold"}
      block
      onClick={toggle}
      disabled={busy}
    >
      {following ? "✓ Diikuti" : "Ikuti Loji"}
    </KongsiButton>
  );
}
