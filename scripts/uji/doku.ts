// Uji tanda tangan DOKU (tanpa DB/jaringan): npx tsx --conditions=react-server scripts/uji/doku.ts
import { execFileSync } from "node:child_process";
import { tandaTangan, verifikasiNotifikasi, PATH_NOTIFIKASI } from "@/lib/payment/doku";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };

const cfg = { clientId: "BRN-UJI-0001", secret: "SK-rahasia-uji" };
const h = { clientId: cfg.clientId, requestId: "c7a1e2d4-0000-4000-8000-000000000001", timestamp: "2026-10-06T03:00:00Z", target: PATH_NOTIFIKASI };
const body = JSON.stringify({ order: { invoice_number: "KD-ISI-UJI", amount: 52000 }, transaction: { status: "SUCCESS" } });

// Pembanding independen (Python, rumus dari JokulUtils::generateSignatureNotification).
const py = `
import base64,hashlib,hmac,sys
cid,rid,ts,tgt,sec,body=sys.argv[1:7]
dg=base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
raw=f"Client-Id:{cid}\\nRequest-Id:{rid}\\nRequest-Timestamp:{ts}\\nRequest-Target:{tgt}\\nDigest:{dg}"
print("HMACSHA256="+base64.b64encode(hmac.new(sec.encode(),raw.encode(),hashlib.sha256).digest()).decode())`;
const pembanding = execFileSync("python3", ["-c", py, h.clientId, h.requestId, h.timestamp, h.target, cfg.secret, body]).toString().trim();
const sig = tandaTangan(cfg.secret, h, body);
ok(sig === pembanding, "tanda tangan sama dengan pembanding Python");
ok(tandaTangan(cfg.secret, h) !== sig, "tanpa body (cek status) tidak memakai Digest");

const hdr = { clientId: h.clientId, requestId: h.requestId, timestamp: h.timestamp, signature: sig };
ok(verifikasiNotifikasi(cfg, hdr, body), "notifikasi asli diterima");
ok(!verifikasiNotifikasi(cfg, hdr, body.replace("52000", "520000")), "body diubah (nominal) ditolak");
ok(!verifikasiNotifikasi(cfg, { ...hdr, clientId: "BRN-LAIN" }, body), "Client-Id lain ditolak");
ok(!verifikasiNotifikasi(cfg, { ...hdr, signature: null }, body), "tanpa Signature ditolak");
ok(!verifikasiNotifikasi({ ...cfg, secret: "salah" }, hdr, body), "secret salah ditolak");
ok(!verifikasiNotifikasi(cfg, hdr, body, "/path/lain"), "Request-Target lain ditolak");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
