// @ts-nocheck
// Salão isométrico do "Pregão DAYTRADE", portado de painel-aovivo/salao/index.html (mesmo desenho, mesmas regras).
// Aqui só desenha: quem decide o dia mostrado, a fonte e o teste de parar é o React.
import { KS, NOME, COR, C, dayIdx, fmt, pct, dBR } from "../dados/formato";
import { segurar, pregao, idxAte } from "../dados/mercados";
import { criarCamera } from "./camera";

const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
// O salão de cripto vai de x 0 a 12; a ala de ações (EUA e B3) de x 12 a 22.
const W = 1140, H = 760, TW = 64, TH = 32, N = 12, NX = 22, OX = 420, OY = 200;
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
export type EstadoCena = { D: any; dias: any[]; di: number; pararTeste: boolean; vivo: any | null; aoVivo: boolean; ex: any };

// Ids das pessoas: "robo:<conta>:<cadeira>", "staff:escrivao", "staff:guardiao", "agente:<nome>", "ref:SPY", "ref:BOVA11",
// "robo:guardiao-dados", "robo:coletor-clima", "robo:coletor-mercados", "robo:organizador".
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
    { id: "agente:pesquisador", nome: "Pesquisador", x: 0.9, y: 3.4, cor: "#8fa9b3", label: "fichas · segundas" },
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
    for (let x = 0; x < NX; x++) for (let y = 0; y < N; y++) poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], x < N ? ((x + y) % 2 ? "#222d33" : "#1e282e") : ((x + y) % 2 ? "#252a33" : "#21262e"));
    poly([P(N, 5.9), P(NX, 5.9), P(NX, 6.1), P(N, 6.1)], "#3a3f4a");
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
    backText(12.8, 148, "AÇÕES · EUA e B3", 22, C.brand);
    backText(12.8, 131, "só olhar: aqui ninguém compra nem vende", 11, C.muted);
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
    const d = dias[di], ki = KS.indexOf(c.conta);
    let txt, tc;
    if (c.mode === "sair") { txt = "parada"; tc = C.bad; }
    else if (c.coin && sit) { const ch = coinChange(c.coin); txt = c.coin + " " + pct(ch); tc = ch >= 0 ? C.good : C.bad; }
    else if (d.st[ki] === "pausada") { txt = "pausa"; tc = C.warn; }
    else { txt = "em caixa"; tc = C.muted; }
    tag(sx, by - 44, txt, tc);
    if (c.bubble && c.bt > 0) bubble(sx + 14, by - 60, c.bubble, c.bcol);
  }
  function drawDesk(x, y, w, label, col) {
    box(x, y, w, 0.8, 26, "#3b4850", "#2b363c", "#323e45");
    box(x, y, w, 0.08, 4, col, col, col, 26);
    const [px, py] = P(x + 0.15, y + 0.8, 20); g.font = `700 11px ${FONT}`; g.fillStyle = col; g.fillText(label, px - 2, py + 16);
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
  function drawTelao() {
    const { dias, di } = S;
    const ini = Math.max(0, di - 120), sl = dias.slice(ini, di + 1);
    panel(3.0, 0.05, 30, 6.6, 138, (w, h) => {
      g.fillStyle = "#04070a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#0b1419"; g.fillRect(0, 0, w, h);
      g.font = `700 11px ${FONT}`; g.fillStyle = C.accent; g.fillText("CARTEIRA", 8, 16); g.font = `500 9px ${FONT}`; g.fillStyle = C.muted; g.fillText("patrimônio das 3 contas · tracejado: só segurar BTC", 8, h - 4);
      g.fillStyle = C.ink; g.font = `700 11px ${FONT}`; g.textAlign = "right"; g.fillText(dBR(dias[di].d), w - 8, 16); g.textAlign = "left";
      if (sl.length < 2) return;
      const p0 = dias[0].px[0], hold = sl.map(d => 10000 * d.px[0] / p0);
      const series = KS.map((k, ki) => sl.map(d => d.eq[ki]));
      const all = [...hold, ...series.flat()], lo = Math.min(...all), hi = Math.max(...all);
      const X = i => 8 + i * (w - 48) / (sl.length - 1), Y = v => h - 18 - (v - lo) / ((hi - lo) || 1) * (h - 44);
      g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = .5; for (let q = 0; q < 4; q++) { const yy = 26 + q * (h - 36) / 3; g.beginPath(); g.moveTo(8, yy); g.lineTo(w - 40, yy); g.stroke(); }
      g.setLineDash([2, 2]); g.strokeStyle = "rgba(230,236,234,.5)"; g.lineWidth = .8; g.beginPath(); hold.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke(); g.setLineDash([]);
      series.forEach((s, ki) => {
        g.strokeStyle = COR[KS[ki]]; g.lineWidth = 1.8; g.beginPath(); s.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke();
        g.fillStyle = COR[KS[ki]]; g.font = `700 9px ${FONT}`; g.fillText(fmt(s.at(-1) / 1000, 1) + "k", w - 37, Y(s.at(-1)) + 3);
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
    tag(sx, sy - 60, fl ? "FREIO!" : "motor de risco", fl ? C.bad : "#9fc3cf");
    const [lx, ly] = P(9.25, 3.6, 78); g.font = `700 11px ${FONT}`; g.fillStyle = "#9fc3cf"; g.fillText("MOTOR DE RISCO · sem IA", lx - 6, ly);
  }
  function drawLounge() {
    box(0.6, 10.9, 2.6, 0.7, 16, "#5b3f52", "#47313f", "#503848"); box(0.6, 11.4, 2.6, 0.2, 30, "#5b3f52", "#47313f", "#503848");
    box(2.0, 8.6, 1.8, 1.0, 22, "#1f6b4d", "#3a2a20", "#47342a");
    box(0.3, 7.9, 0.6, 0.6, 40, "#6b737a", "#454c52", "#545b61");
    const [cx, cy] = P(0.6, 8.2, 46); tag(cx, cy - 4, "café", C.muted);
    const [sx, sy] = P(2.9, 9.1, 30); tag(sx, sy - 6, "sinuca", C.muted);
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
      tag(sx, sy - 58, s.nome + " · " + s.label, s.anda ? C.staff : s.cor);
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
  // Com o salão inteiro na tela, a ala mostra só os nomes; de perto, mostra o que cada um está fazendo.
  const perto = () => camera.zoom() > 1.5;
  function drawFundoTV(cx, cy, mk, cor) {
    const [bx, by] = P(cx + 1.1, cy, 26); g.fillStyle = "#4a565d"; g.fillRect(bx - 1.5, by - 50, 3, 50);
    panel(cx, cy, 76, 2.3, 58, (w, h) => {
      g.fillStyle = "#05080a"; g.fillRect(-3, -3, w + 6, h + 6); g.fillStyle = "#0d171b"; g.fillRect(0, 0, w, h);
      if (!mk) { g.font = `600 9px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText("sem dados", 6, h / 2); return; }
      const i = idxAte(mk, diaMostrado());
      if (i < 1) { g.font = `600 9px ${FONT}`; g.fillStyle = "#3c4a50"; g.fillText("antes do começo dos dados", 6, h / 2); return; }
      const f = mk.c.slice(Math.max(0, i - 59), i + 1);
      g.save(); g.translate(4, 15); spark(f, w - 10, h - 16, cor, null); g.restore();
      g.font = `700 10px ${FONT}`; g.fillStyle = C.ink; g.fillText(mk.t.replace(".SA", ""), 5, 11);
      g.font = `500 9px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "right"; g.fillText((mk.moeda === "BRL" ? "R$ " : "US$ ") + fmt(mk.c[i], 2) + " · " + dBR(mk.d[i]).slice(0, 5), w - 5, 11); g.textAlign = "left";
    });
  }
  function drawLabMonitor(cx, cy, lab) {
    panel(cx, cy, 30, 1.6, 34, (w, h) => {
      g.fillStyle = "#05080a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#101a1f"; g.fillRect(0, 0, w, h);
      g.font = `700 8px ${FONT}`; g.fillStyle = C.ink; g.fillText(lab.fichas ? lab.fichas + " ficha" + (lab.fichas > 1 ? "s" : "") : "nenhuma ficha", 4, 11);
      g.font = `500 7px ${FONT}`; g.fillStyle = C.muted; g.fillText(lab.linhas[0] ? lab.linhas[0].v.slice(0, 30) : "esperando a fila", 4, 24);
    });
  }
  function drawQuadroLab() {
    const ex = S.ex; if (!ex) return;
    panel(12.8, 0.05, 16, 8.6, 104, (w, h) => {
      g.fillStyle = "#04070a"; g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = "#0e1418"; g.fillRect(0, 0, w, h);
      g.font = `700 11px ${FONT}`; g.fillStyle = C.accent; g.fillText("QUADRO DO LABORATÓRIO · fichas e vereditos", 8, 15);
      g.font = `500 8px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "right"; g.fillText("atualizado " + dBR(ex.lab.em), w - 8, 15); g.textAlign = "left";
      const cols = [["CRIPTO", ex.lab.cripto], ["EUA", ex.lab.eua], ["B3", ex.lab.b3]], cw = (w - 16) / 3;
      cols.forEach(([nome, m], k) => {
        const x0 = 8 + k * cw;
        g.fillStyle = "rgba(255,255,255,.04)"; g.fillRect(x0, 22, cw - 6, h - 28);
        g.font = `700 9px ${FONT}`; g.fillStyle = C.brand; g.fillText(nome + " · " + (m.fichas || 0) + " ficha" + (m.fichas === 1 ? "" : "s"), x0 + 5, 34);
        g.font = `500 7.5px ${FONT}`;
        if (!m.linhas.length) { g.fillStyle = C.muted; quebra(m.nota || "nada ainda", x0 + 5, 47, cw - 16, 10, 5); return; }
        let yy = 47;
        m.linhas.slice(0, 3).forEach(l => { g.fillStyle = C.ink; g.fillText(l.t.slice(0, 34), x0 + 5, yy); g.fillStyle = /descart|reprov/i.test(l.v) ? C.bad : /aprov|passou/i.test(l.v) ? C.good : C.warn; yy = quebra(l.v, x0 + 5, yy + 10, cw - 16, 9, 2) + 4; });
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
      objs.push({ k: 16.6 + a.y + 0.5, f: () => { drawDesk(16.6, a.y, 2.7, a.lab, C.accent); drawLabMonitor(17.1, a.y - 0.05, ex.lab[a.labChave]); } });
      // Placa do pregão: no ao vivo, aberto/fechado agora; no ensaio, se houve pregão no dia mostrado.
      objs.push({ k: 30, f: () => {
        const [px, py] = P(14.2, a.y + 3.0, 0);
        if (!mk) return;
        if (S.aoVivo && ex.aoVivo) { const pg = pregao(mk); tag(px, py, (n ? "B3 · " : "NOVA YORK · ") + pg.texto, pg.aberto ? C.good : C.muted); }
        else { const sg = segurar(mk, inicio, dia); tag(px, py, (n ? "B3 · " : "NOVA YORK · ") + (sg && sg.teveHoje ? "teve pregão neste dia" : "sem pregão neste dia"), sg && sg.teveHoje ? C.good : C.muted); }
      } });
      // Robô de referência: sempre sentado, porque só segura o fundo.
      objs.push({ k: 15.4 + a.y + 1.5 + 0.3, f: () => {
        const [sx, sy] = P(15.4, a.y + 1.5); anel(a.id, sx, sy);
        const by = figura(sx, sy, a.cor, { sentado: true, t, fase: n });
        const sg = mk && segurar(mk, inicio, dia);
        tag(sx, by - 44, sg ? a.nome + " " + pct(sg.ret) : a.nome + " · sem dados", sg ? (sg.ret >= 0 ? C.good : C.bad) : C.muted);
      } });
      objs.push({ k: 18.6 + a.y + 1.5 + 0.3, f: () => {
        const ag = a.agente, [sx, sy] = P(18.6, a.y + 1.5); anel(ag.id, sx, sy);
        const by = figura(sx, sy, ag.cor, { sentado: true, t, fase: n + 2 });
        tag(sx, by - 44, perto() ? ag.nome + " · " + ag.label : ag.nome, ag.cor);
      } });
    });
    objs.push({ k: 20.3 + 1, f: () => box(20.05, 0.9, 0.4, 10.4, 24, "#33404a", "#252f36", "#2c373f") });
    APOIO.forEach((p, n) => objs.push({ k: p.x + p.y + 0.3, f: () => {
      const [sx, sy] = P(p.x, p.y); anel(p.id, sx, sy);
      const by = figura(sx, sy, p.cor, { apagado: p.fase2, t, fase: n });
      let txt = p.fase2 ? "fase 2 · ainda não começou" : "", cor = p.fase2 ? C.muted : p.cor;
      if (p.id === "robo:guardiao-dados") { const gd = ex.guardiao; txt = gd ? (gd.nivel === "ok" ? "dados ok" : gd.nivel === "falha" ? "achou falha!" : "alerta") : "sem leitura"; cor = gd && gd.nivel !== "ok" ? (gd.nivel === "falha" ? C.bad : C.warn) : cor; }
      if (p.id === "robo:coletor-clima") { const cl = ex.clima; txt = cl && cl.medo_ganancia ? "medo/ganância " + cl.medo_ganancia.valor : "sem leitura"; }
      if (p.id === "robo:coletor-mercados") txt = "Yahoo de hora em hora";
      if (p.id === "agente:sentinela") txt = "notícias · só avisa";
      if (p.id === "robo:organizador") txt = "quadro diário";
      tag(sx, by - (n % 2 ? 60 : 44), perto() ? p.nome + " · " + txt : p.nome, cor);
    } }));
    const [lx, ly] = P(21.2, 0.4, 0); tag(lx, ly - 2, "SALA DE APOIO", C.muted);
    objs.push({ k: 40, f: () => { const [x1, y1] = P(12.6, 5.6, 0); tag(x1, y1, "ALA EUA", C.brand); const [x2, y2] = P(12.6, 11.5, 0); tag(x2, y2, "ALA B3", C.brand); } });
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
