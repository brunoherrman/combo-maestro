# Active Spec - combo-maestro

## Goal

Atualizar o núcleo Orquestrador Maestro de 0.1.12 para 0.1.19, manter os blocos COMBO válidos e reavaliar quais peças do combo o núcleo já absorveu.

## In Scope

- Atualizar a CLI do núcleo por npm e aplicar o conteúdo com `orquestrador-maestro update`.
- Reinjetar e verificar os blocos COMBO em `rules.md` e `hooks.md`.
- Migrar o `DEV/` do combo para os headings canônicos exigidos pelo gate estrito do núcleo 0.1.18.
- Levantar a sobreposição entre o combo e o núcleo 0.1.19 com evidência (grep nos contratos, `--help`, execução dos comandos novos).

## Out Of Scope

- Aposentar ou reescrever `init-entrypoint` e `budget`: depende de decisão do maestro.
- Publicar o pacote no npm.
- Adotar o perfil `phase-loop` e os `WORKFLOW_SCHEMAS.json` do núcleo.

## Acceptance

- [x] núcleo em 0.1.19 (`npm update -g` + `orquestrador-maestro update`)
- [x] `orquestrador-maestro verify` passa
- [x] `doctor` com `IssueCount: 0` e zero `Healthy: false`
- [x] `combo-maestro verify` passa e `hooks.md` fica dentro de 80 linhas
- [x] `DEV/` do combo com os headings canônicos e `DEV/README.md` presente
- [x] `npm test` 6/6
- [x] sobreposição com o núcleo levantada com evidência

## Constraints

- `hooks.md` tem 4 linhas de folga (76/80).
- Atualizar o núcleo apaga os blocos COMBO; a reinjeção é obrigatória.
- `check-dev-gates` do 0.1.19 só aceita `--project-path` absoluto.

## Verification Plan

- `orquestrador-maestro verify` e `doctor` para o núcleo.
- `combo-maestro verify` para os blocos injetados.
- `npm test` para a CLI do combo.
- `orquestrador-maestro check-dev-gates --project-path <abs> --strict` para o `DEV/`.

## Status

- State: em andamento
- Owner: Bruno Herrman
- Last updated: 2026-08-08
