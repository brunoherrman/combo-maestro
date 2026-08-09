# Current Context

## State

- Project: `combo-maestro`
- Tipo: CLI Node.js sem dependências externas
- Active handoff: `HANDOFF.md`
- Active spec: `SPECS/ACTIVE.md`
- Núcleo Orquestrador alvo: **0.1.19**
- Camada aditiva: injeta blocos `<!-- COMBO-MAESTRO:BEGIN/END -->` em `~/.orquestrador/rules.md` e `hooks.md`

## Commands

- Install: `npm install -g @brunoherrman/combo-maestro` (hoje roda como link global para esta pasta)
- Development: editar direto; o link global reflete na hora
- Tests: `npm test`
- Build: não há etapa de build

## Constraints And Risks

- `~/.orquestrador/hooks.md` tem limite de 80 linhas no núcleo; hoje em 76. O bloco COMBO divide esse orçamento.
- Reinstalar ou atualizar o núcleo **sempre** apaga os blocos COMBO. Rodar `combo-maestro install` + `verify` depois.
- O núcleo 0.1.18 introduziu gate estrito de `DEV/` com headings canônicos em inglês. `init-entrypoint` ainda gera o schema antigo em português e produz projetos que falham o gate.
- `context brief` (núcleo 0.1.14/0.1.18) cobre o que o `budget` do combo fazia, com orçamento de caracteres e resumo de estado.
- Bug no núcleo 0.1.19: `check-dev-gates --project-path` relativo resolve contra o diretório de instalação da CLI. Usar caminho absoluto.

## Next Context

- Decidir o destino de `init-entrypoint` e `budget` diante da absorção pelo núcleo.
- Reportar o bug de caminho relativo ao Bolzan.
