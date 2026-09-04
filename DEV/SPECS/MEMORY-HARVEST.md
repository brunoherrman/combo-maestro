# Proposal Spec - memory harvest (cross-session synthesis)

> Estado: PROPOSTA. Nao iniciada. Decidir antes de codar. Nao e a spec ativa
> (`ACTIVE.md` = camada memory, ja implementada). Este arquivo existe para o
> maestro aprovar/recusar o escopo.

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

## Acceptance (quando/se aprovada)

- [ ] harvest le transcript real e propoe candidatas com texto literal, sem gravar.
- [ ] `--apply`/`--pick` grava paginas e reindexao; sem eles, nada escrito.
- [ ] dedup: candidata ja existente no store nao e reproposta.
- [ ] formato de transcript desconhecido -> aborta com mensagem clara, exit != 0.
- [ ] nenhuma pagina gravada contem transcript inteiro; so o trecho-sinal.
- [ ] escopo respeita `--project-path`; nao cruza projetos.
- [ ] `npm test` cobre extracao de sinais (fixture de transcript), dedup e degradacao.

## Decisoes pendentes do maestro

1. Vale o ruido do harvest lexical, ou `push` manual do WORKLOG basta?
2. Quais sinais entram no v1 (lista acima e um ponto de partida)?
3. `--last N` default (ex.: 5 sessoes) e teto de tamanho de scan.

## Status

- State: proposta, aguardando decisao do maestro
- Owner: Bruno Herrman
- Last updated: 2026-09-03
