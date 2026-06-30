# Encontro com Deus — Sistema de Gestão

## Estrutura
- /frontend → App React + Vite
- /sql      → Scripts do banco Supabase

## Como rodar

### 1. Configure o banco (se ainda não fez)
Execute no SQL Editor do Supabase na ordem:
1. sql/01_schema.sql
2. sql/02_rls_policies.sql
3. sql/03_seed.sql

### 2. Configure o frontend
```bash
cd frontend
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
```

### 3. Instale e rode
```bash
npm install
npm run dev
```

## Credenciais do Supabase
Encontre em: https://app.supabase.com → seu projeto → Settings → API
- VITE_SUPABASE_URL = Project URL
- VITE_SUPABASE_ANON_KEY = anon / public key
