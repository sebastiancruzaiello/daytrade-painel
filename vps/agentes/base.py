"""Peças comuns dos agentes da VPS: chave da API, trava de gasto, leitura e entrega pelo n8n.

Regras que valem para todos (README do TecnoVault):
- só leem a simulação; nunca escrevem em estado/, config, limites, calendário ou lacre;
- nunca mandam ordem, nunca param nem retomam nada;
- a chave da API fica só em agentes/chave.txt (chmod 600), posta pelo próprio Sebastian;
- gasto: no máximo US$ 5 por dia (trava local) além do limite mensal do Console.
"""
import json
import os
import stat
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

UTC = timezone.utc
AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
MODELO = "claude-sonnet-5-5"
# preço por milhão de tokens (entrada, saída) e por busca, em dólares
PRECO = {"claude-sonnet-5-5": (2.0, 10.0), "claude-haiku-5-5": (0.10, 0.50), "claude-opus-5-5": (4.0, 20.0)}
PRECO_BUSCA = 0.01
TETO_DIA_USD = 5.0


class GastoEstourado(RuntimeError):
    pass


def ler_chave(arq: Path = AQUI / "chave.txt") -> str:
    if not arq.exists():
        raise SystemExit("falta agentes/chave.txt (o Sebastian coloca com agentes/instalar.sh)")
    if stat.S_IMODE(arq.stat().st_mode) & 0o077:
        raise SystemExit("agentes/chave.txt está aberta para outros usuários; rode: chmod 600 agentes/chave.txt")
    chave = arq.read_text().strip()
    if not chave.startswith("sk-ant-"):
        raise SystemExit("agentes/chave.txt não parece uma chave da API do Claude")
    return chave


def cliente():
    import anthropic  # só existe no venv dos agentes
    return anthropic.Anthropic(api_key=ler_chave(), max_retries=3, timeout=300.0)


# ---------------------------------------------------------------- gasto
def custo(uso, modelo: str = MODELO) -> float:
    ent, sai = PRECO[modelo]
    tokens_ent = (getattr(uso, "input_tokens", 0) or 0) + (getattr(uso, "cache_creation_input_tokens", 0) or 0) \
        + (getattr(uso, "cache_read_input_tokens", 0) or 0)
    tokens_sai = getattr(uso, "output_tokens", 0) or 0
    stu = getattr(uso, "server_tool_use", None)
    buscas = (getattr(stu, "web_search_requests", 0) or 0) if stu else 0
    return tokens_ent / 1e6 * ent + tokens_sai / 1e6 * sai + buscas * PRECO_BUSCA


class Caixa:
    """Livro do gasto do dia em agentes/gasto.json. Antes de cada chamada confere o teto."""

    def __init__(self, arq: Path = AQUI / "gasto.json", teto: float = TETO_DIA_USD, agora=None):
        self.arq, self.teto = arq, teto
        self.dia = (agora or datetime.now(UTC)).date().isoformat()

    def _ler(self) -> dict:
        try:
            return json.loads(self.arq.read_text())
        except (FileNotFoundError, ValueError):
            return {}

    def gasto_hoje(self) -> float:
        return float(self._ler().get(self.dia, {}).get("usd", 0.0))

    def conferir(self):
        if self.gasto_hoje() >= self.teto:
            raise GastoEstourado(f"teto de US$ {self.teto:.2f} por dia atingido; nada foi chamado")

    def anotar(self, agente: str, usd: float):
        dados = self._ler()
        d = dados.setdefault(self.dia, {"usd": 0.0, "chamadas": []})
        d["usd"] = round(d["usd"] + usd, 6)
        d["chamadas"].append({"agente": agente, "usd": round(usd, 6),
                              "em": datetime.now(UTC).isoformat(timespec="seconds")})
        # guarda só os últimos 60 dias
        dados = dict(sorted(dados.items())[-60:])
        self.arq.write_text(json.dumps(dados, indent=1))


def chamar(cli, caixa: Caixa, agente: str, **pedido) -> tuple[str, float]:
    """Uma conversa com o Claude. Retoma o 'pause_turn' das buscas (no máximo 3 vezes) e devolve (texto, custo)."""
    caixa.conferir()
    mensagens = list(pedido.pop("messages"))
    total, resp = 0.0, None
    for _ in range(4):
        resp = cli.messages.create(messages=mensagens, **pedido)
        gasto = custo(resp.usage, pedido.get("model", MODELO))
        caixa.anotar(agente, gasto)
        total += gasto
        if resp.stop_reason != "pause_turn":
            break
        mensagens = mensagens + [{"role": "assistant", "content": resp.content}]
        caixa.conferir()
    if resp.stop_reason == "refusal":
        raise RuntimeError("o modelo recusou o pedido")
    texto = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
    if not texto:
        raise RuntimeError(f"resposta sem texto (stop_reason={resp.stop_reason})")
    return texto, total


# ---------------------------------------------------------------- n8n (mesma chave do porteiro)
def _n8n():
    pasta = RAIZ / "central"
    return (pasta / "destino.txt").read_text().strip(), (pasta / "token.txt").read_text().strip()


def _pedir(url: str, token: str, dados: dict | None = None) -> dict:
    corpo = None if dados is None else json.dumps(dados).encode()
    req = urllib.request.Request(url, data=corpo, method="GET" if dados is None else "POST",
                                 headers={"Content-Type": "application/json", "x-porteiro": token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode() or "{}")


def ler_quadro(pedir=_pedir) -> dict:
    """guardiao e clima, que só existem no n8n. Falhou? Devolve vazio e o boletim diz 'sem dado'."""
    try:
        url, token = _n8n()
        return pedir(url + "-ler-agentes", token) or {}
    except Exception as e:  # rede, arquivo, resposta estranha: o boletim sai mesmo assim
        return {"erro": str(e)[:200]}


def entregar(agente: str, dia: str, texto: str, pedir=_pedir) -> list[str]:
    """Grava agentes/saida/<agente>/<dia>.md e manda para equipe_daytrade (<agente> e <agente>:<dia>)."""
    pasta = AQUI / "saida" / agente
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / f"{dia}.md").write_text(texto + "\n", encoding="utf-8")
    feitos = [f"arquivo saida/{agente}/{dia}.md"]
    try:
        url, token = _n8n()
        for chave in (agente, f"{agente}:{dia}"):
            pedir(url + "-agentes", token, {"chave": chave, "conteudo": texto[:20000]})
        feitos.append("n8n equipe_daytrade")
    except Exception as e:
        feitos.append(f"n8n FALHOU: {str(e)[:120]}")
    return feitos
