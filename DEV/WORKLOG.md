# WORKLOG

## 2026-07-28 - núcleo 0.1.12 e gate de tamanho de hooks

- Spec: atualizar o núcleo (instalação estava em 0.1.2; npm já servia 0.1.12) e adaptar o combo
- Núcleo: `npm update -g` (0.1.2 -> 0.1.12) + `orquestrador-maestro update`; ganhos 0.1.3/0.1.10/0.1.11/0.1.12 (Grok, LGPD, optimize-images, hardening de bootstrap, backup sem dados pessoais, `/maestro` no Cursor)
- Achado: o núcleo 0.1.12 passou a recusar `hooks.md` acima de 80 linhas; com o bloco COMBO o arquivo ia a 84 e `orquestrador-maestro verify` falhava
- Changed: `templates/bracal-curation.hooks.md` comprimido 30 -> 22 linhas (substância mantida); guard `checkHooksBudget` em `lib.js` usado por `install.js` (aviso) e `verify.js` (falha); 2 testes novos; help do bin 0.1.2 -> 0.1.12; README com seção de compatibilidade; versão 0.9.0 -> 0.9.1
- Verified: `orquestrador-maestro verify` passou; `doctor` com `IssueCount: 0` e hooks 76/80 `Healthy`; `combo-maestro verify` passou; `npm test` 6/6
- Risks: margem de hooks é de 4 linhas; releases futuros do núcleo podem crescer `hooks.md` e estourar o limite sozinhos.

## 2026-07-28 - núcleo no Unreleased e alinhamento com PERSISTENCE.md

- Spec: aplicar o bloco `Unreleased` (2026-07-28), que só existe em GitHub main, e adaptar o combo ao contrato `PERSISTENCE.md`
- Núcleo: clone `8910530` (`git clone -c core.longpaths=true` resolveu o estouro de path dos schemas ooxml; não precisou de `-SkipCommunitySkills`) + `scripts/install.ps1 -InstallToolProfiles -Force` (rodado pelo usuário; o classificador de permissões bloqueia `-Force`)
- Achado: os verificadores do main exigem `orquestrador/PERSISTENCE.md` presente E citado em cada entrypoint, então `-InstallToolProfiles` deixou de ser opcional
- Achado: `~/.claude/CLAUDE.md` era o template padrão sem customização e o novo é superset (adiciona `PERSISTENCE.md` + regra de reidratação), então a sobrescrita não custou nada — conferido antes de rodar
- Changed: bloco de session-start em `templates/bracal-delegation.rules.md` passou a delegar a ORDEM de leitura ao `PERSISTENCE.md` (evita fonte dupla de verdade) e manter só o gatilho automático, read-once, "não pergunte" e a exceção destrutiva; fallback preservado quando `PERSISTENCE.md` não existe; README com seção nova; versão 0.9.1 -> 0.9.2
- Verified: `scripts/verify-install.ps1` do main passou; `doctor` com `IssueCount: 0` e zero `Healthy: false`; hooks 76/80; `PERSISTENCE.md` citado em claude/codex/cursor/gemini/AGENTS global; skill `improve-codebase-architecture` instalada em `skill-library/community-skills/`; `combo-maestro verify` passou; `npm test` 6/6
- Risks: margem de hooks segue 4 linhas (estimativa anterior de 8 estava errada; a base do main dá o mesmo total instalado). RFC 0002 (`ai-memory`) ainda é proposta — nada a fazer no combo.

## 2026-07-16 - adaptação ao Orquestrador 0.1.3 (Grok)

- Spec: atualizar núcleo Orquestrador para 0.1.3 (via GitHub, não publicado no npm) e adaptar combo
- Núcleo: instalado 0.1.3 do GitHub main (installer + `install-grok-orquestrador.ps1`); backup criado pelo installer; skills novas `skill-lgpd-brasil` e `skill-optimize-images`; Grok CLI integrado (`~/.grok/config.toml`)
- Changed: broker `grok` (in-session, tier `grok-code-fast-1`) em `delegate.js`; detecção `GROK_HOME`/`XAI_API_KEY`; linha Grok no template de delegação, README e help do bin; versão 0.8.0 -> 0.9.0
- Blocos COMBO reinjetados em `rules.md`/`hooks.md` (estavam ausentes após reinstalação do núcleo)
- Verified: `npm test` (EXIT=0); `delegate --cli grok` redireciona in-session; `combo-maestro verify` passou; Grok presente no `rules.md` instalado
- Risks: Grok CLI é sempre metrado por API xAI — mantido in-session por design; msg genérica de redirect diz "assinatura" (corrigido no texto `how` específico)

## 2026-07-01 - revisão de contrato e cobertura

- Spec: corrigir problemas encontrados na revisão anterior
- Changed: README reescrito; `init-entrypoint` completado com `HANDOFF` e `VERIFY`; testes de CLI adicionados; help atualizado
- Verified: `npm test`
- Risks: `curate`, `budget` e `stale-check` ainda têm cobertura indireta, não dedicada
