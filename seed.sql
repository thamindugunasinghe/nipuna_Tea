-- Seed default admin user (password: admin123)
INSERT INTO "users" (username, password_hash, name, role, updated_at)
VALUES ('admin', '$2a$10$wTf2e/k16rD.Eok.h2a86O8R.j/R7p76D92w1oUaN1jR.v6z6.Z0G', 'Administrator', 'admin', CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;

-- Seed default settings
INSERT INTO "settings" (key, value) VALUES
  ('tea_price_per_kilo', '100'),
  ('commission_rate', '5'),
  ('other_deduction_rate', '5')
ON CONFLICT (key) DO NOTHING;

-- Seed default fertilisers
INSERT INTO "fertilisers" (name, price_per_unit, weight_per_bag) VALUES
  ('T-65 Fertiliser', 5500, 50),
  ('U-709 Fertiliser', 4800, 50),
  ('Dolomite', 1200, 50),
  ('Tea Special Mixture', 6200, 25);
