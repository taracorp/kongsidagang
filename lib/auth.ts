import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 6 },
  socialProviders: google,
  databaseHooks: {
    user: {
      create: {
        // Pengganti trigger handle_new_user: siapkan profil + Pundi kosong.
        after: async (user) => {
          await prisma.profile.upsert({
            where: { id: user.id },
            create: { id: user.id, full_name: user.name ?? "" },
            update: {},
          });
          await prisma.wallet.upsert({
            where: { user_id: user.id },
            create: { user_id: user.id, balance: 0 },
            update: {},
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type SessionUser = { id: string; email: string; name: string };

/** User yang sedang login (atau null). Di-cache per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/** Wajib login — dipakai di server actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Silakan masuk dulu.");
  return user;
}
