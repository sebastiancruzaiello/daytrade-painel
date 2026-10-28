# DAYTRADE Painel

Programa de Windows que mostra, só para olhar, uma simulação de robôs de trading (dinheiro de mentira).
Feito com Electron, React e componentes do [affectUI](https://github.com/flohoeller/affectui) (MIT).

- Só lê. Não fala com corretora, não muda regras nem limites, não tem IA nas decisões.
- Não traz endereço nem chave de nenhum servidor: quem usa cola os dois em Ajustes, e eles ficam só no PC,
  cifrados pelo Windows.
- Atualiza sozinho a partir dos lançamentos deste repositório (electron-updater). Cada lançamento é montado e publicado pelo
  GitHub Actions (`.github/workflows/publicar.yml`) quando a versão do `package.json` muda.

## Situação de cada robô

A tela Robôs mostra todos os robôs, réguas e carteiras ao vivo, com filtros e a ficha de cada um. O que cada
situação quer dizer (ativo, aguardando mercado, falha de conexão, dado velho…) está em [`docs/ESTADOS.md`](docs/ESTADOS.md).

## Fábrica de estratégias

A tela Fábrica mostra quem pesquisa, revisa, congela e testa estratégias, e em que etapa cada candidato está (fonte,
hipótese, triagem, regra congelada, código, testes técnicos, teste histórico, parecer). Lê a linha `fabrica:resumo`:

    {"em": "...", "etapas": ["fonte", ...] (opcional), "candidatos": [{"id", "titulo", "mercado", "etapa",
     "situacao", "desde", "responsavel", "evidencia", "veredito"}]}

Campos a mais são ignorados. Sem essa linha, a tela usa as fichas e vereditos do `lab:resumo`.

## Detalhe de cada robô

Desde a 0.1.10 a ficha de cada robô lê a linha `robos:detalhe`, quando ela vem. Ela traz:

- a linha do tempo com o que o robô fez e o que **decidiu não fazer e por quê**, com selos e filtro;
- os custos reais;
- caixa, reservado e exposição;
- a decisão pendente da bolsa;
- a conciliação do caixa refeito pelo diário.

No cartão aparecem a última decisão e um aviso quando o caixa não fecha. O formato e o significado de cada campo
estão em `docs/ESTADOS.md`. Sem a linha, a ficha fica como na 0.1.9.

## Lote de robôs

Desde a 0.1.11 a tela Robôs também mostra os 9 robôs do lote de observação, lidos da linha `lote:resumo`. Cada um
aparece com o veredito, a régua na mesma moeda, a última decisão e o quadro Dinheiro. Os resultados nunca se somam.
Em `docs/ESTADOS.md` está como cada situação do lote vira situação do painel.

## Escritório gerado da lista

Desde a 0.1.13 o Pregão tem a **ala dos robôs**: cada robô, régua e carteira da tela Robôs ganha um lugar no
escritório, sem cadeira escrita à mão. Quem a VPS diz que existe e não chegou na leitura aparece como "sem
telemetria", e a coluna da direita mostra esperados, recebidos e desenhados. O rodapé mostra a versão do programa,
de onde vêm os números e a hora da última leitura e do último envio da VPS. Detalhes em `docs/ESTADOS.md`.

## Escritório operacional

Desde a 0.1.14 o Pregão abre com a **faixa de prontidão**: relógio de Brasília e de Nova York, o escritório
(preparação das 8h30 às 8h55, pronto às 9h de Brasília) e a fase de cada mercado no horário dele (B3 ações, B3 ETFs,
EUA na hora de Nova York, cripto contínuo), com os impedimentos do checklist da VPS. Acima de cada operador com conta
aparece o ganho ou a perda em verde ou vermelho, com a moeda e o período (Dia ou Acumulado, escolhido na faixa); aporte
nunca vira lucro. Os agentes de IA e o apoio mostram a última tarefa com prova, ou "aguardando agenda" quando não há
prova. A tela Robôs ganha as cinco dimensões de cada operador e o inventário aprovado × instalado × enviado × desenhado.
Lê três linhas novas do exportador (`prontidao:resumo`, `agentes:resumo`, `resultado:resumo`). Detalhes em `docs/ESTADOS.md`.

## Mesa e área de lazer

Desde a 0.1.15 a mesa é só de quem está **comprado** (tem moeda ou ação na mão), mesmo que esteja parado esperando:
em cima dele fica o ganho ou a perda, com moeda e período, e o que ele tem. Quem não tem posição, inclusive quem está
esperando sinal ou já decidiu comprar na próxima abertura, levanta e vai para a **área de lazer** na frente do
escritório (sinuca, sofás e café); a cadeira dele fica vazia na mesa. Falha, pausa, parado e falta de dado nunca vão
para o lazer: ficam em pé no próprio lugar com ⚠ e o motivo. O escritório ficou maior (mais fundo, com o lazer na
frente) e os lugares mais espaçados, para os nomes não se sobreporem. Regra em `src/dados/elenco.ts` (`ondeFica`,
`vagasLazer`), com testes.

Desde a 0.1.16 os **agentes de IA e o apoio** seguem a mesma regra: no posto só quem está com uma tarefa em execução
agora. Quem está sem tarefa (já entregou, ou espera a próxima hora da agenda) vai para a área de lazer com
"sem tarefa · última 01:11" ou "sem tarefa · aguardando agenda". Parado há mais de um dia ou sem nenhum registro fica
no posto, em amarelo, porque falta de dado não pode parecer folga; o Guardião de dados com alerta também fica. A única
exceção é o **Guardião do motor de risco**: ele não tem tarefa própria, faz parte do motor e confere cada ordem na hora
em que ela nasce, então fica sempre de guarda na cabine. Regra em `src/dados/escritorio.ts` (`atividade`, campo `posto`).

Desde a 0.1.17 o rótulo de ganho ou perda traz também a **porcentagem** (sobre o começo do dia, ou sobre o capital
no acumulado). O Momentum, que é uma conta só com três moedas, ganha um rótulo da conta acima do grupo e, em cada
cadeira, a moeda e a variação dela no último fechamento diário. Quem só marca uma vez por dia mostra "DIA — sem preço
novo desde ..." e o acumulado, em vez de um 0,00 que parece resultado.

Desde a 0.1.18 cada robô na área de lazer diz **por que está fora da mesa**, com o motivo concreto que a VPS manda
(campo `espera` do `robos:detalhe` e do `lote:resumo`): "sem sinal · abaixo do teto", "compra recusada · FOMC",
"sem sinal · abaixo da MM20", "capital novo · compra 19:50", "compra da abertura de 28/10" (a bolsa compra pelo
preço de abertura, mas só lança a posição depois do fechamento; aí vai para a mesa). Embaixo, o evento do calendário
de hoje e a **hora da próxima rodada** que decide, em Brasília ("FOMC hoje · próx. 11:00"). A frase inteira fica no
cartão e na ficha do robô (aba Robôs). O day trade mostra também o que a **regra pura** fez hoje (antes ficava
+0,00% até a meia-noite UTC). E o **Maestro** (o Claude que coordena a equipe) entrou no escritório: acima da cabeça
dele, e de cada agente, a tarefa em execução no registro de tarefas (linha `tarefas:resumo`, `equipe/tarefas` no
daytrade-lab); "atividade não confirmada" (6 h sem sinal) fica no posto em amarelo; quem só espera uma condição (um
sim do Sebastian) vai para o lazer dizendo o quê.

## Desenvolver

    npm ci
    npm test
    npm run dev          # tela no navegador
    npm run dist:win     # instalador local, sem publicar
