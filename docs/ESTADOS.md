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

## O que ainda não vem da VPS

- Custos pagos do cripto diário e do day trade: o resumo não traz. O detalhe diz "não informado pela simulação".
- Caixa das carteiras: é calculado (valor menos o que está no ativo); a conciliação confere se faz sentido.
- Histórico por pregão das contas da bolsa: só o último pregão e o total de operações.
