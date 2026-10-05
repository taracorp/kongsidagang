-- Aturan data yang tidak bisa ditulis di schema.prisma (dulu ada di SQL Supabase / trigger).
ALTER TABLE "barter_ratings" ADD CONSTRAINT "barter_ratings_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_nonneg" CHECK ("balance" >= 0);

-- Maksimal 2 Ketua Kongsi (pengganti trigger enforce_max_ketua).
CREATE OR REPLACE FUNCTION enforce_max_ketua() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'ketua' THEN
    IF (SELECT count(*) FROM "staff_roles" WHERE role = 'ketua' AND user_id <> NEW.user_id) >= 2 THEN
      RAISE EXCEPTION 'Maksimal 2 Ketua Kongsi';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_max_ketua BEFORE INSERT OR UPDATE ON "staff_roles"
  FOR EACH ROW EXECUTE FUNCTION enforce_max_ketua();

-- Pengaturan awal Sekilas Pariwara.
INSERT INTO "settings" ("key", "value") VALUES ('ad_video_url', ''), ('ad_image_url', '')
  ON CONFLICT ("key") DO NOTHING;
