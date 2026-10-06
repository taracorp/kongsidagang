import { redirect } from "next/navigation";
import { AuthForm } from "@/components/kongsi/AuthForm";
import { getSessionUser } from "@/lib/auth";

export default async function MasukPage() {
  const user = await getSessionUser();
  if (user) redirect("/pakhuis");

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Gerbang Kongsi
          </div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">
            Masuk ke Kongsi
          </h2>
        </div>
        <AuthForm redirectTo="/pakhuis" />
      </div>
    </section>
  );
}
