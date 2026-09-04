# combo-maestro

Camada complementar para o **[Orquestrador Maestro](https://github.com/FernandoBolzan/Orquestrador-Maestro)** de [Fernando Bolzan](https://github.com/FernandoBolzan).

> **Baseado no Orquestrador Maestro.** Este pacote **não é um orquestrador novo** e não substitui nada do projeto do Bolzan. Ele é uma camada **aditiva** que pluga por cima do Orquestrador Maestro já instalado e cobre apenas as peças que o núcleo ainda não traz. Todo o mérito da arquitetura base (`rules`, `hooks`, `skills`, `profiles`, DEV-memory, combo `spec + worklog + verify + handoff + gate`) é do Orquestrador Maestro. Quando o núcleo absorver estas peças nativamente, o combo-maestro se autoaposenta.

## Por que existe

O Orquestrador Maestro já entrega o combo `spec + worklog + verify + handoff + gate` via `init-dev`, `compact-worklog` e `check-dev-gates`. Trabalhando com ele no dia a dia, sobraram estas lacunas:

| Lacuna | O que o combo-maestro adiciona |
|---|---|
| **Delegação de braçal cheap-tier (human-in-the-loop)** | Regra + broker: ao detectar trabalho mecânico verificável e volumoso, o agente **pergunta ao maestro antes** de delegar (delegar ao Haiku? outro modelo? inline?) — sistema propõe, você aprova. Com OK, cai no tier barato do **mesmo CLI** (Claude→Haiku, Codex→gpt-5.4-mini, Gemini→Flash), sempre por **assinatura, nunca API**. |
| **Curadoria human-in-the-loop** | `curate` separa o worklog em baldes e mostra o texto literal das cinzas para decisão humana. |
| **Stale-process gate** | `stale-check` falha se o processo ou servidor rodando ficou velho em relação à fonte. |
| **Economia de turnos** | Regra dura contra o gasto que mais dói na prática: reingestão de contexto por turno. |
| **Cold start auto-suficiente** | Regra global de session-start e injeção de entrypoint compacto no sub frio. |
| **Harvest de transcripts → memory do core** | O core 0.2.0 trouxe `memory` nativo, mas não colhe conhecimento dos transcripts de sessão. `memory harvest` lê os transcripts do Claude Code, extrai turnos com sinal durável (correção, decisão, fix), redige dados pessoais e **alimenta o `orquestrador-maestro memory record`** do core. Human-in-the-loop, sem LLM/API. |

Conferido contra o núcleo **0.2.4**: `rules.md`, `hooks.md`, `maestro.md` e `PERSISTENCE.md` não têm nenhuma ocorrência de tier barato, subagent, stale/fingerprint, anti-poll ou read-once/batch.

> **`stale-check` vs `workflow-state` do núcleo (0.1.21+).** O núcleo passou a trazer `workflow-lock`/`workflow-state` (digest SHA-256 de artefato, drift bloqueia ops). Escopos **diferentes e complementares**: `workflow-state` guarda o digest de um artefato/lock; `stale-check` do combo compara um **processo ou servidor rodando** (que carregou a fonte em memória, ex.: MCP server) contra a fonte em disco. Enquanto o núcleo não cobrir o processo-em-RAM, `stale-check` fica.

### Peças aposentadas

O combo se autoaposenta por partes, conforme o núcleo absorve:

| Peça | Substituto no núcleo | Desde |
|---|---|---|
| `budget` | `orquestrador-maestro context brief --project-path <abs> --max-chars N` | 0.1.14 / 0.1.18 |
| skeletons de `DEV/` do `init-entrypoint` | `orquestrador-maestro init-dev` (o `init-entrypoint` agora delega a ele) | 0.1.18 |
| ordem de leitura no session-start | `~/.orquestrador/PERSISTENCE.md` | Unreleased 2026-07-28 |
| store/recall/lint próprios do `memory` (BM25, edges) | `orquestrador-maestro memory record\|search\|promote` (nativo, per-repo) | 0.2.0 |

`combo-maestro budget` continua existindo só para falhar alto e apontar o substituto, em vez de quebrar hooks antigos em silêncio.

Princípio comum: **regras boas não podem depender de você lembrar**.

## Requisitos

- **Orquestrador Maestro instalado** (testado contra o núcleo **0.2.4**)
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

Não publicado no registro npm — instala direto do GitHub (link local, sem registro).

```bash
git clone https://github.com/brunoherrman/combo-maestro.git
cd combo-maestro
npm link
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

combo-maestro memory harvest  [--project-path PATH] [--last N] [--transcripts DIR] [--pick 1,3] [--apply]

combo-maestro log             [--lines N]
```

## Memory harvest (bridge para o memory nativo do core)

O núcleo **0.2.4** trouxe `memory` nativo (`orquestrador-maestro memory record|search|show|timeline|promote|stats`), per-repositório e git-integrado. **O combo não duplica isso** — a camada de store/recall/lint própria (BM25, edges) foi **aposentada** para não criar fonte dupla de verdade.

O que o memory do core **não** faz é colher conhecimento dos **transcripts de sessão**. É só isso que o combo mantém:

```bash
combo-maestro memory harvest --project-path . --last 5
```

- **Fonte**: transcripts do Claude Code (`~/.claude/projects/<slug>/*.jsonl`), **read-only**.
- **Extração**: turnos do usuário com SINAL de conhecimento durável (correção, decisão, fix confirmado, risco) por heurística lexical. Ruidoso de propósito.
- **Bridge**: com `--apply` (ou `--pick 1,3`), cada candidata aprovada vira uma observação no core via `orquestrador-maestro memory record --type <decision|discovery|implementation|risk>`. Sem `--apply`, só propõe.
- **Human-in-the-loop**: você revisa o TEXTO LITERAL antes de gravar. Nunca grava sozinho.
- **Privacidade**: `redactSnippet` mascara home/username em paths e tokens (`sk-`/`xai-`/`ghp_`/`AKIA`/hex longo) **antes** de propor.
- **Aditivo**: subcomando novo, sem LLM/API, sem daemon. Não injeta linha de hooks (zero orçamento). Não toca no `~/.orquestrador` além de chamar o `memory record` do core.

`memory index|push|recall|link|lint` foram aposentados e apontam para o memory nativo do core. Depois de colher, consulte com `orquestrador-maestro memory search --project . --unverified`.

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

Passando nos dois, o agente **não delega sozinho** — ele **pergunta ao maestro** (`delegar ao Haiku? outro modelo? faço inline?`) e espera o OK. Sistema propõe, você aprova; pode trocar o modelo na hora. Braçal pequeno fica inline sem perguntar.

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
- hooks de curadoria, stale e memory harvest → bloco marcado em `hooks.md`
- profile do braçal → `[profiles.bracal]` marcado no `~/.codex/config.toml`
- memory harvest → alimenta o `orquestrador-maestro memory record` nativo (core 0.2.0+)

## AionUI e times multi-agente

O combo é agnóstico de UI: ele injeta regras no `~/.orquestrador`, que é a fonte de verdade que o [AionUI](https://www.aionui.com) e qualquer cowork/TEAM coordena por cima. As peças do combo valem para o time inteiro, não só para uma sessão:

- **Delegação de braçal** vira política de composição do time: Leader no tier caro, Teammates no tier barato do próprio vendor, sempre por assinatura (a regra de `rules.md` já diz isso a qualquer agente que leia o contrato).
- **Cold start** (`init-entrypoint`/entrypoint compacto) evita que cada teammate frio reingira o `DEV/` inteiro.
- **memory harvest** colhe conhecimento durável dos transcripts e joga no memory do core — memória compartilhada entre os agentes do time.

> Regra de ouro (herdada da skill `aionui-cowork-orchestration`): o AionUI **coordena**, o `~/.orquestrador` **manda**. O combo nunca reescreve config de agente; só injeta entre marcadores.

## Ideias / roadmap

Peças em avaliação (nada implementado ainda — abrir spec em `DEV/SPECS/` antes):

- **Indicador de quota (25/50/75/90%)**: um ledger dep-free em `~/.orquestrador/quota.json` que conta uso por provider (claude/codex/gemini/grok), lido tanto por um statusline do Claude Code quanto pelos agentes do TEAM do AionUI, alertando nos limiares. Fonte pragmática: contagem de tokens dos próprios transcripts (o harvest já os lê).
- **Cross-agent harvest**: estender o harvest além do Claude Code para transcripts de Codex/Gemini/AionUI, unificando a síntese cross-sessão no memory do core.

## Descontinuação

Quando o Orquestrador Maestro absorver essas peças nativamente:

```bash
combo-maestro uninstall
npm unlink -g @brunoherrman/combo-maestro
```

## Créditos

- **Orquestrador Maestro** — Fernando Bolzan
- **combo-maestro** — Bruno Herrman

## Licença

MIT
