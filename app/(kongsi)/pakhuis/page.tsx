import { redirect } from "next/navigation";
import { CompassRose, WaxSeal } from "@/components/kongsi/icons";
import { Pill } from "@/components/kongsi/Pill";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import { IsiPundiButton, VoucherRedeem } from "@/components/kongsi/PundiActions";
import { getPakhuis } from "@/lib/queries";
import { cn, formatKeping } from "@/lib/utils";
import { levelTangga } from "@/lib/data-e";

const levelOrder = [
  "pelanggan_kecil",
  "pelanggan_besar",
  "tuan_kecil",
  "tuan_besar",
  "juragan",
];

export default async function PakhuisPage() {
  const data = await getPakhuis();
  if (!data) redirect("/masuk");

  const levelIndex = Math.max(0, levelOrder.indexOf(data.level));
  const capTotal = 10;
  const capFilled = Math.min(capTotal, data.stamps);

  const thresholds = [0, 250000, 1000000, 5000000, 20000000];
  const curMin = thresholds[levelIndex] ?? 0;
  const nextMin = thresholds[levelIndex + 1];
  const isMax = levelIndex >= levelOrder.length - 1;
  const levelProgress = isMax
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((data.totalSpend - curMin) / (nextMin - curMin)) * 100,
          ),
        ),
      );
  const nextLevelNote = isMax
    ? "Kamu di puncak — Juragan. Hak penuh: Vendu prioritas & bea gratis."
    : `Rp ${(nextMin - data.totalSpend).toLocaleString("id-ID")} lagi menuju ${levelTangga[levelIndex + 1]} — buka potongan bea & akses Vendu lebih leluasa.`;

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
              Pakhuis-ku
            </div>
            <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
              Halo, {data.name}
            </h2>
          </div>
          <LogoutButton />
        </div>

        {data.isSaudagar ? (
          <a
            href="/lapak"
            className="mb-[22px] flex items-center justify-between rounded-[6px] border-2 border-kongsi-ink bg-kongsi-beeswax px-4 py-3 shadow-hard-sm"
          >
            <span className="font-fraunces font-black text-kongsi-ink">
              🏪 Kelola Lapak-ku
            </span>
            <span className="text-[13px] font-bold text-kongsi-ink">→</span>
          </a>
        ) : null}

        {/* Pundi */}
        <div className="relative mb-[22px] overflow-hidden rounded-[8px] border-2 border-kongsi-ink bg-kongsi-grenadine p-[22px_24px] text-kongsi-parchment shadow-hard">
          <div className="text-[11px] font-bold uppercase tracking-[2px] opacity-85">
            Pundi · Keping
          </div>
          <div className="mt-[3px] font-fraunces text-[38px] font-black leading-none">
            {data.balance.toLocaleString("id-ID")}{" "}
            <small className="text-[15px] opacity-80">
              keping (= {formatKeping(data.balance)})
            </small>
          </div>
          <IsiPundiButton />
          <CompassRose
            size={90}
            className="absolute -bottom-2 -right-2 text-kongsi-parchment opacity-15"
          />
        </div>

        {/* Level */}
        <div className="mb-[22px] rounded-[8px] border-2 border-kongsi-ink bg-kongsi-parchment p-[20px_22px] shadow-hard">
          <div className="mb-[6px] flex items-center gap-3">
            <Pill variant="live">Level</Pill>
            <span className="font-fraunces text-2xl font-black text-kongsi-indigo">
              {levelTangga[levelIndex]}
            </span>
          </div>
          <div className="text-[13px] text-kongsi-ink-soft">{nextLevelNote}</div>
          <div className="my-[10px] h-3 overflow-hidden rounded-full border-2 border-kongsi-ink bg-kongsi-parchment-2">
            <i
              className="block h-full bg-kongsi-beeswax"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-[6px]">
            {levelTangga.map((lv, i) => (
              <span
                key={lv}
                className={cn(
                  "rounded-full border-[1.5px] border-kongsi-ink px-[9px] py-1 text-[11px] font-bold",
                  i < levelIndex && "bg-kongsi-sage text-kongsi-ink",
                  i === levelIndex &&
                    "bg-kongsi-grenadine text-kongsi-parchment",
                  i > levelIndex && "bg-kongsi-parchment-3 text-kongsi-ink-soft",
                )}
              >
                {lv}
              </span>
            ))}
          </div>
          <div className="mt-[14px]">
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">
              Cap terkumpul ({capTotal} = 1 potongan)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: capTotal }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-kongsi-ink text-[15px]",
                    i < capFilled
                      ? "bg-kongsi-beeswax"
                      : "bg-kongsi-parchment-2 opacity-60",
                  )}
                >
                  {i < capFilled ? "✓" : "·"}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Surat Jalan */}
        <h3 className="mb-3 font-fraunces text-xl font-black text-kongsi-indigo">
          Surat Jalan (voucher)
        </h3>
        {data.vouchers.length === 0 ? (
          <p className="mb-4 rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada Surat Jalan. Menang lelang atau tebus neraca untuk
            mendapatkannya.
          </p>
        ) : (
          data.vouchers.map((v) => (
            <div
              key={v.id}
              className="mb-[10px] flex items-center gap-[14px] rounded-[6px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-[14px_16px]"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[6px] border-2 border-kongsi-ink bg-kongsi-beeswax">
                <WaxSeal size={24} />
              </span>
              <div className="flex-1">
                <b className="font-fraunces text-[15px] text-kongsi-indigo">
                  {v.title}
                </b>
                <div className="text-[12px] text-kongsi-ink-soft">{v.note}</div>
              </div>
              {v.status === "aktif" ? (
                <VoucherRedeem id={v.id} />
              ) : (
                <Pill variant="sage">terpakai</Pill>
              )}
            </div>
          ))
        )}

        {/* Riwayat Pundi */}
        <h3 className="mb-3 mt-6 font-fraunces text-xl font-black text-kongsi-indigo">
          Riwayat Pundi
        </h3>
        {data.ledger.length === 0 ? (
          <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada transaksi keping.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment">
            {data.ledger.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b-[1.5px] border-kongsi-ink/10 px-4 py-[10px] text-[13px] last:border-b-0"
              >
                <div>
                  <div className="font-semibold">{t.note ?? t.kind}</div>
                  <div className="text-[11px] text-kongsi-ink-soft">
                    {new Date(t.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-fraunces font-black",
                    t.amount < 0 ? "text-kongsi-bad" : "text-kongsi-ok",
                  )}
                >
                  {t.amount < 0 ? "−" : "+"}
                  {formatKeping(Math.abs(t.amount))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

