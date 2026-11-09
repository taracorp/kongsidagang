import { requireUser } from "@/lib/auth";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { saveUpload, saveVideoTvc } from "@/lib/uploads";

// Unggah materi slide lelang (gambar clue / video TVC). Dipakai pemilik lapak atau pengurus.
// Route Handler (bukan Server Action) supaya bisa terima video besar (batas body action 6 MB).
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Masuk dulu." }, { status: 401 });
  }
  const staff = await getStaffSession();
  const pengurus = isAdminUp(staff.role);
  // Non-pengurus harus pemilik minimal satu lapak.
  if (!pengurus) {
    const punya = await prisma.merchant.count({ where: { owner_id: user.id } });
    if (punya === 0) return Response.json({ error: "Hanya pemilik lapak atau pengurus." }, { status: 403 });
  }

  const form = await req.formData();
  const jenis = String(form.get("jenis") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Berkas tidak ditemukan." }, { status: 400 });

  try {
    const url =
      jenis === "video"
        ? await saveVideoTvc(user.id, file)
        : await saveUpload("lelang", user.id, file);
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Gagal mengunggah." }, { status: 400 });
  }
}
