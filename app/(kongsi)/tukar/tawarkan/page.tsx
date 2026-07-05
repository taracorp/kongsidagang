import Link from "next/link";
import { redirect } from "next/navigation";
import { TawarkanForm } from "@/components/kongsi/TawarkanForm";
import { createClient } from "@/lib/supabase/server";

export default async function TawarkanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk");

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Tukar Guling
          </div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">
            Tawarkan barangmu
          </h2>
        </div>
        <TawarkanForm userId={user.id} />
        <p className="mt-4 text-center text-[12px] text-kongsi-ink-soft">
          <Link href="/tukar" className="font-bold text-kongsi-grenadine">
            ← Kembali ke Tukar Guling
          </Link>
        </p>
      </div>
    </section>
  );
}
