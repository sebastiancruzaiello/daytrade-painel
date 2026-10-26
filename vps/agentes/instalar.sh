#!/usr/bin/env bash
# Instala os agentes de IA do DAYTRADE na VPS (fase C). Roda como claude-vps, de dentro de ~/projects/daytrade-sim:
#   bash agentes/instalar.sh
# Faz: venv com o SDK do Claude, testes, pede a chave da API sem mostrar na tela (chmod 600),
# põe o cron diário (01:10 UTC) e roda uma vez para conferir. Não mexe em estado/, config, limites ou lacre.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/5 preparando o ambiente dos agentes (agentes/.venv)..."
if [ ! -x agentes/.venv/bin/python ]; then
  python3 -m venv agentes/.venv || { echo "FALHOU: falta o pacote python3-venv na VPS. Me mande esta mensagem."; exit 1; }
fi
agentes/.venv/bin/pip install -q --upgrade pip anthropic

echo "2/5 testes (sem chamar a API)..."
agentes/.venv/bin/python -W ignore -m unittest discover -s agentes/tests -t . -q

echo "3/5 chave da API"
if [ -s agentes/chave.txt ]; then
  echo "   já existe agentes/chave.txt; mantida."
else
  read -rsp "   Cole a chave da API (começa com sk-ant-, não aparece na tela) e aperte Enter: " CHAVE; echo
  case "$CHAVE" in sk-ant-*) ;; *) echo "   isso não parece uma chave da API; nada foi gravado."; exit 1;; esac
  (umask 077; printf %s "$CHAVE" > agentes/chave.txt)
  unset CHAVE
  chmod 600 agentes/chave.txt
  echo "   chave guardada só nesta VPS (agentes/chave.txt, chmod 600)."
fi

echo "4/5 cron diário às 01:10 UTC (22:10 em Brasília)..."
LINHA='10 1 * * * cd /home/claude-vps/projects/daytrade-sim && agentes/.venv/bin/python -m agentes dia >> estado/agentes.log 2>&1'
crontab -l | grep -v 'python -m agentes dia' > /tmp/cron.agentes || true
echo "$LINHA" >> /tmp/cron.agentes
crontab /tmp/cron.agentes && rm -f /tmp/cron.agentes
crontab -l

echo "5/5 primeira rodada (custa poucos centavos de dólar)..."
agentes/.venv/bin/python -m agentes dia || true
agentes/.venv/bin/python -m agentes gasto
echo "Pronto."
