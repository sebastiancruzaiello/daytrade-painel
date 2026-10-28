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

## Desenvolver

    npm ci
    npm test
    npm run dev          # tela no navegador
    npm run dist:win     # instalador local, sem publicar
