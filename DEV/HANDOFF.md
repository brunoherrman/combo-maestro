# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-09-03
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-09-03 - memory harvest v1 (cross-session synthesis, lexical)
- Spec: implementar `memory harvest` com defaults, aditivo, sem tocar no orquestrador
- Changed: `memory harvest` le transcripts `.jsonl` do Claude Code, extrai turnos com sinal, propose-only, com `redactSnippet` mascarando home/username e tokens antes de propor; help/README/spec; NAO injeta hooks (zero orcamento). Base memory (index/push/recall/link/lint) ja entregue
- Verified: `npm test` 17/17; smoke nos transcripts reais (extracao + mascaramento OK); `combo-maestro verify` + `orquestrador-maestro verify` passam
- Risks: harvest lexical = ruidoso por design; mitigacao propose-only + revisao + redacao. Sem embeddings (opcao A)
- Next context: opcional auto-propor no session-end (1 linha de hooks); publicar 0.11.0 quando quiser

## Recent Entries

- 2026-09-03 - memory harvest v1 (cross-session, lexical, redacao, 17/17)
- 2026-09-03 - memory lint + proposta harvest (gaps do ai-memory; 15/15)
- 2026-09-03 - camada memory FTS implementada (index/push/recall/link, BM25, 14/14)
- 2026-09-03 - limpeza pre-memory (corte "Budget", bump 0.1.27) + spec da camada memory
- 2026-08-09 - aposentadoria de `budget`; `init-entrypoint` delega ao núcleo; fix de injeção de shell
- 2026-08-08 - núcleo 0.1.19; DEV migrado para schema canônico
- 2026-07-28 - núcleo no Unreleased; alinhamento com `PERSISTENCE.md`
- 2026-07-28 - núcleo 0.1.12; gate de 80 linhas no `hooks.md`
- 2026-07-16 - núcleo 0.1.3; broker Grok in-session
