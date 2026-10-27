#!/usr/bin/env bash
# Cópia diária da simulação DAYTRADE para o repositório privado sebastiancruzaiello/daytrade-copias (fase E).
# Roda como claude-vps pelo cron. Só LÊ a simulação: copia o diário, o estado, os relatórios, os boletins dos
# agentes e o fim dos logs. Nunca copia segredo (central/*.txt, agentes/chave.txt) e recusa se achar um.
set -euo pipefail
SIM=/home/claude-vps/projects/daytrade-sim
DEST=/home/claude-vps/daytrade-copias
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/daytrade_copias -o IdentitiesOnly=yes"
REPO=git@github.com:sebastiancruzaiello/daytrade-copias.git

[ -d "$DEST/.git" ] || git clone -q "$REPO" "$DEST"
cd "$DEST"
git pull -q --rebase 2>/dev/null || true

mkdir -p estado agentes
for f in diario.jsonl estado.json relatorio.md relatorio.json PARAR; do
  if [ -f "$SIM/estado/$f" ]; then cp "$SIM/estado/$f" estado/; else rm -f "estado/$f"; fi
done
for f in cron.log painel.log porteiro.log agentes.log; do
  if [ -f "$SIM/estado/$f" ]; then tail -n 500 "$SIM/estado/$f" > "estado/$f"; fi
done
if [ -d "$SIM/agentes/saida" ]; then rm -rf agentes/saida && cp -r "$SIM/agentes/saida" agentes/; fi
if [ -f "$SIM/agentes/gasto.json" ]; then cp "$SIM/agentes/gasto.json" agentes/; fi

# trava: nenhum segredo pode ir para o repositório
for arq in "$SIM/central/token.txt" "$SIM/agentes/chave.txt"; do
  if [ -s "$arq" ] && grep -rqF --exclude-dir=.git -- "$(cat "$arq")" .; then
    echo "RECUSADO: um segredo apareceu na cópia; nada foi enviado"; git checkout -q -- . ; exit 1
  fi
done
if grep -rqE --exclude-dir=.git 'sk-ant-[A-Za-z0-9_-]{20,}' .; then
  echo "RECUSADO: parece haver uma chave da API na cópia; nada foi enviado"; exit 1
fi

git add -A
if git -c user.name="VPS DAYTRADE" -c user.email="vps@daytrade.invalid" commit -qm "cópia $(date -u +%F)"; then
  git push -q
  echo "$(date -u +%FT%TZ) cópia enviada"
else
  echo "$(date -u +%FT%TZ) nada mudou desde a última cópia"
fi
