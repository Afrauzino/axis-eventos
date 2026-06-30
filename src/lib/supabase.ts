import { createClient } from '@supabase/supabase-js'

// Credenciais diretas para garantir funcionamento
const url = 'https://vxhowdmzssvvmgonwoud.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aG93ZG16c3N2dm1nb253b3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTA4NTgsImV4cCI6MjA5Nzg2Njg1OH0.eujtumZPOAcs4YjhMArf-frJM8U0T1G6S7sOnHBVjCo'

export const supabase = createClient(url, key)
