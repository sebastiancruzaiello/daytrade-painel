// Testes do elenco do escritório: quem o cadastro espera aparece (mesmo sem dado), e cada entidade ganha um lugar
// gerado na ala, sem cadeira escrita à mão (auditoria de 28/10/2026, achados A e B).
import test from "node:test";
import assert from "node:assert/strict";
import { elencoDeLinhas, reconciliar, planta, desenhados, FIXOS, ALA, POR_FILEIRA, ondeFica, vagasLazer, LAZER, type Elenco } from "./elenco.ts";
import type { Entidade, Mercado } from "./estados";

function ent(id: string, mercado: Mercado, extra: Partial<Entidade> = {}): Entidade {
  return {
    id, tipo: "robo", nome: id, mercado, estrategia: "x", versao: "v1", horizonte: "Diário", estagio: "Observação (lote)",
    estado: "ativo", motivo: "", ultima: null, proxima: null, moeda: "USD", capital: 1000, patrimonio: 1000, resultado: 0,
    quedaMax: null, custos: null, posicoes: [], amostra: "", regra: "", dados: "", parecer: null, custoIA: "", linha: [], ...extra,
  };
}
const linha = (conteudo: unknown) => [{ chave: "elenco:esperado", conteudo: JSON.stringify(conteudo) }];

test("lê o cadastro, ignora repetidos e linha estragada", () => {
  const e = elencoDeLinhas(linha({ em: "2026-10-28T12:00:00Z", esperados: [{ id: "lote:mm20-sol", origem: "lote" }, { id: "lote:mm20-sol" }, { nada: 1 }], erros: ["bolsa: x"] }))!;
  assert.deepEqual(e.esperados.map(x => x.id), ["lote:mm20-sol"]);
  assert.deepEqual(e.erros, ["bolsa: x"]);
  assert.equal(elencoDeLinhas([{ chave: "elenco:esperado", conteudo: "{estragado" }]), null);
  assert.equal(elencoDeLinhas([]), null);
});

test("esperado que não chegou aparece como sem telemetria, com mercado certo, e entra na conta", () => {
  const elenco: Elenco = { em: null, erros: [], esperados: ["lote:mm20-sol", "lote:mm20-bova11", "lote:mm10m-efa", "carteira:brasil"].map(id => ({ id, origem: "?", versao: "lote-v1" })) };
  const { lista, conta } = reconciliar([ent("lote:mm20-sol", "Cripto"), ent("bolsa:eua:mm10m-spy", "EUA")], elenco, "sem telemetria");
  assert.equal(conta.esperados, 4);
  assert.equal(conta.recebidos, 1);
  assert.deepEqual(conta.faltando, ["lote:mm20-bova11", "lote:mm10m-efa", "carteira:brasil"]);
  assert.deepEqual(conta.foraDoCadastro, ["bolsa:eua:mm10m-spy"]);
  const falta = lista.find(x => x.id === "lote:mm20-bova11")!;
  assert.equal(falta.semTelemetria, true);
  assert.equal(falta.estado, "aguardando-dado");
  assert.equal(falta.mercado, "B3");
  assert.equal(lista.find(x => x.id === "lote:mm10m-efa")!.mercado, "EUA");
  assert.equal(lista.find(x => x.id === "carteira:brasil")!.tipo, "carteira");
  assert.equal(falta.patrimonio, null);  // nada inventado
});

test("sem o cadastro, a lista fica como veio e a conta diz que não há esperados", () => {
  const l = [ent("lote:a", "EUA")];
  const r = reconciliar(l, null, "x");
  assert.equal(r.lista, l);
  assert.equal(r.conta.esperados, null);
});

test("uma entidade nova ganha lugar na ala sem cadeira nova escrita à mão", () => {
  const base = [ent("cripto:mm20-btc", "Cripto"), ent("lote:a", "EUA"), ent("lote:b", "B3")];
  const p1 = planta(base);
  assert.equal(p1.lugares.length, 2);  // o cripto diário tem lugar fixo no salão antigo
  const p2 = planta([...base, ent("lote:teste-novo", "EUA")]);
  const novo = p2.lugares.find(l => l.id === "lote:teste-novo")!;
  assert.ok(novo, "a entidade de teste tem lugar");
  assert.ok(novo.x > ALA.x0 && novo.x < ALA.x1 && novo.y > ALA.y0 && novo.y <= ALA.y1);
  assert.equal(desenhados([...base, ent("lote:teste-novo", "EUA")], p2), 4);
});

test("parado continua desenhado, no mesmo lugar (não some)", () => {
  const l = [ent("lote:a", "EUA"), ent("lote:b", "EUA")];
  const antes = planta(l).lugares.find(x => x.id === "lote:b")!;
  const depois = planta([l[0], { ...l[1], estado: "parado" }]).lugares.find(x => x.id === "lote:b")!;
  assert.deepEqual(depois, antes);
});

test("lugares não se repetem, mercados em faixas, e quem não cabe é contado", () => {
  const muitos: Entidade[] = [];
  (["Cripto", "EUA", "B3"] as Mercado[]).forEach(m => { for (let i = 0; i < 14; i++) muitos.push(ent(`lote:${m}-${i}`, m)); });
  const p = planta(muitos);
  const chaves = new Set(p.lugares.map(l => `${l.x.toFixed(2)},${l.y.toFixed(2)}`));
  assert.equal(chaves.size, p.lugares.length);
  assert.equal(p.lugares.length + p.foraDaAla.length, muitos.length);
  assert.ok(p.foraDaAla.length > 0);
  assert.deepEqual(p.faixas.map(f => f.nome), ["Cripto", "EUA", "B3"].slice(0, p.faixas.length));
  p.faixas.forEach(f => f.fileiras.forEach(fl => assert.ok(fl.n <= POR_FILEIRA)));
  assert.ok(p.lugares.every(l => l.y <= ALA.y1));
});

test("o elenco de hoje (20 fora do cripto diário) cabe inteiro", () => {
  const hoje: Entidade[] = [
    ...["ruido-btc", "ruido-eth"].map(k => ent("intradia:" + k, "Cripto")),
    ...["mm10m-spy", "segurar-spy", "cesta-20-eua"].map(k => ent("bolsa:eua:" + k, "EUA")),
    ...["mm10m-bova11", "segurar-bova11", "cesta-6-b3"].map(k => ent("bolsa:b3:" + k, "B3")),
    ent("carteira:brasil", "B3", { tipo: "carteira" }), ent("carteira:eua", "EUA", { tipo: "carteira" }), ent("carteira:cripto", "Cripto", { tipo: "carteira" }),
    ...["mm20-sol", "momentum-cripto7"].map(k => ent("lote:" + k, "Cripto")),
    ...["mm10m-efa", "mm10m-ief", "mm10m-vnq", "mm10m-gld", "virada-spy"].map(k => ent("lote:" + k, "EUA")),
    ...["mm20-bova11", "mm10m-smal11"].map(k => ent("lote:" + k, "B3")),
    ...[...FIXOS].map(id => ent(id, "Cripto")),
  ];
  const p = planta(hoje);
  assert.equal(p.foraDaAla.length, 0);
  assert.equal(desenhados(hoje, p), hoje.length);
});

test("mesa só para quem tem posição; sem posição vai para o lazer; falha, pausa e sem dado ficam com alerta", () => {
  assert.equal(ondeFica(ent("lote:a", "EUA", { posicoes: ["9 EFA"] })), "mesa");
  assert.equal(ondeFica(ent("lote:a", "EUA", { estado: "aguardando-mercado", posicoes: ["9 EFA"] })), "mesa");  // comprado e esperando = operando
  assert.equal(ondeFica(ent("lote:a", "EUA", { posicoes: [] })), "lazer");
  assert.equal(ondeFica(ent("lote:a", "EUA", { estado: "sem-capital", posicoes: [] })), "lazer");
  for (const estado of ["parado", "pausado", "falha-conexao", "dado-velho", "aguardando-dado"] as const)
    assert.equal(ondeFica(ent("lote:a", "EUA", { estado, posicoes: ["9 EFA"] })), "alerta", estado);
  assert.equal(ondeFica({ ...ent("lote:a", "EUA", { posicoes: ["1 SPY"] }), semTelemetria: true }), "alerta");
});

test("área de lazer: uma vaga por robô, sem repetir, dentro da área e na mesma ordem a cada leitura", () => {
  const ids = Array.from({ length: 30 }, (_, i) => "lote:r" + String(i).padStart(2, "0"));
  const a = vagasLazer(ids), b = vagasLazer([...ids].reverse());
  assert.deepEqual(a, b);
  assert.equal(a.vagas.length + a.semVaga.length, 30);
  assert.equal(new Set(a.vagas.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`)).size, a.vagas.length);
  assert.ok(a.vagas.every(v => v.x >= LAZER.x0 && v.x <= LAZER.x1 && v.y >= LAZER.y0 && v.y <= LAZER.y1));
  assert.equal(a.semVaga.length, 0);
});
