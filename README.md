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

## Desenvolver

    npm ci
    npm test
    npm run dev          # tela no navegador
    npm run dist:win     # instalador local, sem publicar
