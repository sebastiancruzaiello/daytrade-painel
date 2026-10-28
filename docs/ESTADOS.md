# O que cada situação quer dizer (Salão do Pregão)

O painel dá a cada robô, régua e carteira uma situação. A conta é feita em `src/dados/estados.ts`, só com o que a
VPS mandou ao n8n; os testes ficam em `src/dados/estados.test.ts`. "Aguardando mercado" e "falha de conexão"
nunca se confundem (Plano Geral 2.0, §17).

| Situação | Cor | Quer dizer | Exemplo |
|---|---|---|---|
| Ativo | verde | Rodando, com dado em dia. Pode estar em caixa: ativo não quer dizer comprado. | MM20 · BTC esperando o sinal |
| Aguardando mercado | azul | A bolsa está fechada (noite, fim de semana, feriado). Nada errado. | MM10M · BOVA11 às 22h |
| Aguardando dado | azul | Falta um dado para começar: ao vivo não ligado, primeiro resumo não chegou, fonte sem preço do dia. | Carteira EUA sem preço do Yahoo |
| Falha de conexão | vermelho, com borda | Alguém não falou com alguém: o painel com o n8n, ou a VPS com a fonte de preços. Mostra o último dado que chegou e desde quando. | Internet do PC caiu; Yahoo fora |
| Dado velho | amarelo | A ligação funciona, mas a informação não se renova no prazo. | VPS sem mandar resumo há 2h |
| Pausado | amarelo | O motor de risco pausou a conta por um dia depois de perda grande. Volta sozinha. | perda de 15% no dia |
| Parado | vermelho, com borda | Motor de risco (queda de 35%) ou botão de parar. Só volta com ordem do Sebastian. | botão de parar ligado |
| Capital insuficiente | azul | O capital da carteira não compra uma unidade do ativo com as regras reais. Mostra o mínimo. | Carteira EUA (1 cota de SPY) |

## Ordem de prioridade

1. Falha de conexão do painel com o n8n vale para todos (os números ficam os últimos que chegaram).
2. Sem nenhum dado ainda: aguardando dado, com o motivo (falta a chave, primeira leitura, prévia no navegador).
3. Botão de parar, parado, pausado.
4. Dado velho (primeiro o envio da VPS, depois a própria simulação).
5. Falha da VPS com a fonte de preços (bolsa).
6. Aguardando dado (carteira sem preço, bolsa que ainda não processou pregão) e capital insuficiente.
7. Aguardando mercado (bolsa fechada, pelo horário do pregão do Yahoo).
8. Ativo.

## Prazos de "dado velho"

| O quê | Roda | Velho depois de |
|---|---|---|
| Envio da VPS ao n8n | de meia em meia hora | 75 min |
| Vigia do cripto diário | de hora em hora | 2 h |
| Rodada do cripto diário | depois da meia-noite UTC | 25 h |
| Bolsa (EUA e B3) | de hora em hora, minuto 40 | 2h30 |
| Day trade em cripto | de minuto em minuto | 20 min |
| Carteiras de referência | uma vez por dia, 19h50 de Brasília | 26 h |

Desde a 0.1.13 há dois relógios. O **envio da VPS** (o exportador manda às :10 e :40) é medido contra a hora de
agora: passou de 75 min, todos ficam "dado velho". O **relatório de cada simulação** é medido contra a hora em que a VPS
montou aquele envio, não contra agora. Assim, um day trade que estava em dia no envio das 10:40 não vira "dado velho"
às 11:05 só porque o próximo envio ainda não chegou; e um day trade que já estava parado quando a VPS montou o envio
continua acusado. O motivo mostra as duas horas (do relatório e do envio). O limite não foi afrouxado: só passou a
medir a coisa certa (auditoria de 28/10/2026, achado H).

## Detalhe de cada robô (0.1.10, linha `robos:detalhe`)

A situação diz **se** o robô está rodando. O detalhe diz **o que ele fez e por quê**. Vem numa linha só da VPS,
`robos:detalhe`, gravada pelo exportador (daytrade-lab, `painel-aovivo/painel/detalhe.py`). Ele só lê o diário e o
estado de cada simulação. O detalhe nunca muda a situação: um robô "ativo" continua ativo mesmo quando decidiu
não operar.

Cada entrada da linha do tempo tem um selo:

| Selo | Quer dizer |
|---|---|
| operou | Ordem executada, com o custo pago naquela ordem. |
| vai operar | A regra mandou comprar ou vender no fechamento e a ordem sai na próxima abertura (lote de robôs). Se o motor avisou que não executa (pausa, parada, botão), vira "não operou". |
| não operou | O robô olhou e decidiu não mandar ordem. O motivo vem da regra, com os números do dia. Exemplos: "a regra manda seguir comprado e já estava", "o momentum só escolhe às segundas", "checagem das 11:00: preço abaixo do teto", "R$ 100 não compram 1 BOVA11". Dias seguidos com a mesma decisão viram uma linha só ("30 vezes desde 02/09"). |
| recusada | O robô quis operar e o motor de risco recusou. Exemplos: dia de FOMC, preço velho, limite de ordens. |
| freio | Motor de risco ou botão: pausou, parou, zerou, voltou. |
| registro | Pregão fechado com a decisão para o próximo, dividendo, imposto, fim do dia do day trade. |

Na ficha aparecem a **última decisão** (logo abaixo da situação) e o quadro **Dinheiro**:

- **Caixa disponível.** É o caixa do `estado.json` da simulação. Na carteira de referência em dólar ou cripto, inclui a sobra na moeda do ativo, convertida.
- **Reservado.** É dinheiro separado para a ordem de outro robô na mesma carteira. Hoje cada robô tem a sua carteira, então fica **zero**. A carteira compartilhada com reserva (`lab/contas`) existe, mas ainda não está ligada a nenhuma simulação.
- **Exposição.** É o que está aplicado no ativo, ao último preço que a simulação usou. A data aparece embaixo.
- **Decisão pendente.** Só existe na bolsa: o que a regra decidiu no fechamento e vai executar na próxima abertura.
- **Conciliação.** O caixa é refeito pelo diário (capital inicial, cada ordem com seu custo, dividendos e imposto) e comparado com o estado.
  - "Fecha" quer dizer que os dois batem (diferença de até 0,05).
  - "Não fecha" mostra a diferença e um aviso vermelho no cartão. Alguém deve olhar: pode ser estado mexido à mão ou ordem que não foi para o diário.
  - Na régua, que compra uma vez e não registra ordem no diário, aparece "não se aplica".

Sem a linha `robos:detalhe`, tudo continua como antes. A linha do tempo é a do resumo e o caixa da carteira é calculado.

## Lote de robôs (0.1.11, linha `lote:resumo`)

O lote (lote-v1) roda 9 robôs pequenos de **observação**, cada um com o capital e a moeda dele. As regras foram
reprovadas no laboratório, então os robôs servem para observar e não aprovam nada. Eles aparecem na tela Robôs
com o estágio "Observação (lote)" e uma faixa amarela explicando isso.

Cada cartão mostra:
- o veredito do laboratório, à vista;
- o resultado ao lado da **régua** (só segurar o mesmo ativo, na mesma moeda);
- a última decisão, inclusive "não operou".

Os robôs **nunca se somam**.

Como cada situação do lote vira situação do painel, na mesma ordem de prioridade de cima:

| No lote | No painel |
|---|---|
| parado (botão de parar) | Parado |
| parada / pausada | Parado / Pausado (com o motivo do motor de risco) |
| relatório sem se renovar há mais de 2h30 (o lote roda de hora em hora) | Dado velho |
| capital insuficiente | Capital insuficiente (quanto tem, quanto custa uma unidade, quanto a regra precisaria) |
| aguardando dado | Aguardando dado |
| aguardando o primeiro fechamento | Aguardando mercado, se a bolsa está fechada; senão, aguardando dado |
| ativo / ativo, em caixa | Aguardando mercado (EUA ou B3 fechada) ou Ativo |

Dois avisos vermelhos aparecem no cartão sem mudar a situação: o diário do lote que não confere e o caixa que não fecha
com o diário. A conciliação é a do próprio lote.

## O que ainda não vem da VPS

- Até o exportador novo ser publicado na VPS (PR daytrade-lab#32), custos do cripto diário e do day trade não aparecem, e o caixa das carteiras é calculado.
- Até o exportador com `elenco:esperado` e as quantidades do day trade ser publicado, a conta de esperados não aparece e o day trade sem quantidade mostra só o valor.
- A reserva de caixa só passa a ter número quando algum robô usar a carteira compartilhada.

## Capital das carteiras de referência

Cada carteira mostra o capital que vem no dado (`capital_brl` dentro dela, desde a `carteiras-r100-v2`). Se o relatório
for antigo e não trouxer, vale o capital geral do relatório e, sem ele, R$ 100. Desde 28/10/2026 a Brasil tem R$ 400 e EUA
e Cripto R$ 100. O título da tela Contas diz "R$ X cada" só quando todas têm o mesmo capital.

## Escritório gerado da lista (0.1.13, linha `elenco:esperado`)

O escritório ganhou a **ala dos robôs**, à direita da ala de ações. Ela não tem cadeira escrita à mão: cada robô,
régua e carteira da lista (a mesma da tela Robôs) ganha um lugar, numa faixa por mercado (Cripto, EUA, B3), em
fileiras de até 7. A conta é feita em `src/dados/elenco.ts` (`planta`), com testes em `src/dados/elenco.test.ts`.
O cripto diário (MM20 BTC, MM20 ETH e Momentum) continua no salão antigo, por causa do ensaio de dias passados.

| No escritório | Quer dizer |
|---|---|
| Sentado | rodando e comprado |
| Em pé na mesa | rodando em caixa, ou esperando (bolsa fechada, sem dado) |
| Apagado | parado, falha de conexão ou sem telemetria; continua no lugar, não some |
| Faixa no peito | régua ou carteira de referência (não opera) |
| Número em verde ou vermelho sobre a cabeça | resultado desde o começo (só quando está rodando) |
| Palavra sobre a cabeça | a situação, quando não é "ativo" (fechado, sem dado, dado velho, pausa, parado, sem capital) |

Clicar numa pessoa da ala abre a mesma ficha da tela Robôs. Se a lista tiver mais gente que lugares, quem sobra
fica fora do desenho e uma placa diz quantos: a tela Robôs continua mostrando todos.

**Quem deveria aparecer.** O exportador da VPS manda a linha `elenco:esperado` (daytrade-lab,
`painel-aovivo/painel/elenco.py`), com os ids tirados dos config.json de cada simulação instalada. O painel compara:

- **Esperados:** quantos o cadastro diz que existem.
- **Recebidos:** quantos desses vieram na leitura.
- **No escritório:** quantos estão desenhados.

Quem é esperado e não veio entra na lista como **sem telemetria** (situação "aguardando dado", sem número nenhum),
em vez de sumir. Sem a linha `elenco:esperado` (exportador antigo), a conta mostra só recebidos e desenhados.

## Valor do day trade (0.1.13)

O relatório do day trade só traz o valor do **começo do dia**. Com a linha `robos:detalhe`, o valor passa a ser o
**caixa + a posição a preço da última checagem** (de meia em meia hora), e as posições aparecem com a quantidade.
Debaixo do valor fica de quando ele é. Comprado e sem preço da checagem: o painel não inventa, mostra o valor do
começo do dia e diz que falta a marcação. Lucro realizado e não realizado separados ainda não vêm da VPS.
