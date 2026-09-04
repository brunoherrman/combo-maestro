# Active Handoff

This file should stay small. Refresh it after substantive work or run `orquestrador-maestro compact-worklog`.

## Snapshot

- Updated: 2026-09-04T17:58:38.355Z
- Read order: `INDEX.md` -> `HANDOFF.md` -> `CONTEXT.md` -> `SPECS/ACTIVE.md`
- Active spec: `SPECS/ACTIVE.md`
- Verification source: `VERIFY.md`
- Worklog archive: `HANDOFFS/WORKLOG_ARCHIVE.md`

## Latest Work

- Entry: 2026-09-04 - delegacao ask-first + statusline de quota (5h/7d)
- Spec: melhorias do maestro (AionUI TEAM): delegacao pergunta antes; alerta de quota da janela de 5h no chat
- Changed: `bracal-delegation.rules.md` vira GATE HUMANO (pergunta antes de delegar braçal); novo `src/statusline.js` + comando `statusline` (rate_limits 5h/7d + ctx + custo, cor nos limiares 25/50/75/90, le stdin do Claude Code); README (delegacao, secao Quota, roadmap); core em 0.2.4; memory e bridge pro core (harvest so)
- Verified: `npm test` 14/14; smoke do statusline (60%/92%/legacy/vazio); `combo-maestro verify` + `orquestrador-maestro verify` passam; DEV gate passa (worklog compactado p/ 12)
- Risks: quota so Claude Code (outros providers = ledger no roadmap); ligar statusline exige 1 linha em ~/.claude/settings.json
- Next context: oferecer wire do statusline; ledger multi-provider; cross-agent harvest; team audit

## Recent Entries

- 2026-09-04 - delegacao ask-first + statusline de quota (5h/7d)
- 2026-09-04 - core 0.2.4 (reauditoria, sem mudanca de codigo)
- 2026-09-04 - core 0.2.0; memory FTS aposentada -> bridge harvest->core
