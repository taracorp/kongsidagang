import { bus, LELANG_EVENT } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** SSE: penonton /lelang menerima sinyal "update" (pengganti Supabase Realtime Broadcast). */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(enc.encode(`event: update\ndata: ${JSON.stringify(data)}\n\n`));
      const ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 25_000);
      bus.on(LELANG_EVENT, send);
      cleanup = () => {
        clearInterval(ping);
        bus.off(LELANG_EVENT, send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
