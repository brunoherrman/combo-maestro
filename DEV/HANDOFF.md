# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-09-03
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-09-03 - memory lint + proposta harvest (gaps do ai-memory)
- Spec: cobrir 2 gaps do ai-memory: (2) edge lint implementado, (1) harvest como proposta
- Changed: `memory lint` (edge quebrado/invalido, id duplicado, contradicts pendente, exit 1); `SPECS/MEMORY-HARVEST.md` (proposta, nao iniciada); help/README; camada memory base ja entregue (index/push/recall/link, BM25, `~/.orquestrador/memory/`)
- Verified: `npm test` 15/15; smoke manual lint; `combo-maestro verify` + `orquestrador-maestro verify` passam
- Risks: harvest so proposta (ruido lexical + privacidade de transcript); sem embeddings (opcao A); hooks 3 linhas de folga
- Next context: decisao do maestro sobre harvest (3 perguntas em MEMORY-HARVEST.md); publicar 0.11.0 quando quiser

## Recent Entries

- 2026-09-03 - memory lint + proposta harvest (gaps do ai-memory; 15/15)
- 2026-09-03 - camada memory FTS implementada (index/push/recall/link, BM25, 14/14)
- 2026-09-03 - limpeza pre-memory (corte "Budget", bump 0.1.27) + spec da camada memory
- 2026-08-09 - aposentadoria de `budget`; `init-entrypoint` delega ao núcleo; fix de injeção de shell
- 2026-08-08 - núcleo 0.1.19; DEV migrado para schema canônico
- 2026-07-28 - núcleo no Unreleased; alinhamento com `PERSISTENCE.md`
- 2026-07-28 - núcleo 0.1.12; gate de 80 linhas no `hooks.md`
- 2026-07-16 - núcleo 0.1.3; broker Grok in-session
