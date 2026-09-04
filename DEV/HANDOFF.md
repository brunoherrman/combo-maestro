# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-09-04
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-09-04 - core 0.2.0 + pivot da memory pra bridge
- Spec: atualizar nucleo 0.1.27 -> 0.2.0 e casar o combo
- Changed: 0.2.0 trouxe memory NATIVO -> aposentei a mecanica FTS do combo (index/push/recall/link/lint, exit 2 apontando pro core) e mantive so `memory harvest`, refatorado pra alimentar o `orquestrador-maestro memory record`. bin/README/hooks/package 0.12.0 atualizados. Blocos COMBO reinjetados (76/80)
- Verified: `npm test` 12/12; smoke real harvest --apply -> core memory (confirmado + limpo); `combo-maestro verify` + `orquestrador-maestro verify` passam
- Risks: harvest lexical ruidoso (propose-only + redacao mitigam); classify->4 tipos do core
- Next context: commit + push; stale-check vs workflow-state segue combo-only

## Recent Entries

- 2026-09-04 - core 0.2.0; memory FTS aposentada -> bridge harvest->core (12/12)
- 2026-09-03 - memory harvest v1 (cross-session, lexical, redacao, 17/17)
- 2026-09-03 - memory lint + proposta harvest (gaps do ai-memory; 15/15)
- 2026-09-03 - camada memory FTS implementada (index/push/recall/link, BM25, 14/14)
- 2026-09-03 - limpeza pre-memory (corte "Budget", bump 0.1.27) + spec da camada memory
- 2026-08-09 - aposentadoria de `budget`; `init-entrypoint` delega ao núcleo; fix de injeção de shell
- 2026-08-08 - núcleo 0.1.19; DEV migrado para schema canônico
- 2026-07-28 - núcleo no Unreleased; alinhamento com `PERSISTENCE.md`
- 2026-07-28 - núcleo 0.1.12; gate de 80 linhas no `hooks.md`
- 2026-07-16 - núcleo 0.1.3; broker Grok in-session
