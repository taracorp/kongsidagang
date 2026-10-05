import { advanceAuctions } from "@/lib/domain/lelang";

export const dynamic = "force-dynamic";

/** Dipanggil crontab VPS tiap menit (pengganti pg_cron 'advance-auctions'). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const advanced = await advanceAuctions();
  return Response.json({ advanced });
}
