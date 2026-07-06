import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffSession } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, role, name } = await getStaffSession();
  if (!userId) redirect("/masuk");

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kongsi-parchment-3 px-6 text-center">
        <div>
          <div className="font-fraunces text-2xl font-black text-kongsi-grenadine">
            🚫 Bukan pengurus
          </div>
          <p className="mt-2 text-kongsi-ink-soft">
            Akunmu tidak punya peran di Kantor Kongsi.
          </p>
          <Link href="/" className="mt-4 inline-block font-bold text-kongsi-grenadine">
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell role={role} name={name}>
      {children}
    </AdminShell>
  );
}
