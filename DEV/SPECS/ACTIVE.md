# SPEC ATIVA

Status: concluída

## Objetivo

Atualizar o núcleo Orquestrador Maestro de 0.1.2 até o `Unreleased` de 2026-07-28 (GitHub main) e adaptar o combo-maestro ao gate de tamanho de `hooks.md` e ao novo contrato `PERSISTENCE.md`.

## Critérios de aceitação

- [x] núcleo em 0.1.12 via `npm update -g` + `orquestrador-maestro update`
- [x] núcleo em `Unreleased` (commit `8910530`) via clone + `scripts/install.ps1 -InstallToolProfiles -Force`
- [x] `PERSISTENCE.md` instalado e referenciado nos 5 entrypoints (claude, codex, cursor, gemini, AGENTS global)
- [x] blocos COMBO reinjetados após cada reinstalação do núcleo
- [x] bloco de hooks do combo encurtado (30 -> 22 linhas) para caber no limite de 80 linhas do núcleo
- [x] bloco de session-start delega a ordem de leitura ao `PERSISTENCE.md`, com fallback quando ele não existe
- [x] `scripts/verify-install.ps1` do main passou
- [x] `doctor` com `IssueCount: 0`, zero `Healthy: false`, hooks 76/80
- [x] guard de orçamento de linhas em `verify`/`install` do combo + 2 testes
- [x] help do bin aponta o núcleo 0.1.12
- [x] README documenta compatibilidade, limite de 80 linhas e relação com `PERSISTENCE.md`
- [x] `npm test` passa (6/6)

## Fora de escopo

Integração opt-in com `ai-memory` (RFC 0002). `DEV/` segue fonte de verdade; nada a mudar no combo por ora.
