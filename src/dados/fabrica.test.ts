// Testes da leitura da fábrica de estratégias (npm test).
import test from "node:test";
import assert from "node:assert/strict";
import { fabricaDeLinhas, fabricaDoLab, filaPorPessoa, porEtapa, rotuloTrilha, ETAPAS } from "./fabrica.ts";

const linha = (c: unknown) => [{ chave: "fabrica:resumo", conteudo: typeof c === "string" ? c : JSON.stringify(c), atualizado: "2026-10-28T10:00:00Z" }];

test("sem a linha ou com linha estragada: nada", () => {
  assert.equal(fabricaDeLinhas([]), null);
  assert.equal(fabricaDeLinhas(linha("{nao é json")), null);
  assert.equal(fabricaDeLinhas(linha({ em: "x" })), null);
});

test("lê candidatos, aceita nomes de etapa com acento e espaço e completa quem está esperando", () => {
  const f = fabricaDeLinhas(linha({ em: "2026-10-28T09:00:00Z", candidatos: [
    { id: "a", titulo: "Virada do mês", mercado: "Cripto", etapa: "Triagem", desde: "2026-10-26" },
    { id: "b", titulo: "Meia hora final", mercado: "Cripto", etapa: "parecer", situacao: "arquivado", veredito: "descartada" },
    { id: "c", titulo: "Regra X", mercado: "EUA", etapa: "Teste histórico", situacao: "rodando", campo_novo: 1 },
    { titulo: "" },
  ] }))!;
  assert.equal(f.origem, "fabrica");
  assert.equal(f.candidatos.length, 3);
  assert.equal(f.candidatos[0].situacao, "aguardando Revisor");
  assert.equal(f.candidatos[1].parado, true);
  assert.equal(f.candidatos[2].etapa, "teste_historico");
  assert.deepEqual(filaPorPessoa(f), { Revisor: 1, Claude: 1 });
  const { colunas, outras } = porEtapa(f);
  assert.equal(colunas.length, ETAPAS.length);
  assert.equal(colunas.find(c => c.etapa.id === "triagem")!.candidatos.length, 1);
  assert.equal(outras.length, 0);
});

test("usa as etapas da própria linha, na ordem dela; etapa desconhecida vai para 'outras'", () => {
  const f = fabricaDeLinhas(linha({ etapas: ["proposto", { id: "triagem", rotulo: "Peneira" }, "arquivado"], candidatos: [
    { titulo: "A", etapa: "proposto" }, { titulo: "B", etapa: "triagem" }, { titulo: "C", etapa: "marte" },
  ] }))!;
  assert.deepEqual(f.etapas.map(e => e.rotulo), ["proposto", "Peneira", "arquivado"]);
  const { colunas, outras } = porEtapa(f);
  assert.equal(colunas[0].candidatos[0].titulo, "A");
  assert.equal(outras[0].titulo, "C");
});

test("sem fábrica, o resumo do laboratório vira candidatos na etapa certa", () => {
  const f = fabricaDoLab({ em: "2026-10-26", cripto: { fichas: 2, linhas: [
    { d: "2026-10-26", t: "Meia hora final do bitcoin", v: "descartada: a taxa come o ganho" },
    { d: "2026-10-27", t: "Ruído", v: "REPROVADA no teste histórico" },
  ] }, eua: { fichas: 0, linhas: [] }, b3: { fichas: 0, linhas: [] } });
  assert.equal(f.origem, "lab");
  assert.equal(f.candidatos[0].etapa, "triagem");
  assert.equal(f.candidatos[0].parado, true);
  assert.equal(f.candidatos[1].etapa, "parecer");
});

test("trilha 2: rótulo de ideia nossa ou adaptação, 'não aprovado' até o veredito; trilha 1 sem rótulo", () => {
  const f = fabricaDeLinhas(linha({ candidatos: [
    { id: "a", titulo: "Canal", mercado: "EUA", etapa: "triagem", trilha: 2, mae: "donchian, faith 2003" },
    { id: "b", titulo: "Nossa", mercado: "Cripto", etapa: "parecer", trilha: 2, veredito: "aprovada" },
    { id: "c", titulo: "Velha", mercado: "EUA", etapa: "parecer", trilha: 2, veredito: "reprovada" },
    { id: "d", titulo: "Replicação", mercado: "EUA", etapa: "triagem" },
  ] }))!;
  assert.deepEqual(f.candidatos.map(rotuloTrilha), [
    "adaptação nossa de donchian, faith 2003 · não aprovado", "ideia nossa", "ideia nossa · não aprovado", null]);
  assert.equal(f.candidatos[3].trilha, 1);
});
