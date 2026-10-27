#!/usr/bin/env bash
# Prepara a cópia diária (fase E). Roda como claude-vps, de dentro de ~/projects/daytrade-sim:
#   bash copia/instalar.sh
# Cria uma chave só para este repositório (deploy key), mostra a parte pública para o Sebastian colar no GitHub
# e põe o cron das 03:17 (horário de Brasília, o do relógio da VPS). Não mexe na simulação.
set -euo pipefail
cd "$(dirname "$0")/.."
CHAVE="$HOME/.ssh/daytrade_copias"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$CHAVE" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "daytrade-copias-vps" -f "$CHAVE"
fi
grep -q '^github.com ' "$HOME/.ssh/known_hosts" 2>/dev/null || ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null

LINHA='17 3 * * * /bin/bash /home/claude-vps/projects/daytrade-sim/copia/copiar.sh >> /home/claude-vps/projects/daytrade-sim/estado/copia.log 2>&1'
crontab -l | grep -v 'copia/copiar.sh' > /tmp/cron.copia || true
echo "$LINHA" >> /tmp/cron.copia
crontab /tmp/cron.copia && rm -f /tmp/cron.copia
echo "cron da cópia: 03:17 de Brasília (06:17 UTC)"
echo
echo "Cole a linha abaixo em github.com/sebastiancruzaiello/daytrade-copias -> Settings -> Deploy keys -> Add deploy key"
echo "(título: VPS, marque 'Allow write access'):"
echo
cat "$CHAVE.pub"
