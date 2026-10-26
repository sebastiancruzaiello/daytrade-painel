// @ts-nocheck
// Câmera do salão: zoom e arrasto sobre o canvas. Sem dependências, dá para copiar para o salão web.
// Roda do mouse = zoom no ponto do cursor; arrastar = mover; pinça com dois dedos = zoom;
// clique numa pessoa = aoTocar decide (abre a ficha e aproxima); clique numa mesa = aproxima nela;
// duplo clique no vazio = volta ao salão inteiro.
export function criarCamera(cv, W, H, alvos, aoMudar, aoTocar) {
  const MIN = 1, MAX = 4;
  let z = 1, cx = W / 2, cy = H / 2;          // atual
  let tz = 1, tcx = W / 2, tcy = H / 2;       // destino (anima até ele)
  const toques = new Map();
  let arrasto = null, pinca = null, moveu = false;

  const limita = () => {
    tz = Math.min(MAX, Math.max(MIN, tz));
    const mw = W / 2 / tz, mh = H / 2 / tz;
    tcx = Math.min(W - mw, Math.max(mw, tcx));
    tcy = Math.min(H - mh, Math.max(mh, tcy));
  };
  // ponto da tela (evento) -> coordenada da cena
  const naCena = (ev) => {
    const r = cv.getBoundingClientRect();
    const sx = (ev.clientX - r.left) / r.width * W, sy = (ev.clientY - r.top) / r.height * H;
    return { sx, sy, x: cx + (sx - W / 2) / z, y: cy + (sy - H / 2) / z };
  };
  // zoom mantendo fixo o ponto (sx, sy) da tela
  function zoomEm(fator, sx = W / 2, sy = H / 2) {
    const px = tcx + (sx - W / 2) / tz, py = tcy + (sy - H / 2) / tz;
    tz *= fator; limita();
    tcx = px - (sx - W / 2) / tz; tcy = py - (sy - H / 2) / tz; limita();
    aoMudar && aoMudar(tz);
  }
  function irPara(x, y, zoom) { tz = zoom; tcx = x; tcy = y; limita(); aoMudar && aoMudar(tz); }
  function inicio() { irPara(W / 2, H / 2, 1); }

  function roda(ev) { ev.preventDefault(); const p = naCena(ev); zoomEm(Math.exp(-ev.deltaY * 0.0015), p.sx, p.sy); }
  function desce(ev) {
    cv.setPointerCapture(ev.pointerId);
    toques.set(ev.pointerId, ev);
    moveu = false;
    if (toques.size === 1) arrasto = { x: ev.clientX, y: ev.clientY, cx: tcx, cy: tcy };
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: tz }; arrasto = null; }
  }
  function move(ev) {
    if (!toques.has(ev.pointerId)) {
      if (aoTocar) cv.style.cursor = aoTocar(naCena(ev).x, naCena(ev).y, true) ? "pointer" : (tz > 1.01 ? "grab" : "zoom-in");
      return;
    }
    toques.set(ev.pointerId, ev);
    const r = cv.getBoundingClientRect(), k = W / r.width;
    if (pinca && toques.size === 2) {
      const [a, b] = [...toques.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const meio = naCena({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
      zoomEm((pinca.z * d / pinca.d) / tz, meio.sx, meio.sy); moveu = true;
    } else if (arrasto) {
      const dx = (ev.clientX - arrasto.x) * k, dy = (ev.clientY - arrasto.y) * k;
      if (Math.hypot(dx, dy) > 4) moveu = true;
      tcx = arrasto.cx - dx / tz; tcy = arrasto.cy - dy / tz; limita();
      cx = tcx; cy = tcy; // arrasto acompanha o dedo sem atraso
    }
    const sobre = !arrasto && aoTocar && aoTocar(naCena(ev).x, naCena(ev).y, true);
    cv.style.cursor = arrasto && moveu ? "grabbing" : sobre ? "pointer" : (tz > 1.01 ? "grab" : "zoom-in");
  }
  function sobe(ev) {
    toques.delete(ev.pointerId);
    if (toques.size < 2) pinca = null;
    if (toques.size === 0) {
      if (!moveu) clique(ev);
      arrasto = null;
    }
    cv.style.cursor = tz > 1.01 ? "grab" : "zoom-in";
  }
  function clique(ev) {
    const p = naCena(ev);
    const pessoa = aoTocar && aoTocar(p.x, p.y);
    if (pessoa) { irPara(pessoa.x, pessoa.y, Math.max(tz, pessoa.zoom)); return; }
    let melhor = null, dist = 1e9;
    alvos().forEach(a => { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < a.raio && d < dist) { melhor = a; dist = d; } });
    if (melhor) irPara(melhor.x, melhor.y, Math.max(tz * 1.01, melhor.zoom));
    else if (tz < 1.5) zoomEm(2, p.sx, p.sy);
  }
  function duplo(ev) { ev.preventDefault(); inicio(); }

  cv.style.touchAction = "none";
  cv.style.cursor = "zoom-in";
  cv.addEventListener("wheel", roda, { passive: false });
  cv.addEventListener("pointerdown", desce);
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", sobe);
  cv.addEventListener("pointercancel", sobe);
  cv.addEventListener("dblclick", duplo);

  return {
    // chamada a cada quadro: anima a câmera e aplica a transformação (r = pixels por unidade da cena)
    aplicar(g, r, dt) {
      const a = 1 - Math.pow(0.001, (dt || 16) / 1000 * 3);
      z += (tz - z) * a; cx += (tcx - cx) * a; cy += (tcy - cy) * a;
      g.setTransform(r * z, 0, 0, r * z, r * (W / 2 - cx * z), r * (H / 2 - cy * z));
    },
    mais() { zoomEm(1.4); },
    menos() { zoomEm(1 / 1.4); },
    inicio,
    zoom: () => tz,
    destruir() {
      cv.removeEventListener("wheel", roda); cv.removeEventListener("pointerdown", desce); cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", sobe); cv.removeEventListener("pointercancel", sobe); cv.removeEventListener("dblclick", duplo);
    },
  };
}
