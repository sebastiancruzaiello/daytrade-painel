// @ts-nocheck
// Salão isométrico do "Pregão DAYTRADE", portado de painel-aovivo/salao/index.html (mesmo desenho, mesmas regras).
// Aqui só desenha: quem decide o dia mostrado, a fonte e o teste de parar é o React.
import { KS, NOME, COR, C, dayIdx, fmt, pct, dBR } from "../dados/formato";
import { criarCamera } from "./camera";

const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
const W = 1000, H = 640, TW = 64, TH = 32, N = 12, OX = 500, OY = 200;
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
export type EstadoCena = { D: any; dias: any[]; di: number; pararTeste: boolean; vivo: any | null; aoVivo: boolean };

// Ids das pessoas: "robo:<conta>:<cadeira>", "staff:escrivao", "staff:guardiao", "agente:plantonista", "agente:pesquisador".
export function criarCena(cv: HTMLCanvasElement, aoZoom?: (z: number) => void, aoPessoa?: (id: string) => void): Cena {
  const g = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fit() { const r = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * r; cv.height = H * r; }
  fit(); addEventListener("resize", fit);
  const DPR = () => cv.width / W;

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
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? "#222d33" : "#1e282e");
    poly([P(0.4, 8), P(4.6, 8), P(4.6, 11.6), P(0.4, 11.6)], "#2b2a35");
  }
  function wallText(x, y, z, txt, size, color) {
    const o = P(x, y, z), dx = TW / 2, dy = -TH / 2, L = Math.hypot(dx, dy);
    g.save(); g.translate(o[0], o[1]); g.transform(dx / L, dy / L, 0, 1, 0, 0);
    g.font = `700 ${size}px ${FONT}`; g.fillStyle = color; g.textBaseline = "alphabetic"; g.fillText(txt, 0, 0); g.restore();
  }
  function walls() {
    const h = 170;
    poly([P(0, 0), P(N, 0), P(N, 0, h), P(0, 0, h)], "#18232a");
    poly([P(0, 0), P(0, N), P(0, N, h), P(0, 0, h)], "#141d23");
    poly([P(0, 0), P(N, 0), P(N, 0, 22), P(0, 0, 22)], "#1f2c33");
    poly([P(0, 0), P(0, N), P(0, N, 22), P(0, 0, 22)], "#1a252b");
    wallText(0, 7.2, 118, "DAYTRADE", 34, C.accent);
    wallText(0, 7.2, 96, "simulação ao vivo · aovivo-v1", 13, C.muted);
    poly([P(0, 9.6), P(0, 10.9), P(0, 10.9, 96), P(0, 9.6, 96)], "#0c1114");
    poly([P(0, 9.6, 96), P(0, 10.9, 96), P(0, 10.9, 104), P(0, 9.6, 104)], C.bad);
    wallText(0, 10.8, 112, "SAÍDA", 13, C.bad);
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
    floor(); walls(); drawTelao(); drawShelf();
    const d = S.dias[S.di];
    const objs = [];
    objs.push({ k: 6.9, f: () => drawDesk(2.2, 4.2, 3.2, "MESA MM20", C.accent) });
    objs.push({ k: 4.5, f: () => { drawTV(2.45, 4.1, "BTC", COR["mm20-btc"], true, d.st[0] === "parada"); drawTV(4.05, 4.1, "ETH", COR["mm20-eth"], true, d.st[1] === "parada"); } });
    objs.push({ k: 10.6, f: () => drawDesk(6.2, 6.7, 4.4, "MESA MOMENTUM", C.accent) });
    objs.push({ k: 10.55, f: () => SEATS.momentum.forEach((s, i) => drawTV(s.tv[0], s.tv[1], d.pos[2][i], COR.momentum, false, d.st[2] === "parada")) });
    objs.push({ k: 12.7, f: () => drawBooth(t) });
    objs.push({ k: 9.5, f: () => drawLounge() });
    objs.push({ k: 5, f: () => drawStaff(t) });
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
    destruir() { cancelAnimationFrame(raf); removeEventListener("resize", fit); camera.destruir(); },
  };
}
