"""Porteiro da central do DAYTRADE. Roda na VPS pelo cron, de minuto em minuto.

Busca na caixa do n8n os pedidos que o Claude, o Codex ou o Beto deixaram e só sabe fazer UMA coisa:
ligar o botão de parar (`python3 -m aovivo parar "motivo"`). Nunca retoma, nunca compra ou vende,
nunca mexe em config, limites, calendário ou lacre. Qualquer outro pedido volta como "recusado".

A VPS só puxa: nenhuma porta é aberta. Endereço e segredo ficam em central/destino.txt e central/token.txt
(só na VPS, chmod 600). A resposta de cada pedido vai para o mesmo endereço com "-feito" no fim.

Uso (de dentro de ~/projects/daytrade-sim):
  python3 -m central.porteiro            busca, aplica e responde (o que o cron roda)
  python3 -m central.porteiro --olhar    só mostra os pedidos pendentes, não faz nada
"""
import fcntl
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

UTC = timezone.utc
AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
VALIDADE = timedelta(minutes=30)  # pedido mais velho que isso não é aplicado (pode ser de antes de um retomar)
MAX_PEDIDOS = 20


def pasta_estado() -> Path:
    # mesma regra do aovivo: DAYTRADE_ESTADO ou ./estado ao lado do pacote
    return Path(os.environ.get("DAYTRADE_ESTADO", RAIZ / "estado"))


def limpar(texto, limite: int) -> str:
    s = "".join(c if c.isprintable() else " " for c in str(texto or ""))
    return " ".join(s.split())[:limite]


def motivo_do_pedido(p: dict) -> str:
    cliente = "".join(c for c in str(p.get("cliente") or "").lower() if c.isalnum() or c in "-_")[:20] or "desconhecido"
    return f"central/{cliente}: {limpar(p.get('motivo'), 200) or 'sem motivo escrito'}"


def executar_parar(motivo: str) -> subprocess.CompletedProcess:
    # lista de argumentos, sem shell: o motivo nunca vira comando
    return subprocess.run([sys.executable, "-m", "aovivo", "parar", motivo], cwd=RAIZ,
                          capture_output=True, text=True, timeout=180)


def decidir(p: dict, agora: datetime, executar=executar_parar) -> tuple[str, str]:
    """Devolve (estado, resultado) para um pedido. Só 'pausar' faz alguma coisa."""
    if str(p.get("acao")) != "pausar":
        return "recusado", "o porteiro só sabe pausar"
    try:
        em = datetime.fromisoformat(str(p.get("em")).replace("Z", "+00:00"))
        if em.tzinfo is None:
            em = em.replace(tzinfo=UTC)
    except ValueError:
        return "recusado", "pedido sem hora válida"
    if agora - em > VALIDADE:
        return "recusado", "pedido vencido (mais de 30 min); peça de novo se ainda quiser pausar"
    arq = pasta_estado() / "PARAR"
    if arq.exists():
        return "ja_parado", "o botão de parar já estava ligado: " + limpar(arq.read_text(), 120)
    try:
        r = executar(motivo_do_pedido(p))
    except subprocess.TimeoutExpired:
        return "erro", "aovivo parar demorou demais"
    if arq.exists():
        if r.returncode == 0:
            return "feito", "botão de parar ligado e contas zeradas pelo vigia"
        # o botão já impede compras; o vigia da próxima hora termina de zerar
        return "feito", "botão de parar ligado, mas o zeramento imediato falhou: " + limpar((r.stderr or "")[-200:], 200)
    return "erro", limpar((r.stderr or r.stdout or "")[-300:], 300) or f"aovivo parar saiu com código {r.returncode}"


def _pedir(url: str, token: str, dados: dict | None = None) -> dict:
    corpo = None if dados is None else json.dumps(dados).encode()
    req = urllib.request.Request(url, data=corpo, method="GET" if dados is None else "POST",
                                 headers={"Content-Type": "application/json", "x-porteiro": token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode() or "{}")


def pendentes(url: str, token: str, pedir=_pedir) -> list[dict]:
    lista = pedir(url, token).get("pedidos") or []
    return [p for p in lista if isinstance(p, dict) and str(p.get("id", "")).isdigit()][:MAX_PEDIDOS]


def rodar(url: str, token: str, agora: datetime | None = None, pedir=_pedir, executar=executar_parar) -> list[dict]:
    feitos = []
    for p in pendentes(url, token, pedir):
        estado, resultado = decidir(p, agora or datetime.now(UTC), executar)
        resposta = {"id": int(p["id"]), "estado": estado, "resultado": resultado}
        pedir(url + "-feito", token, resposta)
        feitos.append(resposta)
        print(datetime.now(UTC).isoformat(timespec="seconds"), json.dumps(resposta, ensure_ascii=False), flush=True)
    return feitos


def main(argv):
    url = (AQUI / "destino.txt").read_text().strip()
    token = (AQUI / "token.txt").read_text().strip()
    if "--olhar" in argv:
        print(json.dumps(pendentes(url, token), indent=1, ensure_ascii=False))
        return
    with open(AQUI / ".trava", "w") as t:
        try:
            fcntl.flock(t, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return  # a rodada anterior ainda não terminou
        rodar(url, token)


if __name__ == "__main__":
    main(sys.argv[1:])
