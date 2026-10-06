import "server-only";

// Klien KiriminAja Mitra API (express). Docs: github.com/kiriminaja/docs
// Env:
//   KIRIMINAJA_API_KEY   — Bearer token (dashboard → Integrasi). Kosong + KIRIMINAJA_MOCK=true → driver tiruan.
//   KIRIMINAJA_BASE_URL  — default produksi https://client.kiriminaja.com (sandbox: https://tdev.kiriminaja.com)
//   KIRIMINAJA_PIN       — PIN KA Credit; divalidasi sebelum request_pickup agar ongkir dipotong dari KA Credit.
// Ongkir dibayar platform dari KA Credit; ke user ditagih sebagai Keteng (rekber `ongkir`).

export type Wilayah = {
  district_id: number; // kecamatan_id
  subdistrict_id: number; // kelurahan_id
  full_address: string; // "Kelurahan, Kecamatan, Kota, Provinsi, Kodepos"
  zipcode: string;
};

export type Paket = { weight_g: number; length_cm: number; width_cm: number; height_cm: number; item_value: number };

export type Tarif = {
  courier: string;
  service_type: string;
  service_name: string;
  cost: number;
  insurance: number;
  etd: string | null;
  group: string;
};

export type Alamat = {
  name: string;
  phone: string;
  address: string;
  area: string;
  district_id: number;
  subdistrict_id: number;
  zipcode: string;
  lat: number;
  lng: number;
};

export type OrderInput = {
  order_id: string;
  sender: Alamat;
  receiver: Alamat;
  paket: Paket;
  tarif: Tarif;
  item_name: string;
  schedule: string; // "YYYY-MM-DD HH:mm:ss"
};

export type OrderHasil = { pickup_number: string | null; awb: string | null };

export type KurirDriver = {
  nama: "kiriminaja" | "tiruan";
  cariWilayah(q: string): Promise<Wilayah[]>;
  tarif(asal: Wilayah, tujuan: Wilayah, paket: Paket): Promise<Tarif[]>;
  jadwalPickup(): Promise<string>;
  buatOrder(o: OrderInput): Promise<OrderHasil>;
  batalkan(awb: string, alasan: string): Promise<void>;
};

const PHONE_RE = /^(08\d{8,12}|02\d{7,11}|628\d{8,12}|\+628\d{8,12})$/;

/** Normalisasi & validasi nomor HP sesuai aturan KiriminAja. */
export function normalisasiHp(raw: string): string {
  const s = raw.replace(/[\s-]/g, "");
  if (!PHONE_RE.test(s)) throw new Error("Nomor HP tidak valid (pakai 08… atau 628…).");
  return s;
}

/** Kodepos = segmen terakhir full_address bila berupa angka 5 digit. */
export function kodeposDari(full: string): string {
  const last = full.split(",").pop()?.trim() ?? "";
  return /^\d{5}$/.test(last) ? last : "";
}

/** Tarif termurah (ongkir + asuransi). */
export function termurah(list: Tarif[]): Tarif | null {
  return [...list].sort((x, y) => x.cost + x.insurance - (y.cost + y.insurance))[0] ?? null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtJakarta(d: Date) {
  const j = new Date(d.getTime() + 7 * 3600_000); // WIB
  return `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())} ${pad(j.getUTCHours())}:${pad(j.getUTCMinutes())}:00`;
}

// ============================================================
// Driver asli
// ============================================================

class KiriminAjaError extends Error {}

function driverAsli(apiKey: string): KurirDriver {
  const base = (process.env.KIRIMINAJA_BASE_URL || "https://client.kiriminaja.com").replace(/\/$/, "");

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as ({ status?: boolean; text?: string } & T) | null;
    if (!res.ok || !json || json.status === false) {
      throw new KiriminAjaError(`KiriminAja: ${json?.text ?? `HTTP ${res.status}`}`);
    }
    return json;
  }

  return {
    nama: "kiriminaja",

    async cariWilayah(q) {
      const r = await call<{ data: { district_id: number; subdistrict_id: number; full_address: string }[] }>(
        "GET",
        `api/mitra/v6.1/addresses?search=${encodeURIComponent(q)}`,
      );
      return (r.data ?? []).slice(0, 20).map((w) => ({ ...w, zipcode: kodeposDari(w.full_address) }));
    },

    async tarif(asal, tujuan, p) {
      const r = await call<{
        results: { service: string; service_type: string; service_name: string; cost: string; etd: string; group: string; insurance?: number }[];
      }>("POST", "api/mitra/v6.1/shipping_price", {
        origin: asal.district_id,
        subdistrict_origin: asal.subdistrict_id,
        destination: tujuan.district_id,
        subdistrict_destination: tujuan.subdistrict_id,
        weight: p.weight_g,
        length: p.length_cm,
        width: p.width_cm,
        height: p.height_cm,
        item_value: p.item_value,
        insurance: 1,
      });
      return (r.results ?? []).map((x) => ({
        courier: x.service,
        service_type: x.service_type,
        service_name: x.service_name,
        cost: Number(x.cost) || 0,
        insurance: Number(x.insurance) || 0,
        etd: x.etd ?? null,
        group: x.group,
      }));
    },

    async jadwalPickup() {
      const r = await call<{ schedules: { clock: string; expired: number; libur: boolean }[] }>(
        "POST",
        "api/mitra/v2/schedules",
      );
      const now = Date.now() / 1000;
      const s = (r.schedules ?? []).find((x) => !x.libur && x.expired > now);
      if (!s) throw new KiriminAjaError("KiriminAja: belum ada jadwal pickup tersedia.");
      return s.clock;
    },

    async buatOrder(o) {
      if (process.env.KIRIMINAJA_PIN) {
        await call("POST", "api/mitra/v6.2/pin/validate", { pin: process.env.KIRIMINAJA_PIN });
      }
      const r = await call<{ pickup_number?: string; details?: { order_id: string; awb: string | null }[] }>(
        "POST",
        "api/mitra/v6.2/request_pickup",
        {
          address: o.sender.address + ", " + o.sender.area,
          phone: o.sender.phone,
          kecamatan_id: o.sender.district_id,
          kelurahan_id: o.sender.subdistrict_id,
          latitude: o.sender.lat,
          longitude: o.sender.lng,
          platform_name: "kongsidagang",
          name: o.sender.name,
          zipcode: o.sender.zipcode,
          schedule: o.schedule,
          packages: [
            {
              order_id: o.order_id,
              destination_name: o.receiver.name,
              destination_phone: o.receiver.phone,
              destination_address: o.receiver.address + ", " + o.receiver.area,
              destination_kecamatan_id: o.receiver.district_id,
              destination_kelurahan_id: o.receiver.subdistrict_id,
              destination_zipcode: o.receiver.zipcode,
              destination_latitude: o.receiver.lat,
              destination_longitude: o.receiver.lng,
              weight: o.paket.weight_g,
              width: o.paket.width_cm,
              height: o.paket.height_cm,
              length: o.paket.length_cm,
              qty: 1,
              item_value: o.paket.item_value,
              shipping_cost: o.tarif.cost,
              service: o.tarif.courier,
              service_type: o.tarif.service_type,
              insurance_amount: o.tarif.insurance,
              cod: 0,
              package_type_id: 7,
              item_name: o.item_name.slice(0, 100),
              drop: false,
              note: "Tukar Guling Kongsi Dagang",
              items: [
                {
                  name: o.item_name.slice(0, 100),
                  price: o.paket.item_value,
                  weight: o.paket.weight_g,
                  width: o.paket.width_cm,
                  height: o.paket.height_cm,
                  length: o.paket.length_cm,
                  qty: 1,
                },
              ],
            },
          ],
        },
      );
      return { pickup_number: r.pickup_number ?? null, awb: r.details?.[0]?.awb ?? null };
    },

    async batalkan(awb, alasan) {
      await call("POST", "api/mitra/v3/cancel_shipment", { awb, reason: alasan.slice(0, 200).padEnd(5, ".") });
    },
  };
}

// ============================================================
// Driver tiruan (dev/uji tanpa API key)
// ============================================================

const WILAYAH_TIRUAN: Wilayah[] = [
  { district_id: 5788, subdistrict_id: 31554, full_address: "Sariharjo, Ngaglik, Sleman, DI Yogyakarta, 55581", zipcode: "55581" },
  { district_id: 5783, subdistrict_id: 31532, full_address: "Caturtunggal, Depok, Sleman, DI Yogyakarta, 55281", zipcode: "55281" },
  { district_id: 5507, subdistrict_id: 65005, full_address: "Wirobrajan, Wirobrajan, Kota Yogyakarta, DI Yogyakarta, 55252", zipcode: "55252" },
  { district_id: 3635, subdistrict_id: 46740, full_address: "Sawojajar, Kedungkandang, Kota Malang, Jawa Timur, 65139", zipcode: "65139" },
  { district_id: 2275, subdistrict_id: 46310, full_address: "Sidokerto, Mojowarno, Jombang, Jawa Timur, 61475", zipcode: "61475" },
];

let urutTiruan = 0;
const driverTiruan: KurirDriver = {
  nama: "tiruan",
  async cariWilayah(q) {
    const k = q.toLowerCase();
    return WILAYAH_TIRUAN.filter((w) => w.full_address.toLowerCase().includes(k));
  },
  async tarif(asal, tujuan, p) {
    const vol = (p.length_cm * p.width_cm * p.height_cm) / 6;
    const kg = Math.max(1, Math.ceil(Math.max(p.weight_g, vol) / 1000));
    const jauh = Math.abs(asal.district_id - tujuan.district_id) > 1000 ? 2 : 1;
    const ins = Math.ceil((p.item_value * 0.002) / 100) * 100;
    return [
      { courier: "jne", service_type: "REG23", service_name: "JNE Reguler (tiruan)", cost: 9_000 * jauh + 4_000 * (kg - 1), insurance: ins, etd: "2-3", group: "regular" },
      { courier: "jnt", service_type: "EZ", service_name: "J&T EZ (tiruan)", cost: 8_500 * jauh + 4_500 * (kg - 1), insurance: ins, etd: "2-4", group: "regular" },
    ];
  },
  async jadwalPickup() {
    return fmtJakarta(new Date(Date.now() + 2 * 3600_000));
  },
  async buatOrder(o) {
    urutTiruan++;
    return { pickup_number: `MOCK-PID-${Date.now()}-${urutTiruan}`, awb: `MOCK${o.order_id}` };
  },
  async batalkan() {},
};

/** Driver aktif, atau null bila mode Kirim belum dikonfigurasi. */
export function kurir(): KurirDriver | null {
  const key = process.env.KIRIMINAJA_API_KEY;
  if (key) return driverAsli(key);
  if (process.env.KIRIMINAJA_MOCK === "true") return driverTiruan;
  return null;
}

export function kirimAktif(): boolean {
  return kurir() !== null;
}

/** Token yang wajib ada di header Authorization webhook (KiriminAja mengirim Bearer {api_key}). */
export function tokenWebhook(): string | null {
  if (process.env.KIRIMINAJA_API_KEY) return process.env.KIRIMINAJA_API_KEY;
  if (process.env.KIRIMINAJA_MOCK === "true") return "tiruan";
  return null;
}
