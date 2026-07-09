import { createClient } from '@supabase/supabase-js'

// Conexão com o Supabase.
// Para CLONAR o app: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (na Vercel →
// Settings → Environment Variables, ou num arquivo .env local) apontando para o Supabase
// NOVO. Se não definir, cai no valor padrão abaixo (o app original). Veja docs/NOVO-APP.md.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://vxhowdmzssvvmgonwoud.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aG93ZG16c3N2dm1nb253b3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTA4NTgsImV4cCI6MjA5Nzg2Njg1OH0.eujtumZPOAcs4YjhMArf-frJM8U0T1G6S7sOnHBVjCo'

export const supabase = createClient(url, key)
