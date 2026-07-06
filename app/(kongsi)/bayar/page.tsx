import { BayarClient } from "@/components/kongsi/BayarClient";
import { createClient } from "@/lib/supabase/server";

export default async function BayarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let level = "pelanggan_kecil";
  let stamps = 0;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("level,stamps")
      .eq("id", user.id)
      .maybeSingle();
    level = (data?.level as string) ?? "pelanggan_kecil";
    stamps = (data?.stamps as number) ?? 0;
  }

  return <BayarClient loggedIn={Boolean(user)} level={level} stamps={stamps} />;
}
