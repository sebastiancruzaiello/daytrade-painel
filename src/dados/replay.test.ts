// Testes dos testes no passado (§8.6): os números são os do replay do laboratório (src/dados/replay.json), a frase
// diz o período, que é controle e não resultado de hoje, e capital que não comprou nada não vira "retorno de 0%".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faixa, quadro, minimo, mesAno, type Replay } from "./replay.ts";

const R: Replay = JSON.parse(readFileSync(new URL("./replay.json", import.meta.url), "utf8"));
const c = (id: string) => R.controles.find(x => x.id === id)!;

test("origem rastreável: commit do laboratório, lacre e SHA-256 de cada arquivo lido", () => {
  assert.equal(R.origem.versao, "REPLAY-v1");
  assert.match(R.origem.lacre, /^[0-9a-f]{64}$/);
  for (const n of ["resultado.json", "patrimonio-mm20-btc.csv", "operacoes-ruido-btc-original.csv"]) assert.match(R.origem.arquivos[n], /^[0-9a-f]{64}$/);
  assert.equal(R.controles.length, 3);
  for (const x of R.controles) { assert.equal(x.faixas.length, 8); assert.ok(x.conciliacao.ok); assert.equal(x.conciliacao.eventos_replay, x.registros_original); }
});

test("o exemplo do encaminhamento: MM20 BTC, 1.000 USDT, custos originais", () => {
  const q = quadro(c("mm20-btc"), faixa(c("mm20-btc"), 1000, "original")!);
  assert.equal(q.periodo, "Teste no passado: jan/2024 a set/2026.");
  assert.equal(q.final, "1.632,75 USDT");
  assert.equal(q.ganho, "+632,75 USDT (+63,27%)");
  assert.match(q.custos, /^176,50 USDT em taxas simuladas \(0,12% por compra ou venda\)/);
  assert.equal(q.queda, "33,33% no pior momento");
  assert.match(q.conclusao, /^Reprovada .*: ganhou no período, mas menos que só segurar/);
  assert.match(q.tipo, /Não é resultado de hoje/);
  assert.match(q.contagem, /^54 ciclos completos/);       // 108 registros de compra e venda = 54 ciclos
  assert.equal(c("mm20-btc").registros_original, 108);
});

test("capital que não comprou nada: 'não conseguiu operar', não 'retorno de 0%'", () => {
  const q = quadro(c("virada-spy"), faixa(c("virada-spy"), 100, "original")!);
  assert.equal(q.final, "Não conseguiu operar com este capital");
  assert.equal(q.tom, "aviso");
  assert.equal(q.queda, "não se aplica: não comprou nada");
  assert.match(q.comparacao, /também não daria/);
  assert.match(q.semCapital!, /516 vezes \(a primeira em 04\/01\/2016\)/);
  assert.match(minimo(c("virada-spy"), "original")!, /cerca de US\$ 636,12\. É diagnóstico, não recomendação/);
});

test("perda grande diz que avalia só a regra, sem os freios; SPY explica o dividendo no caixa", () => {
  const q = quadro(c("ruido-btc"), faixa(c("ruido-btc"), 1000, "original")!);
  assert.equal(q.tom, "ruim");
  assert.match(q.ganho, /^−935,05 USDT \(−93,51%\)/);
  assert.ok(q.premissas.some(p => /sem os freios do motor de risco/.test(p)));
  const s = quadro(c("virada-spy"), faixa(c("virada-spy"), 10000, "original")!);
  assert.ok(s.premissas.some(p => /dividendo .* entra no caixa/.test(p)));
  assert.match(s.comparacao, /dividendos parados no caixa/);
  assert.equal(mesAno("2016-01-04"), "jan/2016");
});
