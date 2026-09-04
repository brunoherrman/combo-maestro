# WORKLOG

## 2026-09-03 - memory harvest v1 (cross-session synthesis, lexical)

- Spec: implementar `memory harvest` (decisao do maestro: construir com defaults, aditivo, sem atrapalhar o orquestrador)
- Changed: `cmdHarvest` em `src/memory.js` — le os ultimos N transcripts `.jsonl` do Claude Code (`~/.claude/projects/<slug>/`, slug = abspath com [:\/ espaco]->-), extrai turnos do USUARIO com sinal (correcao/decisao/fix, regex PT+EN), filtra conteudo injetado `<...>`/slash-commands/acks curtos, dedup por texto normalizado e por id ja existente, propose-only (--apply/--pick grava). Flags novas --last/--transcripts no bin; help/README/roteador atualizados
- Changed: `redactSnippet` mascara home/username em path (C:\Users\x, /home/x, /Users/x, os.homedir) e tokens (sk-/xai-/ghp_/gho_/AKIA/hex>=32) ANTES de propor, no snippet E no id. Guard de privacidade exigido pela natureza do transcript
- Verified: `npm test` 17/17 (2 casos novos: harvest propoe sinal + filtra ruido + redige + dir ausente exit 2; redactSnippet unit); smoke nos transcripts reais deste projeto confirmou extracao e mascaramento do path pessoal vazado
- Aditivo confirmado: harvest NAO injeta linha de hooks (comando on-demand) -> zero impacto no orcamento de 80 linhas e zero toque no orquestrador
- Risks: lexical = ruidoso por design (o smoke real mostrou candidatas-ruido); mitigacao e propose-only + revisao humana + redacao. Afinar sinais se incomodar
- Next context: opcional wire de auto-propor no session-end (custaria 1 linha de hooks); publicar 0.11.0 quando o maestro quiser

## 2026-09-03 - memory lint + proposta harvest (gaps do ai-memory)

- Spec: cobrir 2 gaps do ai-memory apontados na auditoria: (2) edge lint de store, (1) cross-session synthesis
- Changed: `memory lint` em `src/memory.js` — varre o store, acha edge quebrado (alvo inexistente), edge invalido, id duplicado, `type` fora do enum, e lista `contradicts` pendentes; exit 1 em erro (serve de gate). Roteado no bin; help e README atualizados
- Changed: nova `SPECS/MEMORY-HARVEST.md` (PROPOSTA, nao iniciada) para `memory harvest` — deriva candidatas de memoria dos transcripts de sessao (`~/.claude/projects/<slug>/*.jsonl`) por sinais heuristicos lexicais, human-in-the-loop forte, sem LLM/API. Documenta a tensao (sem modelo, synthesis fica raso/ruidoso) e riscos (privacidade/LGPD, formato instavel, ruido)
- Verified: `npm test` 15/15 (novo caso: lint clean exit 0, lint com edge quebrado + invalido exit 1); smoke manual de lint em store limpo e corrompido
- Gaps deixados de fora com justificativa: embeddings/hybrid search e `serve` MCP daemon (contradizem opcao A / sem daemon); export-okf conformante (so se interop futura); eval harness (escala pessoal nao justifica)
- Risks: harvest so aprovado como proposta; se implementado, ruido lexical e privacidade de transcript sao os pontos criticos
- Next context: decisao do maestro sobre harvest (3 perguntas no fim do MEMORY-HARVEST.md); publicar 0.11.0 quando quiser

## 2026-09-04 - core 0.2.0 + pivot da memory pra bridge

- Spec: atualizar o nucleo pra 0.2.0 e casar o combo (pedido do maestro)
- Nucleo: `npm uninstall` + `install @latest` (0.1.27 -> 0.2.0); reinstall regenerou contratos e apagou COMBO; reinjetado e verificado (hooks 76/80, ambos verify passam)
- Achado GRANDE: 0.2.0 trouxe `memory` NATIVO (record/search/show/timeline/promote/stats/status/cleanup), per-repo git-integrado, store em `~/.orquestrador/memory/repositories/<id>/observations.jsonl` (mesmo dir que a camada FTS do combo usava). Tipos validos: decision/discovery/implementation/risk
- Decisao do maestro: BRIDGE. Aposentei a mecanica duplicada do combo (index/push/recall/link/lint + store/INDEX proprio) — apontam pro memory nativo com exit 2. Mantive so `memory harvest`, refatorado pra ALIMENTAR o `orquestrador-maestro memory record` (colheita de transcripts que o core nao faz)
- Changed: `src/memory.js` reescrito bridge-only (harvest + redactSnippet + classifyHarvest->tipos do core + spawn do `memory record`); bin usage/help/flags enxugados; hooks template Memory subsection vira ponteiro pro core; README (secao, tabela "Por que existe", "Pecas aposentadas", comandos); package 0.11.0 -> 0.12.0
- Verified: `npm test` 12/12 (harvest propoe/filtra/redige, subcomandos aposentados exit 2, redact, classify->tipos validos); smoke real: harvest --apply gravou observacao no core (confirmado via `memory search`, depois limpei os probes/smoke do observations.jsonl)
- Risks: harvest lexical segue ruidoso (mitigacao propose-only + revisao + redacao); classify mapeia 4 tipos do core, pode precisar ajuste
- Next context: commit + push; avaliar aposentar mais pesas se 0.2.x cobrir (stale-check vs workflow-state segue de pe)

## 2026-09-03 - camada memory FTS implementada (etapa a)

- Spec: `SPECS/ACTIVE.md` (camada memory FTS-only, store global, index/push/recall/link)
- Changed: novo `src/memory.js` (BM25 puro, zero dep): tokenizer PT+EN com stopwords, parser/serializer de frontmatter OKF-like, indice invertido em `~/.orquestrador/memory/INDEX.json`, recall bounded (top-N + char-cap, filtros project/type/as-of), edges tipados (causes/fixes/contradicts), push human-in-the-loop reusando `parseEntries`/`classify` do curate (balde CINZA -> paginas; so grava com --apply/--pick)
- Changed: `src/curate.js` exporta `parseEntries`/`classify`; `bin/combo-maestro.js` roteia `memory <sub>` e ganhou flags --as-of/--top/--max-chars/--type/--project/--pick/--query; help e usage atualizados
- Changed: subsecao Memory no template de hooks + reinjetada (77/80 linhas); README com secao "Camada de memoria" e travas (DEV/ manda, recall bounded, namespace por projeto, degrada vazio); package 0.10.0 -> 0.11.0
- Verified: `npm test` 14/14 (6 casos novos: push propoe/aplica, recall BM25+char-cap+isolamento, as-of, degradacao sem store, link+edge invalido, unit de tokenize/slug/frontmatter); smoke manual index/push/recall/link/as-of/type/isolation em scratch; `combo-maestro verify` + `orquestrador-maestro verify` passam
- Risks: sem embeddings (opcao A) -> recall so lexical; store global exige disciplina de --project no recall; hooks com 3 linhas de folga
- Next context: etapa c (revisao do maestro do design/nomes); decidir publicar 0.11.0 no npm; avaliar `memory push` interativo por-item no futuro

## 2026-09-03 - limpeza pre-memory e spec da camada de memoria

- Spec: aprovada nova `SPECS/ACTIVE.md` para a camada `memory` (FTS-only, store global, comandos index/push/recall/link); decisao do maestro: opcao A (so FTS), store global com recall limitado, spec-first
- Auditoria: nucleo npm em 0.1.27, instalado local 0.1.24, docs miravam 0.1.19; `workflow-lock`/`workflow-state` (0.1.21+) sobrepoe parcialmente `stale-check` (escopo processo-em-RAM ainda nao coberto -> mantido)
- Changed (hooks): removida a subsecao morta "Budget" do template e do `hooks.md` instalado (bullet 1 duplicava PERSISTENCE/core; bullet util "oferecer curadoria" dobrado na secao Curadoria). hooks.md 75 -> 71 linhas, 9 de folga para a linha de session-start recall da camada memory
- Changed (docs): README e CONTEXT bumpados 0.1.19 -> 0.1.27; nota da fronteira `stale-check` vs `workflow-state`; risco do bug de `--project-path` relativo encerrado (corrigido no nucleo 0.1.20)
- Verified: `combo-maestro verify` passou; `orquestrador-maestro verify` passou; hooks 71/80; `npm test` 8/8
- Risks: linha de session-start recall ainda NAO injetada (comando `memory recall` nao existe ate a etapa a); `curate`/`stale-check` seguem sem cobertura dedicada
- Next context: implementar a camada `memory` conforme o spec; depois rodar `combo-maestro install` para reinjetar e revalidar 80 linhas

## 2026-08-08 - núcleo 0.1.19 e migração do DEV para o schema canônico

- Spec: atualizar o núcleo (0.1.12 -> 0.1.19, agora publicado no npm, confirmado pelo Bolzan) e reavaliar a sobreposição do combo
- Núcleo: `npm update -g` + `orquestrador-maestro update`; ganhos 0.1.13 (esteira defensiva Gitleaks/Semgrep/OSV/Trivy), 0.1.14 e 0.1.18 (briefing de contexto econômico, agora com fase/próxima ação/riscos), 0.1.15 (8 skills de API; AbacatePay v2 padrão), 0.1.16/0.1.17 (descoberta de skills no OpenCode; prefixo npm estável no Windows), 0.1.18 (perfil `phase-loop`, `WORKFLOW_SCHEMAS.json`, gate dedicado de DEV), 0.1.19 (correções de `doctor` e dos wrappers PowerShell do `check-dev-gates`)
- Achado: o gate estrito do 0.1.18 exige headings canônicos em inglês; o `DEV/` do combo falhava com 31 erros e faltava `DEV/README.md`
- Achado: `context brief` (`--task`, `--max-chars`, `--json`) cobre o que o `budget` do combo fazia, e melhor — mede, prioriza e resume o estado de `DEV/` dentro de um orçamento
- Achado: `init-entrypoint` gera o schema antigo em português e agora produz projetos que FALHAM o gate do núcleo; o `init-dev` do núcleo cria 11 arquivos contra os 4 do combo
- Achado (bug do núcleo): `check-dev-gates --project-path` relativo resolve contra o diretório de instalação da CLI (`...\node_modules\@iapro\orquestrador-maestro-cli\<path>\DEV`). Reproduzido com `.` e com nome relativo; só absoluto funciona
- Changed: `DEV/` migrado para o schema canônico (`README.md` criado; `HANDOFF`, `CONTEXT`, `VERIFY` e `SPECS/ACTIVE` com os headings exigidos)
- Verified: `orquestrador-maestro verify` passou (43 skills por cliente); `doctor` com `IssueCount: 0` e zero `Healthy: false`; hooks 76/80; `combo-maestro verify` passou; `npm test` 6/6
- Risks: `init-entrypoint` e `budget` viraram dívida; grep nos contratos do 0.1.19 confirma ZERO cobertura de cheap-tier, stale, anti-poll e read-once/batch, então o núcleo do combo segue justificado
- Next context: decidir aposentar ou realinhar `init-entrypoint` e `budget`; reportar o bug de caminho relativo ao Bolzan

## 2026-08-09 - aposentadoria parcial e correcao de injecao de shell

- Spec: aplicar as decisoes do maestro sobre `init-entrypoint` e `budget` diante da absorcao pelo nucleo 0.1.19
- Changed: `init-entrypoint` passou a delegar a hierarquia `DEV/` ao `orquestrador-maestro init-dev` e so acrescenta o ponteiro ENTRYPOINT no `AGENTS.md`; os 4 skeletons proprios foram removidos
- Changed: `budget` aposentado. `src/budget.js` removido; `src/budget-retired.js` falha com exit 2 apontando `context brief`, para nao quebrar hooks antigos em silencio
- Changed: `ENTRY_FILES` do entrypoint alinhado a ordem canonica do `PERSISTENCE.md` (INDEX -> HANDOFF -> CONTEXT -> SPECS/ACTIVE); bloco de hooks e README atualizados; versao 0.9.2 -> 0.10.0
- Security: `delegate` e `init-entrypoint` passavam array de args com `shell:true`, que o Node concatena sem escapar (DEP0190). Um path ou texto de tarefa com `&` viraria segundo comando no cmd.exe. Agora vao como uma linha unica pre-quotada via `shellCommandLine`
- Verified: `npm test` 8/8 exit 0 (3 testes novos: init-entrypoint delegando, budget aposentado, quoting de shell); `init-entrypoint` end-to-end gera projeto que passa no `check-dev-gates`; `combo-maestro verify` passou; DeprecationWarning do Node sumiu
- Risks: `shellQuote` cobre cmd.exe e sh POSIX; PowerShell como shell padrao nao foi testado. `curate` e `stale-check` seguem sem cobertura dedicada
- Next context: reportar ao Bolzan o bug de `--project-path` relativo no 0.1.19; avaliar publicar 0.10.0

## 2026-07-28 - núcleo 0.1.12 e gate de tamanho de hooks

- Spec: atualizar o núcleo (instalação estava em 0.1.2; npm já servia 0.1.12) e adaptar o combo
- Núcleo: `npm update -g` (0.1.2 -> 0.1.12) + `orquestrador-maestro update`; ganhos 0.1.3/0.1.10/0.1.11/0.1.12 (Grok, LGPD, optimize-images, hardening de bootstrap, backup sem dados pessoais, `/maestro` no Cursor)
- Achado: o núcleo 0.1.12 passou a recusar `hooks.md` acima de 80 linhas; com o bloco COMBO o arquivo ia a 84 e `orquestrador-maestro verify` falhava
- Changed: `templates/bracal-curation.hooks.md` comprimido 30 -> 22 linhas (substância mantida); guard `checkHooksBudget` em `lib.js` usado por `install.js` (aviso) e `verify.js` (falha); 2 testes novos; help do bin 0.1.2 -> 0.1.12; README com seção de compatibilidade; versão 0.9.0 -> 0.9.1
- Verified: `orquestrador-maestro verify` passou; `doctor` com `IssueCount: 0` e hooks 76/80 `Healthy`; `combo-maestro verify` passou; `npm test` 6/6
- Risks: margem de hooks é de 4 linhas; releases futuros do núcleo podem crescer `hooks.md` e estourar o limite sozinhos.

## 2026-07-28 - núcleo no Unreleased e alinhamento com PERSISTENCE.md

- Spec: aplicar o bloco `Unreleased` (2026-07-28), que só existe em GitHub main, e adaptar o combo ao contrato `PERSISTENCE.md`
- Núcleo: clone `8910530` (`git clone -c core.longpaths=true` resolveu o estouro de path dos schemas ooxml; não precisou de `-SkipCommunitySkills`) + `scripts/install.ps1 -InstallToolProfiles -Force` (rodado pelo usuário; o classificador de permissões bloqueia `-Force`)
- Achado: os verificadores do main exigem `orquestrador/PERSISTENCE.md` presente E citado em cada entrypoint, então `-InstallToolProfiles` deixou de ser opcional
- Achado: `~/.claude/CLAUDE.md` era o template padrão sem customização e o novo é superset (adiciona `PERSISTENCE.md` + regra de reidratação), então a sobrescrita não custou nada — conferido antes de rodar
- Changed: bloco de session-start em `templates/bracal-delegation.rules.md` passou a delegar a ORDEM de leitura ao `PERSISTENCE.md` (evita fonte dupla de verdade) e manter só o gatilho automático, read-once, "não pergunte" e a exceção destrutiva; fallback preservado quando `PERSISTENCE.md` não existe; README com seção nova; versão 0.9.1 -> 0.9.2
- Verified: `scripts/verify-install.ps1` do main passou; `doctor` com `IssueCount: 0` e zero `Healthy: false`; hooks 76/80; `PERSISTENCE.md` citado em claude/codex/cursor/gemini/AGENTS global; skill `improve-codebase-architecture` instalada em `skill-library/community-skills/`; `combo-maestro verify` passou; `npm test` 6/6
- Risks: margem de hooks segue 4 linhas (estimativa anterior de 8 estava errada; a base do main dá o mesmo total instalado). RFC 0002 (`ai-memory`) ainda é proposta — nada a fazer no combo.

## 2026-07-16 - adaptação ao Orquestrador 0.1.3 (Grok)

- Spec: atualizar núcleo Orquestrador para 0.1.3 (via GitHub, não publicado no npm) e adaptar combo
- Núcleo: instalado 0.1.3 do GitHub main (installer + `install-grok-orquestrador.ps1`); backup criado pelo installer; skills novas `skill-lgpd-brasil` e `skill-optimize-images`; Grok CLI integrado (`~/.grok/config.toml`)
- Changed: broker `grok` (in-session, tier `grok-code-fast-1`) em `delegate.js`; detecção `GROK_HOME`/`XAI_API_KEY`; linha Grok no template de delegação, README e help do bin; versão 0.8.0 -> 0.9.0
- Blocos COMBO reinjetados em `rules.md`/`hooks.md` (estavam ausentes após reinstalação do núcleo)
- Verified: `npm test` (EXIT=0); `delegate --cli grok` redireciona in-session; `combo-maestro verify` passou; Grok presente no `rules.md` instalado
- Risks: Grok CLI é sempre metrado por API xAI — mantido in-session por design; msg genérica de redirect diz "assinatura" (corrigido no texto `how` específico)

## 2026-07-01 - revisão de contrato e cobertura

- Spec: corrigir problemas encontrados na revisão anterior
- Changed: README reescrito; `init-entrypoint` completado com `HANDOFF` e `VERIFY`; testes de CLI adicionados; help atualizado
- Verified: `npm test`
- Risks: `curate`, `budget` e `stale-check` ainda têm cobertura indireta, não dedicada
- Next context: acompanhar releases do núcleo e reinjetar os blocos COMBO após cada atualização
