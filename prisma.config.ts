import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Dev memakai .env.local (seperti Next.js); produksi memakai .env.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
