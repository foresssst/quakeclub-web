-- Insertar presets de banners de ejemplo
INSERT INTO "CoverPreset" (id, name, "imageUrl", active, "createdAt")
VALUES 
  ('preset_quake_arena', 'Quake Arena', '/covers/presets/quake-arena.jpg', true, NOW()),
  ('preset_dark_tech', 'Dark Tech', '/covers/presets/dark-tech.jpg', true, NOW()),
  ('preset_neon_grid', 'Neon Grid', '/covers/presets/neon-grid.jpg', true, NOW()),
  ('preset_space', 'Space', '/covers/presets/space.jpg', true, NOW()),
  ('preset_fire', 'Fire', '/covers/presets/fire.jpg', true, NOW()),
  ('preset_ice', 'Ice', '/covers/presets/ice.jpg', true, NOW())
ON CONFLICT (name) DO NOTHING;
