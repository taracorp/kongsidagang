// Seed awal Kongsi Dagang. Jalankan: npm run seed (dipanggil juga oleh `prisma migrate reset`).
// Tanpa data contoh: hanya akun awal + data tenant asli (scripts/data/tenant-asli.ts).
// Akun dari env: SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (jadi Ketua Kongsi),
// opsional SEED_TESTER_EMAIL + SEED_TESTER_PASSWORD (akun uji dev dengan saldo).
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type UserLevel } from "../lib/generated/prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Buat akun email+sandi bila belum ada (format Better Auth: user + account "credential"). */
async function ensureUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  return id;
}

async function provision(
  userId: string,
  name: string,
  opts: { level?: UserLevel; stamps?: number; balance?: number; total_spend?: number } = {},
) {
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, full_name: name, level: opts.level, stamps: opts.stamps, total_spend: opts.total_spend },
    update: { level: opts.level, stamps: opts.stamps, total_spend: opts.total_spend },
  });
  await prisma.wallet.upsert({
    where: { user_id: userId },
    create: { user_id: userId, balance: opts.balance ?? 0 },
    update: opts.balance != null ? { balance: opts.balance } : {},
  });
}

async function main() {
  console.log("Akun awal…");
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_TESTER_EMAIL, SEED_TESTER_PASSWORD } = process.env;
  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    const adminId = await ensureUser(SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, "Ketua Kongsi");
    await provision(adminId, "Ketua Kongsi");
    await prisma.staffRole.upsert({
      where: { user_id: adminId },
      create: { user_id: adminId, role: "ketua" },
      update: { role: "ketua" },
    });
    console.log(`  Ketua: ${SEED_ADMIN_EMAIL}`);
  } else {
    console.log("  (lewati admin — SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD belum diisi)");
  }

  if (SEED_TESTER_EMAIL && SEED_TESTER_PASSWORD) {
    const testerId = await ensureUser(SEED_TESTER_EMAIL, SEED_TESTER_PASSWORD, "Penguji");
    await provision(testerId, "Penguji", { level: "tuan_kecil", stamps: 7, balance: 1_250_000, total_spend: 1_000_000 });
    console.log(`  Penguji (dev): ${SEED_TESTER_EMAIL}`);
  }
  await prisma.$disconnect();

  console.log("Tenant asli & artikel…");
  execFileSync("npx", ["tsx", "--conditions=react-server", "scripts/data/tenant-asli.ts"], { stdio: "inherit" });

  console.log("\n✓ Seed selesai.");
}

main().catch(async (e) => {
  console.error("\n✗ Seed gagal:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
