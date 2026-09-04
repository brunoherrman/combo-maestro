# Worklog Archive

Older worklog entries moved out of `DEV/WORKLOG.md` by `compact-worklog`.

Read `DEV/HANDOFF.md` and the retained `DEV/WORKLOG.md` entries before opening this archive.

## 2026-09-03 - memory harvest v1 (cross-session synthesis, lexical)

- Spec: implementar `memory harvest` (decisao do maestro: construir com defaults, aditivo, sem atrapalhar o orquestrador)
- Changed: `cmdHarvest` em `src/memory.js` — le os ultimos N transcripts `.jsonl` do Claude Code (`~/.claude/projects/<slug>/`, slug = abspath com [:\/ espaco]->-), extrai turnos do USUARIO com sinal (correcao/decisao/fix, regex PT+EN), filtra conteudo injetado `<...>`/slash-commands/acks curtos, dedup por texto normalizado e por id ja existente, propose-only (--apply/--pick grava). Flags novas --last/--transcripts no bin; help/README/roteador atualizados
- Changed: `redactSnippet` mascara home/username em path (C:\Users\x, /home/x, /Users/x, os.homedir) e tokens (sk-/xai-/ghp_/gho_/AKIA/hex>=32) ANTES de propor, no snippet E no id. Guard de privacidade exigido pela natureza do transcript
- Verified: `npm test` 17/17 (2 casos novos: harvest propoe sinal + filtra ruido + redige + dir ausente exit 2; redactSnippet unit); smoke nos transcripts reais deste projeto confirmou extracao e mascaramento do path pessoal vazado
- Aditivo confirmado: harvest NAO injeta linha de hooks (comando on-demand) -> zero impacto no orcamento de 80 linhas e zero toque no orquestrador
- Risks: lexical = ruidoso por design (o smoke real mostrou candidatas-ruido); mitigacao e propose-only + revisao humana + redacao. Afinar sinais se incomodar
- Next context: opcional wire de auto-propor no session-end (custaria 1 linha de hooks); publicar 0.11.0 quando o maestro quiser
