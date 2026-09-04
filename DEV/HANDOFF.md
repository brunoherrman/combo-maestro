# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-09-04T17:58:38.355Z
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-07-01 - revisão de contrato e cobertura
- Spec: corrigir problemas encontrados na revisão anterior
- Changed: README reescrito; `init-entrypoint` completado com `HANDOFF` e `VERIFY`; testes de CLI adicionados; help atualizado
- Verified: `npm test`
- Risks: `curate`, `budget` e `stale-check` ainda têm cobertura indireta, não dedicada
- Next context: acompanhar releases do núcleo e reinjetar os blocos COMBO após cada atualização

## Recent Entries

- 2026-07-01 - revisão de contrato e cobertura
- 2026-07-16 - adaptação ao Orquestrador 0.1.3 (Grok)
- 2026-07-28 - núcleo no Unreleased e alinhamento com PERSISTENCE.md
