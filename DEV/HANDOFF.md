# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-08-09
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-08-09 - aposentadoria parcial e correção de injeção de shell
- Spec: aplicar as decisões sobre `init-entrypoint` e `budget` diante da absorção pelo núcleo 0.1.19
- Changed: `init-entrypoint` delega o `DEV/` ao `init-dev` do núcleo; `budget` aposentado apontando `context brief`; ordem do entrypoint alinhada ao `PERSISTENCE.md`; args de shell pré-quotados em `delegate` e `init-entrypoint`
- Verified: `npm test` 8/8; projeto gerado pelo `init-entrypoint` passa no `check-dev-gates`; `combo-maestro verify` e `orquestrador-maestro verify` passaram; `doctor` com `IssueCount: 0`
- Risks: `shellQuote` cobre cmd.exe e sh POSIX, não PowerShell como shell padrão; `curate` e `stale-check` sem cobertura dedicada
- Next context: reportar ao Bolzan o bug de `--project-path` relativo no 0.1.19; avaliar publicar 0.10.0

## Recent Entries

- 2026-08-09 - aposentadoria de `budget`; `init-entrypoint` delega ao núcleo; fix de injeção de shell
- 2026-08-08 - núcleo 0.1.19; DEV migrado para schema canônico
- 2026-07-28 - núcleo no Unreleased; alinhamento com `PERSISTENCE.md`
- 2026-07-28 - núcleo 0.1.12; gate de 80 linhas no `hooks.md`
- 2026-07-16 - núcleo 0.1.3; broker Grok in-session
