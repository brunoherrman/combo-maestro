# combo-maestro

Camada complementar para o **[Orquestrador Maestro](https://github.com/FernandoBolzan/Orquestrador-Maestro)** de [Fernando Bolzan](https://github.com/FernandoBolzan).

> **Baseado no Orquestrador Maestro.** Este pacote **não é um orquestrador novo** e não substitui nada do projeto do Bolzan. Ele é uma camada **aditiva** que pluga por cima do Orquestrador Maestro já instalado e cobre apenas as peças que o núcleo ainda não traz. Todo o mérito da arquitetura base (`rules`, `hooks`, `skills`, `profiles`, DEV-memory, combo `spec + worklog + verify + handoff + gate`) é do Orquestrador Maestro. Quando o núcleo absorver estas peças nativamente, o combo-maestro se autoaposenta.

## Por que existe

O Orquestrador Maestro já entrega o combo `spec + worklog + verify + handoff + gate` via `init-dev`, `compact-worklog` e `check-dev-gates`. Trabalhando com ele no dia a dia, sobraram estas lacunas:

| Lacuna | O que o combo-maestro adiciona |
|---|---|
| **Delegação de braçal cheap-tier** | Regra + broker: trabalho mecânico cai no tier barato do **mesmo CLI** (Claude→Haiku, Codex→gpt-5.4-mini, Gemini→Flash), sempre por **assinatura, nunca API**, com heurística "verificável barato?" e fallback. |
| **Curadoria human-in-the-loop** | `curate` separa o worklog em baldes e mostra o texto literal das cinzas para decisão humana. |
| **Stale-process gate** | `stale-check` falha se o processo ou servidor rodando ficou velho em relação à fonte. |
| **Budget report** | `budget` mostra o tamanho de contexto e worklog no início, para a inflação ficar visível cedo. |
| **Economia de turnos** | Regra dura contra o gasto que mais dói na prática: reingestão de contexto por turno. |
| **Cold start auto-suficiente** | Regra global de session-start e injeção de entrypoint compacto no sub frio. |

Princípio comum: **regras boas não podem depender de você lembrar**.

## Requisitos

- **Orquestrador Maestro instalado** (testado contra o núcleo **0.1.12**)
  ```bash
  npm install -g @iapro/orquestrador-maestro-cli
  orquestrador-maestro install
  ```
- **Node >= 18**

## Compatibilidade com o núcleo

Reinstalar ou atualizar o núcleo **regenera** `rules.md` e `hooks.md` e apaga os blocos COMBO. Depois de qualquer `orquestrador-maestro install` ou `update`, rode:

```bash
combo-maestro install
combo-maestro verify
```

A partir do núcleo 0.1.12, `orquestrador-maestro verify` recusa um `hooks.md` acima de **80 linhas**. O bloco COMBO divide esse orçamento com o núcleo, então ele é mantido curto de propósito. `combo-maestro install` avisa e `combo-maestro verify` falha se o limite estourar — corrija encurtando `templates/bracal-curation.hooks.md`, não o arquivo instalado.

O comando `/maestro` do Cursor (núcleo 0.1.12) reidrata o contrato global quando a sessão perde continuidade. Ele é o caminho de **recuperação manual**; a regra de session-start do combo é o caminho **automático**. Os dois convivem.

### Relação com `PERSISTENCE.md`

Quando o núcleo traz `.orquestrador/PERSISTENCE.md` (contrato canônico de reidratação e persistência, exigido pelos verificadores), **ele manda na ordem de leitura** dos arquivos de `DEV/`. O bloco COMBO não duplica essa ordem — restá-la criaria fonte dupla de verdade.

O que o combo continua adicionando, porque o núcleo define o *quê* mas não força o *quando*:

- dispara no início de trabalho substantivo, sem o usuário pedir;
- não pergunta "devo ler?";
- read-once por sessão;
- não lê README ou `AGENTS.md` inteiro por default;
- ação destrutiva continua exigindo confirmação explícita.

Sem `PERSISTENCE.md` instalado, o bloco cai no comportamento anterior (`DEV/SPECS/ACTIVE.md` + `DEV/HANDOFF.md`, com `DEV/INDEX.md` como mapa). Funciona nos dois casos.

## Instalação

```bash
npm install -g @brunoherrman/combo-maestro
combo-maestro install
combo-maestro verify
```

`install` é aditivo e idempotente: injeta blocos marcados em `~/.orquestrador/rules.md` e `hooks.md`.

```md
<!-- COMBO-MAESTRO:BEGIN -->
... contrato do combo ...
<!-- COMBO-MAESTRO:END -->
```

Só o conteúdo entre os marcadores é escrito, atualizado ou removido.

## Comandos

```text
combo-maestro install               # injeta os blocos COMBO no .orquestrador
combo-maestro uninstall             # remove os blocos
combo-maestro verify                # confere que os blocos estão presentes

combo-maestro budget      --project-path PATH
combo-maestro curate      --project-path PATH [--keep N] [--apply]
combo-maestro stale-check --project-path PATH --watch DIR [--update]

combo-maestro setup-bracal    [--cli codex] [--model gpt-5.4-mini]
combo-maestro delegate        "<tarefa>" [--cli codex|claude|mimo|gemini|grok] [--model MODEL] [--allow-api] [--no-context]
combo-maestro init-entrypoint [--project-path PATH] [--dry-run]
combo-maestro log             [--lines N]
```

## Curadoria de worklog

```bash
combo-maestro curate --project-path . --keep 12
```

Separa as entradas do `DEV/WORKLOG.md` em três baldes:

- **manter**: as `--keep` mais recentes
- **arquivar**: antigas e magras
- **cinza**: antigas, mas substantivas

Sem `--apply`, o comando só propõe. Com `--apply`, arquiva apenas o balde `arquivar` em `DEV/HANDOFFS/WORKLOG_ARCHIVE.md`. As cinzas nunca são tocadas automaticamente.

## Stale-process gate

```bash
combo-maestro stale-check --watch core --update
combo-maestro stale-check --watch core
```

O primeiro comando grava o baseline depois do restart do processo. O segundo falha se a fonte mudou desde então.

## Delegação de braçal

O maestro fica no modelo caro; o braçal cai no tier barato do mesmo ecossistema.

| `--cli` | Modo | Como roda | Custo |
|---|---|---|---|
| `claude` | in-session | subagent Haiku | assinatura |
| `gemini` | in-session | tier Flash na própria sessão | assinatura |
| `grok` | in-session | tier `grok-code-fast-1` na própria sessão | API xAI (fica in-session p/ não abrir 2º processo) |
| `codex` | shell-out | `codex exec -m gpt-5.4-mini --sandbox read-only` | assinatura |
| `mimo` | API | `mimo run -m xiaomi/mimo-v2.5` | bloqueado sem `--allow-api` |

`delegate --cli claude|gemini|grok` se recusa de propósito e aponta para o modo in-session. `delegate --cli mimo` só roda com opt-in explícito. Grok CLI (xAI) é sempre metrado por `XAI_API_KEY`; por isso fica in-session, delegando o braçal ao tier barato dentro da própria sessão em vez de abrir um segundo processo cobrado.

## Quando delegar

Os dois filtros precisam dar `SIM`:

1. **Verificável barato?**
2. **Volumoso o bastante para pagar o cold-start?**

Braçal verificável e volumoso vai para o mini. Braçal pequeno fica inline.

## Economia de turnos

As travas principais são:

1. **Anti-poll**: job longo é dispara-e-sai.
2. **Read-once**: documento de contrato lê uma vez por sessão.
3. **Batch**: tarefa repetitiva sobre N itens é uma passada só.

## Cold start auto-suficiente

No modo shell-out do Codex, `delegate` pré-anexa um entrypoint compacto com:

- `DEV/INDEX.md`
- `DEV/SPECS/ACTIVE.md`
- `DEV/HANDOFF.md`

`init-entrypoint` é opcional e cria o esqueleto `DEV/` quando o projeto ainda não tem essa estrutura.

## Como pluga no Orquestrador

- regra de delegação de braçal → bloco marcado em `rules.md`
- regra de economia de turnos → mesmo bloco marcado em `rules.md`
- hooks de budget, curadoria e stale → bloco marcado em `hooks.md`
- profile do braçal → `[profiles.bracal]` marcado no `~/.codex/config.toml`

## Descontinuação

Quando o Orquestrador Maestro absorver essas peças nativamente:

```bash
combo-maestro uninstall
npm uninstall -g @brunoherrman/combo-maestro
```

## Créditos

- **Orquestrador Maestro** — Fernando Bolzan
- **combo-maestro** — Bruno Herrman

## Licença

MIT
