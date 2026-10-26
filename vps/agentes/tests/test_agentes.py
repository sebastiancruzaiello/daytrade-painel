"""Roda de dentro de ~/projects/daytrade-sim:  python3 -m unittest discover -s agentes/tests -t . -q
Nenhum teste chama a API de verdade: o cliente é falso."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace as NS

from agentes import base, plantonista, sentinela

AGORA = datetime(2026, 10, 27, 1, 10, tzinfo=timezone.utc)


def resposta(texto, stop="end_turn", ent=1000, sai=200, buscas=0):
    return NS(content=[NS(type="text", text=texto)], stop_reason=stop,
              usage=NS(input_tokens=ent, output_tokens=sai, cache_creation_input_tokens=0, cache_read_input_tokens=0,
                       server_tool_use=NS(web_search_requests=buscas)))


class ClienteFalso:
    def __init__(self, *respostas):
        self.fila, self.pedidos = list(respostas), []
        self.messages = self

    def create(self, **pedido):
        self.pedidos.append(pedido)
        return self.fila.pop(0)


def linhas_sim(botao=False, integro=True):
    status = {"contas": ["mm20-btc", "mm20-eth", "momentum"], "sy": ["BTC", "ETH", "SOL"], "capital_inicial": 10000,
              "situacao": {"mm20-btc": "ativa", "mm20-eth": "ativa", "momentum": "pausada"},
              "botao_parar": botao, "motivo_parar": "teste" if botao else None, "diario_integro": integro,
              "ultima_rodada": "2026-10-27T00:02:00+00:00", "ultimo_vigia": "2026-10-27T00:30:00+00:00"}
    d1 = {"d": "2026-10-26", "eq": [10000, 10000, 10000], "px": [100.0, 10.0, 1.0], "o": [], "x": []}
    d2 = {"d": "2026-10-27", "eq": [10100, 9900, 9500], "px": [110.0, 9.0, 1.0],
          "o": [["momentum", "SOL", "venda", 4000, "freio"]], "x": [["momentum", "pausar", "perda do dia 5%"]]}
    return [{"chave": "status", "conteudo": json.dumps(status)},
            {"chave": "dia:2026-10-26", "conteudo": json.dumps(d1)},
            {"chave": "dia:2026-10-27", "conteudo": json.dumps(d2)}]


QUADRO = {"guardiao": {"nivel": "ok", "em": "2026-10-27T00:50:00Z", "falhas_seguidas": 0},
          "clima": {"medo_ganancia": {"valor": 50, "classe": "Neutral"}}}


class Gasto(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.caixa = base.Caixa(Path(self.tmp.name) / "gasto.json", teto=0.05, agora=AGORA)

    def tearDown(self):
        self.tmp.cleanup()

    def test_custo(self):
        uso = resposta("x", ent=1_000_000, sai=100_000, buscas=3).usage
        self.assertAlmostEqual(base.custo(uso), 2.0 + 1.0 + 0.03)

    def test_teto_do_dia_bloqueia_antes_de_chamar(self):
        cli = ClienteFalso(resposta("ok", ent=20000, sai=1000))  # 0,05 dólar: bate o teto
        base.chamar(cli, self.caixa, "teste", model=base.MODELO, max_tokens=10, messages=[{"role": "user", "content": "oi"}])
        with self.assertRaises(base.GastoEstourado):
            base.chamar(cli, self.caixa, "teste", model=base.MODELO, max_tokens=10, messages=[])
        self.assertEqual(len(cli.pedidos), 1)

    def test_retoma_pause_turn(self):
        cli = ClienteFalso(resposta("", stop="pause_turn", ent=10, sai=1), resposta("pronto", ent=10, sai=1))
        texto, _ = base.chamar(cli, self.caixa, "t", model=base.MODELO, max_tokens=10, messages=[{"role": "user", "content": "x"}])
        self.assertEqual(texto, "pronto")
        self.assertEqual(cli.pedidos[1]["messages"][-1]["role"], "assistant")

    def test_chave_aberta_e_recusada(self):
        arq = Path(self.tmp.name) / "chave.txt"
        arq.write_text("sk-ant-teste")
        arq.chmod(0o644)
        with self.assertRaises(SystemExit):
            base.ler_chave(arq)
        arq.chmod(0o600)
        self.assertEqual(base.ler_chave(arq), "sk-ant-teste")


class Sentinela(unittest.TestCase):
    def test_niveis(self):
        self.assertEqual(sentinela.conferir("Nível: atenção\n\n1. ..."), "atenção")
        self.assertEqual(sentinela.conferir("nivel: alerta"), "alerta")
        with self.assertRaises(ValueError):
            sentinela.conferir("Olá! Aqui está o resumo")

    def test_rodar_usa_busca_e_entrega(self):
        tmp = tempfile.TemporaryDirectory()
        caixa = base.Caixa(Path(tmp.name) / "g.json", agora=AGORA)
        cli = ClienteFalso(resposta("Nível: nada\n\nBusca de 27/10/2026, últimas 24 horas.", buscas=4))
        entregues = []
        res = sentinela.rodar(cli, caixa, AGORA, entregar=lambda a, d, t: entregues.append((a, d)) or ["ok"])
        self.assertEqual(res["nivel"], "nada")
        self.assertEqual(entregues, [("sentinela", "2026-10-27")])
        self.assertEqual(cli.pedidos[0]["tools"][0]["type"], "web_search_20260209")
        tmp.cleanup()


class Plantonista(unittest.TestCase):
    def test_fatos_por_regra_fixa(self):
        f = plantonista.fatos(linhas_sim(), QUADRO, "Nível: nada", AGORA)
        self.assertEqual(f["alertas"], [])
        self.assertAlmostEqual(f["contas"][0]["no_dia"], 0.01)
        self.assertAlmostEqual(f["contas"][2]["desde_inicio"], -0.05)
        self.assertAlmostEqual(f["segurar"]["BTC"], 0.10)
        self.assertIn("conta momentum pausada", f["freios"])

    def test_alertas(self):
        f = plantonista.fatos(linhas_sim(botao=True, integro=False), {"guardiao": {}}, "Nível: alerta\n...", AGORA)
        juntos = " ".join(f["alertas"])
        self.assertIn("diário quebrada", juntos)
        self.assertIn("Guardião", juntos)
        self.assertIn("Sentinela em alerta", juntos)
        self.assertTrue(any("botão de parar" in x for x in f["freios"]))

    def test_sem_dados_nao_chama_ia(self):
        cli = ClienteFalso()
        res = plantonista.rodar(cli, None, AGORA, linhas=[], quadro={}, entregar=lambda *a: ["ok"])
        self.assertEqual(cli.pedidos, [])
        self.assertIn("sem dados", res["alertas"][0])

    def test_boletim_numeros_vem_do_codigo(self):
        tmp = tempfile.TemporaryDirectory()
        caixa = base.Caixa(Path(tmp.name) / "g.json", agora=AGORA)
        ia = "FRASE: dia misto\nCLIMA: medo e ganância 50, neutro\nNOTICIAS: nada\nPALAVRA: Volatilidade: quanto o preço balança. Mede risco."
        cli = ClienteFalso(resposta(ia))
        textos = []
        plantonista.rodar(cli, caixa, AGORA, linhas=linhas_sim(), quadro=QUADRO,
                          entregar=lambda a, d, t: textos.append(t) or ["ok"])
        b = textos[0]
        self.assertTrue(b.startswith("## 27/10/2026 — dia misto"))
        self.assertIn("**Situação geral:** OK", b)
        self.assertIn("| momentum | 9.500 | -5,00% | -5,00% | pausada |", b)
        self.assertIn("BTC +10,00%", b)
        tmp.cleanup()

    def test_ia_sem_formato_vira_indefinido(self):
        self.assertEqual(plantonista.ler_ia("bla")["FRASE"], "indefinido")


if __name__ == "__main__":
    unittest.main()
