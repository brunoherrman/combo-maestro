## Combo-maestro hooks

> Bloco aditivo. Complementa os hooks do nucleo, nao os substitui.

### Budget (inicio de sessao)

- Use `orquestrador-maestro context brief --project-path <abs> --max-chars 1200` (o combo aposentou o `budget`; passe caminho ABSOLUTO).
- WORKLOG grande: ofereca a curadoria, nao rode sozinho.

### Curadoria de worklog (human-in-the-loop)

- `combo-maestro curate --project-path <project> --keep 12`
- Diferente do `compact-worklog` do nucleo (corta por contagem), separa em baldes: manter (recentes), arquivar (antigas e magras), CINZA (antigas e substantivas).
- Mostra o TEXTO LITERAL das cinzas; o usuario decide cada uma.
- `--apply` arquiva SO o balde 'arquivar'. Cinzas nunca sao tocadas automaticamente.
- Regra de ouro: sistema propoe, usuario aprova.

### Stale-process gate

- `combo-maestro stale-check --project-path <project> --watch <dir-fonte>`
- Rode antes de gerar/testar quando um servidor/processo carrega a fonte em memoria (ex.: MCP server).
- Apos (re)iniciar o processo, grave o baseline com `--update`. Fonte mudou sem restart: o gate falha.
