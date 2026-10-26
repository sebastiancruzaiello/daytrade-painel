"""Agentes de IA na VPS (fase C, 7 dias em paralelo com a rotina do Claude).

Uso (de dentro de ~/projects/daytrade-sim, com o python do venv dos agentes):
  agentes/.venv/bin/python -m agentes dia          Sentinela e depois Plantonista (o que o cron roda)
  agentes/.venv/bin/python -m agentes sentinela    só a Sentinela
  agentes/.venv/bin/python -m agentes plantonista  só o Plantonista
  agentes/.venv/bin/python -m agentes gasto        mostra o gasto dos últimos dias (não chama a API)
"""
import json
import sys
from datetime import datetime

from . import base, plantonista, sentinela


def main(argv):
    cmd = argv[0] if argv else "ajuda"
    if cmd in ("ajuda", "-h", "--help"):
        print(__doc__)
        return 0
    if cmd == "gasto":
        try:
            dados = json.loads((base.AQUI / "gasto.json").read_text())
        except FileNotFoundError:
            dados = {}
        for dia, d in list(dados.items())[-14:]:
            print(f"{dia}: US$ {d['usd']:.4f} em {len(d['chamadas'])} chamadas")
        return 0
    agora = datetime.now(base.UTC)
    cli, caixa = base.cliente(), base.Caixa(agora=agora)
    passos = {"dia": [sentinela, plantonista], "sentinela": [sentinela], "plantonista": [plantonista]}.get(cmd)
    if not passos:
        print(__doc__)
        return 2
    erro = 0
    for agente in passos:
        try:
            res = agente.rodar(cli, caixa, agora)
        except base.GastoEstourado as e:
            res, erro = {"agente": agente.__name__.split(".")[-1], "parado": str(e)}, 1
        except Exception as e:  # a Sentinela falhar não impede o boletim
            res, erro = {"agente": agente.__name__.split(".")[-1], "erro": f"{type(e).__name__}: {e}"[:300]}, 1
        print(agora.isoformat(timespec="seconds"), json.dumps(res, ensure_ascii=False), flush=True)
    return erro


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
