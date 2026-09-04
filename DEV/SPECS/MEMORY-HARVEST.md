# Spec - memory harvest (cross-session synthesis)

> Estado: IMPLEMENTADO v1 (2026-09-03). Decisoes do maestro: construir com
> defaults (sinais correcao/decisao/fix/repeticao; `--last 5`; propose-only).
> Aditivo puro: subcomando novo da CLI, read-only sobre transcripts, nao injeta
> hooks (nao gasta o orcamento de 80 linhas), nao toca no orquestrador.

## Goal

Replicar a "cross-session synthesis" do ai-memory: derivar paginas de memoria
candidatas automaticamente a partir das trajetorias de sessao recentes, em vez de
so promover do WORKLOG manualmente (`memory push`). O objetivo e capturar o
conhecimento duravel que nunca chega ao WORKLOG (correcoes do usuario, decisoes
ditas no chat, fixes confirmados, preferencias repetidas).

## Tensao honesta (ler antes de aprovar)

O ai-memory faz synthesis com embeddings/modelo para achar padroes. O combo,
por decisao (opcao A: sem modelo, sem API), so consegue **extracao heuristica
lexical** — sinais textuais, nao semantica. Portanto o harvest do combo sera
mais ruidoso e mais raso que o do ai-memory. O contrapeso obrigatorio e o mesmo
do `push`: **human-in-the-loop forte** — o sistema so propoe, o humano aprova o
texto literal. Nunca auto-grava.

## Fonte

- Transcripts do Claude Code: `~/.claude/projects/<project-slug>/*.jsonl`.
- Escopo per-projeto (namespace), coerente com o resto da camada memory.
- Alternativa/futuro: logs de outros CLIs (Codex/Gemini) se tiverem formato estavel.

## In Scope (proposto)

- `combo-maestro memory harvest --project-path <abs> [--last N] [--since DATE] [--apply] [--pick id1,id2]`
  - Le as ultimas N sessoes (ou desde DATE) do transcript do projeto.
  - Extrai candidatas por SINAIS heuristicos (lexical, deterministico):
    - correcao/feedback do usuario ("na verdade", "nao", "errado", "lembre", "remember", "sempre", "nunca");
    - decisao ("vamos de", "decidimos", "escolhi", "aposentar");
    - fix confirmado (mensagem de fix + verificacao verde no mesmo trecho);
    - repeticao (mesmo fato/comando aparecendo em >=2 sessoes).
  - Dedup contra o store existente (nao propor o que ja e pagina).
  - Mostra o TEXTO LITERAL de cada candidata (como o balde CINZA do `curate`).
  - So grava paginas com `--apply`/`--pick`. Sem isso, so propoe.
- Reusa `serializePage`/`slugify`/`buildIndex` da camada memory.

## Out Of Scope

- Extracao por LLM/embeddings (exigiria modelo/API — contradiz a opcao A).
- Auto-grava sem aprovacao humana.
- Ler transcripts de outro projeto/cliente sem `--project-path` explicito.
- Sync ou upload de transcript para qualquer lugar.

## Riscos

- **Privacidade/LGPD**: transcript carrega tudo (segredos, PII, dados de cliente).
  Harvest so pode emitir snippets curtos na proposta, nunca colar transcript
  inteiro; nunca sair da maquina; humano revisa antes de virar pagina.
- **Formato instavel**: o schema `.jsonl` do Claude Code pode mudar entre versoes.
  Parser tem que degradar gracioso (formato desconhecido -> aborta limpo, nao quebra).
- **Ruido**: heuristica lexical gera falso-positivo. Mitiga com human-in-the-loop
  e com `--pick`.
- **Custo de token**: o scan roda na CLI, nunca injeta transcript no modelo. So a
  proposta curta chega ao humano.

## Acceptance

- [x] harvest le transcript real e propoe candidatas com texto literal, sem gravar.
- [x] `--apply`/`--pick` grava paginas e reindexao; sem eles, nada escrito.
- [x] dedup: candidata ja existente no store (mesmo id) nao e reproposta.
- [x] formato desconhecido/linha invalida -> pula linha; dir ausente -> exit 2 com mensagem.
- [x] pagina gravada guarda so o snippet (<=200 chars), nunca o transcript inteiro.
- [x] escopo respeita `--project-path`/`--transcripts`; slug per-projeto.
- [x] REDACAO: home/username em path e tokens (sk-/xai-/ghp_/AKIA/hex longo) mascarados antes de propor (no snippet E no id).
- [x] filtra conteudo injetado (`<...>`), slash-commands e acks curtos (<4 palavras).
- [x] `npm test` cobre extracao de sinal, filtro de ruido, redacao e dir ausente (17/17).

## Decisoes pendentes do maestro

1. Vale o ruido do harvest lexical, ou `push` manual do WORKLOG basta?
2. Quais sinais entram no v1 (lista acima e um ponto de partida)?
3. `--last N` default (ex.: 5 sessoes) e teto de tamanho de scan.

## Status

- State: implementado v1, verde (17/17). Aberto: afinar sinais se o ruido incomodar; wire opcional de auto-propor no session-end (custaria linha de hooks, decisao futura).
- Owner: Bruno Herrman
- Last updated: 2026-09-03
