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
| Capital insuficiente | azul | A carteira de R$ 100 não compra uma unidade do ativo com as regras reais. Mostra o mínimo. | Carteira EUA (1 cota de SPY) |

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
| Carteiras R$ 100 | uma vez por dia, 19h50 de Brasília | 26 h |

## Detalhe de cada robô (0.1.10, linha `robos:detalhe`)

A situação diz **se** o robô está rodando. O detalhe diz **o que ele fez e por quê**. Vem numa linha só da VPS,
`robos:detalhe`, gravada pelo exportador (daytrade-lab, `painel-aovivo/painel/detalhe.py`). Ele só lê o diário e o
estado de cada simulação. O detalhe nunca muda a situação: um robô "ativo" continua ativo mesmo quando decidiu
não operar.

Cada entrada da linha do tempo tem um selo:

| Selo | Quer dizer |
|---|---|
| operou | Ordem executada, com o custo pago naquela ordem. |
| não operou | O robô olhou e decidiu não mandar ordem. O motivo vem da regra, com os números do dia. Exemplos: "a regra manda seguir comprado e já estava", "o momentum só escolhe às segundas", "checagem das 11:00: preço abaixo do teto", "R$ 100 não compram 1 BOVA11". Dias seguidos com a mesma decisão viram uma linha só ("30 vezes desde 02/09"). |
| recusada | O robô quis operar e o motor de risco recusou. Exemplos: dia de FOMC, preço velho, limite de ordens. |
| freio | Motor de risco ou botão: pausou, parou, zerou, voltou. |
| registro | Pregão fechado com a decisão para o próximo, dividendo, imposto, fim do dia do day trade. |

Na ficha aparecem a **última decisão** (logo abaixo da situação) e o quadro **Dinheiro**:

- **Caixa disponível.** É o caixa do `estado.json` da simulação. Na carteira de R$ 100 em dólar ou cripto, inclui a sobra na moeda do ativo, convertida.
- **Reservado.** É dinheiro separado para a ordem de outro robô na mesma carteira. Hoje cada robô tem a sua carteira, então fica **zero**. A carteira compartilhada com reserva (`lab/contas`) existe, mas ainda não está ligada a nenhuma simulação.
- **Exposição.** É o que está aplicado no ativo, ao último preço que a simulação usou. A data aparece embaixo.
- **Decisão pendente.** Só existe na bolsa: o que a regra decidiu no fechamento e vai executar na próxima abertura.
- **Conciliação.** O caixa é refeito pelo diário (capital inicial, cada ordem com seu custo, dividendos e imposto) e comparado com o estado.
  - "Fecha" quer dizer que os dois batem (diferença de até 0,05).
  - "Não fecha" mostra a diferença e um aviso vermelho no cartão. Alguém deve olhar: pode ser estado mexido à mão ou ordem que não foi para o diário.
  - Na régua, que compra uma vez e não registra ordem no diário, aparece "não se aplica".

Sem a linha `robos:detalhe`, tudo continua como antes. A linha do tempo é a do resumo e o caixa da carteira é calculado.

## O que ainda não vem da VPS

- Até o exportador novo ser publicado na VPS (PR daytrade-lab#32), custos do cripto diário e do day trade não aparecem, e o caixa das carteiras é calculado.
- A reserva de caixa só passa a ter número quando algum robô usar a carteira compartilhada.
