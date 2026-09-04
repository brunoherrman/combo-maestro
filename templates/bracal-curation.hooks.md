## Combo-maestro hooks

> Bloco aditivo. Complementa os hooks do nucleo, nao os substitui.

### Curadoria de worklog (human-in-the-loop)

- Contexto de inicio: use `orquestrador-maestro context brief` (nucleo). WORKLOG grande: ofereca a curadoria, nao rode sozinho.
- `combo-maestro curate --project-path <project> --keep 12`
- Diferente do `compact-worklog` do nucleo (corta por contagem), separa em baldes: manter (recentes), arquivar (antigas e magras), CINZA (antigas e substantivas).
- Mostra o TEXTO LITERAL das cinzas; o usuario decide cada uma.
- `--apply` arquiva SO o balde 'arquivar'. Cinzas nunca sao tocadas automaticamente.
- Regra de ouro: sistema propoe, usuario aprova.

### Stale-process gate

- `combo-maestro stale-check --project-path <project> --watch <dir-fonte>`
- Rode antes de gerar/testar quando um servidor/processo carrega a fonte em memoria (ex.: MCP server).
- Apos (re)iniciar o processo, grave o baseline com `--update`. Fonte mudou sem restart: o gate falha.

### Memory harvest (bridge pro memory nativo do core 0.2.0)

- Memory e do core (`orquestrador-maestro memory record|search|promote`). Combo nao duplica.
- `combo-maestro memory harvest --project-path <abs>` colhe transcripts de sessao e propoe; --apply grava no `memory record` do core. Human-in-the-loop.
