import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, CONTENT_TYPE } from "@/lib/uploads";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const parts = (await params).path;
  const abs = path.resolve(UPLOAD_DIR, ...parts);
  // Tolak path traversal (../) keluar dari UPLOAD_DIR.
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  const type = CONTENT_TYPE[path.extname(abs).slice(1).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(abs);
    return new Response(buf, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
