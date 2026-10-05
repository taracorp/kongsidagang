# BAB 05 — Peta Arsitektur (dari Graphify)

Snapshot graph di commit `1163dc0`: **570 node · 1103 edge · 48 komunitas**, 99% EXTRACTED.
File interaktif: `graphify-out/graph.html` (lokal, di-ignore git). Refresh: `graphify update .`

### Ch 5.1 — God nodes (paling banyak terhubung)
| Node | Edge | Lokasi | Arti |
|---|---|---|---|
| `createClient()` | 53 | `lib/supabase/client.ts` | Supabase browser — semua aksi client (follow, tawar, admin) |
| `cn()` | 50 | `lib/utils.ts` | gabung className |
| `createClient()` | 40 | `lib/supabase/server.ts` | Supabase server — halaman & query |
| `formatKeping()` | 24 | `lib/utils.ts` | format Rp/Keping |
| `getStaffSession()` | 16 | `lib/auth.ts` | guard admin per-peran |
| `Pill`, `KongsiButton`, `KongsiLinkButton` | 12–15 | `components/kongsi/` | primitif UI |

### Ch 5.2 — Alur data
```
Halaman server (app/**/page.tsx) ──► lib/queries.ts ──► lib/supabase/server.ts ──► Postgres (RLS)
                                         └─ fallback ► lib/dummy.ts / lib/data-e.ts
Komponen client (*Actions, *Form, *Admin) ──► lib/supabase/client.ts ──► tabel / RPC
pg_cron advance_auctions() ──► realtime.send('kongsi-lelang') ──► TheatreLelang (auto-refresh)
proxy.ts ──► updateSession() (refresh cookie sesi)
```

### Ch 5.3 — Database (migrasi 0001–0016)
| Domain | Tabel / view | Fungsi (RPC) |
|---|---|---|
| Saudagar | merchants, merchant_products, merchant_applications, follows | approve_merchant_application |
| Lelang | auctions, auction_participants, auction_guesses, **auction_items_public** (view aman) | advance_auctions, decide_auction |
| Neraca | price_listings (`source_type` merchant/feed/scrape) | — |
| Tukar | barter_items, barter_deals (+rating, sengketa) | rate_deal (sengketa diputus admin via update di `/admin/tukar`) |
| Kabar | articles | can_edit_kabar |
| Akun | profiles, wallets, wallet_transactions, vouchers, staff_roles, settings | spend_keping, topup_demo, redeem_voucher, checkout_keping, recompute_level, handle_new_user, admin_list_users, is_admin*, is_ketua, enforce_max_ketua |

### Ch 5.4 — Temuan struktural
- **Import cycle 3 file:** `AddToCartButton.tsx → cart.tsx → ProdukCard.tsx → AddToCartButton.tsx`.
- Data dummy masih dipakai sebagai fallback di `lib/queries.ts` (merchants, neraca, barter, artikel),
  dan sebagai sumber statis di `pakhuis/page.tsx` (`levelTangga`) & `SaudagarForm.tsx` (`kategoriDagangan`).
