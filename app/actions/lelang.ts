"use server";

import { prisma } from "@/lib/db";
import { setAuctionStatus } from "@/lib/domain/lelang";
import { run, requireUser, requireAdminUp } from "./_util";

const OPEN = ["kumpul", "tebak"];

async function ensureParticipant(auctionId: string, userId: string) {
  const a = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { status: true },
  });
  if (!a) throw new Error("Lelang tidak ditemukan.");
  if (!OPEN.includes(a.status)) throw new Error("Lelang sedang tidak menerima peserta.");
  // Vendu cukup login (sudah dijamin requireUser).
  await prisma.auctionParticipant.upsert({
    where: { auction_id_user_id: { auction_id: auctionId, user_id: userId } },
    create: { auction_id: auctionId, user_id: userId },
    update: {},
  });
}

export async function ikutLelang(auctionId: string) {
  return run(async () => {
    const user = await requireUser();
    await ensureParticipant(auctionId, user.id);
  });
}

export async function tebakLelang(auctionId: string, guess: number) {
  return run(async () => {
    const user = await requireUser();
    if (!Number.isInteger(guess) || guess <= 0) throw new Error("Isi tebakan harga.");
    await ensureParticipant(auctionId, user.id);
    await prisma.auctionGuess.create({
      data: { auction_id: auctionId, user_id: user.id, round: 1, guess },
    });
  });
}

export async function ubahStatusLelang(auctionId: string, status: string) {
  return run(async () => {
    await requireAdminUp();
    await setAuctionStatus(auctionId, status);
  });
}
