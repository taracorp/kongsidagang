"use client";

import { useState } from "react";
import { ikutiLoji } from "@/app/actions/loji";
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
        Ikuti Lapak
      </KongsiLinkButton>
    );
  }

  async function toggle() {
    setBusy(true);
    const { error } = await ikutiLoji(merchantId, !following);
    if (!error) setFollowing(!following);
    setBusy(false);
  }

  return (
    <KongsiButton
      variant={following ? "ghost" : "gold"}
      block
      onClick={toggle}
      disabled={busy}
    >
      {following ? "✓ Diikuti" : "Ikuti Lapak"}
    </KongsiButton>
  );
}
