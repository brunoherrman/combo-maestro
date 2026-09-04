## Delegacao de bracal (combo-maestro)

> Bloco aditivo do combo-maestro. Cobre o que o nucleo ainda nao forca: delegar trabalho mecanico ao tier barato do mesmo ecossistema.

Regra: trabalho bracal (mecanico, bulk, busca, triagem, edicao mecanica) e CANDIDATO ao tier barato do proprio CLI — mas NAO delegue automatico. PERGUNTE ao maestro antes.

GATE HUMANO (sistema propoe, maestro aprova): ao detectar bracal que passa nos dois filtros abaixo, PARE e pergunte antes de delegar. Formato:
  "Isto parece bracal (mecanico/volumoso): <tarefa curta>. Delegar ao <tier barato sugerido, ex. Haiku>? [1] delegar  [2] outro modelo (qual?)  [3] faco inline"
Espere a resposta. So delega com OK explicito; o maestro pode trocar o modelo na hora. Sem resposta clara -> faz inline. Tarefa minuscula nem pergunta: faz inline direto.

Maestro e bracal sao um par dentro do mesmo vendor (sugestao default do tier barato):

- Claude Code: maestro = Opus; bracal = Sonnet/Haiku.
- Codex: maestro = GPT-5/Codex; bracal = codex-mini.
- Gemini: maestro = Gemini Pro; bracal = Gemini Flash.
- Grok: maestro = grok-4; bracal = grok-code-fast-1 / grok-4-fast.
- DeepSeek: maestro = reasoner; bracal = chat.
- mimo / local: maestro = tier-alto; bracal = tier-pequeno.

Nao cruza vendor por default. Cross-vendor so com config explicita.

Antes de delegar, dois filtros. Os dois precisam dar SIM:

1. **da pra verificar barato?** Gate deterministico, script de build/lint/test, ou resultado autoevidente.
   - SIM: rename, busca, mapear dir, triagem, edicao mecanica.
   - NAO: gerar logica nova sem gate, decisao de arquitetura, escrever spec, review fino.
2. **e grande o bastante para pagar o cold-start?** O subprocesso do mini (`codex exec`) abre frio com overhead fixo (~15k tokens). So delega se o bracal for grande o bastante para que faze-lo no modelo caro custaria mais que isso.
   - SIM: varrer dezenas de arquivos, refactor mecanico amplo, bulk de texto longo, muitas checagens repetitivas.
   - NAO: triagem de poucos itens -> maestro faz inline; mandar para o mini frio sai mais caro.

Resumo: bracal verificavel barato e volumoso -> PROPOR delegacao (e esperar OK). Bracal pequeno -> inline mesmo sendo mecanico, sem perguntar. Nao delegar tarefa minuscula nao e violar a regra; e a regra.

Verificacao do bracal em camadas (barato -> caro): (1) gate deterministico; (2) script build/lint/test; (3) receipt obrigatorio (o que mudou + file:line + diff + resultado, nunca so "pronto"); (4) spot-check do maestro.

Fallback: se o bracal falhar ou voltar vazio 1x, o maestro do mesmo ecossistema assume inline e registra no worklog que a delegacao falhou. Sem retentar cego.

REGRA DE CUSTO: bracal usa ASSINATURA, nunca API cobrada. Nada de `claude -p`, `gemini` headless ou qualquer chamada que gaste API key.

Dois modos de delegacao, nesta ordem de preferencia:

MODO A - subagent IN-SESSION (preferido; assinatura; zero API):
Quando voce ja esta rodando dentro de um CLI com subagent nativo, delegue o bracal ao seu proprio tier barato, na mesma sessao, sem sair para outro processo:
- Claude Code -> Task tool com subagent Haiku.
- Gemini -> tier Flash dentro da propria sessao.
- Grok -> tier barato (grok-code-fast-1 / grok-4-fast) dentro da propria sessao Grok. Grok CLI e sempre metrado por XAI_API_KEY; ficar in-session evita abrir um segundo processo cobrado.
combo-maestro NAO executa isso de fora; quem dispara o subagent e o agente em execucao.

MODO B - shell-out (so Codex; unico headless que usa assinatura):
`combo-maestro delegate "<tarefa bracal autocontida>" --cli codex`
- codex -> `codex exec -m gpt-5.4-mini` (login do Codex = assinatura)

So o subprocesso gasta o tier barato. Use so para bracal autocontido (paths e escopo explicitos), pois o subprocesso e frio e tem overhead fixo de cold-start.

`combo-maestro delegate --cli claude|gemini|grok` se RECUSA de proposito e lembra do Modo A.
`combo-maestro delegate --cli mimo` so opera via API cobrada. Bloqueado por padrao; libera so com `--allow-api`.

AUDITORIA: cada chamada de `delegate` e registrada. O usuario confere com `combo-maestro log` (quando/cli/modelo/status). So o Modo B passa pelo log.

## Session-start automatico (entrypoint, sem comando do usuario)

> Vale em qualquer projeto, herdado do global. Aqui esta o GATILHO; a ORDEM de leitura e do nucleo.

QUE ARQUIVOS LER: se existir `.orquestrador/PERSISTENCE.md`, ele manda na ordem de reidratacao e de persistencia. Este bloco nao a duplica. Sem `PERSISTENCE.md`, leia `DEV/SPECS/ACTIVE.md` e `DEV/HANDOFF.md`, usando `DEV/INDEX.md` como mapa.

QUANDO E COMO, que o nucleo nao forca:

1. Dispare no inicio de qualquer trabalho substantivo, sem o usuario pedir.
2. Nao pergunte "devo ler?" - leia e aja.
3. Nao releia o mesmo doc na mesma sessao (read-once).
4. Nao leia README ou AGENTS inteiro por default.
5. EXCECAO: acao destrutiva ou irreversivel ainda exige confirmacao explicita.

Se o projeto nao tem `DEV/`, siga o `AGENTS.md` local normalmente. `combo-maestro init-entrypoint` e opcional e serve so para criar o esqueleto `DEV/` + ponteiro no `AGENTS.md`.

## Jobs longos: dispara-e-sai (anti-poll)

Regra dura para qualquer job longo (render, encode, build pesado, scan, download):

1. Sempre dispara desacoplado e grava PID.
2. Proibido na sessao do modelo caro: `Wait-Process`, loop de polling, `Start-Sleep` seguido de rechecagem.
3. Status = comando pontual, sob demanda, uma vez.
4. Depois de disparar o job, encerra o turno.
5. Auto-relato curto: 1 linha + receipt.

## Custo real = reingestao de contexto (read-once + batch)

Regra dura contra reingestao:

1. READ-ONCE: doc de contrato le-se uma vez por sessao.
2. BATCH: agrupe comandos independentes num bloco so.
3. MINIMIZE ROUNDTRIPS: menos turnos > turnos "espertos".
4. Nao vigiar job longo.
5. Resposta final curta + receipt.
