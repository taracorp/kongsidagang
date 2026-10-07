import { svgCode128 } from "@/lib/barcode/code128";

// Label pengiriman sesuai syarat KiriminAja (docs: important-notes/shipping-label):
// logo/label kurir · jenis layanan · barcode AWB Code128A + teks AWB · shipping type (COD/Non-COD) · sorting code ·
// pengirim & penerima (nama, HP, alamat lengkap, kode pos) · berat (gram) · jumlah item · asuransi (bila dipakai) ·
// kota asal & tujuan · info barang (nama, qty, harga) · order ref (Order ID platform, barcode opsional).
// Hitam-putih agar tajam saat dicetak (ukuran A6 100×150 mm).

export type PihakLabel = { name: string; phone: string; address: string; area?: string; zipcode: string; city: string };
export type DataLabel = {
  order_id: string;
  awb: string | null;
  sorting_code: string | null;
  courier: string;
  service_name: string;
  service_type: string;
  cod: number; // 0 = Non-COD
  insurance: number; // 0 = tanpa asuransi
  item_value: number;
  weight_g: number;
  qty: number;
  items: { name: string; qty: number; price: number }[];
  pengirim: PihakLabel;
  penerima: PihakLabel;
  dibuat: Date;
  catatan?: string;
};

const NAMA_KURIR: Record<string, string> = {
  jne: "JNE",
  jnt: "J&T EXPRESS",
  jntcargo: "J&T CARGO",
  sicepat: "SiCepat",
  spx: "SPX EXPRESS",
  anteraja: "AnterAja",
  ninja: "NINJA XPRESS",
  lion: "LION PARCEL",
  idx: "ID EXPRESS",
  pos: "POS INDONESIA",
  tiki: "TIKI",
  sap: "SAP EXPRESS",
  rpx: "RPX",
};

const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function Pihak({ judul, p }: { judul: string; p: PihakLabel }) {
  return (
    <div className="border-black p-[6px]">
      <div className="text-[9px] font-bold uppercase tracking-[1px]">{judul}</div>
      <div className="text-[12px] font-bold leading-tight">{p.name}</div>
      <div className="text-[10px]">{p.phone}</div>
      <div className="text-[10px] leading-snug">
        {p.address}
        {p.area ? `, ${p.area}` : ""}
      </div>
      <div className="text-[10px] font-bold">Kode pos {p.zipcode}</div>
    </div>
  );
}

export function LabelPengiriman({ d }: { d: DataLabel }) {
  const kurir = NAMA_KURIR[d.courier.toLowerCase()] ?? d.courier.toUpperCase();
  return (
    <div className="label-a6 mx-auto w-[100mm] border-2 border-black bg-white font-work text-black">
      {/* Kepala: label kurir + layanan */}
      <div className="flex items-stretch border-b-2 border-black">
        <div className="flex flex-1 items-center justify-center border-r-2 border-black px-2 py-[6px]">
          <span className="font-fraunces text-[20px] font-black tracking-tight">{kurir}</span>
        </div>
        <div className="flex w-[34mm] flex-col items-center justify-center px-1 py-[4px] text-center">
          <span className="text-[8px] font-bold uppercase">Layanan</span>
          <span className="text-[16px] font-black leading-none">{d.service_type}</span>
          <span className="text-[8px] leading-tight">{d.service_name}</span>
        </div>
      </div>

      {/* AWB */}
      <div className="border-b-2 border-black px-2 py-[6px] text-center">
        {d.awb ? (
          <>
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: svgCode128(d.awb, { modul: 1.6, tinggi: 54 }) }} />
            <div className="mt-[2px] text-[13px] font-black tracking-[2px]">AWB: {d.awb}</div>
          </>
        ) : (
          <div className="py-4 text-[12px] font-bold">AWB belum terbit — label dicetak setelah AWB tersedia</div>
        )}
      </div>

      {/* Shipping type + sorting code */}
      <div className="flex border-b-2 border-black">
        <div className="flex-1 border-r-2 border-black px-2 py-[4px]">
          <div className="text-[8px] font-bold uppercase">Shipping type</div>
          <div className="text-[15px] font-black">{d.cod > 0 ? `COD: ${rp(d.cod)}` : "NON-COD"}</div>
        </div>
        <div className="flex-1 px-2 py-[4px]">
          <div className="text-[8px] font-bold uppercase">Sorting code</div>
          <div className="text-[15px] font-black">{d.sorting_code ?? "-"}</div>
        </div>
      </div>

      {/* Asal → tujuan */}
      <div className="flex border-b-2 border-black text-center">
        <div className="flex-1 border-r-2 border-black px-1 py-[3px]">
          <div className="text-[8px] font-bold uppercase">Kota asal</div>
          <div className="text-[12px] font-black">{d.pengirim.city}</div>
        </div>
        <div className="flex-1 px-1 py-[3px]">
          <div className="text-[8px] font-bold uppercase">Kota tujuan</div>
          <div className="text-[12px] font-black">{d.penerima.city}</div>
        </div>
      </div>

      {/* Pengirim & penerima */}
      <div className="grid grid-cols-2 border-b-2 border-black">
        <div className="border-r-2 border-black">
          <Pihak judul="Pengirim" p={d.pengirim} />
        </div>
        <Pihak judul="Penerima" p={d.penerima} />
      </div>

      {/* Berat, qty, asuransi */}
      <div className="grid grid-cols-3 border-b-2 border-black text-center">
        <div className="border-r-2 border-black py-[3px]">
          <div className="text-[8px] font-bold uppercase">Berat</div>
          <div className="text-[12px] font-black">{d.weight_g.toLocaleString("id-ID")} gram</div>
        </div>
        <div className="border-r-2 border-black py-[3px]">
          <div className="text-[8px] font-bold uppercase">Jumlah item</div>
          <div className="text-[12px] font-black">{d.qty}</div>
        </div>
        <div className="py-[3px]">
          <div className="text-[8px] font-bold uppercase">Asuransi</div>
          <div className="text-[11px] font-black">{d.insurance > 0 ? `Ya · ${rp(d.insurance)}` : "Tidak"}</div>
        </div>
      </div>

      {/* Barang */}
      <div className="border-b-2 border-black px-2 py-[4px]">
        <div className="text-[8px] font-bold uppercase">Isi paket</div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-left">
              <th className="font-bold">Barang</th>
              <th className="w-[10mm] text-right font-bold">Qty</th>
              <th className="w-[22mm] text-right font-bold">Harga</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td className="text-right">{it.qty}</td>
                <td className="text-right">{rp(it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right text-[10px] font-bold">Nilai barang {rp(d.item_value)}</div>
      </div>

      {/* Order ref */}
      <div className="flex items-center justify-between gap-2 px-2 py-[4px]">
        <div>
          <div className="text-[8px] font-bold uppercase">Order ref (Kongsi Dagang · KiriminAja)</div>
          <div className="text-[12px] font-black tracking-[1px]">{d.order_id}</div>
          <div className="text-[8px]">
            {d.dibuat.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            {d.catatan ? ` · ${d.catatan}` : ""}
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: svgCode128(d.order_id, { modul: 1, tinggi: 30 }) }} />
      </div>
    </div>
  );
}
