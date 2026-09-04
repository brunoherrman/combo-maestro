# Active Spec - combo-maestro memory (bridge para o core 0.2.0)

> **PIVOT 2026-09-04**: o core **0.2.0** trouxe `memory` NATIVO (record/search/show/
> timeline/promote/stats/cleanup, per-repo, git-integrado). A camada FTS propria do
> combo (index/push/recall/link/lint, store `~/.orquestrador/memory/`) foi **aposentada**
> para nao duplicar o core. Sobra so o que o core NAO faz: `memory harvest` (colheita de
> transcripts) — refatorado para ALIMENTAR o `orquestrador-maestro memory record` em vez
> de um store proprio. Decisao do maestro: **bridge**. O texto abaixo e o historico da
> camada FTS original (contexto), nao o estado atual.

## Goal

Adicionar ao combo-maestro uma camada de memoria cross-projeto nativa (Node puro, zero
dependencia externa, zero processo daemon, zero API cobrada) que replica as partes de baixo
custo do ai-memory (akitaonrails v2.0.0): paginas OKF-like em disco, busca full-text (FTS
BM25), edges tipados (`causes`/`fixes`/`contradicts`), filtro temporal (`as_of`) e sintese
human-in-the-loop reusando a logica do `curate`. Objetivo: dar recall cross-projeto que o
`DEV/` (per-projeto) nao entrega, sem sair do controle do maestro e sem quebrar o casamento
com o Orquestrador.

Decisao de escopo do maestro (2026-09-03): **so FTS agora** (opcao A), embeddings ficam de
fora; **store global** com recall limitado; **spec primeiro**, codigo numa rodada seguinte.

## In Scope

- Store global em `~/.orquestrador/memory/`: uma pagina `<slug>.md` por fato, frontmatter
  OKF-like (`id`, `type`, `project`, `created`, `links`, `tags`).
- Indice em `~/.orquestrador/memory/INDEX.json`: indice invertido FTS (BM25) + grafo de edges.
  Vive em disco; a CLI le, o modelo nao.
- Comandos novos:
  - `combo-maestro memory index` — rebuild do INDEX.json a partir das paginas.
  - `combo-maestro memory push --project-path <abs>` — deriva paginas candidatas do balde
    CINZA do WORKLOG + outcomes do VERIFY; HUMANO aprova cada uma (reusa split do `curate`).
  - `combo-maestro memory recall "<q>" [--as-of DATE] [--project P] [--type T] [--top N] [--max-chars C]`
    — BM25 top-N char-capped, escopo default = projeto atual + paginas tag global.
  - `combo-maestro memory link <id-a> <causes|fixes|contradicts> <id-b>`.
- Trava de custo de token: recall SEMPRE top-N (default 5) + char-cap (default 1200). Nunca
  emite o store inteiro. Session-start faz no maximo 1 recall (read-once).
- Namespace por projeto (`project:` no frontmatter) para isolamento LGPD no recall.
- Bloco COMBO no `hooks.md`: 1 linha de session-start recall, cabendo no orcamento de 80
  linhas APOS cortar a subsecao "Budget" morta (aponta comando aposentado).
- Degradacao graciosa: sem store/indice, `recall` retorna vazio silencioso e a sessao segue
  (mesmo padrao de ausencia do PERSISTENCE.md).

## Out Of Scope

- Embeddings / busca semantica (opcao B) — flag futura, so se o FTS provar insuficiente.
- Rodar ou depender do binario ai-memory (Rust) ou de qualquer daemon.
- Qualquer chamada de API cobrada.
- Write-back de `memory/` para `DEV/`: `DEV/` continua fonte de verdade, `memory/` e derivado.
- Sincronizar store entre maquinas (git do proprio store fica a criterio do usuario).

## Acceptance

- [x] `combo-maestro memory index` gera INDEX.json valido a partir de paginas de exemplo.
- [x] `recall` retorna top-N ranqueado, respeita `--max-chars`, `--project`, `--type`, `--as-of`.
- [x] `recall` sem store instalado retorna vazio sem erro.
- [x] `push` nunca escreve pagina sem aprovacao humana; cinzas do WORKLOG jamais tocadas sozinhas.
- [x] `link` grava edge tipado valido e o `index` o reflete no grafo.
- [x] escopo default do recall nao vaza paginas de outro `project:` sem `--project` explicito.
- [x] bloco COMBO reinjetado; `hooks.md` <= 80 linhas (Budget morto cortado antes; 77/80).
- [x] `combo-maestro verify` e `orquestrador-maestro verify` passam.
- [x] `npm test` cobre index/recall/push/link (novos casos) e segue verde (14/14).

## Verification Plan

- `npm test` com casos novos: tokenizacao BM25, ranking top-N, char-cap, filtro por project/type/as_of,
  degradacao sem store, aprovacao humana no push (mock stdin), gravacao de edge.
- `combo-maestro memory index && combo-maestro memory recall "<q>" --max-chars 400` manual, medir
  tamanho do output (prova da trava de token).
- `combo-maestro verify` + `orquestrador-maestro verify` para os blocos e o orcamento de 80 linhas.
- `orquestrador-maestro check-dev-gates --project-path <abs> --strict` para o `DEV/`.

## Constraints

- Node >= 18, zero dependencia externa (combo e CLI pura).
- `hooks.md` tem ~5 linhas de folga hoje; a linha de recall so entra apos cortar "Budget".
- Reinstalar o nucleo apaga os blocos COMBO; reinjecao obrigatoria.
- Store global exige escopo por projeto no recall para nao vazar contexto entre clientes.
- Recall e sempre bounded (top-N + char-cap): custo de token fixo, independente do tamanho do store.

## Review (etapa c) - decisoes do maestro

- push por-item interativo (stdin): fora por ora; `--pick` cobre o controle fino. Reavaliar so se incomodar.
- `type` inference (fix/decision/fact): heuristica crua aceita; a pagina e editavel a mao.
- embeddings (opcao B): fora do codigo; fica como flag futura `--semantic` se o recall lexical faltar.
- Publicar 0.11.0 no npm: NAO agora (segue link global local).
- Semear o store real: NAO agora (`~/.orquestrador/memory/` fica vazio ate decisao de promocao).

## Status

- State: FTS aposentada; substituida por `memory harvest` bridge -> core 0.2.0 memory. Verde (12/12). combo 0.12.0.
- Owner: Bruno Herrman
- Last updated: 2026-09-04
