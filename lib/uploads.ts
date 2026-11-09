import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Pengganti Supabase Storage. File disimpan di UPLOAD_DIR (VPS: /var/www/kongsidagang-uploads)
// dan disajikan oleh app/uploads/[...path]/route.ts.

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./.uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function saveUpload(
  bucket: "barter" | "sengketa" | "lelang",
  ownerId: string,
  file: File,
): Promise<string> {
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

/**
 * Simpan video TVC lalu kecilkan ke 720×1280 mp4 dengan ffmpeg (720p vertikal, faststart) —
 * setelan sama dengan Ch 8.49. Mengembalikan URL /uploads/lelang/<owner>/<id>.mp4.
 * Butuh ffmpeg di PATH (ada di VPS & dev).
 */
export async function saveVideoTvc(ownerId: string, file: File): Promise<string> {
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
    throw new Error("Video harus MP4, MOV, atau WEBM.");
  }
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video maksimal 100 MB.");
  const safeOwner = ownerId.replace(/[^\w-]/g, "");
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(UPLOAD_DIR, "lelang", safeOwner);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${id}.src`);
  const outRel = path.posix.join("lelang", safeOwner, `${id}.mp4`);
  const out = path.join(UPLOAD_DIR, outRel);
  await writeFile(tmp, Buffer.from(await file.arrayBuffer()));
  try {
    await transcode(tmp, out);
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
  return `/uploads/${outRel}`;
}

function transcode(src: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y", "-hide_banner", "-loglevel", "error", "-i", src,
      "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,fps=25",
      "-c:v", "libx264", "-profile:v", "main", "-preset", "veryfast", "-crf", "23",
      "-maxrate", "1400k", "-bufsize", "2800k",
      "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", out,
    ];
    const ff = spawn("ffmpeg", args);
    let err = "";
    ff.stderr.on("data", (d) => (err += d.toString()));
    ff.on("error", (e) => reject(new Error(`ffmpeg tidak tersedia: ${e.message}`)));
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg gagal (${code}): ${err.slice(0, 300)}`))));
  });
}

export const CONTENT_TYPE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXT).map(([mime, ext]) => [ext, mime])),
  mp4: "video/mp4",
  webm: "video/webm",
};
