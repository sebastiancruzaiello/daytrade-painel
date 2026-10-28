// @ts-nocheck
// Salão isométrico do "Pregão DAYTRADE", portado de painel-aovivo/salao/index.html (mesmo desenho, mesmas regras).
// Aqui só desenha: quem decide o dia mostrado, a fonte e o teste de parar é o React.
import { KS, NOME, COR, C, dayIdx, fmt, pct, dBR } from "../dados/formato";
import { segurar, pregao, idxAte } from "../dados/mercados";
import { criarCamera } from "./camera";
import { planta, ALA } from "../dados/elenco";
import { ESTADOS } from "../dados/estados";

const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
// O salão de cripto vai de x 0 a 12; a ala de ações (EUA e B3) de x 12 a 22; a ala dos robôs, gerada da lista de
// entidades (src/dados/elenco.ts), de x 22 a 34.
const CURTO = { "mm20-btc": "MM20 BTC", "mm20-eth": "MM20 ETH", "momentum": "Momentum" };
const AZUL = "#8fb0ff"; // títulos da ala de ações e dos grupos por mercado
const W = 1550, H = 960, TW = 64, TH = 32, N = 12, NX = 34, NA = 22, OX = 420, OY = 200;
const P = (x, y, z = 0) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z];

const SEATS = {
  "mm20-btc": [{ x: 3.0, y: 5.7, tv: [2.45, 4.1] }],
  "mm20-eth": [{ x: 4.6, y: 5.7, tv: [4.05, 4.1] }],
  "momentum": [{ x: 6.9, y: 8.2, tv: [6.35, 6.6] }, { x: 8.4, y: 8.2, tv: [7.85, 6.6] }, { x: 9.9, y: 8.2, tv: [9.35, 6.6] }],
};
const LOUNGE = [[1.3, 8.4], [4.2, 8.6], [1.5, 9.9], [4.3, 10.0], [1.4, 10.5], [2.6, 10.5], [3.8, 10.6]];
const OUT = [-0.8, 10.25];
const GUARD = { x: 10.3, y: 2.4 };

export type Cena = { mostrar: (s: EstadoCena) => void; destruir: () => void; mais: () => void; menos: () => void; inicio: () => void; selecionar: (id: string | null) => void };
export type EstadoCena = { D: any; dias: any[]; di: number; pararTeste: boolean; vivo: any | null; aoVivo: boolean; ex: any; entidades: any[] };

// Ids das pessoas: "robo:<conta>:<cadeira>", "staff:escrivao", "staff:guardiao", "agente:<nome>", "ref:SPY", "ref:BOVA11",
// "robo:guardiao-dados", "robo:coletor-clima", "robo:coletor-mercados", "robo:organizador",
// e "ent:<id da entidade>" para cada robô, régua ou carteira desenhado na ala gerada.
export function criarCena(cv: HTMLCanvasElement, aoZoom?: (z: number) => void, aoPessoa?: (id: string) => void): Cena {
  const g = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // O canvas acompanha o tamanho da caixa onde está; a câmera encaixa a cena inteira nele.
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
  function fit() { const w = Math.max(1, Math.round(cv.clientWidth * DPR())), h = Math.max(1, Math.round(cv.clientHeight * DPR())); if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h; }
  fit(); const obs = new ResizeObserver(fit); obs.observe(cv);

  let S: EstadoCena | null = null, flash = 0, raf = 0, lastT = 0;
  let chars = [];
  const staff = [
    { id: "staff:escrivao", nome: "Escrivão", x: 6.2, y: 1.4, cor: C.staff, label: "diário ok", anda: true },
    { id: "agente:pesquisador", nome: "Pesquisador", x: 0.9, y: 3.4, cor: "#8fa9b3", label: "fichas · pela fábrica" },
    { id: "agente:plantonista", nome: "Plantonista", x: 4.4, y: 2.0, cor: "#7fb8ff", label: "boletim diário" },
  ];
  let selecionado: string | null = null;
  // Onde cada pessoa está desenhada (pés), para o clique achar quem foi tocado.
  const posicoes = new Map<string, { x: number; y: number }>();
  function anel(id, sx, sy) {
    posicoes.set(id, { x: sx, y: sy });
    if (id !== selecionado) return;
    g.strokeStyle = C.accent; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy, 16, 7, 0, 0, 7); g.stroke();
  }
  KS.forEach(k => SEATS[k].forEach((s, i) => chars.push({ conta: k, seat: s, i, x: LOUNGE[chars.length % 7][0], y: LOUNGE[chars.length % 7][1], tx: LOUNGE[chars.length % 7][0], ty: LOUNGE[chars.length % 7][1], mode: "lounge", gone: false, bubble: null, bt: 0, coin: null, phase: Math.random() * 6 })));

  /* ---------- desenho base ---------- */
  function poly(pts, fill, stroke?) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } }
  function box(x, y, w, d, h, top, left, right, z0 = 0) {
    const a = P(x, y + d, z0), b = P(x + w, y + d, z0), c = P(x + w, y, z0), A = P(x, y + d, z0 + h), B = P(x + w, y + d, z0 + h), Cc = P(x + w, y, z0 + h), Dd = P(x, y, z0 + h);
    poly([a, b, B, A], left); poly([b, c, Cc, B], right); poly([A, B, Cc, Dd], top);
  }
  function floor() {
    for (let x = 0; x < NX; x++) for (let y = 0; y < N; y++) poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], x < N ? ((x + y) % 2 ? "#222d33" : "#1e282e") : x < NA ? ((x + y) % 2 ? "#252a33" : "#21262e") : ((x + y) % 2 ? "#232b2a" : "#1f2626"));
    poly([P(N, 5.9), P(NA, 5.9), P(NA, 6.1), P(N, 6.1)], "#3a3f4a");
    poly([P(0.4, 8), P(4.6, 8), P(4.6, 11.6), P(0.4, 11.6)], "#2b2a35");
  }
  function wallText(x, y, z, txt, size, color) {
    const o = P(x, y, z), dx = TW / 2, dy = -TH / 2, L = Math.hypot(dx, dy);
    g.save(); g.translate(o[0], o[1]); g.transform(dx / L, dy / L, 0, 1, 0, 0);
    g.font = `700 ${size}px ${FONT}`; g.fillStyle = color; g.textBaseline = "alphabetic"; g.fillText(txt, 0, 0); g.restore();
  }
  function walls() {
    const h = 170;
    poly([P(0, 0), P(NX, 0), P(NX, 0, h), P(0, 0, h)], "#18232a");
    poly([P(0, 0), P(0, N), P(0, N, h), P(0, 0, h)], "#141d23");
    poly([P(0, 0), P(NX, 0), P(NX, 0, 22), P(0, 0, 22)], "#1f2c33");
    poly([P(0, 0), P(0, N), P(0, N, 22), P(0, 0, 22)], "#1a252b");
    wallText(0, 7.2, 118, "DAYTRADE", 34, C.accent);
    wallText(0, 7.2, 96, "simulação ao vivo · aovivo-v1", 13, C.muted);
    poly([P(0, 9.6), P(0, 10.9), P(0, 10.9, 96), P(0, 9.6, 96)], "#0c1114");
    poly([P(0, 9.6, 96), P(0, 10.9, 96), P(0, 10.9, 104), P(0, 9.6, 104)], C.bad);
    wallText(0, 10.8, 112, "SAÍDA", 13, C.bad);
    backText(13.9, 150, "AÇÕES · EUA e B3", 22, AZUL);
    backText(23.2, 150, "ALA DOS ROBÔS", 22, C.good);
    backText(23.2, 132, S && !S.aoVivo ? "estado de agora (o ensaio é só do salão de cripto)" : "gerada da lista: quem existe aparece aqui", 10, C.muted);
  }
  // Texto pintado na parede do fundo (a que corre ao longo de x).
  function backText(x, z, txt, size, color) {
    const o = P(x, 0, z), hyp = Math.hypot(TW / 2, TH / 2);
    g.save(); g.translate(o[0], o[1]); g.transform((TW / 2) / hyp, (TH / 2) / hyp, 0, 1, 0, 0);
    g.font = `700 ${size}px ${FONT}`; g.fillStyle = color; g.fillText(txt, 0, 0); g.restore();
  }
  function panel(x, y, z, wTiles, hPx, draw) {
    const o = P(x, y, z + hPx), hyp = Math.hypot(TW / 2, TH / 2), L = wTiles * hyp;
    g.save(); g.translate(o[0], o[1]); g.transform((TW / 2) / hyp, (TH / 2) / hyp, 0, 1, 0, 0);
    draw(L, hPx); g.restore();
  }
  function spark(vals, w, h, color, mm) {
    const lo = Math.min(...vals), hi = Math.max(...vals), sx = w / (vals.length - 1), sy = v => h - 6 - (v - lo) / ((hi - lo) || 1) * (h - 14);
    if (mm) { g.beginPath(); let up = false; mm.forEach((v, i) => { if (v == null) { up = false; return; } up ? g.lineTo(i * sx, sy(v)) : g.moveTo(i * sx, sy(v)); up = true; }); g.strokeStyle = "rgba(230,236,234,.55)"; g.lineWidth = 1; g.stroke(); }
    g.beginPath(); vals.forEach((v, i) => i ? g.lineTo(i * sx, sy(v)) : g.moveTo(i * sx, sy(v))); g.strokeStyle = color; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); g.arc(w, sy(vals.at(-1)), 2.2, 0, 7); g.fillStyle = color; g.fill();
  }
  function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tag(x, y, txt, col) { g.font = `600 12px ${FONT}`; const w = g.measureText(txt).width + 10; g.fillStyle = "rgba(10,14,16,.82)"; roundRect(x - w / 2, y - 13, w, 17, 4); g.fill(); g.fillStyle = col; g.textAlign = "center"; g.fillText(txt, x, y); g.textAlign = "left"; }
  // Nome no pé de cada boneco: pequeno e desenhado por cima de tudo no fim do quadro, para nada tampar.
  let nomes = [];
  const nome = (id, sx, sy, txt, col) => nomes.push({ id, sx, sy, txt, col });
  // Placas das áreas (ALA EUA, ALA B3, SALA DE APOIO): no chão, mas desenhadas junto com os nomes para nada cobrir.
  const PLACAS = [[21.3, 0.55, "SALA DE APOIO", C.muted], [12.9, 5.6, "ALA EUA ↑", AZUL], [12.9, 6.4, "ALA B3 ↓", AZUL]];
  let placasAla = [];
  function drawNomes() {
    const usados = [], bate = (r) => usados.some(u => r.x < u.x + u.w && u.x < r.x + r.w && r.y < u.y + u.h && u.y < r.y + r.h);
    g.textAlign = "center";
    [...PLACAS, ...placasAla].forEach(([x, y, txt, col]) => {
      const [px, py] = P(x, y); g.font = `700 9.5px ${FONT}`; const w = g.measureText(txt).width + 10;
      g.fillStyle = "rgba(10,14,16,.6)"; roundRect(px - w / 2, py - 8, w, 14, 3); g.fill();
      g.fillStyle = col; g.fillText(txt, px, py + 2); usados.push({ x: px - w / 2, y: py - 8, w, h: 14 });
    });
    // Quem está mais à frente escolhe primeiro; se o nome bater em outro, desce um degrau (até dois).
    g.font = `600 9.5px ${FONT}`;
    [...nomes].sort((a, b) => b.sy - a.sy).forEach(n => {
      const w = g.measureText(n.txt).width + 8, sel = n.id === selecionado;
      let y = n.sy + 5;
      for (let k = 0; k < 3; k++) { if (!bate({ x: n.sx - w / 2, y, w, h: 13 })) break; y += 14; }
      usados.push({ x: n.sx - w / 2, y, w, h: 13 });
      g.fillStyle = sel ? "rgba(107,149,255,.9)" : "rgba(10,14,16,.72)"; roundRect(n.sx - w / 2, y, w, 13, 4); g.fill();
      g.fillStyle = sel ? "#0b0f12" : n.col; g.fillText(n.txt, n.sx, y + 10);
    });
    g.textAlign = "left";
  }
  function bubble(x, y, txt, col) { g.font = `700 12px ${FONT}`; const w = g.measureText(txt).width + 14; g.fillStyle = col; roundRect(x, y - 15, w, 20, 6); g.fill(); g.beginPath(); g.moveTo(x + 6, y + 5); g.lineTo(x + 2, y + 11); g.lineTo(x + 13, y + 5); g.fill(); g.fillStyle = "#0e1316"; g.fillText(txt, x + 7, y); }
  function coinChange(coin) { const { D, dias, di } = S; const f = D.fech[coin] || [], i = dayIdx(D, dias[di].d) - 1; if (i < 1 || !f[i] || !f[i - 1]) return 0; return f[i] / f[i - 1] - 1; }

  /* ---------- quem vai para onde no dia mostrado ---------- */
  function setTargets() {
    const { dias, di, pararTeste, vivo, aoVivo } = S;
    const d = dias[di];
    KS.forEach((k, ki) => {
      const st = pararTeste ? "parada" : d.st[ki], pos = d.pos[ki];
      chars.filter(c => c.conta === k).forEach((c, i) => {
        const coin = k === "mm20-btc" ? "BTC" : k === "mm20-eth" ? "ETH" : pos[i];
        const holding = k === "momentum" ? !!pos[i] : pos.length > 0;
        if (st === "parada") { c.mode = "sair"; c.tx = OUT[0]; c.ty = OUT[1]; }
        else {
          if (c.gone) { c.gone = false; c.x = OUT[0]; c.y = OUT[1]; }
          if (holding && st === "ativa") { c.mode = "mesa"; c.tx = c.seat.x; c.ty = c.seat.y; c.coin = coin; }
          else { if (c.mode !== "lounge") { const s = LOUNGE[(KS.indexOf(k) * 3 + i) % 7]; c.tx = s[0]; c.ty = s[1]; } c.mode = "lounge"; c.coin = k === "momentum" ? null : coin; }
        }
      });
    });
    d.o.forEach(o => {
      const c = chars.find(c => c.conta === o[0] && (o[0] !== "momentum" || c.coin === o[1])) || chars.find(c => c.conta === o[0]);
      if (c) { c.bubble = (o[2] === "compra" ? "compra " : "vende ") + o[1]; c.bt = 1600; c.bcol = o[4] === "motor_de_risco" ? C.bad : (o[2] === "compra" ? C.good : C.accent); }
    });
    if (d.x.some(x => x[1] !== "retomar") || pararTeste) flash = 2200;
    staff[0].label = d.o.length ? "diário ok · " + d.o.length + " ordem" + (d.o.length > 1 ? "s" : "") : "diário ok";
    if (aoVivo && vivo && !vivo.status.diario_integro) staff[0].label = "diário com problema!";
  }

  function drawChar(c, t) {
    if (c.gone) { posicoes.delete(`robo:${c.conta}:${c.i}`); return; }
    const { dias, di } = S;
    const sit = c.mode === "mesa" && Math.hypot(c.x - c.tx, c.y - c.ty) < .05;
    const walking = Math.hypot(c.x - c.tx, c.y - c.ty) > .05;
    const [sx, sy] = P(c.x, c.y), col = COR[c.conta];
    anel(`robo:${c.conta}:${c.i}`, sx, sy);
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.fill();
    const bob = walking ? Math.abs(Math.sin(t / 120 + c.phase)) * 3 : (sit ? Math.sin(t / 260 + c.phase) * 0.8 : Math.sin(t / 700 + c.phase) * 1.2);
    const z = sit ? 10 : 0;
    if (sit) { g.fillStyle = "#3a464d"; g.fillRect(sx - 9, sy - 16, 18, 8); g.fillRect(sx - 2, sy - 8, 4, 8); }
    else { const sw = walking ? Math.sin(t / 120 + c.phase) * 4 : 0; g.fillStyle = "#2c3439"; g.fillRect(sx - 6 + sw, sy - 14, 5, 14); g.fillRect(sx + 1 - sw, sy - 14, 5, 14); }
    const by = sy - 14 - z - bob;
    g.fillStyle = col; roundRect(sx - 9, by - 20, 18, 22, 6); g.fill();
    g.fillStyle = "#e9c9a8"; g.beginPath(); g.arc(sx, by - 27, 8, 0, 7); g.fill();
    g.fillStyle = "#2a2320"; g.beginPath(); g.arc(sx, by - 29, 8.2, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    if (sit) { g.fillStyle = "#2a2320"; g.beginPath(); g.arc(sx, by - 27, 8.2, Math.PI * 1.1, Math.PI * 1.9, true); g.fill(); }
    nome(`robo:${c.conta}:${c.i}`, sx, sy, c.conta === "momentum" ? "Momentum " + (c.i + 1) : NOME[c.conta], col);
    if (c.bubble && c.bt > 0) bubble(sx + 14, by - 60, c.bubble, c.bcol);
  }
  function drawDesk(x, y, w, label, col) {
    box(x, y, w, 0.8, 26, "#3b4850", "#2b363c", "#323e45");
    box(x, y, w, 0.08, 4, col, col, col, 26);
  }
  function drawTV(cx, cy, coin, col, mm, dim) {
    const { D, dias, di } = S;
    const [bx, by] = P(cx + 0.67, cy, 26); g.fillStyle = "#4a565d"; g.fillRect(bx - 1.5, by - 44, 3, 44);
    panel(cx, cy, 70, 1.35, 46, (w, h) => {
      g.fillStyle = "#05080a"; g.fillRect(-3, -3, w + 6, h + 6);
      g.fillStyle = dim ? "#0c1215" : "#0d171b"; g.fillRect(0, 0, w, h);
      if (!coin || dim) { g.font = `600 8px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText(dim ? "desligada" : "sem posição", 5, h / 2 + 3); return; }
      const end = dayIdx(D, dias[di].d), all = D.fech[coin] || [], f = all.slice(Math.max(0, end - 40), end);
      let m = null; if (mm) { m = []; for (let i = Math.max(0, end - 40); i < end; i++) { let s = 0; if (i < 19) { m.push(null); continue; } for (let j = i - 19; j <= i; j++) s += all[j]; m.push(s / 20); } }
      if (f.length < 2) { g.font = `600 8px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText(coin + " · juntando dados", 5, h / 2 + 3); return; }
      g.save(); g.translate(3, 13); spark(f, w - 8, h - 14, col, m); g.restore();
      g.font = `700 9px ${FONT}`; g.fillStyle = C.ink; g.fillText(coin, 4, 10);
      g.fillStyle = C.muted; g.font = `500 8px ${FONT}`; const v = f.at(-1); g.textAlign = "right"; g.fillText(v >= 100 ? fmt(v) : fmt(v, v < 1 ? 4 : 2), w - 4, 11); g.textAlign = "left";
    });
  }
  // Telão: 10.000 em cada conta desde o começo, separado por mercado. À esquerda o gráfico, à direita os números.
  function drawTelao() {
    const { dias, di, ex } = S;
    const ini = Math.max(0, di - 120), sl = dias.slice(ini, di + 1), d0 = dias[0].d;
    const ref = (mk) => mk ? sl.map(d => { const r = segurar(mk, d0, d.d); return r ? r.valor : null; }) : [];
    const linhas = [
      { grupo: "CRIPTO" },
      ...KS.map((k, ki) => ({ nome: CURTO[k], cor: COR[k], s: sl.map(d => d.eq[ki]) })),
      { nome: "Segurar BTC", cor: "rgba(230,236,234,.75)", s: sl.map(d => 10000 * d.px[0] / dias[0].px[0]), tracejado: true },
      { grupo: "EUA" },
      { nome: "Segurar SPY", cor: "#e8a25b", s: ref(ex && ex.spy), tracejado: true },
      { grupo: "B3" },
      { nome: "Segurar BOVA11", cor: "#5fcf8f", s: ref(ex && ex.bova), tracejado: true },
    ];
    panel(3.0, 0.05, 22, 8.0, 146, (w, h) => {
      g.fillStyle = "#04070a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#0b1419"; g.fillRect(0, 0, w, h);
      g.font = `700 11px ${FONT}`; g.fillStyle = C.accent; g.fillText("CARTEIRA", 8, 15);
      g.font = `500 8px ${FONT}`; g.fillStyle = C.muted; g.fillText("10.000 em cada uma desde " + dBR(d0), 64, 15);
      g.fillStyle = C.ink; g.font = `700 10px ${FONT}`; g.textAlign = "right"; g.fillText(dBR(dias[di].d), w - 8, 15); g.textAlign = "left";
      const gw = w * 0.42, top = 26, bot = h - 8;
      const series = linhas.filter(l => l.s && l.s.length > 1);
      const todos = series.flatMap(l => l.s.filter(v => v != null));
      if (sl.length > 1 && todos.length) {
        const lo = Math.min(...todos, 10000), hi = Math.max(...todos, 10000);
        const X = i => 8 + i * (gw - 12) / (sl.length - 1), Y = v => bot - (v - lo) / ((hi - lo) || 1) * (bot - top);
        g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = .6; g.setLineDash([1, 3]); g.beginPath(); g.moveTo(8, Y(10000)); g.lineTo(gw - 4, Y(10000)); g.stroke(); g.setLineDash([]);
        series.forEach(l => {
          g.strokeStyle = l.cor; g.lineWidth = l.tracejado ? 1 : 1.8; g.setLineDash(l.tracejado ? [3, 2] : []);
          g.beginPath(); let up = false; l.s.forEach((v, i) => { if (v == null) { up = false; return; } up ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)); up = true; }); g.stroke();
        });
        g.setLineDash([]);
      }
      // Tabela por mercado.
      let yy = 30; const x0 = gw + 6, xr = w - 8;
      linhas.forEach(l => {
        if (l.grupo) { g.font = `700 8.5px ${FONT}`; g.fillStyle = AZUL; g.fillText(l.grupo, x0, yy); yy += 11; return; }
        const v = l.s && l.s.length ? l.s[l.s.length - 1] : null;
        g.fillStyle = l.cor; g.fillRect(x0, yy - 6, 7, l.tracejado ? 2 : 4);
        g.font = `500 9px ${FONT}`; g.fillStyle = C.ink; g.fillText(l.nome, x0 + 11, yy);
        g.textAlign = "right";
        if (v == null) { g.fillStyle = C.muted; g.fillText("—", xr, yy); }
        else { const r = v / 10000 - 1; g.fillStyle = r >= 0 ? C.good : C.bad; g.fillText(pct(r), xr, yy); g.fillStyle = C.ink; g.fillText(fmt(v), xr - 40, yy); }
        g.textAlign = "left"; yy += 12.5;
      });
    });
  }
  function drawBooth(t) {
    const fl = flash > 0 && Math.floor(t / 180) % 2 === 0;
    box(9.2, 1.2, 2.4, 2.4, 0, "#1b262c", "#1b262c", "#1b262c");
    const glass = fl ? "rgba(236,93,85,.35)" : "rgba(140,190,200,.10)";
    poly([P(9.2, 3.6), P(11.6, 3.6), P(11.6, 3.6, 70), P(9.2, 3.6, 70)], glass, "rgba(160,200,210,.35)");
    poly([P(9.2, 1.2), P(9.2, 3.6), P(9.2, 3.6, 70), P(9.2, 1.2, 70)], glass, "rgba(160,200,210,.35)");
    box(9.6, 1.5, 1.4, 0.6, 22, "#33424a", "#26323a", "#2c3940");
    const [sx, sy] = P(GUARD.x, GUARD.y); anel("staff:guardiao", sx, sy); g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.fill();
    g.fillStyle = "#2c3439"; g.fillRect(sx - 6, sy - 14, 5, 14); g.fillRect(sx + 1, sy - 14, 5, 14);
    g.fillStyle = fl ? C.bad : "#5d7f8c"; roundRect(sx - 9, sy - 36, 18, 22, 6); g.fill();
    g.fillStyle = "#e9c9a8"; g.beginPath(); g.arc(sx, sy - 43, 8, 0, 7); g.fill();
    g.fillStyle = "#1d2a30"; g.fillRect(sx - 9, sy - 52, 18, 6);
    if (fl) tag(sx, sy - 60, "FREIO!", C.bad);
    nome("staff:guardiao", sx, sy, "Guardião", "#9fc3cf");
    const [lx, ly] = P(9.25, 3.6, 78); g.font = `700 9px ${FONT}`; g.fillStyle = "#9fc3cf"; g.fillText("MOTOR DE RISCO", lx - 4, ly);
  }
  function drawLounge() {
    box(0.6, 10.9, 2.6, 0.7, 16, "#5b3f52", "#47313f", "#503848"); box(0.6, 11.4, 2.6, 0.2, 30, "#5b3f52", "#47313f", "#503848");
    box(2.0, 8.6, 1.8, 1.0, 22, "#1f6b4d", "#3a2a20", "#47342a");
    box(0.3, 7.9, 0.6, 0.6, 40, "#6b737a", "#454c52", "#545b61");
    const [cx, cy] = P(0.6, 8.2, 46); g.font = `600 9px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "center"; g.fillText("café", cx, cy - 4);
    const [sx, sy] = P(2.9, 9.1, 30); g.fillText("sinuca", sx, sy - 6); g.textAlign = "left";
  }
  function drawShelf() {
    box(0.15, 2.2, 0.5, 1.8, 90, "#4a3a2c", "#3a2e23", "#44362a");
    for (let k = 0; k < 4; k++) box(0.2, 2.3, 0.4, 1.6, 3, "#6b5440", "#5a4636", "#5a4636", 18 + k * 20);
  }
  function drawStaff(t) {
    staff.forEach((s, i) => {
      const [sx, sy] = P(s.x + (s.anda ? Math.sin(t / 2400) * 0.6 : 0), s.y); anel(s.id, sx, sy); g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.fill();
      g.fillStyle = "#2c3439"; g.fillRect(sx - 6, sy - 14, 5, 14); g.fillRect(sx + 1, sy - 14, 5, 14);
      g.fillStyle = s.cor; roundRect(sx - 9, sy - 36, 18, 22, 6); g.fill();
      g.fillStyle = "#e9c9a8"; g.beginPath(); g.arc(sx, sy - 43, 8, 0, 7); g.fill();
      g.fillStyle = "#3a2c22"; g.beginPath(); g.arc(sx, sy - 45, 8.2, Math.PI, 0); g.fill();
      nome(s.id, sx, sy, s.nome, s.anda ? C.staff : s.cor);
    });
  }

  /* ---------- ala de ações (EUA e B3): só referências, laboratório e equipe de apoio ---------- */
  const ALAS = [
    { id: "ref:SPY", y: 2.2, chave: "spy", nome: "SPY", rotulo: "SÓ SEGURAR SPY", lab: "LABORATÓRIO EUA", labChave: "eua", cor: "#e8a25b", agente: { id: "agente:revisor", nome: "Revisor", cor: "#c9b38a", label: "pareceres" } },
    { id: "ref:BOVA11", y: 7.6, chave: "bova", nome: "BOVA11", rotulo: "SÓ SEGURAR BOVA11", lab: "LABORATÓRIO B3", labChave: "b3", cor: "#5fcf8f", agente: { id: "agente:formalizador", nome: "Formalizador", cor: "#a99ae0", label: "regra lacrada" } },
  ];
  // Equipe de apoio (lado direito da ala): robôs do n8n e os ajudantes da rotina diária.
  const APOIO = [
    { id: "robo:guardiao-dados", nome: "Guardião de dados", x: 21.0, y: 1.7, cor: "#6f9fb0" },
    { id: "robo:coletor-clima", nome: "Coletor de clima", x: 21.0, y: 3.8, cor: "#8fb07a" },
    { id: "robo:coletor-mercados", nome: "Coletor de referências", x: 21.0, y: 5.9, cor: "#d0a35c" },
    { id: "agente:sentinela", nome: "Sentinela", x: 21.0, y: 8.1, cor: "#e07a6a" },
    { id: "robo:organizador", nome: "Organizador", x: 21.0, y: 10.2, cor: "#9a9fb0" },
  ];
  function figura(sx, sy, cor, { sentado = false, apagado = false, t = 0, fase = 0 } = {}) {
    g.save(); if (apagado) g.globalAlpha = 0.45;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.fill();
    const z = sentado ? 10 : 0, bob = sentado ? Math.sin(t / 260 + fase) * 0.8 : Math.sin(t / 700 + fase) * 1.2;
    if (sentado) { g.fillStyle = "#3a464d"; g.fillRect(sx - 9, sy - 16, 18, 8); g.fillRect(sx - 2, sy - 8, 4, 8); }
    else { g.fillStyle = "#2c3439"; g.fillRect(sx - 6, sy - 14, 5, 14); g.fillRect(sx + 1, sy - 14, 5, 14); }
    const by = sy - 14 - z - bob;
    g.fillStyle = cor; roundRect(sx - 9, by - 20, 18, 22, 6); g.fill();
    g.fillStyle = "#e9c9a8"; g.beginPath(); g.arc(sx, by - 27, 8, 0, 7); g.fill();
    g.fillStyle = "#3a2c22"; g.beginPath(); g.arc(sx, by - 29, 8.2, Math.PI, 0); g.fill();
    g.restore();
    return by;
  }
  function drawDivisoria() {
    box(11.85, 0, 0.3, 4.4, 46, "#2c3940", "#202a30", "#26323a");
    box(11.85, 7.6, 0.3, 4.4, 46, "#2c3940", "#202a30", "#26323a");
  }
  function diaMostrado() { return S.dias[S.di].d; }
  function drawFundoTV(cx, cy, mk, cor) {
    const [bx, by] = P(cx + 1.3, cy, 26); g.fillStyle = "#4a565d"; g.fillRect(bx - 1.5, by - 54, 3, 54);
    panel(cx, cy, 80, 2.7, 64, (w, h) => {
      g.fillStyle = "#05080a"; g.fillRect(-3, -3, w + 6, h + 6); g.fillStyle = "#0d171b"; g.fillRect(0, 0, w, h);
      if (!mk) { g.font = `600 9px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText("sem dados", 6, h / 2); return; }
      const dia = diaMostrado(), i = idxAte(mk, dia);
      if (i < 1) { g.font = `600 9px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText("antes do começo dos dados", 6, h / 2); return; }
      g.font = `700 10px ${FONT}`; g.fillStyle = C.ink; g.fillText(mk.t.replace(".SA", ""), 5, 11);
      g.textAlign = "right"; g.fillText((mk.moeda === "BRL" ? "R$ " : "US$ ") + fmt(mk.c[i], 2), w - 5, 11); g.textAlign = "left";
      // Segunda linha: pregão agora (ao vivo) ou se houve pregão no dia mostrado (ensaio).
      let txt, cl;
      if (S.aoVivo && S.ex.aoVivo) { const pg = pregao(mk); txt = pg.aberto ? "pregão aberto" : "pregão fechado"; cl = pg.aberto ? C.good : C.muted; }
      else { const teve = mk.d[i] === dia; txt = teve ? "pregão em " + dBR(dia).slice(0, 5) : "sem pregão em " + dBR(dia).slice(0, 5); cl = teve ? C.good : C.muted; }
      g.font = `600 8px ${FONT}`; g.fillStyle = cl; g.fillText(txt, 5, 22);
      const f = mk.c.slice(Math.max(0, i - 59), i + 1);
      g.save(); g.translate(4, 26); spark(f, w - 10, h - 28, cor, null); g.restore();
    });
  }
  function drawLabMonitor(cx, cy, lab, titulo) {
    panel(cx, cy, 30, 1.6, 30, (w, h) => {
      g.fillStyle = "#05080a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#101a1f"; g.fillRect(0, 0, w, h);
      g.textAlign = "center";
      g.font = `700 8.5px ${FONT}`; g.fillStyle = C.accent; g.fillText(titulo, w / 2, 12);
      g.font = `600 8px ${FONT}`; g.fillStyle = lab.fichas ? C.ink : C.muted;
      g.fillText(lab.fichas ? lab.fichas + " ficha" + (lab.fichas > 1 ? "s" : "") : "sem fichas", w / 2, 24); g.textAlign = "left";
    });
  }
  function drawQuadroLab() {
    const ex = S.ex; if (!ex) return;
    panel(13.9, 0.05, 40, 8.0, 100, (w, h) => {
      g.fillStyle = "#04070a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#0e1418"; g.fillRect(0, 0, w, h);
      g.font = `700 11px ${FONT}`; g.fillStyle = C.accent; g.fillText("LABORATÓRIO · fichas e vereditos", 8, 15);
      g.font = `500 8px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "right"; g.fillText(dBR(ex.lab.em), w - 8, 15); g.textAlign = "left";
      const cols = [["CRIPTO", ex.lab.cripto], ["EUA", ex.lab.eua], ["B3", ex.lab.b3]], cw = (w - 16) / 3;
      cols.forEach(([nm, m], k) => {
        const x0 = 8 + k * cw, larg = cw - 16;
        g.save(); g.beginPath(); g.rect(x0, 22, cw - 6, h - 28); g.clip();
        g.fillStyle = "rgba(255,255,255,.04)"; g.fillRect(x0, 22, cw - 6, h - 28);
        g.font = `700 9px ${FONT}`; g.fillStyle = AZUL; g.fillText(nm, x0 + 5, 34);
        g.font = `500 8px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "right"; g.fillText((m.fichas || 0) + " ficha" + (m.fichas === 1 ? "" : "s"), x0 + cw - 11, 34); g.textAlign = "left";
        if (!m.linhas.length) { g.font = `500 8px ${FONT}`; g.fillStyle = C.muted; quebra(m.nota || "nada ainda", x0 + 5, 48, larg, 10, 4); g.restore(); return; }
        // Uma linha por veredito: a palavra principal colorida e o nome curto da estratégia.
        let yy = 48;
        m.linhas.slice(0, 3).forEach(l => {
          const palavra = (String(l.v).split(/[:\s]/)[0] || "").toUpperCase();
          const cl = /descart|reprov/i.test(l.v) ? C.bad : /aprov|passou/i.test(l.v) ? C.good : C.warn;
          g.font = `700 8px ${FONT}`; g.fillStyle = cl; g.fillText(palavra, x0 + 5, yy);
          g.font = `500 8px ${FONT}`; g.fillStyle = C.ink; yy = quebra(String(l.t).replace(/^ficha:\s*/i, ""), x0 + 5, yy + 10, larg, 9.5, 2) + 5;
        });
        g.restore();
      });
    });
  }
  function quebra(txt, x, y, larg, alt, maxL) {
    const ps = String(txt).split(" "); let l = "", n = 0;
    for (const p of ps) { const t2 = l ? l + " " + p : p; if (g.measureText(t2).width > larg && l) { g.fillText(l, x, y); y += alt; l = p; if (++n >= maxL) return y; } else l = t2; }
    if (l) { g.fillText(l, x, y); y += alt; }
    return y;
  }
  function alaAcoes(objs, t) {
    const ex = S.ex; if (!ex) return;
    const dia = diaMostrado(), inicio = S.dias[0].d;
    ALAS.forEach((a, n) => {
      const mk = ex[a.chave];
      objs.push({ k: 13 + a.y + 0.2, f: () => drawFundoTV(13.15, a.y - 0.1, mk, a.cor) });
      objs.push({ k: 13 + a.y + 0.5, f: () => drawDesk(13.0, a.y, 3.0, a.rotulo, a.cor) });
      objs.push({ k: 16.6 + a.y + 0.5, f: () => { drawDesk(16.6, a.y, 2.7, a.lab, C.accent); drawLabMonitor(17.1, a.y - 0.05, ex.lab[a.labChave], a.lab.replace("LABORATÓRIO", "LAB")); } });

      // Robô de referência: sempre sentado, porque só segura o fundo.
      objs.push({ k: 15.4 + a.y + 1.5 + 0.3, f: () => {
        const [sx, sy] = P(15.4, a.y + 1.5); anel(a.id, sx, sy);
        figura(sx, sy, a.cor, { sentado: true, t, fase: n });
        nome(a.id, sx, sy, "Segurar " + a.nome, a.cor);
      } });
      objs.push({ k: 18.6 + a.y + 1.5 + 0.3, f: () => {
        const ag = a.agente, [sx, sy] = P(18.6, a.y + 1.5); anel(ag.id, sx, sy);
        figura(sx, sy, ag.cor, { sentado: true, t, fase: n + 2 });
        nome(ag.id, sx, sy, ag.nome, ag.cor);
      } });
    });
    objs.push({ k: 20.3 + 1, f: () => box(20.05, 0.9, 0.4, 10.4, 24, "#33404a", "#252f36", "#2c373f") });
    APOIO.forEach((p, n) => objs.push({ k: p.x + p.y + 0.3, f: () => {
      const [sx, sy] = P(p.x, p.y); anel(p.id, sx, sy);
      figura(sx, sy, p.cor, { t, fase: n });
      const gd = ex.guardiao, alerta = p.id === "robo:guardiao-dados" && gd && gd.nivel !== "ok";
      if (alerta) tag(sx, sy - 58, "!", gd.nivel === "falha" ? C.bad : C.warn);
      nome(p.id, sx, sy, p.nome, p.cor);
    } }));
  }

  /* ---------- ala dos robôs: uma pessoa por entidade da lista; nenhuma cadeira escrita à mão por robô ---------- */
  const COR_MERCADO = { Cripto: "#4fc1c9", EUA: "#e8a25b", B3: "#5fcf8f" };
  const CURTO_ESTADO = { "aguardando-mercado": "fechado", "aguardando-dado": "sem dado", "falha-conexao": "falha", "dado-velho": "dado velho", "pausado": "pausa", "parado": "parado", "sem-capital": "sem capital" };
  const TOM_COR = { ok: C.good, espera: "#8fb0ff", aviso: C.warn, ruim: C.bad };
  let plantaAtual = planta([]), entPlanta = null;
  function plantaDe(lista) { if (lista !== entPlanta) { entPlanta = lista; plantaAtual = planta(lista || []); } return plantaAtual; }
  const curtoNome = (t) => t.length > 15 ? t.slice(0, 14) + "…" : t;
  function tagP(x, y, txt, col) { g.font = `700 9px ${FONT}`; const w = g.measureText(txt).width + 8; g.fillStyle = "rgba(10,14,16,.85)"; roundRect(x - w / 2, y - 10, w, 13, 3); g.fill(); g.fillStyle = col; g.textAlign = "center"; g.fillText(txt, x, y); g.textAlign = "left"; }
  function drawEntidade(x, l, t, n) {
    const id = "ent:" + x.id, [sx, sy] = P(l.x, l.y);
    anel(id, sx, sy);
    const est = ESTADOS[x.estado] || ESTADOS["aguardando-dado"];
    // Sentado = comprado e rodando; em pé = em caixa ou esperando; apagado = parado, sem conexão ou sem telemetria.
    const sentado = x.estado === "ativo" && x.posicoes && x.posicoes.length > 0;
    const apagado = !!x.semTelemetria || x.estado === "parado" || x.estado === "falha-conexao";
    const cor = COR_MERCADO[x.mercado] || C.accent;
    const by = figura(sx, sy, x.tipo === "robo" ? cor : "#8a949c", { sentado, apagado, t, fase: n * 0.7 });
    if (x.tipo !== "robo") { g.fillStyle = cor; g.fillRect(sx - 9, by - 13, 18, 3); }  // régua ou carteira: faixa na cor do mercado
    const curto = x.semTelemetria ? "sem dado" : CURTO_ESTADO[x.estado];
    const r = x.resultado;
    // Rodando: o resultado em verde ou vermelho. Fora disso: a situação, na cor dela (o resultado fica na ficha).
    if (curto) tagP(sx, by - 42, curto, TOM_COR[est.tom]);
    else if (r != null) tagP(sx, by - 42, pct(r), r > 0 ? C.good : r < 0 ? C.bad : C.muted);
    nome(id, sx, sy, curtoNome(x.nome), x.tipo === "robo" ? cor : "#b9c2c8");
  }
  // Desenhada depois do resto (fica à direita e na frente): por fileira, primeiro a mesa, depois quem senta nela.
  function alaRobos(t) {
    const lista = S.entidades || [], pl = plantaDe(lista), porId = new Map(lista.map(x => [x.id, x]));
    // Nome da faixa na ponta direita da primeira mesa, onde não há ninguém sentado.
    placasAla = pl.faixas.map(fx => [ALA.x1 + 0.2, fx.fileiras[0].y - 0.7, `${fx.nome.toUpperCase()} · ${fx.fileiras.reduce((a, f) => a + f.n, 0)}`, COR_MERCADO[fx.nome] || AZUL]);
    if (pl.foraDaAla.length) placasAla.push([ALA.x0 + 5.3, ALA.y1 - 0.1, `+${pl.foraDaAla.length} sem lugar: veja a aba Robôs`, C.warn]);
    if (!pl.lugares.length) placasAla.push([ALA.x0 + 5.3, 5.5, S.aoVivo ? "nenhum robô chegou na leitura" : "liga o ao vivo para ver os robôs", C.muted]);
    box(22.1, 0, 0.3, 3.6, 46, "#2c3940", "#202a30", "#26323a");
    box(22.1, 8.4, 0.3, 3.6, 46, "#2c3940", "#202a30", "#26323a");
    const fileiras = [];
    pl.faixas.forEach(fx => fx.fileiras.forEach(fl => fileiras.push({ y: fl.y, cor: COR_MERCADO[fx.nome] || C.accent })));
    fileiras.forEach(fl => {
      drawDesk(ALA.x0 + 0.05, fl.y - 1.05, ALA.x1 - ALA.x0 - 0.1, "", fl.cor);
      pl.lugares.filter(l => l.y >= fl.y - 1e-6 && l.y < fl.y + 0.5).forEach((l, n) => { const x = porId.get(l.id); if (x) drawEntidade(x, l, t, n); });
    });
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!S) return;
    const dt = Math.min(64, t - (lastT || t)); lastT = t;
    flash = Math.max(0, flash - dt);
    chars.forEach(c => {
      const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy), sp = dt * 0.0032 * (reduce ? 4 : 1);
      if (dist > 0.02) { c.x += dx / dist * Math.min(sp, dist); c.y += dy / dist * Math.min(sp, dist); }
      else if (c.mode === "sair") c.gone = true;
      if (c.bt > 0) c.bt -= dt;
    });
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0b0f12"; g.fillRect(0, 0, cv.width, cv.height);
    camera.aplicar(g, DPR(), dt);
    floor(); walls(); drawTelao(); drawShelf(); drawQuadroLab();
    nomes = [];
    const d = S.dias[S.di];
    const objs = [];
    objs.push({ k: 6.9, f: () => drawDesk(2.2, 4.2, 3.2, "MESA MM20", C.accent) });
    objs.push({ k: 4.5, f: () => { drawTV(2.45, 4.1, "BTC", COR["mm20-btc"], true, d.st[0] === "parada"); drawTV(4.05, 4.1, "ETH", COR["mm20-eth"], true, d.st[1] === "parada"); } });
    objs.push({ k: 10.6, f: () => drawDesk(6.2, 6.7, 4.4, "MESA MOMENTUM", C.accent) });
    objs.push({ k: 10.55, f: () => SEATS.momentum.forEach((s, i) => drawTV(s.tv[0], s.tv[1], d.pos[2][i], COR.momentum, false, d.st[2] === "parada")) });
    objs.push({ k: 12.7, f: () => drawBooth(t) });
    objs.push({ k: 9.5, f: () => drawLounge() });
    objs.push({ k: 5, f: () => drawStaff(t) });
    objs.push({ k: 11.5, f: () => drawDivisoria() });
    alaAcoes(objs, t);
    chars.forEach(c => objs.push({ k: c.x + c.y + 0.3, f: () => drawChar(c, t) }));
    objs.sort((a, b) => a.k - b.k).forEach(o => o.f());
    alaRobos(t);
    drawNomes();
    KS.forEach((k, ki) => {
      if (d.st[ki] === "parada" || S.pararTeste) {
        const pos = k === "momentum" ? P(8.2, 7.4, 60) : P(k === "mm20-btc" ? 3.0 : 4.6, 4.9, 60);
        tag(pos[0], pos[1], NOME[k] + " parada · volta só com ordem do Sebastian", C.bad);
      }
    });
  }
  // Pontos onde um clique aproxima: mesas, telão, cabine do motor de risco e área de descanso.
  const ALVOS = [
    { p: P(3.8, 4.9, 30), zoom: 2.6 }, { p: P(8.4, 7.4, 30), zoom: 2.4 }, { p: P(6.3, 0.05, 110), zoom: 2.2 },
    { p: P(10.4, 2.4, 40), zoom: 2.6 }, { p: P(2.4, 9.8, 20), zoom: 2.4 }, { p: P(0.9, 3.4, 40), zoom: 2.8 },
    { p: P(14.5, 2.9, 40), zoom: 2.6 }, { p: P(18.6, 2.9, 40), zoom: 2.6 }, { p: P(14.5, 8.3, 40), zoom: 2.6 }, { p: P(18.6, 8.3, 40), zoom: 2.6 },
    { p: P(17.0, 0.05, 80), zoom: 2.1 }, { p: P(20.9, 6.0, 30), zoom: 2.0 },
    { p: P(28.3, 2.6, 30), zoom: 2.0 }, { p: P(28.3, 6.0, 30), zoom: 2.0 }, { p: P(28.3, 9.4, 30), zoom: 2.0 },
  ].map(a => ({ x: a.p[0], y: a.p[1], raio: 110, zoom: a.zoom }));
  // Clique (ou cursor por cima): acha a pessoa mais próxima do ponto, olhando o corpo inteiro (pés até a cabeça).
  function tocar(x, y, soOlhar) {
    let achou = null, melhor = 1e9;
    posicoes.forEach((p, id) => {
      if (Math.abs(x - p.x) > 14 || y < p.y - 62 || y > p.y + 8) return;
      const d = Math.abs(x - p.x) + Math.abs(y - (p.y - 28)) / 3;
      if (d < melhor) { melhor = d; achou = { id, p }; }
    });
    if (!achou) return null;
    if (!soOlhar) { selecionado = achou.id; aoPessoa && aoPessoa(achou.id); }
    return { x: achou.p.x, y: achou.p.y - 40, zoom: 2.4 };
  }
  const camera = criarCamera(cv, W, H, () => ALVOS, aoZoom, tocar);
  raf = requestAnimationFrame(frame);

  return {
    mais: () => camera.mais(),
    menos: () => camera.menos(),
    inicio: () => camera.inicio(),
    selecionar: (id) => { selecionado = id; },
    mostrar(s) {
      const mudou = !S || S.di !== s.di || S.dias !== s.dias || S.pararTeste !== s.pararTeste;
      S = s;
      if (mudou) setTargets();
    },
    destruir() { cancelAnimationFrame(raf); obs.disconnect(); camera.destruir(); },
  };
}
