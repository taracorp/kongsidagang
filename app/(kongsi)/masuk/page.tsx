import { redirect } from "next/navigation";
import { AuthForm } from "@/components/kongsi/AuthForm";
import { createClient } from "@/lib/supabase/server";

export default async function MasukPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/pakhuis");

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Gerbang Kongsi
          </div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">
            Masuk ke lojimu
          </h2>
        </div>
        <AuthForm redirectTo="/pakhuis" />
      </div>
    </section>
  );
}
