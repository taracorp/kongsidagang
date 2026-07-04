"use client";

import { useState } from "react";
import { cn, formatKeping } from "@/lib/utils";
import { Pill } from "./Pill";
import { KongsiLinkButton } from "./KongsiButton";
import type { LelangAktif } from "@/lib/dummy";

export function LiveAuction({ data }: { data: LelangAktif }) {
  const [live, setLive] = useState(true);

  return (
    <div>
      <div className="mb-[14px] flex justify-center gap-[6px]">
        {(
          [
            ["Ada lelang", true],
            ["Belum ada (slot iklan)", false],
          ] as const
        ).map(([label, val]) => (
          <button
            key={label}
            type="button"
            onClick={() => setLive(val)}
            className={cn(
              "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-[11px] py-[5px] text-[12px] font-bold",
              live === val
                ? "bg-kongsi-indigo text-kongsi-parchment"
                : "bg-kongsi-parchment text-kongsi-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {live ? (
        <div className="grid grid-cols-1 overflow-hidden rounded-[6px] border-2 border-kongsi-ink shadow-hard-lg md:grid-cols-[1.1fr_1fr]">
          <div className="relative flex flex-col justify-center bg-gradient-to-br from-kongsi-indigo to-kongsi-indigo-dark p-[26px] text-kongsi-parchment">
            <Pill variant="live" className="absolute left-[14px] top-[14px]">
              ◉ Lelang Reguler · terbuka
            </Pill>
            <div className="mt-[14px] font-fraunces text-2xl font-black">
              {data.kategori}
            </div>
            <div className="mt-[2px] text-sm opacity-85">
              Nama loji:{" "}
              <b className="font-fraunces tracking-[3px] text-kongsi-beeswax">
                {data.namaLoji}
              </b>{" "}
              · disamarkan sampai menang
            </div>
          </div>
          <div className="flex flex-col justify-center bg-kongsi-parchment p-6 text-center">
            <div className="font-fraunces text-[44px] font-black leading-none text-kongsi-grenadine">
              {data.mulaiDalam}
              <small className="block font-work text-[10px] font-bold uppercase tracking-[2px] text-kongsi-olive">
                mulai dalam
              </small>
            </div>
            <div className="my-3 text-sm text-kongsi-ink-soft">
              Harga normal{" "}
              <b className="font-fraunces text-lg text-kongsi-grenadine line-through">
                {formatKeping(data.hargaNormal)}
              </b>
            </div>
            <div className="font-fraunces text-[22px] font-black text-kongsi-indigo">
              {data.peserta}
              <small className="block font-work text-xs font-semibold text-kongsi-ink-soft">
                dari {data.kapasitas} peserta
              </small>
            </div>
            <KongsiLinkButton href="/lelang" variant="primary" block className="mt-3">
              Ikut Lelang
            </KongsiLinkButton>
          </div>
        </div>
      ) : (
        <div className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-6 py-10 text-center text-kongsi-ink-soft">
          <Pill variant="gold">Slot Iklan / Video</Pill>
          <h3 className="mt-[10px] font-fraunces text-xl font-black text-kongsi-indigo">
            Belum ada lelang berjalan
          </h3>
          <p className="mt-[6px] text-sm">
            Saat balai kosong, ruang ini diisi iklan saudagar atau video promosi
            Pekan Raya.
          </p>
        </div>
      )}

      <p className="mt-[10px] text-[12px] text-kongsi-ink-soft">
        ◆ <b>Lelang Reguler</b> terbuka untuk siapa saja (daftar hanya saat mau
        menebus). <b>Vendu</b> (lelang khusus) hanya untuk yang sudah masuk loji.
      </p>
    </div>
  );
}
