# Continuação — Cadastro (cargos) + Ranking (iniciar/terminar)

> Handoff pra outro chat continuar. Escrito porque as duas features abaixo são grandes
> e a regra do Anderson é **não deixar nada pela metade/quebrado**. Nada disso foi
> começado ainda — está tudo especificado pra implementar do zero, com segurança.

## ⛔ NÃO MEXER
- **Painel de notificações**: `src/pages/ConfigNotificacoes.tsx`, `src/lib/notifRegras.ts` — o Anderson está terminando em OUTRO chat. Não alterar.
- **Portão do app**: `src/components/PortaoApp.tsx` — também está sendo mexido noutro chat (regra: PC obriga app, exceto primeiro acesso). Não alterar.
- Regra geral do projeto: **não quebrar/alterar o que já funciona**; cor personalizável (não hardcodar); tudo pelo app (migrações via `sql/NN` OK, nada manual no Supabase).

## Estado atual (referências úteis)
- Config chave/valor: `carregarConfig(chave)` / `salvarConfig(chave, valor)` em `src/lib/tema.ts` (tabela `configuracoes`).
- Dropdown "que abre e rola" que o Anderson quer = componente **`src/components/Seletor.tsx`** (já existe, usado em várias telas). É a "caixa de seleção" pedida.
- Tela de config admin padrão: `src/pages/MenusAdmin.tsx` e `ConfigNotificacoes.tsx`. Rota nova entra em `src/App.tsx` (lazy import + `<Route>` + label no `rotaLabel`) e link no submenu **Administração** em `src/components/Nav.tsx`.
- Cadastro: `src/components/CadastroPessoa.tsx` — tipo `PessoaForm` (~linha 20), `FORM_VAZIO` (~57), export `ROLES`, props `showRole/showStatus/showTeam/showReferencia/fotoObrigatoria`. A seção "geral" mostra os campos; saúde fica oculta (`aba='geral'`).
- Auto-cadastro do usuário (Perfil → "Editar todos os meus dados") salva via função `atualizar_meu_cadastro(jsonb)` em `sql/59_meu_cadastro.sql` (SECURITY DEFINER, só campos seguros; NÃO mexe em papel/permissão).

---

## TAREFA A — Campo "Cargo" no cadastro + ficha personalizável em Administração

**O que o Anderson quer:**
1. No cadastro, um campo **Cargo** = **caixa de seleção** (usar `Seletor`) com uma **lista de cargos fixos** que o admin configura.
2. Essa configuração fica em **Administração** (nova tela, ex.: "Ficha de cadastro").
3. **Modular**: poder **adicionar/remover** cargos, marcar o campo como **obrigatório ou não**, e **ocultar** a caixa. Ideia futura: mesma lógica (ocultar/obrigar) para outros campos da ficha.
4. **Sem quebrar** o cadastro de hoje.

**Como fazer (sugestão segura):**
1. **Armazenar a config em `configuracoes` (chave/valor, sem schema novo):**
   - `cadastro_cargos` = JSON array de strings, ex.: `["Recepção","Cozinha","Louvor","Intercessão"]`.
   - `cadastro_cargo_obrigatorio` = `'1'|'0'`.
   - `cadastro_cargo_oculto` = `'1'|'0'`.
2. **Guardar o cargo escolhido em `people`:** precisa de **coluna nova** → criar `sql/61_cadastro_cargo.sql`:
   ```sql
   ALTER TABLE public.people ADD COLUMN IF NOT EXISTS cargo text;
   -- E incluir 'cargo' na função de auto-cadastro:
   -- editar sql/59: no UPDATE people, add:  cargo = NULLIF(p->>'cargo',''),
   NOTIFY pgrst, 'reload schema';
   ```
   Também incluir `cargo` no `atualizar_meu_cadastro` (sql/59) e no payload do Perfil (`salvarMeuCadastro`) e no `salvarEdicaoCompleta` do Admin (grava `cargo`).
3. **`CadastroPessoa.tsx`:**
   - `PessoaForm` + `FORM_VAZIO`: add `cargo: string` (default `''`).
   - Carregar `cadastro_cargos/obrigatorio/oculto` (via `carregarConfig`) num `useEffect`.
   - Renderizar, na seção geral, um `<Seletor titulo="Cargo" value={form.cargo} onChange=... opcoes={cargos.map(c=>({value:c,label:c}))} />` — só se **não** estiver oculto. Marcar `*` se obrigatório e validar no submit dos pais (Login/Cadastros/Admin) — cuidado: a validação de obrigatoriedade fica em quem salva, não dentro do CadastroPessoa (ele é controlado).
   - Carregar `cargo` no `abrirEdicao`/loaders (Admin, Perfil, Cadastros).
4. **Nova tela `src/pages/CadastroConfig.tsx`** (Administração → "Ficha de cadastro"):
   - Lista editável de cargos (add/remover/reordenar — pode ser textarea "um por linha" pra simplificar, ou lista com inputs).
   - Toggle "Obrigatório" e "Ocultar" pro campo Cargo.
   - Salvar via `salvarConfig`.
   - Rota `/admin/cadastro-config` em App.tsx + item no submenu Administração (Nav.tsx) + label.
5. **Não quebrar:** o cadastro atual continua igual; o campo Cargo só aparece se houver cargos configurados e não estiver oculto. Se `cadastro_cargos` vazio → não mostra nada (comportamento de hoje).

**Não conseguido nesta sessão:** nada iniciado (feature grande, evitei half-doing).

---

## TAREFA B — Ranking com Iniciar/Terminar votação

**O que o Anderson quer:**
- Botões **Iniciar** e **Terminar** a votação do Ranking (só admin).
- **Iniciou** → **todos** podem votar. **Terminou** → não dá mais pra votar (só ver resultado).
- **Vincular na notificação**: ao iniciar, disparar aviso (usar `enviarPush` do `src/lib/push.ts` — NÃO mexer no painel de regras de notificação; no máximo `enviarPush({ notify_admins?..., title:'🏆 Votação do Ranking começou!' , ... })`, ou deixar a REGRA pro outro chat ligar depois).
- **Quando iniciar, "o painel fica"** = aparece um painel/banner do Ranking na tela **Início** (Dashboard) enquanto a votação está aberta.

**Como fazer (sugestão segura):**
1. **Estado da votação** por evento. Simples: `configuracoes` key `ranking_aberto` = `'1'|'0'` (global) — ou, melhor, coluna `events.ranking_aberto boolean` (sql/62) se quiser por evento. Config key é mais rápido e sem schema.
2. **`src/pages/Ranking.tsx`:**
   - Carregar `ranking_aberto`.
   - Se admin (`isAdmin(user_role) || is_admin`): botões **"Iniciar votação"** (set `'1'`) e **"Terminar votação"** (set `'0'`).
   - Hoje quem vota é gated por `poderes` (linha ~) e `votarInline`. Mudar: **votar habilitado quando `ranking_aberto==='1'`** (pra todos os aprovados), e **desabilitado** quando fechado (estrelas viram read-only). Manter a lógica de tirar voto (já existe).
   - Ao **Iniciar**: `enviarPush({ ... , title:'🏆 A votação do Ranking começou!', body:'Vote nos seus destaques!', url:'/ranking' })` (ver quem recebe — provavelmente todos os aprovados; resolver alvo com `person_ids`/`notify_admins` ou uma nova opção; se ficar complexo, deixar a notificação pro outro chat e só ligar o start/stop + trava aqui).
3. **Painel na Início:** em `src/pages/Dashboard.tsx`, quando `ranking_aberto==='1'`, mostrar um card/banner "🏆 Votação aberta — toque para votar" que leva a `/ranking`. (Dashboard tem sistema de blocos; o mais simples é um card fixo no topo condicional, sem mexer nos blocos configuráveis.)
4. **Não quebrar:** se `ranking_aberto` indefinido, tratar como hoje (o comportamento atual de votação continua). Só adicionar a trava quando explicitamente fechado.

**Não conseguido nesta sessão:** nada iniciado.

---

## Bug já resolvido nesta sessão (contexto)
- Salvar ministração voltava pro início → corrigido (commit `98ebd01`).
- Pôster do cronograma: PNG do ministrante com enquadramento robusto (contain, centralizado, junto do card em linhas altas).
- Email órfão afrauzino2@gmail.com: **liberar manualmente em Supabase → Authentication → Users → Delete** (auth.users guardou o email).

## Dúvida respondida
- Botão **"Criar PR"** = Pull Request do GitHub (da ferramenta de código), NÃO é do app. Ignorar — commit vai direto na `main`.
