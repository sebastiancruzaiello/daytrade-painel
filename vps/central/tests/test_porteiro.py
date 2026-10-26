"""Roda de dentro de ~/projects/daytrade-sim:  python3 -m unittest discover -s central/tests -t . -q"""
import os
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from central import porteiro

AGORA = datetime(2026, 10, 26, 20, 0, tzinfo=timezone.utc)


def pedido(**k):
    p = {"id": 7, "acao": "pausar", "cliente": "beto", "motivo": "mercado estranho", "em": "2026-10-26T19:55:00.000Z"}
    p.update(k)
    return p


class Porteiro(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self.tmp.name)
        self.env = mock.patch.dict(os.environ, {"DAYTRADE_ESTADO": self.tmp.name})
        self.env.start()
        self.chamadas = []

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def parar_falso(self, codigo=0, liga=True):
        def executar(motivo):
            self.chamadas.append(motivo)
            if liga:
                (self.pasta / "PARAR").write_text(motivo)
            return subprocess.CompletedProcess([], codigo, "", "" if codigo == 0 else "deu ruim")
        return executar

    def test_pausar_liga_o_botao(self):
        estado, _ = porteiro.decidir(pedido(), AGORA, self.parar_falso())
        self.assertEqual(estado, "feito")
        self.assertEqual(self.chamadas, ["central/beto: mercado estranho"])

    def test_ja_parado_nao_chama_de_novo(self):
        (self.pasta / "PARAR").write_text("Sebastian: teste")
        estado, res = porteiro.decidir(pedido(), AGORA, self.parar_falso())
        self.assertEqual(estado, "ja_parado")
        self.assertIn("Sebastian", res)
        self.assertEqual(self.chamadas, [])

    def test_outras_acoes_recusadas(self):
        for acao in ("retomar", "comprar", "limite", "", None):
            estado, _ = porteiro.decidir(pedido(acao=acao), AGORA, self.parar_falso())
            self.assertEqual(estado, "recusado")
        self.assertEqual(self.chamadas, [])
        self.assertFalse((self.pasta / "PARAR").exists())

    def test_pedido_vencido_ou_sem_hora(self):
        self.assertEqual(porteiro.decidir(pedido(em="2026-10-26T19:00:00Z"), AGORA, self.parar_falso())[0], "recusado")
        self.assertEqual(porteiro.decidir(pedido(em="ontem"), AGORA, self.parar_falso())[0], "recusado")
        self.assertEqual(self.chamadas, [])

    def test_erro_do_aovivo(self):
        estado, res = porteiro.decidir(pedido(), AGORA, self.parar_falso(codigo=1, liga=False))
        self.assertEqual(estado, "erro")
        self.assertIn("deu ruim", res)

    def test_botao_ligado_mas_vigia_falhou(self):
        estado, res = porteiro.decidir(pedido(), AGORA, self.parar_falso(codigo=1, liga=True))
        self.assertEqual(estado, "feito")
        self.assertIn("zeramento imediato falhou", res)

    def test_codigo_zero_sem_arquivo_e_erro(self):
        self.assertEqual(porteiro.decidir(pedido(), AGORA, self.parar_falso(liga=False))[0], "erro")

    def test_motivo_e_cliente_limpos(self):
        m = porteiro.motivo_do_pedido(pedido(cliente="Be;to rm -rf", motivo="a\nb\x00c " + "x" * 500))
        self.assertTrue(m.startswith("central/betorm-rf: a b"))
        self.assertNotIn("\n", m)
        self.assertLessEqual(len(m), len("central/") + 20 + 2 + 200)

    def test_rodar_responde_cada_pedido(self):
        enviados = []

        def pedir(url, token, dados=None):
            self.assertEqual(token, "segredo")
            if dados is None:
                self.assertEqual(url, "https://caixa")
                return {"pedidos": [pedido(), pedido(id=8, acao="retomar"), {"id": "x; drop"}, "lixo"]}
            enviados.append((url, dados))
            return {"ok": True}

        feitos = porteiro.rodar("https://caixa", "segredo", AGORA, pedir, self.parar_falso())
        self.assertEqual([f["estado"] for f in feitos], ["feito", "recusado"])
        self.assertEqual([u for u, _ in enviados], ["https://caixa-feito"] * 2)
        self.assertEqual(enviados[0][1]["id"], 7)
        self.assertEqual(len(self.chamadas), 1)

    def test_caixa_vazia(self):
        self.assertEqual(porteiro.rodar("u", "t", AGORA, lambda *a: {"pedidos": []}, self.parar_falso()), [])


if __name__ == "__main__":
    unittest.main()
