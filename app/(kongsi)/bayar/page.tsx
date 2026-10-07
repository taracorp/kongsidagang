import { BayarClient } from "@/components/kongsi/BayarClient";
import { isiPundiTersedia } from "@/lib/domain/pundi";
import { sudahPkp } from "@/lib/domain/belanja";
import { getSessionUser } from "@/lib/auth";

export default async function BayarPage() {
  const user = await getSessionUser();
  return <BayarClient loggedIn={Boolean(user)} pkp={sudahPkp()} tersedia={isiPundiTersedia() !== null} />;
}
