import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Satu PrismaClient per proses (hindari banjir koneksi saat hot-reload dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  // Transaksi uang (batal tukar, terbit voucher) bisa berisi puluhan query; batas bawaan 5 detik terlalu ketat
  // bila DB sedang sibuk → transaksi gagal di tengah dan user harus mengulang.
  return new PrismaClient({ adapter, transactionOptions: { timeout: 15_000, maxWait: 5_000 } });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
