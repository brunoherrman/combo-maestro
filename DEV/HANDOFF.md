# HANDOFF

## Estado atual

- Núcleo Orquestrador no `Unreleased` de 2026-07-28 (GitHub main, commit `8910530`). Caminho: `npm update -g` (0.1.2 -> 0.1.12), depois clone + `scripts/install.ps1 -InstallToolProfiles -Force`.
- `PERSISTENCE.md` instalado e citado nos 5 entrypoints. Os verificadores do núcleo agora exigem isso — `-InstallToolProfiles` é obrigatório.
- combo-maestro **0.9.2**: bloco de hooks cabe no limite de 80 linhas; bloco de session-start delega a ordem de leitura ao `PERSISTENCE.md` com fallback; guard de orçamento em `install`/`verify`; 6 testes passando.
- `verify-install.ps1` do main passou; `doctor` com `IssueCount: 0`, zero `Healthy: false`.
- Blocos COMBO reinjetados e verificados.

## Próximo passo

- Publicar combo 0.9.2 no npm quando desejado (`npm publish`) — usuário valida.
- Quando o `Unreleased` virar release no npm, trocar o install-from-clone por `npm update -g`.
- Avaliar a RFC 0002 (`ai-memory` como provider opcional) quando sair de proposta. Hoje `DEV/` é fonte de verdade e o combo não precisa mudar.
- Ampliar testes para broker `grok`, `curate`, `budget` e `stale-check` (cobertura ainda indireta).

## Margem apertada

`hooks.md` está em 76/80 linhas. Qualquer linha nova no bloco COMBO de hooks precisa remover outra. `combo-maestro install` avisa e `verify` falha antes do gate do núcleo.

## Armadilhas conhecidas

- Reinstalar o núcleo **sempre** apaga os blocos COMBO. Rode `combo-maestro install` + `verify` depois.
- O clone do repositório precisa de `git clone -c core.longpaths=true`; sem isso os schemas ooxml das skills docx/pptx estouram o limite de path do Windows.
- `scripts/install.ps1` exige `-Force` para sobrescrever um `.orquestrador` existente. Ele faz backup próprio em `~/.orquestrador-public-backups/<timestamp>`.
