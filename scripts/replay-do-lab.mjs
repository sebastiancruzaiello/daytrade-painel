// Copia para o painel os resultados do replay histórico (daytrade-lab, lab/reports/replay, REPLAY-v1, PR lab#102),
// sem refazer conta nenhuma: só lê resultado.json, os patrimônios por dia e a contagem de registros, e grava
// src/dados/replay.json com a origem (commit do lab, lacre e SHA-256 de cada arquivo lido).
//
//   node scripts/replay-do-lab.mjs <pasta lab/reports/replay> <commit do daytrade-lab>
//
// O que é texto escrito à mão aqui (nome em português, veredito, de onde vem o veredito) fica no objeto CONTROLES
// e aponta para o parecer de cada regra. Os números vêm todos dos arquivos.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [pasta, commitLab] = process.argv.slice(2);
if (!pasta || !commitLab) { console.error("uso: node scripts/replay-do-lab.mjs <lab/reports/replay> <commit>"); process.exit(1); }

const CONTROLES = {
  "mm20-btc": {
    nome: "Média de 20 dias · Bitcoin", regra: "MM20-v1", ativo: "BTC", moeda: "USDT",
    explica: "Compra bitcoin quando o fechamento do dia passa acima da média dos últimos 20 dias e vende quando fica abaixo.",
    veredito: "Reprovada no experimento 2: ganhou no período, mas menos que só segurar o bitcoin e não passou no teste contra a sorte.",
    parecer: "lab/README.md, experimento 2",
  },
  "virada-spy": {
    nome: "Virada do mês · S&P 500 (SPY)", regra: "VIRADA-EUA-v1", ativo: "SPY", moeda: "USD",
    explica: "Fica comprado no SPY só no último pregão do mês e nos 3 primeiros do mês seguinte; no resto, em caixa.",
    veredito: "Reprovada no parecer de 27/10: ganhou bem menos que só segurar o SPY e não passou no teste contra a sorte.",
    parecer: "lab/fila/pareceres/PARECER-2026-10-27-VIRADA-EUA-v1.md",
  },
  "ruido-btc": {
    nome: "Rompimento da faixa do dia · Bitcoin (day trade)", regra: "RUIDO-v1", ativo: "BTC", moeda: "USDT",
    explica: "Confere a cada meia hora se o preço saiu muito acima da faixa normal do dia; se sim, compra. Vende tudo no fim do dia.",
    veredito: "Reprovada no parecer de 27/10: opera demais e a taxa de cada compra e venda come o pequeno ganho.",
    parecer: "lab/fila/pareceres/PARECER-2026-10-27-RUIDO-v1.md",
  },
};

const sha = b => createHash("sha256").update(b).digest("hex");
const arquivos = {};
const ler = nome => { const b = readFileSync(join(pasta, nome)); arquivos[nome] = sha(b); return b.toString("utf8"); };

const r = JSON.parse(ler("resultado.json"));
const saida = {
  origem: {
    repositorio: "daytrade-lab", pasta: "lab/reports/replay", commit_lab: commitLab, commit_da_rodada: r.commit,
    versao: r.versao, lacre: r.lacre, comando: r.comando, arquivos, observacoes: r.observacoes,
  },
  controles: [],
};

// Patrimônio de cada dia em cada faixa, reduzido a no máximo ~160 pontos (o último sempre entra) para o gráfico.
function curvas(nome) {
  const linhas = ler(nome).trim().split("\n");
  const cab = linhas[0].split(",");
  const dados = linhas.slice(1).map(l => l.split(","));
  const passo = Math.max(1, Math.ceil(dados.length / 160));
  const idx = dados.map((_, i) => i).filter(i => i % passo === 0 || i === dados.length - 1);
  const series = {};
  cab.slice(1).forEach((c, j) => { series[c] = idx.map(i => Math.round(Number(dados[i][j + 1]) * 100) / 100); });
  return { inicio: dados[0][0].slice(0, 10), fim: dados[dados.length - 1][0].slice(0, 10), dias: dados.length,
    datas: idx.map(i => dados[i][0].slice(0, 10)), series };
}
const registros = nome => ler(nome).trim().split("\n").length - 1;

for (const [id, t] of Object.entries(CONTROLES)) {
  const f = r.faixas[id], c = r.conciliacao[id];
  if (!f || !c) throw new Error("faltou " + id + " no resultado.json");
  const cur = curvas(`patrimonio-${id}.csv`);
  saida.controles.push({
    id, ...t,
    periodo: { inicio: cur.inicio, fim: cur.fim, dias: cur.dias },
    conciliacao: { ok: c.ok, eventos_replay: c.eventos.n_replay, eventos_original: c.eventos.n_original },
    registros_original: registros(`operacoes-${id}-original.csv`),
    capital_minimo: f.capital_minimo,
    faixas: f.faixas.map(x => ({
      capital: x.capital, custo: x.custo, custo_por_ponta: x.custo_por_ponta, regra_quantidade: x.regra,
      final: x.final, retorno: x.retorno, pior_queda: x.pior_queda, exposicao: x.exposicao,
      ciclos: x.operacoes, custos_pagos: x.custos_pagos, proventos: x.proventos,
      sem_capital: x.capital_insuficiente, segurar: { final: x.segurar.final, retorno: x.segurar.retorno, pior_queda: x.segurar.pior_queda, custos_pagos: x.segurar.custos_pagos, proventos: x.segurar.proventos },
    })),
    curvas: { datas: cur.datas, series: cur.series },
  });
}
writeFileSync(new URL("../src/dados/replay.json", import.meta.url), JSON.stringify(saida) + "\n");
console.log("replay.json gravado:", saida.controles.map(c => `${c.id} ${c.faixas.length} faixas`).join(", "));
