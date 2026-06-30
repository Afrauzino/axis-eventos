-- ============================================================
-- ENCONTRO COM DEUS — SEED DATA (opcional para desenvolvimento)
-- ============================================================
-- Execute APÓS criar o primeiro usuário admin no Supabase Auth
-- Substitua 'YOUR_ADMIN_USER_ID' pelo UUID do usuário admin

-- Promover usuário a admin (execute após signup)
-- UPDATE profiles SET is_admin = true, role_status = 'approved'
-- WHERE user_id = 'YOUR_ADMIN_USER_ID';

-- Exemplo de evento
-- INSERT INTO events (name, description, status, start_date, end_date, location)
-- VALUES ('Encontro 2026', 'Primeiro encontro do ano', 'active', '2026-07-10', '2026-07-13', 'Centro de Retiros São Paulo');

-- ============================================================
-- STORAGE BUCKETS (execute no Supabase Dashboard ou via API)
-- ============================================================
-- Bucket: people-photos (para fotos dos participantes)
-- Bucket: event-documents (para documentos do evento)
-- 
-- No Supabase Dashboard > Storage > New Bucket:
-- Nome: people-photos
-- Public: false
-- Allowed MIME types: image/*
-- Max file size: 5MB
