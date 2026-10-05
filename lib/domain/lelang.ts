import "server-only";
import { prisma } from "@/lib/db";
import { broadcastLelang } from "@/lib/realtime";

// Port dari plpgsql decide_auction / advance_auctions (migrasi Supabase 0010 & 0013).

export const AUCTION_STATUSES = [
  "kumpul",
  "tebak",
  "jeda",
  "final",
  "pemenang",
  "bayar",
  "selesai",
] as const;

const NEXT_STATUS: Record<string, string> = {
  kumpul: "tebak",
  tebak: "jeda",
  jeda: "final",
  final: "pemenang",
  pemenang: "bayar",
  bayar: "selesai",
  selesai: "kumpul",
};

const PHASE_MS = 60_000;

/** Pemenang = tebakan terbaru tiap user yang paling dekat ke set_price; terbitkan Surat Jalan. */
export async function decideAuction(auctionId: string) {
  const a = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { set_price: true, clue_category: true },
  });
  if (!a || a.set_price == null) return;
  const sp = a.set_price;

  const guesses = await prisma.auctionGuess.findMany({
    where: { auction_id: auctionId },
    select: { user_id: true, guess: true },
    orderBy: { created_at: "desc" },
  });
  const latest = new Map<string, number>();
  for (const g of guesses) if (!latest.has(g.user_id)) latest.set(g.user_id, g.guess);
  if (!latest.size) return;

  const [winnerId, winGuess] = [...latest.entries()].sort(
    ([, x], [, y]) => Math.abs(x - sp) - Math.abs(y - sp) || x - y,
  )[0];

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: { winner_id: winnerId, winning_guess: winGuess },
    });
    const exists = await tx.voucher.findFirst({
      where: { user_id: winnerId, title: a.clue_category, kind: "lelang" },
      select: { id: true },
    });
    if (!exists) {
      await tx.voucher.create({
        data: {
          user_id: winnerId,
          title: a.clue_category,
          note: "Menang lelang · tebus segera",
          kind: "lelang",
        },
      });
    }
  });
}

/** Efek samping saat lelang memasuki status baru (dipakai cron & admin). */
async function onEnterStatus(auctionId: string, status: string) {
  if (status === "pemenang") {
    await decideAuction(auctionId);
  } else if (status === "kumpul") {
    await prisma.$transaction([
      prisma.auction.update({
        where: { id: auctionId },
        data: { winner_id: null, winning_guess: null },
      }),
      prisma.auctionGuess.deleteMany({ where: { auction_id: auctionId } }),
      prisma.auctionParticipant.deleteMany({ where: { auction_id: auctionId } }),
    ]);
  }
}

/** Majukan fase lelang yang waktunya habis (dipanggil cron tiap menit). */
export async function advanceAuctions(): Promise<number> {
  const due = await prisma.auction.findMany({
    where: { phase_ends_at: { not: null, lt: new Date() } },
    select: { id: true, status: true },
  });
  for (const r of due) {
    const next = NEXT_STATUS[r.status] ?? "kumpul";
    await prisma.auction.update({
      where: { id: r.id },
      data: { status: next, phase_ends_at: new Date(Date.now() + PHASE_MS) },
    });
    await onEnterStatus(r.id, next);
  }
  broadcastLelang();
  return due.length;
}

/** Admin mengubah status manual. */
export async function setAuctionStatus(auctionId: string, status: string) {
  if (!(AUCTION_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Status tidak dikenal.");
  }
  await prisma.auction.update({
    where: { id: auctionId },
    data: { status, phase_ends_at: new Date(Date.now() + PHASE_MS) },
  });
  await onEnterStatus(auctionId, status);
  broadcastLelang();
}
