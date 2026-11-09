import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";

// Suara Bang Kongsi via ElevenLabs. Dipanggil dari server saat pengurus menyetujui/menyunting lelang
// (sekali per lelang, bukan tiap penonton) → hemat kuota. Best-effort: bila gagal/ tak ada kunci,
// mengembalikan null dan UI jatuh ke Web Speech API gratis di browser.

const API = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL = "eleven_multilingual_v2"; // mendukung Bahasa Indonesia

/** Buat berkas suara dari teks, simpan di uploads/lelang/suara/<rel>.mp3, kembalikan URL /uploads/... */
export async function buatSuara(teks: string, relTanpaEkstensi: string): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  const bersih = teks.trim().slice(0, 800);
  if (!key || !voice || bersih.length < 2) return null;

  try {
    const res = await fetch(`${API}/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: bersih,
        model_id: MODEL,
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
      }),
    });
    if (!res.ok) {
      console.error("ElevenLabs gagal:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const rel = path.posix.join("lelang", "suara", `${relTanpaEkstensi.replace(/[^\w-]/g, "")}.mp3`);
    const abs = path.join(UPLOAD_DIR, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    return `/uploads/${rel}`;
  } catch (e) {
    console.error("ElevenLabs error:", e);
    return null;
  }
}
