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
| **Economia de turnos** | Regra dura contra o gasto que mais dói na prática: reingestão de contexto por turno. |
| **Cold start auto-suficiente** | Regra global de session-start e injeção de entrypoint compacto no sub frio. |
| **Memória cross-projeto (FTS)** | `memory` replica as partes de baixo custo do [ai-memory](https://github.com/akitaonrails/ai-memory) em Node puro: páginas OKF-like + busca BM25, edges tipados, temporal e `lint`. Recall **bounded** (top-N + char-cap) — store global sem inflar token. O `DEV/` (per-projeto) segue como fonte de verdade. |

Conferido contra o núcleo **0.1.27**: `rules.md`, `hooks.md`, `maestro.md` e `PERSISTENCE.md` não têm nenhuma ocorrência de tier barato, subagent, stale/fingerprint, anti-poll ou read-once/batch.

> **`stale-check` vs `workflow-state` do núcleo (0.1.21+).** O núcleo passou a trazer `workflow-lock`/`workflow-state` (digest SHA-256 de artefato, drift bloqueia ops). Escopos **diferentes e complementares**: `workflow-state` guarda o digest de um artefato/lock; `stale-check` do combo compara um **processo ou servidor rodando** (que carregou a fonte em memória, ex.: MCP server) contra a fonte em disco. Enquanto o núcleo não cobrir o processo-em-RAM, `stale-check` fica.

### Peças aposentadas

O combo se autoaposenta por partes, conforme o núcleo absorve:

| Peça | Substituto no núcleo | Desde |
|---|---|---|
| `budget` | `orquestrador-maestro context brief --project-path <abs> --max-chars N` | 0.1.14 / 0.1.18 |
| skeletons de `DEV/` do `init-entrypoint` | `orquestrador-maestro init-dev` (o `init-entrypoint` agora delega a ele) | 0.1.18 |
| ordem de leitura no session-start | `~/.orquestrador/PERSISTENCE.md` | Unreleased 2026-07-28 |

`combo-maestro budget` continua existindo só para falhar alto e apontar o substituto, em vez de quebrar hooks antigos em silêncio.

Princípio comum: **regras boas não podem depender de você lembrar**.

## Requisitos

- **Orquestrador Maestro instalado** (testado contra o núcleo **0.1.27**)
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

combo-maestro curate      --project-path PATH [--keep N] [--apply]
combo-maestro stale-check --project-path PATH --watch DIR [--update]

combo-maestro setup-bracal    [--cli codex] [--model gpt-5.4-mini]
combo-maestro delegate        "<tarefa>" [--cli codex|claude|mimo|gemini|grok] [--model MODEL] [--allow-api] [--no-context]
combo-maestro init-entrypoint [--project-path PATH] [--dry-run]

combo-maestro memory index
combo-maestro memory push     [--project-path PATH] [--keep N] [--pick id1,id2] [--apply]
combo-maestro memory recall   "<query>" [--project P] [--type T] [--as-of DATE] [--top N] [--max-chars C]
combo-maestro memory link     <id-a> <causes|fixes|contradicts> <id-b>
combo-maestro memory lint

combo-maestro log             [--lines N]
```

## Camada de memoria (FTS cross-projeto)

Replica as partes de baixo custo do [ai-memory](https://github.com/akitaonrails/ai-memory) em Node puro — sem daemon, sem dependencia externa, sem API cobrada. Da o recall **cross-projeto** que o `DEV/` (per-projeto) nao entrega.

- **Store**: `~/.orquestrador/memory/` — uma pagina `<slug>.md` por fato (frontmatter OKF-like: `id`, `type`, `project`, `created`, `links`, `tags`) + `INDEX.json` (indice invertido BM25 + grafo de edges).
- **Busca**: full-text BM25. Sem embeddings (decisao: recall bom pra escala pessoal sem processo nem modelo de 87MB).
- **Temporal**: `--as-of DATE` recupera o estado do conhecimento ate aquela data.
- **Edges tipados**: `memory link <a> fixes|causes|contradicts <b>`.
- **Lint**: `memory lint` varre o store inteiro — edge quebrado (alvo inexistente), edge invalido, id duplicado, `contradicts` pendente. Falha (exit 1) em erro, entao serve de gate.
- **Push human-in-the-loop**: `memory push` deriva candidatas do balde CINZA do WORKLOG (reusa o `curate`); so grava com `--apply` (ou `--pick` para subconjunto). Nunca escreve sem sua aprovacao, nunca toca no WORKLOG.

### Travas

- **DEV/ e a fonte de verdade; a memoria e derivada.** Sem write-back para `DEV/`.
- **Recall e sempre bounded** (top-N + `--max-chars`). O `INDEX.json` fica em disco e e lido pela CLI, nunca injetado no contexto do modelo — um store global cresce sem inflar o custo de token da sessao.
- **Namespace por projeto** (`project:` no frontmatter): o recall so cruza projetos com `--project` explicito, para nao vazar contexto entre clientes.
- **Degrada gracioso**: sem store/indice, `recall` volta vazio e a sessao segue.

O bloco de hooks injeta um `recall` read-once no session-start (termos da tarefa/projeto atual), so quando ha store.

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

No modo shell-out do Codex, `delegate` pré-anexa um entrypoint compacto na ordem canônica do `PERSISTENCE.md`:

- `DEV/INDEX.md`
- `DEV/HANDOFF.md`
- `DEV/CONTEXT.md`
- `DEV/SPECS/ACTIVE.md`

`init-entrypoint` é opcional. Ele **delega a hierarquia `DEV/` ao `orquestrador-maestro init-dev`** — por isso o projeto gerado passa no `check-dev-gates --strict` — e acrescenta só o ponteiro ENTRYPOINT no topo do `AGENTS.md`, sem mover o corpo.

## Como pluga no Orquestrador

- regra de delegação de braçal → bloco marcado em `rules.md`
- regra de economia de turnos → mesmo bloco marcado em `rules.md`
- hooks de curadoria e stale → bloco marcado em `hooks.md`
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
