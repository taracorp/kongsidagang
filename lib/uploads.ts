import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Pengganti Supabase Storage. File disimpan di UPLOAD_DIR (VPS: /var/www/kongsidagang-uploads)
// dan disajikan oleh app/uploads/[...path]/route.ts.

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./.uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function saveUpload(bucket: "barter", ownerId: string, file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error("Foto harus JPG, PNG, WEBP, atau GIF.");
  if (file.size > MAX_BYTES) throw new Error("Foto maksimal 5 MB.");
  const safeOwner = ownerId.replace(/[^\w-]/g, "");
  const rel = path.posix.join(bucket, safeOwner, `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`);
  const abs = path.join(UPLOAD_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return `/uploads/${rel}`;
}

export const CONTENT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(EXT).map(([mime, ext]) => [ext, mime]),
);
