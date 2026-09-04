# Current Context

## State

- Project: `combo-maestro`
- Tipo: CLI Node.js sem dependências externas
- Active handoff: `HANDOFF.md`
- Active spec: `SPECS/ACTIVE.md`
- Núcleo Orquestrador alvo: **0.2.4** (npm e instalado local)
- **memory NATIVO no core (0.2.0+)**: `record/search/show/timeline/promote/stats/status/cleanup`, per-repo. Decisão do maestro: **bridge** — a mecânica FTS do combo foi aposentada; sobra só `memory harvest` alimentando o `memory record` do core. Tipos válidos: decision/discovery/implementation/risk.
- Camada aditiva: injeta blocos `<!-- COMBO-MAESTRO:BEGIN/END -->` em `~/.orquestrador/rules.md` e `hooks.md`

## Commands

- Install: `git clone` + `npm link` (não publicado no npm; `private:true`). Roda como link global desta pasta; update = `git pull`
- Development: editar direto; o link global reflete na hora
- Tests: `npm test`
- Build: não há etapa de build

## Constraints And Risks

- `~/.orquestrador/hooks.md` tem limite de 80 linhas no núcleo; hoje em 76. O bloco COMBO divide esse orçamento.
- Reinstalar ou atualizar o núcleo **sempre** apaga os blocos COMBO. Rodar `combo-maestro install` + `verify` depois.
- O núcleo 0.1.18 introduziu gate estrito de `DEV/` com headings canônicos em inglês. `init-entrypoint` ainda gera o schema antigo em português e produz projetos que falham o gate.
- `context brief` (núcleo 0.1.14/0.1.18) cobre o que o `budget` do combo fazia; subseção "Budget" morta removida do hooks (2026-09-03).
- Bug de `--project-path` relativo corrigido no núcleo 0.1.20 (verificado 0.1.24). Risco encerrado.
- Núcleo 0.1.21+ trouxe `workflow-lock`/`workflow-state`; sobrepõe parcialmente `stale-check` (ver README). Decisão: manter, escopo processo-em-RAM ainda não coberto.

## Next Context

- Implementar a camada `memory` (spec em `SPECS/ACTIVE.md`): FTS-only, store global, comandos index/push/recall/link.
- Rodar `combo-maestro install` para propagar o corte do "Budget" e revalidar orçamento de 80 linhas.
