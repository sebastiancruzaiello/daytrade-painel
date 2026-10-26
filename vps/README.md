# Código que roda na VPS do DAYTRADE

Fica em `~/projects/daytrade-sim/` na VPS, ao lado da simulação (`aovivo/`) e do exportador do painel (`painel/`).
Nada aqui manda ordem, muda limite, config, calendário ou lacre. Nenhum segredo fica neste repositório:
`central/destino.txt`, `central/token.txt` e `agentes/chave.txt` existem só na VPS (chmod 600).

- `central/porteiro.py`: busca na central do n8n os pedidos de pausa do Claude, Codex, Beto e Alex e só roda
  `python3 -m aovivo parar`. Cron de minuto em minuto. Retomar é só com o Sebastian.
- `agentes/`: Sentinela de notícias e Plantonista pela API do Claude (fase C). Cron diário às 01:10 UTC.
  Trava de US$ 5 por dia além do limite mensal do Console. Instalação: `bash agentes/instalar.sh`.

Testes (sem rede e sem API): `python3 -m unittest discover -s central/tests -t . -q` e
`agentes/.venv/bin/python -m unittest discover -s agentes/tests -t . -q`.
