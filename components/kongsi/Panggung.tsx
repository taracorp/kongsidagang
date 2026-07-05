"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const confettiColors = ["#d0451f", "#e7a24a", "#a9c6ae", "#16495d", "#c9852f"];

function Confetti() {
  const pieces = Array.from({ length: 16 });
  return (
    <>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 6.2 + 4) % 96}%`,
            backgroundColor: confettiColors[i % confettiColors.length],
            animationDelay: `${(i % 6) * 0.22}s`,
          }}
        />
      ))}
    </>
  );
}

export function Panggung({
  open,
  celebrate = false,
  children,
}: {
  open: boolean;
  celebrate?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="stage mt-6">
      <div className="stage-spotlight" />
      <div className="stage-floor" />
      <div className="stage-content">{children}</div>

      {celebrate && open ? <Confetti /> : null}

      <div className={cn("curtain curtain-left", open && "curtain-open")} />
      <div className={cn("curtain curtain-right", open && "curtain-open")} />
      <div className="valance" />
      <div className="proscenium" />
    </div>
  );
}
