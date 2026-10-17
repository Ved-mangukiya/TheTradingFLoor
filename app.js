/*!
 * Trading Floor Championship 2026: Vanilla charting engine
 * Zero dependencies. Canvas 2D, HiDPI-aware, monotone cubic Bezier splines.
 *
 * Public API (attached to window and window.TFCharts):
 *   drawSmoothMiniSparkline(canvasId, history, dayOpenPrice, isUp) -> { update(history, dayOpen, isUp), destroy() }
 *   drawInteractiveMainChart(canvasId, stock, containerElement)    -> { update(stock), destroy() }
 *   drawPortfolioEquityCurve(canvasId, equityHistory, opts?)       -> { update(equityHistory), destroy() }
 *
 * Call a function again with the same canvas on every WebSocket tick; it updates in place
 * (no re-registration, no leaks). A single shared requestAnimationFrame loop drives all charts
 * and stops automatically when no chart is connected to the DOM.
 */
(function (global) {
  'use strict';

  /* ------------------------------ Design tokens ------------------------------ */
  var C = {
    bg: '#FBF9F5', cream: '#F4EFE6', white: '#FFFFFF',
    grid: '#E6DEC9', ref: '#BDAF8F', text: '#1A3026', muted: '#7A8579', gold: '#8E6D3B',
    up: '#218653', upGlow: 'rgba(33,134,83,0.12)',
    down: '#C64B4B', downGlow: 'rgba(198,75,75,0.12)'
  };
  var MONO = "'Courier New', Consolas, monospace";

  /* -------------------------------- Formatters ------------------------------- */
  function fmtRupee(v, d) {
    d = d == null ? 2 : d;
    var neg = v < 0;
    var s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (neg ? '-' : '') + '\u20B9' + s;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtSigned(v, d) { return (v >= 0 ? '+' : '-') + fmtRupee(Math.abs(v), d); }

  /* -------------------------- Shared animation loop -------------------------- */
  var registry = new Map(), raf = 0;
  function loop(t) {
    registry.forEach(function (entry, canvas) {
      if (!canvas.isConnected) { if (entry.cleanup) entry.cleanup(); registry.delete(canvas); return; }
      try { entry.draw(t); } catch (e) { console.error('[TFCharts]', e); }
    });
    raf = registry.size ? requestAnimationFrame(loop) : 0;
  }
  function register(canvas, entry) {
    registry.set(canvas, entry);
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function unregister(canvas) {
    var e = registry.get(canvas);
    if (e && e.cleanup) e.cleanup();
    registry.delete(canvas);
  }

  /* --------------------------------- Canvas ---------------------------------- */
  function getCanvas(id) {
    var c = typeof id === 'string' ? document.getElementById(id) : id;
    if (!c) { return null; }
    return c;
  }
  function initialSize(canvas, dw, dh) {
    var w = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || dw;
    var h = canvas.clientHeight || parseInt(canvas.getAttribute('height'), 10) || dh;
    return { w: w, h: h };
  }
  /** Sizes the backing store for devicePixelRatio and returns a ctx scaled to CSS pixels. */
  function prepare(canvas, st) {
    var dpr = global.devicePixelRatio || 1;
    var pw = Math.round(st.w * dpr), ph = Math.round(st.h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
      canvas.style.width = st.w + 'px'; canvas.style.height = st.h + 'px';
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, st.w, st.h);
    return ctx;
  }

  /* --------------------------- Drawing primitives ---------------------------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Monotone cubic (Fritsch-Carlson) tangents: smooth, never overshoots the data. */
  function tangents(pts) {
    var n = pts.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (pts[i + 1].y - pts[i].y) / ((pts[i + 1].x - pts[i].x) || 1e-9);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return m;
  }
  /** Adds the spline through pts to the current path (caller does beginPath/moveTo handling). */
  function splinePath(ctx, pts, continueFromCurrent) {
    if (!pts.length) return;
    if (continueFromCurrent) ctx.lineTo(pts[0].x, pts[0].y); else ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) return;
    if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
    var m = tangents(pts);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i], p1 = pts[i + 1], dx = (p1.x - p0.x) / 3;
      ctx.bezierCurveTo(p0.x + dx, p0.y + m[i] * dx, p1.x - dx, p1.y - m[i + 1] * dx, p1.x, p1.y);
    }
  }
  function badge(ctx, text, x, y, align, bg, fg, size) {
    ctx.save();
    ctx.font = 'bold ' + (size || 11) + 'px ' + MONO;
    var tw = ctx.measureText(text).width, w = tw + 12, h = (size || 11) + 8;
    var bx = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
    ctx.fillStyle = bg; rr(ctx, bx, y - h / 2, w, h, 4); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 6, y + 0.5);
    ctx.restore();
    return { x: bx, w: w, h: h };
  }
  function pulseHead(ctx, x, y, color, t, r) {
    var ph = (t % 1500) / 1500;
    ctx.save();
    ctx.globalAlpha = (1 - ph) * 0.45; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r + ph * r * 3.2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  function tooltip(ctx, x, y, lines, w, h) {
    ctx.save();
    ctx.font = 'bold 11px ' + MONO;
    var tw = 0; lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l.t).width); });
    tw += 20; var th = lines.length * 16 + 10;
    var bx = x + 14; if (bx + tw > w - 4) bx = x - 14 - tw; if (bx < 4) bx = 4;
    var by = Math.min(Math.max(y - th / 2, 4), h - th - 4);
    ctx.shadowColor = 'rgba(26,48,38,0.18)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.fillStyle = C.white; rr(ctx, bx, by, tw, th, 6); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; rr(ctx, bx + 0.5, by + 0.5, tw - 1, th - 1, 6); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach(function (l, i) { ctx.fillStyle = l.c || C.text; ctx.fillText(l.t, bx + 10, by + 5 + 8 + i * 16); });
    ctx.restore();
  }

  /** Pointer hover with eased fade in/out. Returns unbind function. */
  function bindHover(canvas, st) {
    st.mx = null; st.ha = 0; st.lastMx = 0;
    function move(e) {
      var r = canvas.getBoundingClientRect();
      st.mx = (e.clientX - r.left) * (st.w / r.width);
      st.lastMx = st.mx;
    }
    function leave() { st.mx = null; }
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', leave);
    return function () {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', leave);
    };
  }
  function stepHover(st) { st.ha += ((st.mx == null ? 0 : 1) - st.ha) * 0.22; if (st.ha < 0.01) st.ha = 0; }
  function nearest(pts, x) {
    var lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (pts[mid].x < x) lo = mid; else hi = mid; }
    return Math.abs(pts[lo].x - x) <= Math.abs(pts[hi].x - x) ? lo : hi;
  }
  function thin(arr, max) {
    if (arr.length <= max) return arr;
    var step = Math.ceil(arr.length / max), out = [];
    for (var i = 0; i < arr.length; i += step) out.push(arr[i]);
    if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
    return out;
  }
  function rangeOf(vals, padFrac) {
    var lo = Infinity, hi = -Infinity;
    vals.forEach(function (v) { if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    var p = (hi - lo) * padFrac;
    return { lo: lo - p, hi: hi + p };
  }

  /* ========================================================================== *
   * 1. MINI SPARKLINE
   * ========================================================================== */
  function drawSmoothMiniSparkline(canvasId, history, dayOpenPrice, isUp) {
    var canvas = getCanvas(canvasId); if (!canvas) return null;
    var e = registry.get(canvas), st;
    if (!e) {
      var sz = initialSize(canvas, 220, 60);
      st = { w: sz.w, h: sz.h, hist: [], open: 0, up: true };
      register(canvas, { draw: function (t) { renderSpark(canvas, st, t); } });
      e = registry.get(canvas); e.st = st;
    }
    st = e.st;
    st.hist = history || []; st.open = dayOpenPrice;
    st.up = isUp == null ? (st.hist.length ? st.hist[st.hist.length - 1].price >= dayOpenPrice : true) : !!isUp;
    return {
      update: function (h, o, u) { drawSmoothMiniSparkline(canvas, h, o, u); },
      destroy: function () { unregister(canvas); }
    };
  }
  function renderSpark(canvas, st, t) {
    var ctx = prepare(canvas, st), W = st.w, H = st.h;
    var data = thin(st.hist, 240);
    if (data.length < 2) return;
    var padX = 5, padT = 7, padB = 7, iw = W - padX * 2, ih = H - padT - padB;
    var r = rangeOf(data.map(function (d) { return d.price; }).concat([st.open]), 0.08);
    var t0 = data[0].time, t1 = data[data.length - 1].time || 1; if (t1 === t0) t1 = t0 + 1;
    function X(tm) { return padX + (tm - t0) / (t1 - t0) * iw; }
    function Y(p) { return padT + (r.hi - p) / (r.hi - r.lo) * ih; }
    var col = st.up ? C.up : C.down;
    var pts = data.map(function (d) { return { x: X(d.time), y: Y(d.price) }; });
    var last = pts[pts.length - 1];

    // Day Open dashed baseline
    var oy = Y(st.open);
    ctx.save(); ctx.strokeStyle = C.ref; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(padX, oy + 0.5); ctx.lineTo(W - padX, oy + 0.5); ctx.stroke(); ctx.restore();

    // Gradient fill
    var g = ctx.createLinearGradient(0, padT, 0, H);
    g.addColorStop(0, st.up ? 'rgba(33,134,83,0.22)' : 'rgba(198,75,75,0.22)');
    g.addColorStop(1, st.up ? 'rgba(33,134,83,0)' : 'rgba(198,75,75,0)');
    ctx.beginPath(); splinePath(ctx, pts); ctx.lineTo(last.x, H); ctx.lineTo(pts[0].x, H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    // Line
    ctx.beginPath(); splinePath(ctx, pts);
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

    pulseHead(ctx, last.x, last.y, col, t, 2.8);
  }

  /* ========================================================================== *
   * 2. INTERACTIVE MAIN CHART
   * ========================================================================== */
  function drawInteractiveMainChart(canvasId, stock, containerElement) {
    var canvas = getCanvas(canvasId); if (!canvas) return null;
    var e = registry.get(canvas), st;
    if (!e) {
      var cont = containerElement || canvas.parentElement;
      var sz = initialSize(canvas, 800, 320);
      var w = (cont && cont.clientWidth) || sz.w;
      st = { w: w, h: 320, stock: stock };
      canvas.classList.add('tf-chart-canvas', 'tf-chart-canvas--main');
      var unbind = bindHover(canvas, st), ro = null;
      if (cont && global.ResizeObserver) {
        ro = new ResizeObserver(function () { var nw = cont.clientWidth; if (nw > 0) st.w = nw; });
        ro.observe(cont);
      }
      register(canvas, {
        draw: function (t) { renderMain(canvas, st, t); },
        cleanup: function () { unbind(); if (ro) ro.disconnect(); }
      });
      e = registry.get(canvas); e.st = st;
    }
    e.st.stock = stock;
    return {
      update: function (s) { drawInteractiveMainChart(canvas, s, containerElement); },
      destroy: function () { unregister(canvas); }
    };
  }
  function renderMain(canvas, st, t) {
    var ctx = prepare(canvas, st), W = st.w, H = st.h, s = st.stock;
    stepHover(st);
    var hist = (s && s.history) || [];
    ctx.fillStyle = C.white; rr(ctx, 0, 0, W, H, 10); ctx.fill();
    if (hist.length < 2) {
      ctx.fillStyle = C.muted; ctx.font = '13px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for market data\u2026', W / 2, H / 2); return;
    }
    var pl = 14, pr = 86, pt = 20, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
    var open = s.dayOpenPrice, hi = s.dayHigh, lo = s.dayLow;
    var r = rangeOf(hist.map(function (d) { return d.price; }).concat([open, hi, lo]), 0.08);
    var t0 = hist[0].time, t1 = hist[hist.length - 1].time; if (t1 === t0) t1 = t0 + 1;
    function X(tm) { return pl + (tm - t0) / (t1 - t0) * iw; }
    function Y(p) { return pt + (r.hi - p) / (r.hi - r.lo) * ih; }
    var cur = hist[hist.length - 1].price, up = cur >= open, col = up ? C.up : C.down;
    var pts = hist.map(function (d) { return { x: X(d.time), y: Y(d.price) }; });
    var head = pts[pts.length - 1];

    // Grid + Y labels
    ctx.font = '11px ' + MONO; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var gp = r.lo + (r.hi - r.lo) * i / 4, gy = Math.round(Y(gp)) + 0.5;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(W - pr, gy); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(fmtRupee(gp), W - pr + 8, gy);
    }
    // X ticks
    ctx.textBaseline = 'top';
    for (var k = 0; k <= 5; k++) {
      var tm = t0 + (t1 - t0) * k / 5, tx = X(tm);
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(Math.round(tx) + 0.5, pt + ih); ctx.lineTo(Math.round(tx) + 0.5, pt + ih + 4); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = k === 0 ? 'left' : k === 5 ? 'right' : 'center';
      ctx.fillText(fmtTime(tm), tx, pt + ih + 8);
    }

    // Day High / Day Low dotted guides
    function guide(p, label, color) {
      if (!isFinite(p)) return;
      var y = Math.round(Y(p)) + 0.5;
      ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1; ctx.setLineDash([1.5, 4]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(W - pr, y); ctx.stroke(); ctx.restore();
      ctx.font = 'bold 10px ' + MONO; ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(label, W - pr - 4, y - 3);
    }
    guide(hi, 'DAY HIGH', C.up); guide(lo, 'DAY LOW', C.down);
    // Soft markers where the extremes occurred
    var iMax = 0, iMin = 0;
    hist.forEach(function (d, ix) { if (d.price > hist[iMax].price) iMax = ix; if (d.price < hist[iMin].price) iMin = ix; });
    [[iMax, C.up], [iMin, C.down]].forEach(function (m) {
      var p = pts[m[0]]; ctx.save();
      ctx.fillStyle = m[1]; ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = C.white; ctx.strokeStyle = m[1]; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
    });

    // Day Open reference line + right-axis badge
    var oy = Math.round(Y(open)) + 0.5;
    ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(pl, oy); ctx.lineTo(W - pr, oy); ctx.stroke(); ctx.restore();
    badge(ctx, 'OPEN ' + fmtRupee(open), W - pr + 4, oy, 'left', C.cream, C.gold, 10);

    // Area fill + glowing line
    var g = ctx.createLinearGradient(0, pt, 0, pt + ih);
    g.addColorStop(0, up ? 'rgba(33,134,83,0.26)' : 'rgba(198,75,75,0.26)');
    g.addColorStop(1, up ? 'rgba(33,134,83,0.02)' : 'rgba(198,75,75,0.02)');
    ctx.beginPath(); splinePath(ctx, pts); ctx.lineTo(head.x, pt + ih); ctx.lineTo(pts[0].x, pt + ih); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.beginPath(); splinePath(ctx, pts);
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();

    // Live price tag on the right axis
    badge(ctx, fmtRupee(cur), W - pr + 4, Y(cur), 'left', col, '#fff', 11);

    // Animated head
    if (!s.isHalted) pulseHead(ctx, head.x, head.y, col, t, 4);
    else badge(ctx, 'TRADING HALTED', pl + 8, pt + 12, 'left', C.down, '#fff', 11);

    // Published news event timeline markers
    var newsList = (s && s.newsMarkers) || [];
    newsList.forEach(function (n) {
      if (n.time >= t0 && n.time <= t1) {
        var nx = Math.round(X(n.time)) + 0.5;
        ctx.save();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(nx, pt); ctx.lineTo(nx, pt + ih); ctx.stroke();
        ctx.setLineDash([]);
        badge(ctx, '⚡ ' + (n.label || 'NEWS'), nx, pt + 6, 'center', '#FEF3C7', '#92400E', 9);
        ctx.restore();
      }
    });

    // Hover crosshair (fades in/out; returns to live mode on mouseout)
    if (st.ha > 0) {
      var i2 = nearest(pts, Math.min(Math.max(st.lastMx, pl), W - pr)), p = pts[i2], d = hist[i2];
      ctx.save(); ctx.globalAlpha = st.ha;
      ctx.strokeStyle = C.text; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(Math.round(p.x) + 0.5, pt); ctx.lineTo(Math.round(p.x) + 0.5, pt + ih); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pl, Math.round(p.y) + 0.5); ctx.lineTo(W - pr, Math.round(p.y) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.white; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke();
      badge(ctx, fmtRupee(d.price), W - pr + 4, p.y, 'left', C.text, '#fff', 11);
      badge(ctx, fmtTime(d.time), p.x, pt + ih + 14, 'center', C.text, '#fff', 10);
      var chg = (d.price - open) / open * 100;
      tooltip(ctx, p.x, p.y, [
        { t: fmtTime(d.time) + '  ' + fmtRupee(d.price), c: C.text },
        { t: (chg >= 0 ? '\u25B2 +' : '\u25BC ') + chg.toFixed(2) + '% vs open', c: chg >= 0 ? C.up : C.down }
      ], W - pr, H);
      ctx.restore();
    }
  }

  /* ========================================================================== *
   * 3. PORTFOLIO EQUITY CURVE
   * ========================================================================== */
  function drawPortfolioEquityCurve(canvasId, equityHistory, opts) {
    var canvas = getCanvas(canvasId); if (!canvas) return null;
    var e = registry.get(canvas), st;
    if (!e) {
      var sz = initialSize(canvas, 640, 260);
      st = { w: sz.w, h: sz.h, eq: [], base: (opts && opts.startingCash) || 500000 };
      canvas.classList.add('tf-chart-canvas');
      var unbind = bindHover(canvas, st);
      register(canvas, {
        draw: function (t) { renderEquity(canvas, st, t); },
        cleanup: unbind
      });
      e = registry.get(canvas); e.st = st;
    }
    e.st.eq = equityHistory || [];
    if (opts && opts.startingCash) e.st.base = opts.startingCash;
    return {
      update: function (h) { drawPortfolioEquityCurve(canvas, h, opts); },
      destroy: function () { unregister(canvas); }
    };
  }
  function renderEquity(canvas, st, t) {
    var ctx = prepare(canvas, st), W = st.w, H = st.h, base = st.base;
    stepHover(st);
    var eq = thin(st.eq, 400);
    ctx.fillStyle = C.white; rr(ctx, 0, 0, W, H, 10); ctx.fill();
    if (eq.length < 2) {
      ctx.fillStyle = C.muted; ctx.font = '13px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No equity history yet', W / 2, H / 2); return;
    }
    var pl = 14, pr = 92, pt = 38, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
    var r = rangeOf(eq.map(function (d) { return d.netWorth; }).concat([base]), 0.12);
    var t0 = eq[0].time, t1 = eq[eq.length - 1].time; if (t1 === t0) t1 = t0 + 1;
    function X(tm) { return pl + (tm - t0) / (t1 - t0) * iw; }
    function Y(v) { return pt + (r.hi - v) / (r.hi - r.lo) * ih; }
    var now = eq[eq.length - 1].netWorth, profit = now >= base, pnl = now - base, pct = pnl / base * 100;
    var lineCol = profit ? C.gold : C.down, glow = profit ? C.upGlow : C.downGlow;
    var pts = eq.map(function (d) { return { x: X(d.time), y: Y(d.netWorth) }; });
    var head = pts[pts.length - 1], by = Y(base);

    // Grid + Y labels
    ctx.font = '11px ' + MONO; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var v = r.lo + (r.hi - r.lo) * i / 4, y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(W - pr, y); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(fmtRupee(v, 0), W - pr + 8, y);
    }
    ctx.textBaseline = 'top';
    for (var k = 0; k <= 4; k++) {
      var tm = t0 + (t1 - t0) * k / 4;
      ctx.fillStyle = C.muted; ctx.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center';
      ctx.fillText(fmtTime(tm), X(tm), pt + ih + 8);
    }

    // Profit zone (green) above baseline, drawdown zone (red) below baseline
    function area(clipY0, clipY1, color) {
      ctx.save(); ctx.beginPath(); ctx.rect(pl, clipY0, iw + 1, clipY1 - clipY0); ctx.clip();
      ctx.beginPath(); splinePath(ctx, pts); ctx.lineTo(head.x, by); ctx.lineTo(pts[0].x, by); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.restore();
    }
    area(pt, by, 'rgba(33,134,83,0.16)');
    area(by, pt + ih, 'rgba(198,75,75,0.16)');

    // Starting-cash baseline
    ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pl, Math.round(by) + 0.5); ctx.lineTo(W - pr, Math.round(by) + 0.5); ctx.stroke(); ctx.restore();
    badge(ctx, 'START ' + fmtRupee(base, 0), W - pr + 4, by, 'left', C.cream, C.gold, 10);

    // Equity line
    ctx.save(); ctx.beginPath(); splinePath(ctx, pts);
    ctx.shadowColor = lineCol; ctx.shadowBlur = 8; ctx.strokeStyle = lineCol; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    badge(ctx, fmtRupee(now, 0), W - pr + 4, Y(now), 'left', profit ? C.up : C.down, '#fff', 11);
    pulseHead(ctx, head.x, head.y, lineCol, t, 4);

    // Headline: status pill + P&L
    badge(ctx, profit ? 'IN PROFIT' : 'DRAWDOWN', pl + 4, 16, 'left', profit ? C.up : C.down, '#fff', 11);
    ctx.font = 'bold 14px ' + MONO; ctx.fillStyle = profit ? C.up : C.down; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtSigned(pnl, 0) + '  (' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%)', pl + 104, 16);

    // Hover
    if (st.ha > 0) {
      var j = nearest(pts, Math.min(Math.max(st.lastMx, pl), W - pr)), p = pts[j], d = eq[j], dv = d.netWorth - base;
      ctx.save(); ctx.globalAlpha = st.ha;
      ctx.strokeStyle = C.text; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(Math.round(p.x) + 0.5, pt); ctx.lineTo(Math.round(p.x) + 0.5, pt + ih); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.white; ctx.strokeStyle = dv >= 0 ? C.up : C.down; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke();
      tooltip(ctx, p.x, p.y, [
        { t: fmtTime(d.time) + '  ' + fmtRupee(d.netWorth, 0), c: C.text },
        { t: fmtSigned(dv, 0) + ' vs start', c: dv >= 0 ? C.up : C.down }
      ], W - pr, H);
      ctx.restore();
    }
  }

  /* --------------------------------- Exports --------------------------------- */
  var api = {
    drawSmoothMiniSparkline: drawSmoothMiniSparkline,
    drawInteractiveMainChart: drawInteractiveMainChart,
    drawPortfolioEquityCurve: drawPortfolioEquityCurve,
    destroy: function (canvasId) { var c = getCanvas(canvasId); if (c) unregister(c); },
    formatRupee: fmtRupee, formatTime: fmtTime, colors: C
  };
  global.TFCharts = api;
  global.drawSmoothMiniSparkline = drawSmoothMiniSparkline;
  global.drawInteractiveMainChart = drawInteractiveMainChart;
  global.drawPortfolioEquityCurve = drawPortfolioEquityCurve;
})(typeof window !== 'undefined' ? window : this);


// ==========================================================================
// THE TRADING FLOOR CHAMPIONSHIP 2026 — CLIENT ENGINE & INTERFACE CONTROLLER
// Offline-First Institutional Trading Terminal
// ==========================================================================

let ws = null;
let sessionToken = sessionStorage.getItem('ttf_session_token') || null;
let currentRole = null;
let isLoggedIn = false;
let latestState = null;
let flashTimerHandle = null;
let currentSelectedTickerForChart = null;

// Trader View Filtering & Tab State
let activeTraderTab = 'market';
let activeHostTab = 'stocks';
let traderSearchTerm = '';
let traderSectorFilterVal = 'ALL';
let traderSortFilterVal = 'default';
let traderHoldingsOnlyVal = false;
let dayCompletedDismissed = false;

// Modal Trade State
let currentTradeModalTicker = null;
let currentTradeModalSide = 'BUY';
let teamEquityHistory = [];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// 1. INSTITUTIONAL AUDIO SYNTHESIZER (OFFLINE-READY)
// ==========================================
// Self-contained Web Audio API synthesizer — works offline without any external MP3s!
let sharedAudioCtx = null;
function getSharedAudioContext() {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch (e) {}
  return sharedAudioCtx;
}

// User-gesture listener to immediately unlock Web Audio on first interaction
['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, () => {
    getSharedAudioContext();
  }, { once: false, passive: true });
});

function playInstitutionalSound(cueName) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (cueName === 'bell_open' || cueName === 'bell_close') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.25, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.4);
      });
    } else if (cueName === 'news_siren' || cueName === 'heavy_news_boom') {
      // 1. Deep cinematic sub-bass boom
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(90, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.9);
      subGain.gain.setValueAtTime(0.4, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.1);

      // 2. High-tension triple sonar alert
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, now + 0.15 + i * 0.32);
        osc.frequency.linearRampToValueAtTime(980, now + 0.15 + i * 0.32 + 0.28);
        gain.gain.setValueAtTime(0.22, now + 0.15 + i * 0.32);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15 + i * 0.32 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.15 + i * 0.32);
        osc.stop(now + 0.15 + i * 0.32 + 0.3);
      }
    } else if (cueName === 'circuit_alarm' || cueName === 'emergency_klaxon') {
      // Oscillating urgent 6-burst two-tone klaxon
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const f = i % 2 === 0 ? 820 : 600;
        osc.frequency.setValueAtTime(f, now + i * 0.18);
        gain.gain.setValueAtTime(0.25, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.18 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.16);
      }
    } else if (cueName === 'order_fill') {
      // Crisp mechanical double-register cash execution click
      [1480, 1960].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.2);
      });
    } else if (cueName === 'countdown_tick') {
      // High-pressure woodblock tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (cueName === 'championship_fanfare') {
      const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0.3, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 1.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 1.8);
      });
    } else if (cueName === 'order_rejected') {
      // Urgent, low-frequency double descending warning buzz
      [260, 195].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.2, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.16);
      });
    } else if (cueName === 'portfolio_liquidated') {
      // Rapid bright cascade chime for full liquidation to cash
      [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.22, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } else if (cueName === 'dramatic_tension_riser') {
      // Intense accelerating sub-bass heartbeat riser with detuned sweeping filters
      const heartbeats = [0, 0.45, 0.85, 1.20, 1.50, 1.75, 1.95, 2.12];
      heartbeats.forEach((tOffset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(75, now + tOffset);
        osc.frequency.exponentialRampToValueAtTime(36, now + tOffset + 0.15);
        gain.gain.setValueAtTime(0.35 + (i * 0.04), now + tOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + tOffset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + tOffset);
        osc.stop(now + tOffset + 0.2);
      });

      // Filtered rising tension noise/saw sweep
      const sweepOsc = ctx.createOscillator();
      const sweepFilter = ctx.createBiquadFilter();
      const sweepGain = ctx.createGain();
      sweepOsc.type = 'sawtooth';
      sweepOsc.frequency.setValueAtTime(90, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(420, now + 2.2);

      sweepFilter.type = 'lowpass';
      sweepFilter.frequency.setValueAtTime(180, now);
      sweepFilter.frequency.exponentialRampToValueAtTime(1400, now + 2.2);
      sweepFilter.Q.setValueAtTime(6.0, now);

      sweepGain.gain.setValueAtTime(0.05, now);
      sweepGain.gain.linearRampToValueAtTime(0.32, now + 2.1);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);

      sweepOsc.connect(sweepFilter);
      sweepFilter.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      sweepOsc.start(now);
      sweepOsc.stop(now + 2.35);
    } else if (cueName === 'winner_drumroll_boom') {
      // Rapid snare drumroll strikes (20 rapid micro-bursts accelerating)
      for (let i = 0; i < 22; i++) {
        const strikeTime = now + (i * 0.045);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(220 + (i * 8), strikeTime);
        gain.gain.setValueAtTime(0.12 + (i * 0.012), strikeTime);
        gain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(strikeTime);
        osc.stop(strikeTime + 0.045);
      }

      // Massive Seismic Sub-Bass Boom Impact at the end of the roll
      const boomTime = now + 1.0;
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(85, boomTime);
      subOsc.frequency.exponentialRampToValueAtTime(32, boomTime + 1.6);
      subGain.gain.setValueAtTime(0.55, boomTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 1.8);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(boomTime);
      subOsc.stop(boomTime + 1.85);
    } else if (cueName === 'champion_fanfare_epic') {
      // Grand D-Major multi-octave victory fanfare (D4, F#4, A4, D5, F#5, A5, D6)
      const brassNotes = [
        { freq: 293.66, time: 0.0, dur: 0.35, vol: 0.35 }, // D4
        { freq: 369.99, time: 0.22, dur: 0.35, vol: 0.35 }, // F#4
        { freq: 440.00, time: 0.44, dur: 0.45, vol: 0.38 }, // A4
        { freq: 587.33, time: 0.70, dur: 0.55, vol: 0.42 }, // D5
        { freq: 739.99, time: 1.10, dur: 0.45, vol: 0.45 }, // F#5
        { freq: 880.00, time: 1.40, dur: 0.50, vol: 0.48 }, // A5
        { freq: 1174.66, time: 1.80, dur: 2.2, vol: 0.55 }  // D6 Grand Finale
      ];
      brassNotes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);
        gain.gain.setValueAtTime(n.vol, now + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });
    } else if (cueName === 'reaction_start_chime') {
      // Bright crystalline 4-tone ascending alert chime when price reaction begins
      [783.99, 987.77, 1174.66, 1567.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.24, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.65);
      });
    } else if (cueName === 'competition_ready') {
      // Ascending C-Major chord fanfare
      [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.28, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.2);
      });
    } else if (cueName === 'login_success') {
      [659.25, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (cueName === 'login_error') {
      [207.65, 155.56].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.18, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.22);
      });
    }
  } catch (e) {
    console.warn('[AUDIO NOTE]', e);
  }
}

// ==========================================
// 2. WEBSOCKET ROUTING & SPA SESSION MANAGER
// ==========================================
function getAutoCredentials(paramVal, allParams) {
  if (allParams) {
    const customUser = allParams.get('username') || allParams.get('user') || allParams.get('u');
    const customPass = allParams.get('password') || allParams.get('pass') || allParams.get('p');
    if (customUser && customPass) {
      return { u: customUser.trim(), p: customPass.trim() };
    }
  }

  if (!paramVal) return null;
  const lower = paramVal.toLowerCase().trim();
  if (lower === 'host') {
    const pass = (allParams && (allParams.get('password') || allParams.get('pass') || allParams.get('p'))) || 'host2026';
    return { u: 'host', p: pass };
  }
  if (lower === 'projector') {
    const pass = (allParams && (allParams.get('password') || allParams.get('pass') || allParams.get('p'))) || 'screen2026';
    return { u: 'projector', p: pass };
  }
  if (lower === 'sound') {
    const pass = (allParams && (allParams.get('password') || allParams.get('pass') || allParams.get('p'))) || 'sound2026';
    return { u: 'sound', p: pass };
  }
  if (lower === 'winner') {
    const pass = (allParams && (allParams.get('password') || allParams.get('pass') || allParams.get('p'))) || 'winner2026';
    return { u: 'winner', p: pass };
  }
  const teamMatch = lower.match(/^team(\d+)$/);
  if (teamMatch) {
    const num = teamMatch[1];
    const pass = (allParams && (allParams.get('password') || allParams.get('pass') || allParams.get('p'))) || `trade${num}00`;
    return { u: `team${num}`, p: pass };
  }
  return null;
}

// ==========================================
// 1.9 EXECUTIVE INTERACTIVE SHOWCASE ENGINE (HOD PREVIEW)
// ==========================================
const MOCK_COMPANIES_BASE = [
  { ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy & Conglomerate", price: 2950, basePrice: 2950, lot_presets: [1, 5, 10] },
  { ticker: "TATAMOTORS", name: "Tata Motors Passenger & Commercial", sector: "Automobile", price: 980, basePrice: 980, lot_presets: [5, 15, 30] },
  { ticker: "MARUTI", name: "Maruti Suzuki India", sector: "Automobile", price: 12400, basePrice: 12400, lot_presets: [1, 2, 5] },
  { ticker: "M&M", name: "Mahindra & Mahindra", sector: "Automobile", price: 2850, basePrice: 2850, lot_presets: [2, 5, 10] },
  { ticker: "TCS", name: "Tata Consultancy Services", sector: "IT", price: 4150, basePrice: 4150, lot_presets: [1, 5, 10] },
  { ticker: "INFY", name: "Infosys", sector: "IT", price: 1880, basePrice: 1880, lot_presets: [5, 10, 25] },
  { ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking", price: 1680, basePrice: 1680, lot_presets: [5, 15, 30] },
  { ticker: "ICICIBANK", name: "ICICI Bank", sector: "Banking", price: 1240, basePrice: 1240, lot_presets: [5, 15, 30] },
  { ticker: "SBIN", name: "State Bank of India", sector: "Banking", price: 820, basePrice: 820, lot_presets: [10, 25, 50] },
  { ticker: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking", price: 7200, basePrice: 7200, lot_presets: [1, 3, 5] },
  { ticker: "LT", name: "Larsen & Toubro", sector: "Infrastructure", price: 3600, basePrice: 3600, lot_presets: [2, 5, 10] },
  { ticker: "AIRTEL", name: "Bharti Airtel", sector: "Telecom", price: 1550, basePrice: 1550, lot_presets: [5, 10, 25] },
  { ticker: "ITC", name: "ITC Limited", sector: "FMCG", price: 490, basePrice: 490, lot_presets: [20, 50, 100] },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG", price: 2750, basePrice: 2750, lot_presets: [2, 5, 10] },
  { ticker: "SUNPHARMA", name: "Sun Pharmaceutical Industries", sector: "Healthcare", price: 1720, basePrice: 1720, lot_presets: [5, 10, 20] },
  { ticker: "NTPC", name: "NTPC Limited", sector: "Energy & Power", price: 410, basePrice: 410, lot_presets: [25, 50, 100] },
  { ticker: "POWERGRID", name: "Power Grid Corporation", sector: "Energy & Power", price: 340, basePrice: 340, lot_presets: [25, 50, 100] },
  { ticker: "TATASTEEL", name: "Tata Steel", sector: "Metals", price: 165, basePrice: 165, lot_presets: [50, 100, 200] },
  { ticker: "JSWSTEEL", name: "JSW Steel", sector: "Metals", price: 980, basePrice: 980, lot_presets: [10, 20, 50] },
  { ticker: "TITAN", name: "Titan Company", sector: "Consumer & Luxury", price: 3450, basePrice: 3450, lot_presets: [2, 5, 10] }
];

class MockEngine {
  constructor() {
    this.companies = MOCK_COMPANIES_BASE.map(function(c, i) {
      var base = c.price;
      var history = [];
      var p = base * 0.985;
      for (var h = 0; h < 14; h++) {
        p += (Math.sin(h + i) * 0.005 + 0.001) * base;
        history.push(Number(p.toFixed(2)));
      }
      history.push(base);
      return Object.assign({}, c, {
        price: base,
        basePrice: base,
        change: 0,
        changePercent: 0,
        high: Math.max.apply(null, history),
        low: Math.min.apply(null, history),
        volume: 15400 + i * 1250,
        priceHistory: history,
        isHalted: false,
        isEnabled: true,
        lotPresets: c.lot_presets,
        fundamentals: {
          market_cap: '₹' + (base * 12).toFixed(0) + ' Cr',
          summary: c.name + ' leading constituent in ' + c.sector + '.'
        }
      });
    });

    const teamNames = [
      'Dalal Street Titans', 'Bullish Bears', 'Alpha Hedge', 'Quantum Traders',
      'Apex Capital', 'Vanguard Vipers', 'Sterling Bulls', 'Maverick Fund',
      'Zenith Asset Mgmt', 'Phoenix Wealth', 'Starlight Equity', 'Omega Syndicate',
      'Matrix Capital', 'Falcon Traders', 'Centurion Wealth', 'Ironclad Asset'
    ];

    this.teams = teamNames.map(function(name, idx) {
      return {
        id: 'team' + (idx + 1),
        username: 'team' + (idx + 1),
        name: name,
        cash: 1000000,
        portfolioValue: 1000000,
        netWorth: 1000000,
        holdings: idx === 0 ? { TATAMOTORS: 30, TCS: 10 } : {},
        avgBuyPrice: idx === 0 ? { TATAMOTORS: 975, TCS: 4120 } : {},
        realizedPnL: 0,
        unrealizedPnL: 0,
        tradesCount: idx === 0 ? 2 : 0,
        rank: idx + 1
      };
    });

    this.recalcTeam(this.teams[0]);

    this.gameState = {
      title: 'The Trading Floor Championship 2026',
      subtitle: 'BBA Department • Annual Stock Simulation',
      institution: 'Gujarat Technological University',
      status: 'LIVE',
      isPaused: false,
      currentDay: 1,
      day: 1,
      round: 1,
      elapsedSeconds: 340,
      roundDurationSeconds: 1800,
      currentEventIndex: 0,
      newsHistory: [
        {
          id: 'news_demo_1',
          headline: 'RBI Monetary Policy: Repo Rates Retained at 6.5%, Liquidity Infusion Approved',
          explanation: 'Accommodative banking stance drives immediate institutional demand across blue-chip financials and manufacturing.',
          trafficLight: 'GOOD',
          eventType: 'MACRO PULSE',
          day: 1,
          timestamp: new Date().toISOString()
        }
      ],
      circuitBreakers: {},
      projectorState: { boardPage: 1, isBoardPaused: false, autoCycleSeconds: 8 }
    };
  }

  recalcTeam(team) {
    var holdingsVal = 0;
    var unrealized = 0;
    for (var ticker in (team.holdings || {})) {
      var qty = team.holdings[ticker] || 0;
      if (qty > 0) {
        var c = this.companies.find(function(stock) { return stock.ticker === ticker; });
        var curPrice = c ? c.price : 0;
        holdingsVal += curPrice * qty;
        var avg = (team.avgBuyPrice && team.avgBuyPrice[ticker]) || curPrice;
        unrealized += (curPrice - avg) * qty;
      }
    }
    team.portfolioValue = Number((team.cash + holdingsVal).toFixed(2));
    team.netWorth = team.portfolioValue;
    team.unrealizedPnL = Number(unrealized.toFixed(2));
  }

  getState(role, teamId) {
    if (!teamId) teamId = 'team1';
    var enabled = this.companies.filter(function(c) { return c.isEnabled !== false; });
    var targetTeam = this.teams.find(function(t) { return t.id === teamId || t.username === teamId; }) || this.teams[0];

    var allocations = {};
    allocations[targetTeam.id] = { "Automobile": 2.9, "IT": 4.1, "CASH": 93.0 };

    return {
      type: 'TICK_UPDATE',
      scenarioMode: 'demo',
      serverTimeMs: Date.now(),
      soundConsoleConnected: true,
      gameState: Object.assign({}, this.gameState, {
        teams: this.teams,
        companies: enabled
      }),
      companies: enabled,
      allCompaniesUniverse: this.companies,
      team: role === 'TRADER' ? targetTeam : undefined,
      marketIndices: {
        NIFTY_TF20: { value: 24350.25, change: 112.50, changePercent: 0.46 },
        BANK_TF: { value: 52180.10, change: 310.20, changePercent: 0.60 },
        IT_TF: { value: 41920.40, change: -45.10, changePercent: -0.11 },
        AUTO_TF: { value: 25410.80, change: 185.30, changePercent: 0.73 }
      },
      teamSectorAllocations: allocations
    };
  }

  tick() {
    this.gameState.elapsedSeconds += 2;
    if (this.gameState.isPaused) return;

    for (var k = 0; k < 4; k++) {
      var idx = Math.floor(Math.random() * this.companies.length);
      var c = this.companies[idx];
      if (c && !c.isHalted) {
        var delta = (Math.random() - 0.49) * 0.006 * c.price;
        c.price = Number(Math.max(1, c.price + delta).toFixed(2));
        c.change = Number((c.price - c.basePrice).toFixed(2));
        c.changePercent = Number(((c.change / c.basePrice) * 100).toFixed(2));
        c.high = Math.max(c.high, c.price);
        c.low = Math.min(c.low, c.price);
        c.priceHistory.push(c.price);
        if (c.priceHistory.length > 50) c.priceHistory.shift();
      }
    }

    this.recalcTeam(this.teams[0]);
  }

  handleClientMessage(data, socket) {
    var action = data.action;

    if (action === 'LOGIN') {
      var u = (data.username || '').toLowerCase().trim();
      var role = 'TRADER';
      var id = 'team1';
      var name = 'Dalal Street Titans';

      if (u === 'host') { role = 'HOST'; id = 'host'; name = 'Master Control'; }
      else if (u === 'projector') { role = 'PROJECTOR'; id = 'PROJECTOR'; name = 'Main Stage Projector'; }
      else if (u === 'sound') { role = 'SOUND_CONSOLE'; id = 'SOUND_CONSOLE'; name = 'Hall Sound System'; }
      else if (u === 'winner') { role = 'WINNER_DISPLAY'; id = 'WINNER_DISPLAY'; name = 'Winner Presentation Stage'; }
      else if (u.indexOf('team') === 0) { id = u; var t = this.teams.find(function(team) { return team.id === u; }); if (t) name = t.name; }

      socket.sendBack({
        type: 'LOGIN_SUCCESS',
        session_token: 'demo_token_' + id,
        role: role,
        id: id,
        name: name,
        initialState: this.getState(role, id)
      });
      return;
    }

    if (action === 'RESUME_SESSION') {
      socket.sendBack({
        type: 'LOGIN_SUCCESS',
        session_token: data.session_token || 'demo_token_host',
        role: currentRole || 'HOST',
        id: 'host',
        name: 'Master Control',
        initialState: this.getState(currentRole || 'HOST', 'team1')
      });
      return;
    }

    if (action === 'LOGOUT') {
      return;
    }

    if (action === 'ORDER') {
      var ticker = data.ticker;
      var type = data.type;
      var quantity = data.quantity;
      var stock = this.companies.find(function(c) { return c.ticker === ticker; });
      var team = this.teams[0];

      if (!stock) {
        socket.sendBack({ type: 'ORDER_REJECTED', reason: 'Unknown stock ticker: ' + ticker });
        return;
      }
      if (stock.isHalted) {
        socket.sendBack({ type: 'ORDER_REJECTED', reason: 'Trading is halted on ' + ticker + ' due to circuit breaker.' });
        return;
      }
      var qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        socket.sendBack({ type: 'ORDER_REJECTED', reason: 'Invalid order quantity specified.' });
        return;
      }

      if (type === 'BUY') {
        var cost = stock.price * qty;
        if (team.cash < cost) {
          socket.sendBack({ type: 'ORDER_REJECTED', reason: 'Insufficient cash. Needed ₹' + cost.toFixed(2) + ', available ₹' + team.cash.toFixed(2) + '.' });
          return;
        }
        team.cash -= cost;
        team.holdings[ticker] = (team.holdings[ticker] || 0) + qty;
        team.avgBuyPrice[ticker] = stock.price;
        team.tradesCount++;
        this.recalcTeam(team);
        socket.sendBack({ type: 'ORDER_FILLED', orderType: 'BUY', ticker: ticker, quantity: qty, price: stock.price, totalImpact: cost });
        socket.sendBack(this.getState('TRADER', team.id));
      } else if (type === 'SELL') {
        var cur = team.holdings[ticker] || 0;
        if (cur < qty) {
          socket.sendBack({ type: 'ORDER_REJECTED', reason: 'Insufficient shares. You hold ' + cur + ' of ' + ticker + ', tried to sell ' + qty + '.' });
          return;
        }
        var credit = stock.price * qty;
        team.cash += credit;
        team.holdings[ticker] -= qty;
        team.tradesCount++;
        this.recalcTeam(team);
        socket.sendBack({ type: 'ORDER_FILLED', orderType: 'SELL', ticker: ticker, quantity: qty, price: stock.price, totalImpact: credit });
        socket.sendBack(this.getState('TRADER', team.id));
      }
      return;
    }

    if (action === 'LIQUIDATE_ALL') {
      var teamToLiq = this.teams[0];
      var totalCredit = 0;
      var count = 0;
      for (var tickKey in (teamToLiq.holdings || {})) {
        var hQty = teamToLiq.holdings[tickKey] || 0;
        if (hQty > 0) {
          var sStock = this.companies.find(function(c) { return c.ticker === tickKey; });
          totalCredit += (sStock ? sStock.price : 0) * hQty;
          teamToLiq.holdings[tickKey] = 0;
          count++;
        }
      }
      teamToLiq.cash += totalCredit;
      this.recalcTeam(teamToLiq);
      socket.sendBack({ type: 'PORTFOLIO_LIQUIDATED', tradesCount: count, totalNetCredit: totalCredit });
      socket.sendBack(this.getState('TRADER', teamToLiq.id));
      return;
    }

    if (action === 'HOST_PAUSE') {
      this.gameState.isPaused = true;
      this.gameState.status = 'PAUSED';
      socket.sendBack({ type: 'MARKET_PAUSED', pauseMode: data.pauseMode || 'SOFT' });
      socket.sendBack(this.getState(currentRole || 'HOST'));
      return;
    }

    var self = this;
    if (action === 'HOST_RESUME_COUNTDOWN') {
      socket.sendBack({ type: 'COUNTDOWN_TARGET', targetTimestampMs: Date.now() + 3200, remainingSeconds: 3 });
      setTimeout(function() {
        self.gameState.isPaused = false;
        self.gameState.status = 'LIVE';
        socket.sendBack({ type: 'MARKET_RESUMED' });
        socket.sendBack(self.getState(currentRole || 'HOST'));
      }, 3200);
      return;
    }

    if (action === 'HOST_TRIGGER_NEWS' || action === 'HOST_PUBLISH_NEWS_NOW') {
      var item = data.news || {
        id: 'news_' + Date.now(),
        headline: data.headline || 'Institutional Block Deal Shock: Heavy Volume Surge',
        explanation: data.explanation || 'Large domestic institutions execute portfolio rebalancing, injecting high liquidity across sectors.',
        trafficLight: data.trafficLight || 'GOOD',
        eventType: data.eventType || 'INSTITUTIONAL WIRE',
        day: this.gameState.currentDay || 1,
        timestamp: new Date().toISOString()
      };
      this.gameState.newsHistory.unshift(item);
      var s1 = this.companies[Math.floor(Math.random() * this.companies.length)];
      if (s1) { s1.price = Number((s1.price * 1.05).toFixed(2)); }
      socket.sendBack({ type: 'NEWS_FLASH', news: item });
      socket.sendBack(this.getState(currentRole || 'HOST'));
      return;
    }

    if (action === 'HOST_UNHALT_STOCK') {
      var uStock = this.companies.find(function(c) { return c.ticker === data.ticker; });
      if (uStock) uStock.isHalted = false;
      socket.sendBack(this.getState(currentRole || 'HOST'));
      return;
    }

    if (action === 'HOST_TOGGLE_SHARE') {
      var tStock = this.companies.find(function(c) { return c.ticker === data.ticker; });
      if (tStock) tStock.isEnabled = !tStock.isEnabled;
      socket.sendBack(this.getState(currentRole || 'HOST'));
      return;
    }

    if (action === 'HOST_NEXT_DAY' || action === 'HOST_FINALIZE_DAY') {
      var oldD = this.gameState.currentDay || 1;
      this.gameState.currentDay = oldD + 1;
      this.gameState.day = this.gameState.currentDay;
      socket.sendBack({ type: 'DAY_TRANSITION', oldDay: oldD, newDay: this.gameState.currentDay });
      socket.sendBack(this.getState(currentRole || 'HOST'));
      return;
    }

    if (action === 'PROJECTOR_PAGE_NAV') {
      this.gameState.projectorState.boardPage = data.page || 1;
      socket.sendBack({ type: 'PROJECTOR_STATE_UPDATE', projectorState: this.gameState.projectorState });
      return;
    }

    if (action === 'PROJECTOR_TOGGLE_BOARD_PAUSE') {
      this.gameState.projectorState.isBoardPaused = !this.gameState.projectorState.isBoardPaused;
      socket.sendBack({ type: 'PROJECTOR_STATE_UPDATE', projectorState: this.gameState.projectorState });
      return;
    }

    if (action === 'HOST_TEST_SOUND_CUE') {
      playInstitutionalSound(data.cueName);
      return;
    }
  }
}

class MockWebSocket {
  constructor(engine) {
    this.engine = engine;
    this.readyState = 1;
    var self = this;
    setTimeout(function() {
      if (self.onopen) self.onopen();
    }, 40);
  }
  send(raw) {
    try {
      var data = JSON.parse(raw);
      var self = this;
      this.engine.handleClientMessage(data, {
        sendBack: function(msg) {
          if (self.onmessage) {
            self.onmessage({ data: JSON.stringify(msg) });
          }
        }
      });
    } catch (e) {
      console.warn('[MOCK WS MSG ERROR]', e);
    }
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

let isDemoMode = false;
let mockEngineInstance = null;

function activateDemoShowcaseMode(preselectedRole) {
  if (!mockEngineInstance) {
    mockEngineInstance = new MockEngine();
  }
  isDemoMode = true;

  var demoBanner = document.getElementById('ttfDemoBanner');
  if (demoBanner) demoBanner.classList.remove('hidden');
  var quickAccessCard = document.getElementById('demoQuickAccessCard');
  if (quickAccessCard) quickAccessCard.classList.remove('hidden');

  ws = new MockWebSocket(mockEngineInstance);
  attachWebSocketEvents();

  if (preselectedRole) {
    launchDemoRole(preselectedRole);
  }
}

function launchDemoRole(role) {
  if (!isDemoMode) activateDemoShowcaseMode();
  getSharedAudioContext();

  currentRole = role;
  isLoggedIn = true;
  sessionToken = 'demo_token_' + role.toLowerCase();
  sessionStorage.setItem('ttf_session_token', sessionToken);

  ['Host', 'Projector', 'Trader', 'Winner', 'Sound'].forEach(function(name) {
    var el = document.getElementById('demoPill' + name);
    if (el) el.classList.remove('active');
  });
  var pillKey = role === 'SOUND_CONSOLE' ? 'Sound' : role === 'WINNER_DISPLAY' ? 'Winner' : role.charAt(0) + role.slice(1).toLowerCase();
  var activePill = document.getElementById('demoPill' + pillKey);
  if (activePill) activePill.classList.add('active');

  switchSpaView(role);
  if (mockEngineInstance) {
    handleStateUpdate(mockEngineInstance.getState(role, 'team1'));
  }
}

function exitDemoMode() {
  sessionToken = null;
  sessionStorage.removeItem('ttf_session_token');
  currentRole = null;
  isLoggedIn = false;
  switchSpaView(null);
  var quickAccessCard = document.getElementById('demoQuickAccessCard');
  if (quickAccessCard) quickAccessCard.classList.remove('hidden');
}

function hideDemoOverlays() {
  var demoBanner = document.getElementById('ttfDemoBanner');
  if (demoBanner) demoBanner.classList.add('hidden');
  var quickAccessCard = document.getElementById('demoQuickAccessCard');
  if (quickAccessCard) quickAccessCard.classList.add('hidden');
}

function openDeveloperInfoModal() {
  const el = document.getElementById('developerInfoModal');
  if (el) el.classList.remove('hidden');
}

function closeDeveloperInfoModal() {
  const el = document.getElementById('developerInfoModal');
  if (el) el.classList.add('hidden');
}

window.openDeveloperInfoModal = openDeveloperInfoModal;
window.closeDeveloperInfoModal = closeDeveloperInfoModal;
window.launchDemoRole = launchDemoRole;
window.exitDemoMode = exitDemoMode;
window.activateDemoShowcaseMode = activateDemoShowcaseMode;

setInterval(function() {
  if (isDemoMode && mockEngineInstance) {
    mockEngineInstance.tick();
    if (ws && ws.onmessage) {
      ws.onmessage({ data: JSON.stringify(mockEngineInstance.getState(currentRole || 'HOST', 'team1')) });
    }
  }
}, 2000);


function connectWebSocket() {
  const params = new URLSearchParams(window.location.search);
  const explicitDemo = params.get('demo') === '1' || params.get('showcase') === '1';
  const customServer = params.get('server');
  const isGitHubPages = window.location.hostname.includes('github.io');
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^192\.168\./.test(window.location.hostname) || /^10\./.test(window.location.hostname);

  if ((isGitHubPages && !customServer) || explicitDemo) {
    activateDemoShowcaseMode();
    return;
  }

  let wsUrl;
  if (customServer) {
    wsUrl = customServer.indexOf('ws') === 0 ? customServer : 'wss://' + customServer;
  } else {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = protocol + '//' + location.host;
  }

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.warn('[WS INIT NOTE]', err);
    if (!isLocalHost) {
      activateDemoShowcaseMode();
      return;
    }
  }

  let connectTimeout = setTimeout(function() {
    if (ws && ws.readyState !== WebSocket.OPEN && !isLocalHost) {
      console.info('[TTF] Server unreachable, activating Executive Demo Mode for showcase.');
      try { ws.close(); } catch (e) {}
      activateDemoShowcaseMode();
    }
  }, 3500);

  attachWebSocketEvents(function() { clearTimeout(connectTimeout); }, isLocalHost);
}

function attachWebSocketEvents(onOpenHook, isLocalHost) {
  if (typeof isLocalHost === 'undefined') isLocalHost = true;
  ws.onopen = () => {
    if (onOpenHook) onOpenHook();
    if (!isDemoMode) hideDemoOverlays();
    const params = new URLSearchParams(window.location.search);
    const targetQuery = params.get('role') || params.get('team') || params.get('autologin') || params.get('user');

    if (targetQuery) {
      if (targetQuery.toLowerCase() === 'login' || params.get('logout') === 'true') {
        sessionToken = null;
        sessionStorage.removeItem('ttf_session_token');
        switchSpaView(null);
        return;
      }

      const creds = getAutoCredentials(targetQuery, params);
      if (creds) {
        // Discard any inherited parent/tab session token to authenticate requested role cleanly
        sessionToken = null;
        sessionStorage.removeItem('ttf_session_token');
        ws.send(JSON.stringify({ action: 'LOGIN', username: creds.u, password: creds.p }));
        return;
      }
    }

    if (params.get('logout') === 'true') {
      sessionToken = null;
      sessionStorage.removeItem('ttf_session_token');
      switchSpaView(null);
      return;
    }

    if (sessionToken) {
      ws.send(JSON.stringify({ action: 'RESUME_SESSION', session_token: sessionToken }));
    }
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'LOGIN_ERROR') {
      const errEl = document.getElementById('loginError');
      errEl.textContent = msg.message;
      errEl.classList.remove('hidden');
      return;
    }

    if (msg.type === 'SESSION_EXPIRED') {
      logoutTerminal();
      return;
    }

    if (msg.type === 'LOGIN_SUCCESS') {
      sessionToken = msg.session_token;
      currentRole = msg.role;
      isLoggedIn = true;
      sessionStorage.setItem('ttf_session_token', sessionToken);
      if (msg.initialState) {
        latestState = msg.initialState;
      }
      switchSpaView(msg.role);
      handleStateUpdate(msg.initialState);
      return;
    }

    if (msg.type === 'PUBLIC_EVENT_STATUS') {
      if (!latestState) latestState = {};
      if (!latestState.gameState) latestState.gameState = {};
      latestState.gameState.configLocked = !!msg.configLocked;
      latestState.gameState.status = msg.status;
      latestState.gameState.title = msg.title;
      latestState.gameState.subtitle = msg.subtitle;
      latestState.gameState.institution = msg.institution;
      latestState.gameState.currentDay = msg.currentDay;
      latestState.gameState.totalDays = msg.totalDays;
      updateLoginEventStatusBanner(latestState);
      return;
    }

    if (msg.type === 'TICK_UPDATE') {
      if (!isLoggedIn || currentRole === null) {
        updateLoginEventStatusBanner(msg);
        return;
      }
      handleStateUpdate(msg);
      return;
    }

    if (msg.type === 'NEWS_FLASH') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('heavy_news_boom');
      showBreakingNewsToast(msg.news);
      return;
    }

    if (msg.type === 'CIRCUIT_BREAKER_ALERT') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('emergency_klaxon');
      document.body.classList.add('circuit-strobe-active');
      setTimeout(() => { document.body.classList.remove('circuit-strobe-active'); }, 5000);
      showCircuitAlertBanner(`${msg.name || msg.ticker} (${msg.ticker}) HALTED at ₹${msg.price.toFixed(2)} due to ${msg.direction || '20%'} circuit limit breach.`);
      showOrderToast(`🚨 CIRCUIT BREAKER: ${msg.ticker} halted (${msg.direction} limit at ₹${msg.price.toFixed(2)})`, false);
      return;
    }

    if (msg.type === 'BELL_EVENT') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound(msg.bell === 'OPEN' ? 'bell_open' : 'bell_close');
      return;
    }

    if (msg.type === 'AUDIO_CUE') {
      if (!isLoggedIn || currentRole === null) return;
      handleIncomingAudioCue(msg);
      return;
    }

    if (msg.type === 'PRESENTATION_SCENE_UPDATE') {
      if (!isLoggedIn || currentRole === null) return;
      renderPresentationScene(msg.scene, msg.snapshot);
      return;
    }

    if (msg.type === 'COUNTDOWN_START') {
      if (!isLoggedIn || currentRole === null) return;
      syncAuthoritativeCountdown(msg);
      return;
    }

    if (msg.type === 'COUNTDOWN_CANCELLED') {
      if (!isLoggedIn || currentRole === null) return;
      cancelAuthoritativeCountdown();
      return;
    }

    if (msg.type === 'COUNTDOWN_FINISH') {
      if (!isLoggedIn || currentRole === null) return;
      cancelAuthoritativeCountdown();
      return;
    }

    if (msg.type === 'MARKET_PAUSED') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('emergency_klaxon');
      const pauseMode = msg.pauseMode || 'VISIBLE_FROZEN';
      const softOverlay = document.getElementById('softPauseOverlay');
      const blackoutOverlay = document.getElementById('blackoutOverlay');
      if (currentRole !== 'HOST') {
        if (pauseMode === 'BLACKOUT') {
          if (blackoutOverlay) blackoutOverlay.classList.remove('hidden');
          if (softOverlay) softOverlay.classList.add('hidden');
        } else {
          if (softOverlay) softOverlay.classList.remove('hidden');
          if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
        }
      }
      showOrderToast(pauseMode === 'BLACKOUT' ? '🕶️ BLACKOUT PAUSE: Host has paused trading and blinded screens.' : '⏸️ MARKET PAUSED: Orders temporarily frozen.', false);
      return;
    }

    if (msg.type === 'MARKET_RESUMED') {
      if (!isLoggedIn || currentRole === null) return;
      const softOverlay = document.getElementById('softPauseOverlay');
      const blackoutOverlay = document.getElementById('blackoutOverlay');
      if (softOverlay) softOverlay.classList.add('hidden');
      if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
      const projPauseBanner = document.getElementById('projPauseBanner');
      if (projPauseBanner) projPauseBanner.classList.add('hidden');

      if (latestState && latestState.gameState) {
        latestState.gameState.isPaused = false;
        latestState.gameState.pauseMode = 'NONE';
        latestState.gameState.status = 'LIVE';
        handleStateUpdate(latestState);
      }

      if (!currentCountdownId && (Date.now() - lastCountdownFinishedTime > 1500)) {
        playInstitutionalSound('bell_open');
      }
      showOrderToast('Trading Resumed: Floor is active!', true);
      return;
    }

    if (msg.type === 'DAY_TRANSITION') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('bell_close');
      const dtOverlay = document.getElementById('dayTransitionOverlay');
      if (dtOverlay) {
        const titleEl = document.getElementById('dayTransitionTitle');
        const subEl = document.getElementById('dayTransitionSubtitle');
        if (titleEl) titleEl.textContent = `Day ${msg.oldDay} Concluded`;
        if (subEl) subEl.textContent = `Day ${msg.oldDay} trading finished • Day ${msg.newDay} is now on Standby`;
        dtOverlay.classList.remove('hidden');
        setTimeout(() => {
          dtOverlay.classList.add('hidden');
          showOrderToast(`Day ${msg.newDay} Standby: Waiting for Host to open the floor`, true);
        }, 3000);
      }
      return;
    }

    if (msg.type === 'EVENT_SCHEDULED') {
      if (latestState && latestState.gameState) {
        latestState.gameState.status = 'SCHEDULED';
        latestState.gameState.startMode = 'SCHEDULED';
        latestState.gameState.scheduledStartTime = msg.scheduledStartTime;
        latestState.gameState.pausePolicy = msg.pausePolicy || latestState.gameState.pausePolicy;
        if (msg.gameState) latestState.gameState = { ...latestState.gameState, ...msg.gameState };
        handleStateUpdate(latestState);
      }
      if (isLoggedIn) {
        playInstitutionalSound('order_placed');
        const timeStr = new Date(msg.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        showOrderToast(`📅 Event scheduled for ${timeStr}. Waiting room countdown armed.`, true);
      }
      return;
    }

    if (msg.type === 'EVENT_CONFIG_LOCKED' || msg.type === 'EVENT_CONFIG_LOCKED_ACK') {
      closeLockSetupConfirmModal();
      try { localStorage.removeItem('ttf_setup_draft'); } catch (e) {}

      if (!latestState) latestState = {};
      if (!latestState.gameState) latestState.gameState = {};
      latestState.gameState.configLocked = true;
      latestState.gameState.status = msg.status || (msg.gameState && msg.gameState.status) || 'STANDBY';
      if (msg.gameState) latestState.gameState = { ...latestState.gameState, ...msg.gameState };
      if (msg.companies) latestState.companies = msg.companies;
      if (msg.allCompaniesUniverse) latestState.allCompaniesUniverse = msg.allCompaniesUniverse;
      if (msg.scenarioMode) latestState.scenarioMode = msg.scenarioMode;

      if (isLoggedIn) {
        playInstitutionalSound('competition_ready');
      }
      updateLoginEventStatusBanner(latestState);

      if (currentRole === 'HOST') {
        const setupEl = document.getElementById('eventSetupView');
        const hostEl = document.getElementById('hostView');
        if (setupEl) setupEl.classList.add('hidden');
        if (hostEl) hostEl.classList.remove('hidden');
        showOrderToast(`🔒 ${msg.message || msg.reason || 'Configuration locked! Live championship active and team logins open.'}`, true);
        if (msg.type === 'EVENT_CONFIG_LOCKED_ACK') {
          openPostLockDay1Modal(msg.teamsCount || 16);
        }
        if (latestState) {
          try {
            renderHostView(latestState);
          } catch (renderErr) {
            console.error('[RENDER HOST VIEW ERROR]', renderErr);
          }
        }
      }
      return;
    }

    if (msg.type === 'NEWS_REACTION_START') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('reaction_start_chime');
      showOrderToast(`📢 BREAKING WIRE: ${msg.headline || 'Market news bulletin'}`, true);
      const trafficBadge = document.getElementById('bannerTrafficBadge');
      if (trafficBadge) {
        trafficBadge.textContent = '🔴 LIVE BREAKING NEWS';
        trafficBadge.className = 'badge badge-halted';
      }
      return;
    }

    if (msg.type === 'NEWS_REACTION_SPOTLIGHT') {
      if (!isLoggedIn || currentRole === null) return;
      handleNewsReactionSpotlight(msg.data);
      return;
    }

    if (msg.type === 'DAY_CONCLUDED') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('bell_close');
      const isAuto = !!msg.isAutomaticEnd || msg.reason === 'TIMER_EXPIRY';
      const toastMsg = isAuto
        ? `🔔 Day ${msg.day} Concluded: The trading timer has ended. Results have been finalized, and trading cannot be resumed for this day.`
        : `🔔 Day ${msg.day} Concluded! Daily portfolios frozen and audited standings generated.`;
      showOrderToast(toastMsg, true);

      // Explicitly hide pause overlays on day conclusion
      const softOverlay = document.getElementById('softPauseOverlay');
      const blackoutOverlay = document.getElementById('blackoutOverlay');
      if (softOverlay) softOverlay.classList.add('hidden');
      if (blackoutOverlay) blackoutOverlay.classList.add('hidden');

      if (latestState && latestState.gameState) {
        latestState.gameState.status = 'DAY_COMPLETED';
        latestState.gameState.isPaused = false;
        latestState.gameState.pauseMode = 'NONE';
        latestState.gameState.isAutomaticEnd = isAuto;
        latestState.gameState.concludedReason = msg.reason || (isAuto ? 'TIMER_EXPIRY' : 'MANUAL_HOST_ACTION');
        latestState.gameState.isConcluded = (msg.day >= (latestState.gameState.totalDays || 3));
        if (msg.daySnapshot) {
          if (!latestState.gameState.dailyLeaderboards) latestState.gameState.dailyLeaderboards = {};
          latestState.gameState.dailyLeaderboards[`day_${msg.day}`] = msg.daySnapshot;
        }
        handleStateUpdate(latestState);
      }
      return;
    }

    if (msg.type === 'DAY_ADDED') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('competition_ready');
      showOrderToast(`➕ Championship extended! Total days is now ${msg.totalDays}. Balanced news generated for Day ${msg.totalDays}.`, true);
      if (latestState && latestState.gameState) {
        latestState.gameState.totalDays = msg.totalDays;
        handleStateUpdate(latestState);
      }
      return;
    }

    if (msg.type === 'EMERGENCY_STOP') {
      if (!isLoggedIn || currentRole === null) return;
      playInstitutionalSound('emergency_klaxon');
      document.body.classList.add('circuit-strobe-active');
      setTimeout(() => { document.body.classList.remove('circuit-strobe-active'); }, 5000);
      showOrderToast(`🚨 EMERGENCY STOP: All market trading halted by Host across all desks.`, false);
      if (latestState && latestState.gameState) {
        latestState.gameState.status = 'EMERGENCY_STOP';
        latestState.gameState.isPaused = true;
        handleStateUpdate(latestState);
      }
      return;
    }

    if (msg.type === 'CHAMPIONSHIP_RESET') {
      playInstitutionalSound('bell_close');
      cancelAuthoritativeCountdown();
      // Safely close all active dialogs & modals across desks
      ['tradeModal', 'detailsModal', 'fullChartModal', 'liquidateConfirmModal', 'newsFlashModal', 'winnerPodiumModal', 'softPauseOverlay', 'blackoutOverlay'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const resetMsg = msg.message || 'The host has reset the competition. You have been logged out. Please wait for the host to set up a new event.';
      if (currentRole === 'TRADER') {
        const modal = document.getElementById('clientResetModal');
        const textEl = document.getElementById('clientResetMessageText');
        if (textEl) textEl.textContent = resetMsg;
        if (modal) modal.classList.remove('hidden');
        sessionToken = null;
        localStorage.removeItem('tf_session_token');
      } else if (currentRole === 'HOST') {
        showOrderToast('🔄 Championship reset complete. Returned to Day 1 Standby.', true);
        switchHostTab('event');
        switchSetupSection('details');
      } else {
        showOrderToast(resetMsg, false);
      }
      return;
    }

    if (msg.type === 'CHAMPIONSHIP_RESET_ACK') {
      if (currentRole === 'HOST') {
        showOrderToast('Championship successfully reset to Day 1 Standby.', true);
      }
      return;
    }

    if (msg.type === 'CHAMPIONSHIP_INITIALIZED_SUCCESS') {
      if (currentRole === 'HOST') {
        closeChampionshipWizardModal();
        showOrderToast(msg.message || 'New championship configured! Market is ready.', true);
      }
      return;
    }

    if (msg.type === 'CHAMPIONSHIP_CONCLUDED') {
      playInstitutionalSound('championship_fanfare');
      showWinnerPodium(msg.winnerData, msg.title);
      return;
    }

    if (msg.type === 'PODIUM_DISMISSED') {
      document.getElementById('winnerPodiumModal').classList.add('hidden');
      return;
    }

    if (msg.type === 'PORTFOLIO_LIQUIDATED') {
      playInstitutionalSound('portfolio_liquidated');
      closeLiquidateModal();
      const skipNote = msg.skippedHalted && msg.skippedHalted.length > 0
        ? ` (${msg.skippedHalted.length} halted stocks preserved)`
        : '';
      showOrderToast(`⚡ ALL SHARES SOLD: Liquidated ${msg.tradesCount} positions for ₹${Number(msg.totalNetCredit).toLocaleString('en-IN')} net cash! Portfolio is now 100% Cash in Hand.${skipNote}`, true);
      return;
    }

    if (msg.type === 'SETUP_VALIDATION_ERROR') {
      showOrderToast(`⚠️ ${msg.message || 'Setup validation failed.'}`, false);
      return;
    }

    if (msg.type === 'EVENT_CONFIG_UNLOCKED') {
      if (latestState && latestState.gameState) {
        latestState.gameState.configLocked = false;
        latestState.gameState.status = 'SETUP';
      }
      updateLoginEventStatusBanner(latestState);
      if (currentRole === 'HOST') {
        const setupEl = document.getElementById('eventSetupView');
        const hostEl = document.getElementById('hostView');
        if (setupEl) {
          setupEl.classList.remove('hidden');
          initOrRestoreEventSetup();
        }
        if (hostEl) hostEl.classList.add('hidden');
      }
      showOrderToast('🔓 Event setup is now unlocked.', true);
      return;
    }

    if (msg.type === 'EVENT_CONFIG_CHANGED') {
      showOrderToast(`⚙️ Tournament settings updated: "${msg.title || 'Settings Updated'}"`, true);
      return;
    }

    if (msg.type === 'ORDER_FILLED') {
      playInstitutionalSound('order_fill');
      showOrderToast(`✓ ${msg.orderType} FILLED: ${msg.quantity} ${msg.ticker} @ ₹${msg.price.toFixed(2)} (Net: ₹${msg.totalImpact.toFixed(2)})`, true);
      closeTradeModal();
      return;
    }

    if (msg.type === 'ORDER_REJECTED') {
      playInstitutionalSound('order_rejected');
      showOrderToast(`✗ ${msg.reason}`, false);

      // Display live feedback inside Trade Modal if open
      const noticeEl = document.getElementById('tradeModalValidationNotice');
      if (noticeEl && currentTradeModalTicker) {
        noticeEl.textContent = msg.reason;
        noticeEl.style.backgroundColor = '#FEF2F2';
        noticeEl.style.color = '#B91C1C';
        noticeEl.style.border = '1px solid #FCA5A5';
        noticeEl.classList.remove('hidden');
      }
      return;
    }

    if (msg.type === 'MARKET_RESTORED') {
      playInstitutionalSound('bell_close');
      const softOverlay = document.getElementById('softPauseOverlay');
      if (softOverlay && currentRole !== 'HOST') softOverlay.classList.remove('hidden');
      showOrderToast(msg.message || 'Championship state restored! Market is paused ready for Host Resume.', true);
      const banner = document.getElementById('hostRestoreStatusBanner');
      const bannerText = document.getElementById('hostRestoreStatusText');
      if (banner && bannerText) {
        bannerText.textContent = msg.message || 'Championship state restored successfully!';
        banner.classList.remove('hidden');
        setTimeout(() => { banner.classList.add('hidden'); }, 8000);
      }
      return;
    }

    if (msg.type === 'CHECKPOINT_CREATED_ACK') {
      if (msg.ok) {
        showOrderToast(`💾 ${msg.message || 'Checkpoint saved successfully!'}`, true);
        hostRefreshCheckpoints();
      } else {
        showOrderToast(`⚠️ ${msg.message || 'Failed to save checkpoint.'}`, false);
      }
      return;
    }

    if (msg.type === 'CHECKPOINTS_LIST_ACK') {
      renderHostCheckpointsTable(msg.checkpoints || []);
      return;
    }

    if (msg.type === 'CHECKPOINT_RESTORED_ACK') {
      showOrderToast(`🛡️ ${msg.message || 'Game restored from checkpoint!'}`, true);
      const banner = document.getElementById('hostRestoreStatusBanner');
      const bannerText = document.getElementById('hostRestoreStatusText');
      if (banner && bannerText) {
        bannerText.textContent = msg.message || 'Game restored from checkpoint!';
        banner.classList.remove('hidden');
        setTimeout(() => { banner.classList.add('hidden'); }, 8000);
      }
      hostRefreshCheckpoints();
      return;
    }

    if (msg.type === 'PROJECTOR_STATE_UPDATE') {
      if (latestState && latestState.gameState) {
        latestState.gameState.projectorState = msg.projectorState;
      }
      if (msg.projectorState && msg.projectorState.boardPage) {
        currentProjectorBoardPage = msg.projectorState.boardPage;
      }
      if (msg.projectorState && msg.projectorState.isBoardPaused !== undefined) {
        isProjectorBoardPaused = msg.projectorState.isBoardPaused;
        const btn = document.getElementById('btnProjToggleBoardPause');
        if (btn) btn.textContent = isProjectorBoardPaused ? '▶' : '⏸';
      }
      if (currentRole === 'PROJECTOR' && latestState) {
        renderProjectorView(latestState);
      }
      return;
    }
  };

  ws.onerror = (err) => {
    if (!isLocalHost && !isDemoMode) {
      activateDemoShowcaseMode();
    }
  };

  ws.onclose = () => {
    if (isDemoMode) return;
    if (!isLocalHost) {
      activateDemoShowcaseMode();
    } else {
      setTimeout(connectWebSocket, 2000);
    }
  };
}

function switchSpaView(role) {
  // Set data-role on body for CSS targeting (responsive styles)
  if (role) {
    document.body.setAttribute('data-role', role);
  } else {
    document.body.removeAttribute('data-role');
  }

  ['loginView', 'traderView', 'hostView', 'projectorView', 'soundConsoleView', 'winnerPresentationView', 'eventSetupView'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (role === 'TRADER') {
    document.getElementById('traderView').classList.remove('hidden');
  } else if (role === 'HOST') {
    const isLocked = latestState && latestState.gameState && latestState.gameState.configLocked;
    if (!isLocked) {
      const setupEl = document.getElementById('eventSetupView');
      if (setupEl) {
        setupEl.classList.remove('hidden');
        initOrRestoreEventSetup();
      }
    } else {
      const hostEl = document.getElementById('hostView');
      if (hostEl) hostEl.classList.remove('hidden');
    }
  } else if (role === 'PROJECTOR') {
    document.getElementById('projectorView').classList.remove('hidden');
  } else if (role === 'SOUND_CONSOLE') {
    document.getElementById('soundConsoleView').classList.remove('hidden');
  } else if (role === 'WINNER_DISPLAY') {
    document.getElementById('winnerPresentationView').classList.remove('hidden');
  } else {
    document.getElementById('loginView').classList.remove('hidden');
    updateLoginEventStatusBanner(latestState);
  }
}

function logoutTerminal() {
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'LOGOUT', session_token: sessionToken }));
  }
  sessionStorage.removeItem('ttf_session_token');
  sessionToken = null;
  currentRole = null;
  isLoggedIn = false;
  teamEquityHistory = [];
  ['softPauseOverlay', 'blackoutOverlay', 'countdownOverlay', 'traderDayCompletedOverlay', 'waitingRoomOverlay', 'tradeModal', 'detailsModal', 'fullChartModal', 'liquidateConfirmModal', 'newsFlashModal', 'winnerPodiumModal', 'circuitBreakerAlertBanner'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.body.classList.remove('circuit-strobe-active');
  switchSpaView(null);
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  if (isDemoMode) {
    const lower = (username || '').toLowerCase().trim();
    if (lower === 'host') return launchDemoRole('HOST');
    if (lower === 'projector') return launchDemoRole('PROJECTOR');
    if (lower === 'sound') return launchDemoRole('SOUND_CONSOLE');
    if (lower === 'winner') return launchDemoRole('WINNER_DISPLAY');
    return launchDemoRole('TRADER');
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    const errEl = document.getElementById('loginError');
    errEl.textContent = 'Connecting to simulation engine... Please wait 2 seconds.';
    errEl.classList.remove('hidden');
    return;
  }
  ws.send(JSON.stringify({ action: 'LOGIN', username, password }));
});

// Window keydown shortcuts: Trade modal controls & Projector lock
window.addEventListener('keydown', (e) => {
  // ESC key handler
  if (e.key === 'Escape') {
    if (currentTradeModalTicker) {
      closeTradeModal();
      return;
    }
    if (currentRole === 'PROJECTOR') {
      logoutTerminal();
    }
    return;
  }

  // Active Trade Modal Controls
  if (currentTradeModalTicker) {
    const modal = document.getElementById('tradeModal');
    if (modal && !modal.classList.contains('hidden')) {
      if (e.key === 'Enter') {
        const btn = document.getElementById('btnExecuteTradeOrder');
        if (btn && !btn.disabled) {
          e.preventDefault();
          executeModalTrade();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepTradeQuantity(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepTradeQuantity(-1);
      }
    }
  }
});

function toggleProjectorFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ==========================================
// 3. UTILITY FORMATTERS
// ==========================================
function formatMMSS(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatINR(num) {
  return '₹' + Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatRupee(num) {
  return formatINR(num);
}

function handleStateUpdate(state) {
  if (!state) return;
  latestState = state;

  if (state.serverTimeMs) {
    serverClockOffsetMs = Date.now() - state.serverTimeMs;
  }

  // Sync custom Event Title across all views
  if (state.gameState && state.gameState.title) {
    document.title = state.gameState.title;
    const loginTitleEl = document.getElementById('loginEventTitle');
    if (loginTitleEl) loginTitleEl.textContent = state.gameState.title;
    const projTitleEl = document.getElementById('projEventTitleHeader');
    if (projTitleEl) projTitleEl.textContent = state.gameState.title;
    const presTitleEl = document.getElementById('presEventTitle');
    if (presTitleEl) presTitleEl.textContent = state.gameState.title;
  }

  // Synchronize Authoritative Resume Countdown if active on server
  if (state.gameState && state.gameState.activeCountdown) {
    const activeCdId = state.gameState.activeCountdown.countdownId || state.gameState.activeCountdown.id;
    if (!currentCountdownId || currentCountdownId !== activeCdId) {
      syncAuthoritativeCountdown(state.gameState.activeCountdown);
    }
  } else if (currentCountdownId) {
    cancelAuthoritativeCountdown();
  }

  // Handle Dual Pause Overlays (Strict State Priority: Never show pause overlay when pre-event, standby, countdown, or day concluded)
  const isPreEvent = state.gameState && (
    state.gameState.status === 'SCHEDULED' ||
    state.gameState.status === 'PRE_EVENT_COUNTDOWN' ||
    state.gameState.status === 'STANDBY' ||
    state.gameState.status === 'COUNTDOWN' ||
    state.gameState.status === 'NOT_STARTED' ||
    (state.gameState.elapsedSeconds === 0 && state.gameState.status !== 'LIVE')
  );
  const isDayCompleted = state.gameState && (
    state.gameState.status === 'DAY_COMPLETED' ||
    state.gameState.status === 'MARKET_CLOSED'
  );
  const softOverlay = document.getElementById('softPauseOverlay');
  const blackoutOverlay = document.getElementById('blackoutOverlay');

  // CRITICAL INVARIANT: Day conclusion is NEVER a pause. Pause overlay can only appear if genuinely paused.
  const isGenuinelyPaused = isLoggedIn && currentRole !== null && currentRole !== 'HOST' &&
    state.gameState &&
    state.gameState.isPaused &&
    !state.gameState.isConcluded &&
    !isPreEvent &&
    !isDayCompleted &&
    state.gameState.status !== 'DAY_COMPLETED';

  if (isGenuinelyPaused) {
    const mode = state.gameState.pauseMode || 'VISIBLE_FROZEN';
    if (mode === 'BLACKOUT') {
      if (blackoutOverlay) blackoutOverlay.classList.remove('hidden');
      if (softOverlay) softOverlay.classList.add('hidden');
    } else {
      if (softOverlay) softOverlay.classList.remove('hidden');
      if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
    }
  } else {
    if (softOverlay) softOverlay.classList.add('hidden');
    if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
  }

  // Check if championship concluded and show podium
  if (state.gameState && state.gameState.isConcluded && state.gameState.winnerData) {
    showWinnerPodium(state.gameState.winnerData, state.gameState.title);
  }

  // Authoritatively update login readiness banner
  updateLoginEventStatusBanner(state);

  // Authoritatively manage Host Setup View vs Host Panel View routing
  if (currentRole === 'HOST') {
    const setupEl = document.getElementById('eventSetupView');
    const hostEl = document.getElementById('hostView');
    const isLocked = state.gameState && state.gameState.configLocked;
    if (!isLocked) {
      if (setupEl && setupEl.classList.contains('hidden')) {
        setupEl.classList.remove('hidden');
        initOrRestoreEventSetup();
      }
      if (hostEl && !hostEl.classList.contains('hidden')) {
        hostEl.classList.add('hidden');
      }
    } else {
      if (setupEl && !setupEl.classList.contains('hidden')) {
        setupEl.classList.add('hidden');
      }
      if (hostEl && hostEl.classList.contains('hidden')) {
        hostEl.classList.remove('hidden');
      }
    }
  }

  if (currentRole === 'TRADER') renderTraderView(state);
  else if (currentRole === 'HOST') {
    if (state.gameState && state.gameState.configLocked) {
      renderHostView(state);
    }
  }
  else if (currentRole === 'PROJECTOR') renderProjectorView(state);
  else if (currentRole === 'SOUND_CONSOLE') renderSoundConsoleView(state);
  else if (currentRole === 'WINNER_DISPLAY') renderWinnerPresentationView(state);

  // If full chart modal is open, keep updating it live
  if (currentSelectedTickerForChart && !document.getElementById('fullChartModal').classList.contains('hidden')) {
    updateFullChartModalData(currentSelectedTickerForChart);
  }

  // If trade modal is open, keep updating live prices
  if (currentTradeModalTicker && !document.getElementById('tradeModal').classList.contains('hidden')) {
    recalculateTradeModal();
  }
}

// ==========================================
// 4. STUDENT TRADER DESK RENDERER
// ==========================================
function switchTraderTab(tabName) {
  activeTraderTab = tabName;
  ['market', 'positions', 'trades'].forEach((t) => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`traderTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.className = t === tabName ? 'btn btn-sage' : 'btn btn-outline';
    if (content) {
      if (t === tabName) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });
}

function filterTraderStocks() {
  const searchInput = document.getElementById('traderStockSearch');
  const sectorSelect = document.getElementById('traderSectorFilter');
  const sortSelect = document.getElementById('traderSortFilter');
  const holdingsCheck = document.getElementById('traderHoldingsOnly');

  traderSearchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
  traderSectorFilterVal = sectorSelect ? sectorSelect.value : 'ALL';
  traderSortFilterVal = sortSelect ? sortSelect.value : 'default';
  traderHoldingsOnlyVal = holdingsCheck ? holdingsCheck.checked : false;

  renderTraderSectorChips();

  if (latestState && currentRole === 'TRADER') {
    renderTraderView(latestState);
  }
}

function onTraderSectorSelect(sec) {
  traderSectorFilterVal = sec;
  const sectorSelect = document.getElementById('traderSectorFilter');
  if (sectorSelect) sectorSelect.value = sec;
  renderTraderSectorChips();
  if (latestState && currentRole === 'TRADER') {
    renderTraderView(latestState);
  }
}

function clearTraderFilters() {
  const searchInput = document.getElementById('traderStockSearch');
  const sectorSelect = document.getElementById('traderSectorFilter');
  const sortSelect = document.getElementById('traderSortFilter');
  const holdingsCheck = document.getElementById('traderHoldingsOnly');

  if (searchInput) searchInput.value = '';
  if (sectorSelect) sectorSelect.value = 'ALL';
  if (sortSelect) sortSelect.value = 'default';
  if (holdingsCheck) holdingsCheck.checked = false;

  traderSearchTerm = '';
  traderSectorFilterVal = 'ALL';
  traderSortFilterVal = 'default';
  traderHoldingsOnlyVal = false;

  renderTraderSectorChips();

  if (latestState && currentRole === 'TRADER') {
    renderTraderView(latestState);
  }
}

function renderTraderSectorChips() {
  const container = document.getElementById('traderSectorChips');
  if (!container || !latestState || !latestState.companies) return;

  const activeCompanies = latestState.companies.filter((c) => c.isEnabled !== false);
  const sectors = ['ALL', ...new Set(activeCompanies.map((c) => c.sector).filter(Boolean))];

  // Dynamically populate sector dropdown if changed
  const sectorSelect = document.getElementById('traderSectorFilter');
  if (sectorSelect) {
    const existingOpts = Array.from(sectorSelect.options).map((o) => o.value);
    const isDifferent = existingOpts.length !== sectors.length || !sectors.every((s) => existingOpts.includes(s));
    if (isDifferent) {
      const currentVal = sectorSelect.value || traderSectorFilterVal;
      sectorSelect.innerHTML = `<option value="ALL">All Sectors</option>` +
        sectors.filter((s) => s !== 'ALL').map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      sectorSelect.value = sectors.includes(currentVal) ? currentVal : 'ALL';
    }
  }

  // Render clickable pills
  container.innerHTML = sectors.map((sec) => {
    const isActive = traderSectorFilterVal === sec;
    const label = sec === 'ALL' ? 'All Stocks' : sec;
    return `
      <button type="button" onclick="onTraderSectorSelect('${escapeHtml(sec)}')" class="trader-chip ${isActive ? 'active' : ''}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
}

function dismissTraderDayCompleted() {
  dayCompletedDismissed = true;
  const overlay = document.getElementById('traderDayCompletedOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderTraderDayCompletedLeaderboard(state) {
  const container = document.getElementById('traderDayCompletedLeaderboardList');
  if (!container) return;
  const gs = state.gameState;
  const curDay = gs ? gs.currentDay : 1;
  const snapshot = (gs && gs.dailyLeaderboards && gs.dailyLeaderboards[`day_${curDay}`]) || null;
  const rankings = (snapshot && snapshot.rankings && snapshot.rankings.length > 0)
    ? snapshot.rankings
    : (state.leaderboard || []);
  const myTeamId = state.portfolio ? state.portfolio.id : null;

  if (!rankings || rankings.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px;">Auditing Day ${curDay} standings...</div>`;
    return;
  }

  container.innerHTML = rankings.map((team, idx) => {
    const rank = team.rank || (idx + 1);
    const isMe = (team.teamId === myTeamId) || (team.id === myTeamId);
    const dayPnl = team.dayPnl !== undefined
      ? team.dayPnl
      : ((team.netWorth || 500000) - (team.startingCash || gs?.startingCash || 500000));
    const pnlFormatted = `${dayPnl >= 0 ? '+' : ''}${formatINR(dayPnl)}`;
    const pnlColor = dayPnl > 0 ? '#16804a' : dayPnl < 0 ? '#b42318' : 'var(--text-muted)';
    const netWorthFormatted = formatINR(team.netWorth || 500000);
    const retPct = team.dayReturnPercent !== undefined
      ? `${team.dayReturnPercent >= 0 ? '+' : ''}${team.dayReturnPercent.toFixed(2)}%`
      : '';

    const rankBadgeStyle = rank === 1
      ? 'background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B;'
      : rank === 2
      ? 'background: #F1F5F9; color: #475569; border: 1px solid #94A3B8;'
      : rank === 3
      ? 'background: #FFEDD5; color: #9A3412; border: 1px solid #FB923C;'
      : 'background: var(--surface-cream); color: var(--text-muted); border: 1px solid var(--subtle-border);';

    const rowBg = isMe
      ? 'background: rgba(63, 98, 146, 0.08); border: 1.5px solid #3f6292;'
      : 'background: #FAF9F6; border: 1px solid var(--subtle-border);';

    return `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; ${rowBg}">
        <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 800; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; flex-shrink: 0; ${rankBadgeStyle}">
          ${rank}
        </span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 800; color: var(--text-forest); display: flex; align-items: center; gap: 6px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(team.teamName || team.name || `Team ${rank}`)}</span>
            ${isMe ? '<span class="badge" style="background: #3f6292; color: #fff; font-size: 10px; padding: 1px 6px;">YOU</span>' : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
            Net Worth: ${netWorthFormatted}${retPct ? ` • Return: ${retPct}` : ''}
          </div>
        </div>
        <div style="text-align: right; font-family: var(--font-mono); font-size: 15px; font-weight: 800; color: ${pnlColor}; flex-shrink: 0;">
          ${pnlFormatted}
        </div>
      </div>
    `;
  }).join('');
}

let traderWaitingRoomTickerHandle = null;
function ensureTraderWaitingRoomTicker() {
  if (traderWaitingRoomTickerHandle) return;
  traderWaitingRoomTickerHandle = setInterval(() => {
    if (!latestState || !latestState.gameState) return;
    const gs = latestState.gameState;
    const isPreEvent = gs.status === 'SCHEDULED' || 
                       gs.status === 'PRE_EVENT_COUNTDOWN' || 
                       gs.status === 'NOT_STARTED' ||
                       (gs.elapsedSeconds === 0 && gs.status !== 'LIVE');
    if (!isPreEvent) {
      clearInterval(traderWaitingRoomTickerHandle);
      traderWaitingRoomTickerHandle = null;
      const wrOverlay = document.getElementById('traderWaitingRoomOverlay');
      if (wrOverlay) wrOverlay.classList.add('hidden');
      return;
    }
    if (!gs.scheduledStartTime) return;
    const targetMs = new Date(gs.scheduledStartTime).getTime();
    if (isNaN(targetMs)) return;
    const remainingMs = Math.max(0, targetMs - Date.now());
    const remSec = Math.floor(remainingMs / 1000);
    const hrs = Math.floor(remSec / 3600);
    const mins = Math.floor((remSec % 3600) / 60);
    const secs = remSec % 60;
    const formatted = hrs > 0
      ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const timerDisplay = document.getElementById('waitingRoomTimerDisplay');
    if (timerDisplay) timerDisplay.textContent = formatted;

    const dualVal = document.getElementById('traderDualTimerValue');
    if (dualVal) dualVal.textContent = formatted;

    const timerNote = document.getElementById('waitingRoomTimerNote');
    if (timerNote) {
      if (remSec <= 5 && remSec > 0) {
        timerNote.innerHTML = `<span style="color: #059669; font-weight: 800; font-size: 15px;">🚀 Stand by! Floor opening bell in ${remSec}s...</span>`;
      } else if (remSec === 0) {
        timerNote.innerHTML = `<span style="color: #059669; font-weight: 800; font-size: 15px;">🔔 Opening bells ringing! Market is launching...</span>`;
      }
    }
  }, 250);
}

function renderTraderView(state) {
  const { gameState, companies, portfolio, teamTrades } = state;
  if (!gameState || !companies) return;

  document.getElementById('traderDayBadge').textContent = `DAY ${gameState.currentDay} / ${gameState.totalDays}`;
  document.getElementById('traderClock').textContent = formatMMSS(gameState.elapsedSeconds);

  const statusEl = document.getElementById('traderMarketStatus');
  if (gameState.status === 'DAY_COMPLETED') {
    statusEl.textContent = `DAY ${gameState.currentDay} COMPLETED`;
    statusEl.className = 'badge badge-champagne';
    statusEl.style.cursor = 'pointer';
    statusEl.title = 'Click to reopen Day Concluded Standings';
    statusEl.onclick = () => {
      dayCompletedDismissed = false;
      const overlay = document.getElementById('traderDayCompletedOverlay');
      if (overlay) overlay.classList.remove('hidden');
    };
  } else if (gameState.status === 'STANDBY') {
    statusEl.textContent = `DAY ${gameState.currentDay} STANDBY`;
    statusEl.className = 'badge badge-champagne';
    statusEl.style.cursor = 'default';
    statusEl.onclick = null;
  } else if (gameState.isPaused) {
    statusEl.textContent = 'MARKET PAUSED';
    statusEl.className = 'badge badge-paused';
    statusEl.style.cursor = 'default';
    statusEl.onclick = null;
  } else {
    statusEl.textContent = 'ACTIVE TRADING';
    statusEl.className = 'badge badge-active';
    statusEl.style.cursor = 'default';
    statusEl.onclick = null;
  }

  // Dual Timer & Waiting Room Logic
  const waitingRoomOverlay = document.getElementById('traderWaitingRoomOverlay');
  const dayCompletedOverlay = document.getElementById('traderDayCompletedOverlay');
  const dualTimerLabel = document.getElementById('traderDualTimerLabel');
  const dualTimerValue = document.getElementById('traderDualTimerValue');
  const dualTimerWrap = document.getElementById('traderDualTimerWrap');
  const softPauseOverlay = document.getElementById('softPauseOverlay');
  const blackoutOverlay = document.getElementById('blackoutOverlay');

  // Handle Dedicated Day Completed Modal for Traders
  if (gameState.status === 'DAY_COMPLETED') {
    if (dayCompletedOverlay && !dayCompletedDismissed) {
      dayCompletedOverlay.classList.remove('hidden');
      const badge = document.getElementById('traderDayCompletedBadge');
      const title = document.getElementById('traderDayCompletedTitle');
      const sub = document.getElementById('traderDayCompletedSubtitle');
      const netWorthEl = document.getElementById('traderDayCompletedNetWorth');
      const pnlEl = document.getElementById('traderDayCompletedPnl');
      const rankEl = document.getElementById('traderDayCompletedRank');
      const waitTitle = document.getElementById('traderDayCompletedWaitTitle');
      const waitDesc = document.getElementById('traderDayCompletedWaitDesc');

      if (badge) badge.textContent = `DAY ${gameState.currentDay} COMPLETED`;
      if (title) title.textContent = `Day ${gameState.currentDay} Concluded`;
      if (sub) sub.textContent = gameState.currentDay < gameState.totalDays
        ? `Trading session completed successfully. All student portfolios audited and locked.`
        : `Championship final round completed! Stand by for the official winner presentation.`;

      if (portfolio) {
        if (netWorthEl) netWorthEl.textContent = formatINR(portfolio.netWorth);
        const dayPnl = portfolio.netWorth - (portfolio.startingCash || gameState.startingCash || 500000);
        if (pnlEl) {
          pnlEl.textContent = `${dayPnl >= 0 ? '+' : ''}${formatINR(dayPnl)}`;
          pnlEl.className = dayPnl >= 0 ? 'price-up' : 'price-down';
        }
        if (rankEl && latestState.leaderboard) {
          const myIdx = latestState.leaderboard.findIndex((t) => t.id === portfolio.id);
          if (myIdx !== -1) rankEl.textContent = `#${myIdx + 1}`;
        }
      }

      if (waitTitle && waitDesc) {
        if (gameState.currentDay < gameState.totalDays) {
          waitTitle.textContent = 'Waiting for the host';
          waitDesc.textContent = `The next trading day has not started yet. All portfolios and cash carry forward seamlessly to Day ${gameState.currentDay + 1}.`;
        } else {
          waitTitle.textContent = 'Waiting for the host';
          waitDesc.textContent = 'All competition days completed. Stand by for the official championship awards ceremony.';
        }
      }

      renderTraderDayCompletedLeaderboard(state);
    }
    if (dualTimerLabel) dualTimerLabel.textContent = 'SESSION:';
    if (dualTimerValue) dualTimerValue.textContent = 'COMPLETED';
    if (dualTimerWrap) {
      dualTimerWrap.style.background = 'rgba(180, 154, 112, 0.12)';
      dualTimerWrap.style.borderColor = 'rgba(180, 154, 112, 0.35)';
    }
  } else {
    if (dayCompletedOverlay) dayCompletedOverlay.classList.add('hidden');
    dayCompletedDismissed = false;
  }

  const isPreEventTrader = gameState.status === 'SCHEDULED' || 
                           gameState.status === 'PRE_EVENT_COUNTDOWN' || 
                           gameState.status === 'STANDBY' ||
                           gameState.status === 'NOT_STARTED' ||
                           (gameState.elapsedSeconds === 0 && gameState.status !== 'LIVE' && gameState.status !== 'COUNTDOWN');

  if (isPreEventTrader && gameState.status !== 'DAY_COMPLETED') {
    if (waitingRoomOverlay) {
      waitingRoomOverlay.classList.remove('hidden');
      if (softPauseOverlay) softPauseOverlay.classList.add('hidden');
      if (blackoutOverlay) blackoutOverlay.classList.add('hidden');

      const wrTitle = document.getElementById('waitingRoomTitle');
      const wrSub = document.getElementById('waitingRoomSubtitle');
      const wrTeam = document.getElementById('waitingRoomTeamName');
      const wrCash = document.getElementById('waitingRoomCash');
      const wrRound = document.getElementById('waitingRoomRound');
      const wrStatusText = document.getElementById('waitingRoomStatusText');
      const wrTimeDisplay = document.getElementById('waitingRoomScheduledTimeDisplay');
      const wrTimerDisplay = document.getElementById('waitingRoomTimerDisplay');
      const wrTimerNote = document.getElementById('waitingRoomTimerNote');

      if (wrTitle) wrTitle.textContent = gameState.title || 'The Trading Floor Championship 2026';
      if (wrSub) wrSub.textContent = gameState.subtitle || `${gameState.institution || 'Gujarat Technological University'} • Official Trading Terminal`;
      if (wrTeam && portfolio) wrTeam.textContent = portfolio.name;
      if (wrCash) wrCash.textContent = formatINR(portfolio ? (portfolio.cash || gameState.startingCash || 500000) : (gameState.startingCash || 500000));
      if (wrRound) wrRound.textContent = `Day ${gameState.currentDay} of ${gameState.totalDays}`;

      if (gameState.scheduledStartTime) {
        const schDate = new Date(gameState.scheduledStartTime);
        const timeStr = schDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (wrStatusText) wrStatusText.textContent = '⏳ Official Market Opening Countdown';
        if (wrTimeDisplay) wrTimeDisplay.textContent = `Scheduled Opening: ${timeStr} (Local Time)`;

        const remainingMs = Math.max(0, schDate.getTime() - Date.now());
        const remSec = Math.floor(remainingMs / 1000);
        const hrs = Math.floor(remSec / 3600);
        const mins = Math.floor((remSec % 3600) / 60);
        const secs = remSec % 60;
        const formatted = hrs > 0
          ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
          : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (wrTimerDisplay) {
          wrTimerDisplay.textContent = formatted;
        }

        if (wrTimerNote) {
          if (remSec <= 5 && remSec > 0) {
            wrTimerNote.innerHTML = `<span style="color: #059669; font-weight: 800; font-size: 15px;">🚀 Stand by! Floor opening bell in ${remSec}s...</span>`;
          } else if (remSec === 0) {
            wrTimerNote.innerHTML = `<span style="color: #059669; font-weight: 800; font-size: 15px;">🔔 Opening bells ringing! Market is launching now...</span>`;
          } else {
            wrTimerNote.textContent = 'Trading desks and all selected stocks will unlock automatically when timer reaches zero.';
          }
        }

        if (dualTimerLabel) dualTimerLabel.textContent = 'OPENS IN:';
        if (dualTimerValue) dualTimerValue.textContent = formatted;
        if (dualTimerWrap) {
          dualTimerWrap.style.background = 'rgba(217, 119, 6, 0.1)';
          dualTimerWrap.style.borderColor = 'rgba(217, 119, 6, 0.3)';
        }

        ensureTraderWaitingRoomTicker();
      } else {
        const isDayStandby = gameState.currentDay > 1;
        if (wrStatusText) wrStatusText.textContent = isDayStandby ? `★ Day ${gameState.currentDay} Standby Lobby ★` : '★ Pre-Market Lobby & Desk Briefing ★';
        if (wrTimeDisplay) wrTimeDisplay.textContent = isDayStandby ? `Day ${gameState.currentDay} • Waiting for Host to Open Floor` : 'Awaiting Host Event Schedule / Launch Signal';
        if (wrTimerDisplay) wrTimerDisplay.textContent = 'STANDBY';
        if (wrTimerNote) wrTimerNote.textContent = isDayStandby 
          ? `Day ${gameState.currentDay - 1} completed! Your portfolio and cash have carried forward. Please stand by, the host will launch Day ${gameState.currentDay} shortly.`
          : 'Your trading terminal is connected and verified. Review your desk parameters and stand by for host launch.';
        if (dualTimerLabel) dualTimerLabel.textContent = 'STATUS:';
        if (dualTimerValue) dualTimerValue.textContent = 'STANDBY';
      }
    }
  } else if (gameState.status !== 'DAY_COMPLETED') {
    if (waitingRoomOverlay) waitingRoomOverlay.classList.add('hidden');
    if (dualTimerLabel) dualTimerLabel.textContent = 'CLOSES IN:';
    if (dualTimerValue) {
      const remainingSec = Math.max(0, (gameState.dayDurationSeconds || 1800) - gameState.elapsedSeconds);
      dualTimerValue.textContent = formatMMSS(remainingSec);
    }
    if (dualTimerWrap) {
      dualTimerWrap.style.background = 'rgba(33, 134, 83, 0.08)';
      dualTimerWrap.style.borderColor = 'rgba(33, 134, 83, 0.25)';
    }
  }

  if (portfolio) {
    document.getElementById('traderTeamName').textContent = portfolio.name.toUpperCase();
    const membersDisplay = document.getElementById('traderTeamMembersDisplay');
    if (membersDisplay) {
      membersDisplay.textContent = portfolio.members ? `Members: ${portfolio.members}` : '';
    }

    const deskPill = document.getElementById('traderDeskPill');
    if (deskPill) {
      deskPill.textContent = `💼 TRADING DESK • ${portfolio.name.toUpperCase()}`;
    }

    // Top ribbon values
    document.getElementById('traderCash').textContent = formatINR(portfolio.cash);
    document.getElementById('traderEquity').textContent = formatINR(portfolio.holdingsValue);
    document.getElementById('traderNetWorth').textContent = formatINR(portfolio.netWorth);

    const retEl = document.getElementById('traderReturnPct');
    const isUp = portfolio.pnlPct >= 0;
    retEl.textContent = `${isUp ? '+' : ''}${portfolio.pnlPct.toFixed(2)}%`;
    retEl.className = `metric-value ${isUp ? 'price-up' : 'price-down'}`;

    // 4-Card Beginner-Friendly Hero Summary Cards
    const heroCash = document.getElementById('heroCashInHand');
    if (heroCash) heroCash.textContent = formatINR(portfolio.cash);

    const heroShares = document.getElementById('heroMoneyInvested');
    if (heroShares) heroShares.textContent = formatINR(portfolio.holdingsValue);

    const heroWorth = document.getElementById('heroTotalTeamWorth');
    if (heroWorth) heroWorth.textContent = formatINR(portfolio.netWorth);

    const heroPill = document.getElementById('heroPerformancePill');
    const heroSub = document.getElementById('heroPerformanceSubtext');
    const heroIconBox = document.getElementById('heroProfitLossIconBox');
    const heroCard = document.getElementById('heroProfitLossCard');

    const startCash = gameState.startingCash || 500000;
    const totalPnL = portfolio.netWorth - startCash;
    const isZero = Math.abs(totalPnL) < 1;
    const isProfit = totalPnL > 0;
    const pnlPct = startCash > 0 ? (totalPnL / startCash) * 100 : 0;

    if (heroPill) {
      if (isZero) {
        heroPill.textContent = '₹0.00 (+0.00%)';
        heroPill.className = 'val-neutral';
        if (heroSub) heroSub.textContent = 'Break-even vs starting cash';
        if (heroIconBox) heroIconBox.className = 'hero-icon-box hero-icon-blue';
        if (heroCard) heroCard.style.borderLeft = '4px solid #2563EB';
      } else if (isProfit) {
        heroPill.textContent = `+${formatINR(totalPnL)} (+${pnlPct.toFixed(2)}%)`;
        heroPill.className = 'val-profit';
        if (heroSub) heroSub.textContent = 'Net profit earned today 📈';
        if (heroIconBox) heroIconBox.className = 'hero-icon-box hero-icon-green';
        if (heroCard) heroCard.style.borderLeft = '4px solid #16A34A';
      } else {
        heroPill.textContent = `-${formatINR(Math.abs(totalPnL))} (${pnlPct.toFixed(2)}%)`;
        heroPill.className = 'val-loss';
        if (heroSub) heroSub.textContent = 'Current drawdown (manage risk) 📉';
        if (heroIconBox) heroIconBox.className = 'hero-icon-box hero-icon-red';
        if (heroCard) heroCard.style.borderLeft = '4px solid #DC2626';
      }
    }

    // Render Real-Time Market & Sector Indices Ticker Strip
    const traderIndicesData = state.marketIndices || (state.gameState && state.gameState.marketIndices) || calculateClientIndices(companies);
    renderAllIndicesBars(traderIndicesData);

    // Update team equity timeline history
    if (!teamEquityHistory.length || teamEquityHistory[teamEquityHistory.length - 1].time !== gameState.elapsedSeconds) {
      teamEquityHistory.push({ time: gameState.elapsedSeconds, netWorth: portfolio.netWorth });
      if (teamEquityHistory.length > 400) teamEquityHistory.shift();
    }
    if (window.drawPortfolioEquityCurve && document.getElementById('traderEquityCanvas')) {
      const startCash = gameState.startingCash || 500000;
      drawPortfolioEquityCurve('traderEquityCanvas', teamEquityHistory, { startingCash: startCash });
    }

    // Render Tab 2: Positions Table & Asset Allocation
    const positionsTbody = document.getElementById('traderPositionsTbody');
    const activePositions = companies.filter((c) => (portfolio.holdings[c.ticker] || 0) > 0);

    const cashInHand = portfolio.cash || 0;
    let totalStockValuation = 0;
    activePositions.forEach((s) => {
      totalStockValuation += (portfolio.holdings[s.ticker] || 0) * s.currentPrice;
    });
    const totalPortfolioVal = cashInHand + totalStockValuation;

    const elPosCash = document.getElementById('posCashInHand');
    if (elPosCash) elPosCash.textContent = formatINR(cashInHand);
    const elPosStock = document.getElementById('posStockValuation');
    if (elPosStock) elPosStock.textContent = formatINR(totalStockValuation);
    const elPosTotal = document.getElementById('posTotalNetWorth');
    if (elPosTotal) elPosTotal.textContent = formatINR(totalPortfolioVal);

    const btnLiquidate = document.getElementById('btnLiquidateAll');
    if (btnLiquidate) {
      if (activePositions.length === 0) {
        btnLiquidate.style.opacity = '0.45';
        btnLiquidate.style.cursor = 'not-allowed';
        btnLiquidate.title = 'No active shares held in portfolio to liquidate';
      } else {
        btnLiquidate.style.opacity = '1';
        btnLiquidate.style.cursor = 'pointer';
        btnLiquidate.title = `Sell all ${activePositions.length} active positions into 100% Cash in Hand`;
      }
    }

    if (activePositions.length === 0) {
      positionsTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No shares currently held in portfolio. Use the Market Trading Desk to place buy orders.</td></tr>`;
    } else {
      positionsTbody.innerHTML = activePositions.map((stock) => {
        const qty = portfolio.holdings[stock.ticker] || 0;
        const avgCost = portfolio.avgBuyPrice[stock.ticker] || 0;
        const totalInvested = qty * avgCost;
        const currentVal = qty * stock.currentPrice;
        const pnl = currentVal - totalInvested;
        const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
        const isPos = pnl >= 0;

        return `
          <tr style="border-bottom: 1px solid var(--subtle-border);">
            <td style="padding: 10px;">
              <strong style="color: var(--text-forest);">${stock.ticker}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${stock.name}</div>
            </td>
            <td style="padding: 10px; font-weight: 700;">${qty}</td>
            <td style="padding: 10px;">₹${avgCost.toFixed(2)}</td>
            <td style="padding: 10px; font-weight: 700;">₹${stock.currentPrice.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 800;">₹${currentVal.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 700;" class="${isPos ? 'price-up' : 'price-down'}">
              ${isPos ? '+' : ''}₹${pnl.toFixed(2)} (${isPos ? '+' : ''}${pnlPct.toFixed(2)}%)
            </td>
            <td style="padding: 10px; text-align: center;">
              <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                <button onclick="openTradeModal('${stock.ticker}')" class="btn btn-outline" style="padding: 4px 10px; font-size: 11px;">
                  Trade
                </button>
                <button onclick="quickSellAllStock('${stock.ticker}', ${qty})" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #DC2626; border-color: #FCA5A5; background: #FEF2F2; font-weight: 700;" title="Instantly sell all ${qty} shares of ${stock.ticker}">
                  ⚡ Sell All (${qty})
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Tab 3: Trade Order History Table
    const tradesTbody = document.getElementById('traderTradesTbody');
    if (!teamTrades || teamTrades.length === 0) {
      tradesTbody.innerHTML = `<tr><td colspan="10" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No executed trades recorded yet.</td></tr>`;
    } else {
      tradesTbody.innerHTML = teamTrades.map((tr) => `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px;">#${tr.seq}</td>
          <td style="padding: 8px;">${tr.timestamp}</td>
          <td style="padding: 8px;">Day ${tr.day}</td>
          <td style="padding: 8px;">
            <span class="badge ${tr.type === 'BUY' ? 'badge-active' : 'badge-paused'}" style="font-size: 10px; padding: 2px 6px;">
              ${tr.type}
            </span>
          </td>
          <td style="padding: 8px; font-weight: 700;">${tr.ticker}</td>
          <td style="padding: 8px; text-align: right;">${tr.quantity}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.price.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.grossValue.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">₹${tr.fee.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${tr.cashAfter.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // Filter companies for Tab 1 Grid (Ensure disabled shares are never shown)
  let filteredCompanies = companies.filter((stock) => {
    if (stock.isEnabled === false) return false;
    const matchesSearch = stock.ticker.toLowerCase().includes(traderSearchTerm) ||
      stock.name.toLowerCase().includes(traderSearchTerm);
    const matchesSector = traderSectorFilterVal === 'ALL' || stock.sector === traderSectorFilterVal;
    const heldQty = portfolio ? (portfolio.holdings[stock.ticker] || 0) : 0;
    const matchesHoldings = !traderHoldingsOnlyVal || heldQty > 0;
    return matchesSearch && matchesSector && matchesHoldings;
  });

  // Apply Multi-Metric Sorting
  const chgPctVal = (s) => s.dayOpenPrice > 0 ? ((s.currentPrice - s.dayOpenPrice) / s.dayOpenPrice) * 100 : 0;
  const holdingVal = (s) => (portfolio ? (portfolio.holdings[s.ticker] || 0) : 0) * s.currentPrice;

  if (traderSortFilterVal === 'gainers') {
    filteredCompanies.sort((a, b) => chgPctVal(b) - chgPctVal(a));
  } else if (traderSortFilterVal === 'losers') {
    filteredCompanies.sort((a, b) => chgPctVal(a) - chgPctVal(b));
  } else if (traderSortFilterVal === 'priceHigh') {
    filteredCompanies.sort((a, b) => b.currentPrice - a.currentPrice);
  } else if (traderSortFilterVal === 'priceLow') {
    filteredCompanies.sort((a, b) => a.currentPrice - b.currentPrice);
  } else if (traderSortFilterVal === 'value') {
    filteredCompanies.sort((a, b) => holdingVal(b) - holdingVal(a));
  }

  const grid = document.getElementById('traderTabContentMarket');
  if (filteredCompanies.length === 0) {
    grid.innerHTML = `
      <div class="luxury-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; color: var(--text-muted); border-radius: var(--radius-md);">
        <div style="font-size: 36px; margin-bottom: 10px;">🔍</div>
        <h3 style="font-size: 18px; color: var(--text-forest); margin-bottom: 6px; font-weight: 800;">No stocks match your filters</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 18px;">Try searching for another company or clear your sector/holdings filter.</p>
        <button onclick="clearTraderFilters()" class="btn btn-outline" style="padding: 7px 18px; font-size: 12px; font-weight: 700;">
          Clear All Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredCompanies.map((stock) => {
    const pctVal = stock.dayOpenPrice > 0 ? ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100 : 0;
    const deltaDiff = stock.currentPrice - stock.dayOpenPrice;
    const pct = pctVal.toFixed(2);
    const isUp = pctVal >= 0;
    const isNeutral = Math.abs(pctVal) < 0.001;
    const heldQty = portfolio ? (portfolio.holdings[stock.ticker] || 0) : 0;
    const avgPrice = portfolio ? (portfolio.avgBuyPrice[stock.ticker] || 0) : 0;

    // Unrealized P&L calculation for position box
    const totalCost = heldQty * avgPrice;
    const currentVal = heldQty * stock.currentPrice;
    const pnl = heldQty > 0 ? currentVal - totalCost : 0;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const isPnlPos = pnl >= 0;

    // Smart Quick Lot Buttons with Live Affordability Check
    const quickLots = (stock.lot_presets || [5, 15, 30]).slice(0, 3).map((lot) => {
      const feeBps = gameState.transactionFeeBps || 0;
      const orderCost = lot * stock.currentPrice * (1 + feeBps / 10000);
      const isMarketPaused = gameState.isPaused || gameState.isConcluded || gameState.status === 'DAY_COMPLETED';

      // Circuit Breaker direction-specific permissions:
      // UPPER circuit halts BUY, allows SELL
      // LOWER circuit halts SELL, allows BUY
      // General or unspecified halts block BOTH BUY and SELL
      const isUpperHalted = stock.isHalted && stock.haltDirection === 'UPPER';
      const isLowerHalted = stock.isHalted && stock.haltDirection === 'LOWER';
      const isGeneralHalted = stock.isHalted && !isUpperHalted && !isLowerHalted;
      const isBuyHalted = isUpperHalted || isGeneralHalted;
      const isSellHalted = isLowerHalted || isGeneralHalted;

      const canBuy = !isMarketPaused && !isBuyHalted && portfolio && portfolio.cash >= orderCost;
      const canSell = !isMarketPaused && !isSellHalted && heldQty >= lot;

      let buyTitle = `Buy ${lot} shares of ${stock.ticker} for ~₹${orderCost.toFixed(2)}`;
      if (isMarketPaused) buyTitle = 'Market is currently paused / closed';
      else if (isUpperHalted) buyTitle = `Upper circuit ceiling reached (₹${stock.currentPrice.toFixed(2)}). Buying is restricted.`;
      else if (isGeneralHalted) buyTitle = `Trading in ${stock.ticker} is halted. Buying and selling are blocked.`;
      else if (!canBuy && portfolio) buyTitle = `Insufficient cash: need ₹${orderCost.toFixed(2)}, available ₹${portfolio.cash.toFixed(2)}`;

      let sellTitle = `Sell ${lot} shares of ${stock.ticker} for ~₹${(lot * stock.currentPrice * (1 - feeBps / 10000)).toFixed(2)}`;
      if (isMarketPaused) sellTitle = 'Market is currently paused / closed';
      else if (isLowerHalted) sellTitle = `Lower circuit floor reached (₹${stock.currentPrice.toFixed(2)}). Selling is restricted.`;
      else if (isGeneralHalted) sellTitle = `Trading in ${stock.ticker} is halted. Buying and selling are blocked.`;
      else if (!canSell) sellTitle = `Insufficient shares: you own ${heldQty} shares, need ${lot}`;

      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <button onclick="sendOrder('${stock.ticker}', 'BUY', ${lot})"
            ${canBuy ? '' : 'disabled'}
            title="${escapeHtml(buyTitle)}"
            class="btn btn-buy">
            BUY +${lot}
          </button>
          <button onclick="sendOrder('${stock.ticker}', 'SELL', ${lot})"
            ${canSell ? '' : 'disabled'}
            title="${escapeHtml(sellTitle)}"
            class="btn btn-sell">
            SELL -${lot}
          </button>
        </div>
      `;
    }).join('');

    const colorClass = isNeutral ? 'val-neutral' : isUp ? 'price-up' : 'price-down';
    const cbPct = (gameState && gameState.circuitBreakerPercent) || 20;
    const refForCB = stock.dayOpenPrice || stock.referencePrice || stock.currentPrice || 1;
    const upperLimit = +(refForCB * (1 + cbPct / 100)).toFixed(2);
    const lowerLimit = +(refForCB * (1 - cbPct / 100)).toFixed(2);

    const f = stock.fundamentals || {};
    const w52High = stock.week52High || (f.high_52w ? parseFloat(f.high_52w) : +(refForCB * 1.25).toFixed(2));
    const w52Low = stock.week52Low || (f.low_52w ? parseFloat(f.low_52w) : +(refForCB * 0.75).toFixed(2));
    const is52WHighBreakout = !!(stock.isNew52WHigh || stock.currentPrice >= w52High);
    const is52WLowBreakdown = !!(stock.isNew52WLow || stock.currentPrice <= w52Low);

    return `
      <div class="stock-card ${stock.isHalted ? 'halted' : ''}">
        <div>
          <div class="stock-card-header">
            <div>
              <span class="stock-sector">${escapeHtml(stock.sector || 'Equities')}</span>
              <div class="stock-ticker">${stock.ticker}</div>
              <div class="stock-name" title="${escapeHtml(stock.name)}">${escapeHtml(stock.name)}</div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="openFullChartModal('${stock.ticker}')" class="btn btn-outline" style="padding: 3px 7px; font-size: 11px;" title="Enlarge Chart">
                📈
              </button>
              <button onclick="openDetailsModal('${stock.ticker}')" class="btn btn-outline" style="padding: 3px 7px; font-size: 11px;" title="Company Profile">
                ℹ
              </button>
            </div>
          </div>

          <div class="stock-price-row">
            <span class="stock-current-price ${colorClass}">
              ₹${stock.currentPrice.toFixed(2)}
            </span>
            <span class="stock-delta ${colorClass}">
              ${deltaDiff >= 0 ? '+' : ''}₹${deltaDiff.toFixed(2)} (${isUp ? '+' : ''}${pct}%) ${isUp ? '▲' : '▼'}
            </span>
          </div>

          <!-- Circuit Limit Bands (Floor & Cap) -->
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin: 3px 0 4px 0; background: #FAF9F6; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--subtle-border);">
            <span title="Lower Circuit Limit (-${cbPct}%)">Floor: ₹${lowerLimit.toFixed(2)}</span>
            <span style="font-weight: 700; color: var(--text-muted);">±${cbPct}% Limit</span>
            <span title="Upper Circuit Limit (+${cbPct}%)">Cap: ₹${upperLimit.toFixed(2)}</span>
          </div>

          <!-- 52-Week Range & Breakout Alert Banner -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-family: var(--font-mono); margin: 2px 0 4px 0; background: #FAF9F6; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--subtle-border);">
            <span title="52-Week Low" style="color: var(--price-down); font-weight: 700;">52W L: ₹${Number(w52Low).toFixed(2)}</span>
            ${is52WHighBreakout
              ? `<span class="badge" style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 9px; padding: 1px 6px; border: 1px solid #F59E0B; animation: pulse 1.5s infinite;">🔥 NEW 52W HIGH</span>`
              : is52WLowBreakdown
              ? `<span class="badge" style="background: #E0F2FE; color: #0369A1; font-weight: 800; font-size: 9px; padding: 1px 6px; border: 1px solid #38BDF8;">❄️ NEW 52W LOW</span>`
              : `<span style="color: var(--text-muted); font-size: 9px; font-weight: 600;">52W Range</span>`
            }
            <span title="52-Week High" style="color: var(--price-up); font-weight: 700;">52W H: ₹${Number(w52High).toFixed(2)}</span>
          </div>

          <!-- Micro Corporate Fundamentals Bar -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 4px; font-size: 10px; color: var(--text-muted); font-family: var(--font-sans); margin-bottom: 6px; background: #fff; padding: 3px 4px; border-radius: 4px; border: 1px solid var(--subtle-border);">
            <div><span style="font-size: 9px; color: var(--text-muted); display: block;">MCAP</span><strong style="color: var(--text-forest); font-family: var(--font-mono); font-size: 10px;">${f.market_cap || 'N/A'}</strong></div>
            <div><span style="font-size: 9px; color: var(--text-muted); display: block;">P/E</span><strong style="color: var(--text-forest); font-family: var(--font-mono); font-size: 10px;">${f.pe_ratio !== undefined ? f.pe_ratio : 'N/A'}</strong></div>
            <div><span style="font-size: 9px; color: var(--text-muted); display: block;">BETA</span><strong style="color: var(--text-forest); font-family: var(--font-mono); font-size: 10px;">${(stock.beta || 1.0).toFixed(2)}</strong></div>
          </div>

          <!-- Mini Canvas Sparkline -->
          <div class="sparkline-wrapper" onclick="openFullChartModal('${stock.ticker}')" title="Click to view interactive full-size chart">
            <canvas id="traderCanvas_${stock.ticker}" width="280" height="60" style="width: 100%; height: 100%;"></canvas>
          </div>

          <!-- Directional Circuit Breaker Banner -->
          ${stock.isHalted ? `
            <div class="badge badge-halted" style="width: 100%; justify-content: center; margin-bottom: 8px; font-size: 10px; font-weight: 800; padding: 4px 6px;">
              ${stock.haltDirection === 'UPPER' 
                ? `⛔ UPPER CIRCUIT (₹${stock.currentPrice.toFixed(2)}) • BUY BLOCKED`
                : stock.haltDirection === 'LOWER'
                ? `⛔ LOWER CIRCUIT (₹${stock.currentPrice.toFixed(2)}) • SELL BLOCKED`
                : `⛔ TRADING HALTED (₹${stock.currentPrice.toFixed(2)}) • BUY & SELL BLOCKED`}
            </div>
          ` : ''}

          <!-- Portfolio Position on Card with Live P&L -->
          <div class="stock-holding-row" style="background: #fffbf1; border: 1px solid var(--subtle-border); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700;">Shares Owned</span>
              <strong style="font-family: var(--font-mono); color: var(--text-forest); font-size: 13px;">${heldQty} shares</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700;">
                ${heldQty > 0 ? 'Avg Buy Price · Profit' : 'Avg Buy Price'}
              </span>
              <strong style="font-family: var(--font-mono); color: var(--text-muted); font-size: 12px;">₹${avgPrice.toFixed(2)}</strong>
              ${heldQty > 0 ? `
                <div class="${isPnlPos ? 'stock-card-pnl-pos' : 'stock-card-pnl-neg'}" style="font-family: var(--font-mono); font-size: 11px; margin-top: 1px;">
                  ${isPnlPos ? '+' : ''}₹${pnl.toFixed(2)} (${isPnlPos ? '+' : ''}${pnlPct.toFixed(1)}%)
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div>
          <!-- Quick Lot Presets -->
          <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px;">
            ${quickLots}
          </div>
          <!-- Custom Quantity Trade Modal Trigger -->
          <button onclick="openTradeModal('${stock.ticker}')" class="btn btn-outline" style="width: 100%; padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--text-forest); background: #ffffff;">
            Buy / Sell Any Quantity…
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Render organic Bezier sparkline curves on each stock card
  filteredCompanies.forEach((stock) => {
    const isUp = stock.currentPrice >= stock.dayOpenPrice;
    if (window.drawSmoothMiniSparkline) {
      drawSmoothMiniSparkline(`traderCanvas_${stock.ticker}`, stock.history, stock.dayOpenPrice, isUp);
    } else {
      drawSmoothBezierSparkline(`traderCanvas_${stock.ticker}`, stock.history, stock.dayOpenPrice, isUp, false);
    }
  });

  // Render Market Wire Feed
  const newsList = document.getElementById('traderNewsList');
  if (!gameState.newsHistory || gameState.newsHistory.length === 0) {
    newsList.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); font-style: italic; padding: 12px;">No market announcements released yet.</p>`;
  } else {
    newsList.innerHTML = gameState.newsHistory.map((n) => `
      <div class="news-item">
        <div class="news-meta">
          <span>DAY ${n.day} • ${formatMMSS(n.second)}</span>
          <span class="badge badge-champagne" style="font-size: 9px; padding: 1px 5px;">${n.type}</span>
        </div>
        <div class="news-headline">${n.headline}</div>
        <div class="news-explanation">${n.simple_explanation}</div>
      </div>
    `).join('');
  }
}

// Order Submission with Client-Side Anti-Spam Throttle
let lastClientOrderSubmitTime = 0;
function sendOrder(ticker, type, quantity) {
  if (!ws || !sessionToken) return;
  const now = Date.now();
  if (now - lastClientOrderSubmitTime < 180) {
    // 180ms client-side anti-spam throttle prevents accidental double clicks
    return;
  }
  lastClientOrderSubmitTime = now;
  ws.send(JSON.stringify({
    action: 'ORDER',
    session_token: sessionToken,
    ticker,
    type,
    quantity
  }));
}

// Interactive Custom Trade Modal
function openTradeModal(ticker, side = 'BUY', preferredQty = null) {
  currentTradeModalTicker = ticker;
  currentTradeModalSide = side;
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  document.getElementById('tradeModalTicker').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('tradeModalSector').textContent = stock.sector || 'Equities';

  const defaultQty = preferredQty !== null ? preferredQty : (stock.lot_presets && stock.lot_presets[0] ? stock.lot_presets[0] : 10);
  const qInput = document.getElementById('tradeQuantityInput');
  if (qInput) qInput.value = Math.max(1, defaultQty);

  const notice = document.getElementById('tradeModalValidationNotice');
  if (notice) notice.classList.add('hidden');

  syncTradeModalSide();
  recalculateTradeModal();
  document.getElementById('tradeModal').classList.remove('hidden');

  // Focus and select quantity input for rapid keyboard trading
  setTimeout(() => {
    const input = document.getElementById('tradeQuantityInput');
    if (input) {
      input.focus();
      input.select();
    }
  }, 40);
}

function closeTradeModal() {
  currentTradeModalTicker = null;
  document.getElementById('tradeModal').classList.add('hidden');
}

function setTradeSide(side) {
  if (currentTradeModalSide === side) return;
  currentTradeModalSide = side;
  syncTradeModalSide();
  recalculateTradeModal();
}

function syncTradeModalSide() {
  const isBuy = currentTradeModalSide === 'BUY';
  const tabBuy = document.getElementById('tabTradeBuy');
  const tabSell = document.getElementById('tabTradeSell');
  if (tabBuy) tabBuy.className = 'trade-side-tab' + (isBuy ? ' on buy' : '');
  if (tabSell) tabSell.className = 'trade-side-tab' + (!isBuy ? ' on sell' : '');

  const presetLabel = document.getElementById('tradePresetLabel');
  const pillsContainer = document.getElementById('tradePresetPillsContainer');

  if (isBuy) {
    if (presetLabel) presetLabel.textContent = 'Budget Shortcuts:';
    if (pillsContainer) {
      pillsContainer.innerHTML = `
        <button type="button" onclick="setTradeBudgetPreset(25)" class="trade-pill">25% Cash</button>
        <button type="button" onclick="setTradeBudgetPreset(50)" class="trade-pill">50% Cash</button>
        <button type="button" onclick="setTradeBudgetPreset(75)" class="trade-pill">75% Cash</button>
        <button type="button" onclick="setTradeBudgetPreset(100)" class="trade-pill good" title="Use maximum affordable cash">⚡ Max Affordable Buy</button>
      `;
    }
  } else {
    if (presetLabel) presetLabel.textContent = 'Holding Shortcuts:';
    if (pillsContainer) {
      pillsContainer.innerHTML = `
        <button type="button" onclick="setTradeHoldingPreset(25)" class="trade-pill">25% Held</button>
        <button type="button" onclick="setTradeHoldingPreset(50)" class="trade-pill">50% Held</button>
        <button type="button" onclick="setTradeHoldingPreset(75)" class="trade-pill">75% Held</button>
        <button type="button" onclick="setTradeHoldingPreset(100)" class="trade-pill danger" title="Liquidate all held shares of this stock">⚡ Sell All Held</button>
      `;
    }
  }
}

function stepTradeQuantity(delta) {
  const input = document.getElementById('tradeQuantityInput');
  if (!input) return;
  const current = parseInt(input.value, 10) || 0;
  const next = Math.max(1, current + delta);
  input.value = next;
  recalculateTradeModal();
}

function setTradeLotPreset(mode, val) {
  const input = document.getElementById('tradeQuantityInput');
  if (!input) return;
  const current = parseInt(input.value, 10) || 0;
  if (mode === 'ADD') {
    input.value = Math.max(1, current + val);
  } else if (mode === 'SET') {
    input.value = Math.max(1, val);
  }
  recalculateTradeModal();
}

function setTradeBudgetPreset(pct) {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;
  const feeBps = latestState.gameState.transactionFeeBps || 0;
  const costPerShare = stock.currentPrice * (1 + feeBps / 10000);
  const budget = p.cash * (pct / 100);
  const maxAffordable = Math.floor(budget / costPerShare);
  const input = document.getElementById('tradeQuantityInput');
  if (input) {
    input.value = Math.max(1, maxAffordable);
    recalculateTradeModal();
  }
}

function setTradeHoldingPreset(pct) {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;
  const held = p.holdings[stock.ticker] || 0;
  const qty = pct === 100 ? held : Math.floor(held * (pct / 100));
  const input = document.getElementById('tradeQuantityInput');
  if (input) {
    input.value = Math.max(1, qty);
    recalculateTradeModal();
  }
}

function setTradeLot(qty) {
  if (qty === 'MAX_BUY') setTradeBudgetPreset(100);
  else if (qty === 'SELL_ALL' || qty === 'MAX_SELL') setTradeHoldingPreset(100);
  else if (typeof qty === 'string' && qty.endsWith('%')) {
    const num = parseInt(qty, 10);
    if (currentTradeModalSide === 'BUY') setTradeBudgetPreset(num);
    else setTradeHoldingPreset(num);
  } else {
    setTradeLotPreset('SET', Number(qty) || 1);
  }
}

function recalculateTradeModal() {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  const gs = latestState.gameState;
  if (!stock || !p || !gs) return;

  const input = document.getElementById('tradeQuantityInput');
  const qty = parseInt(input ? input.value : '0', 10) || 0;
  const price = stock.currentPrice;
  const gross = +(qty * price).toFixed(2);
  const feeBps = gs.transactionFeeBps || 0;
  const fee = +((gross * feeBps) / 10000).toFixed(2);
  const netBuyCost = +(gross + fee).toFixed(2);
  const netSellProceeds = +(gross - fee).toFixed(2);
  const currentHeld = p.holdings[stock.ticker] || 0;

  // Authoritative max affordable shares calculation
  const costPerUnit = price * (1 + feeBps / 10000);
  const maxAffordable = Math.max(0, Math.floor(p.cash / costPerUnit));

  // Update header and stat boxes
  const elPrice = document.getElementById('tradeModalPrice');
  const elCash = document.getElementById('tradeModalCash');
  const elHolding = document.getElementById('tradeModalHolding');
  const elGross = document.getElementById('tradeModalGross');
  const elFee = document.getElementById('tradeModalFee');
  const elFeeLabel = document.getElementById('tradeModalFeeLabel');
  const elNet = document.getElementById('tradeModalNet');
  const elNetLabel = document.getElementById('tradeModalNetLabel');
  const elCashAfter = document.getElementById('tradeModalCashAfter');
  const elCashAfterLabel = document.getElementById('tradeModalCashAfterLabel');
  const elHint = document.getElementById('tradeAffordableHint');

  if (elPrice) elPrice.textContent = `₹${price.toFixed(2)}`;
  if (elCash) elCash.textContent = formatINR(p.cash);
  if (elHolding) elHolding.textContent = `${currentHeld} shares`;
  if (elGross) elGross.textContent = `₹${gross.toFixed(2)}`;
  if (elFee) elFee.textContent = `₹${fee.toFixed(2)}`;
  if (elFeeLabel) elFeeLabel.textContent = `Brokerage Fee (${feeBps} bps):`;

  // 52W High / Low & Fundamentals in Trade Modal
  const el52W = document.getElementById('tradeModal52W');
  const elFund = document.getElementById('tradeModalFundSummary');
  if (el52W) {
    const high52 = Number(stock.week52High || (stock.fundamentals && stock.fundamentals.high_52w) || (stock.base_price * 1.25));
    const low52 = Number(stock.week52Low || (stock.fundamentals && stock.fundamentals.low_52w) || (stock.base_price * 0.75));
    const isNew52H = !!(stock.isNew52WHigh || price >= high52);
    const isNew52L = !!(stock.isNew52WLow || price <= low52);
    if (isNew52H) {
      el52W.innerHTML = `<span style="color: #B45309; font-weight: 800;">🔥 NEW 52W HIGH ₹${price.toFixed(2)}</span>`;
    } else if (isNew52L) {
      el52W.innerHTML = `<span style="color: #0369A1; font-weight: 800;">❄️ NEW 52W LOW ₹${price.toFixed(2)}</span>`;
    } else {
      el52W.textContent = `₹${low52.toFixed(2)} − ₹${high52.toFixed(2)}`;
    }
  }
  if (elFund) {
    const f = stock.fundamentals || {};
    elFund.textContent = `${f.market_cap || 'N/A'} • P/E ${f.pe_ratio !== undefined ? f.pe_ratio : 'N/A'}`;
  }

  if (elHint) {
    if (currentTradeModalSide === 'BUY') {
      elHint.textContent = `Max Affordable: ${maxAffordable}`;
      elHint.style.color = qty > maxAffordable ? 'var(--price-down)' : 'var(--text-muted)';
    } else {
      elHint.textContent = `Held: ${currentHeld}`;
      elHint.style.color = qty > currentHeld ? 'var(--price-down)' : 'var(--text-muted)';
    }
  }

  const isBuy = currentTradeModalSide === 'BUY';
  if (elNetLabel) elNetLabel.textContent = isBuy ? 'Total Amount to Pay:' : 'Total Amount You Receive:';
  if (elNet) elNet.textContent = `${isBuy ? '−' : '+'}₹${(isBuy ? netBuyCost : netSellProceeds).toFixed(2)}`;

  const cashAfter = isBuy ? Math.max(0, p.cash - netBuyCost) : p.cash + netSellProceeds;
  if (elCashAfterLabel) elCashAfterLabel.textContent = isBuy ? 'Money Left After Buying:' : 'Total Cash After Selling:';
  if (elCashAfter) elCashAfter.textContent = formatINR(cashAfter);

  const isMarketPaused = gs.isPaused || gs.isConcluded || gs.status === 'DAY_COMPLETED';
  const isUpperHalted = stock.isHalted && stock.haltDirection === 'UPPER';
  const isLowerHalted = stock.isHalted && stock.haltDirection === 'LOWER';
  const isGeneralHalted = stock.isHalted && !isUpperHalted && !isLowerHalted;
  const isBuyHalted = isUpperHalted || isGeneralHalted;
  const isSellHalted = isLowerHalted || isGeneralHalted;

  let isValid = true;
  let validationMessage = '';
  let noticeType = 'INFO';

  if (isMarketPaused) {
    isValid = false;
    noticeType = 'WARN';
    validationMessage = gs.status === 'DAY_COMPLETED'
      ? `<strong>Day ${gs.currentDay} is concluded.</strong> Trading is closed. Please wait for host to start Day ${gs.currentDay + 1}.`
      : `<strong>⏸️ Market is currently paused.</strong> The host has temporarily paused trading.`;
  } else if (stock.isHalted && isGeneralHalted) {
    isValid = false;
    noticeType = 'ERROR';
    validationMessage = `<strong>⛔ Stock Trading Halted (₹${price.toFixed(2)})</strong><br>Trading in ${stock.ticker} is currently frozen under regulatory / circuit limits. Both buying and selling are blocked.`;
  } else if (isBuy && isUpperHalted) {
    isValid = false;
    noticeType = 'ERROR';
    validationMessage = `<strong>⛔ Upper Circuit Ceiling Reached (₹${price.toFixed(2)})</strong><br>Buying this share is restricted under market rules. Selling is permitted to absorb demand.`;
  } else if (!isBuy && isLowerHalted) {
    isValid = false;
    noticeType = 'ERROR';
    validationMessage = `<strong>⛔ Lower Circuit Floor Reached (₹${price.toFixed(2)})</strong><br>Selling this share is restricted under market rules. Buying is permitted for bargain hunting.`;
  } else if (qty <= 0) {
    isValid = false;
    noticeType = 'WARN';
    validationMessage = `Please enter an order quantity of at least 1 share.`;
  } else if (isBuy && p.cash < netBuyCost) {
    isValid = false;
    noticeType = 'ERROR';
    const shortfall = (netBuyCost - p.cash).toFixed(2);
    validationMessage = `<strong>💰 Not Enough Balance:</strong><br>Buying ${qty} shares costs ₹${Number(netBuyCost).toLocaleString('en-IN')}, but your cash is ₹${Number(p.cash).toLocaleString('en-IN')}. Shortfall: ₹${Number(shortfall).toLocaleString('en-IN')}. You can afford up to <strong>${maxAffordable}</strong> shares with your available cash.`;
  } else if (!isBuy && currentHeld < qty) {
    isValid = false;
    noticeType = 'ERROR';
    const shortfall = qty - currentHeld;
    validationMessage = currentHeld === 0
      ? `<strong>📉 No Shares Held:</strong><br>You own 0 shares of ${stock.ticker}. Switch to the BUY tab to purchase shares first.`
      : `<strong>📉 Insufficient Shares:</strong><br>You hold <strong>${currentHeld}</strong> shares of ${stock.ticker}, but tried to sell ${qty} shares. Shortfall: <strong>${shortfall}</strong> shares.`;
  } else {
    isValid = true;
    noticeType = 'SUCCESS';
    validationMessage = isBuy
      ? `<strong>✓ Order Ready:</strong> Buying ${qty} shares will cost ₹${netBuyCost.toFixed(2)}. Cash remaining: ₹${(p.cash - netBuyCost).toFixed(2)}.`
      : `<strong>✓ Order Ready:</strong> Selling ${qty} shares will credit ₹${netSellProceeds.toFixed(2)} to your cash balance.`;
  }

  // Update Dynamic Status Notice Box
  const notice = document.getElementById('tradeModalValidationNotice');
  if (notice) {
    notice.innerHTML = validationMessage;
    notice.classList.remove('hidden');
    if (noticeType === 'ERROR') {
      notice.style.backgroundColor = 'var(--price-down-bg)';
      notice.style.color = 'var(--price-down)';
      notice.style.border = '1px solid var(--price-down-border)';
    } else if (noticeType === 'WARN') {
      notice.style.backgroundColor = 'var(--warning-bg)';
      notice.style.color = 'var(--warning-amber)';
      notice.style.border = '1px solid var(--warning-border)';
    } else if (noticeType === 'SUCCESS') {
      notice.style.backgroundColor = 'var(--price-up-bg)';
      notice.style.color = 'var(--price-up)';
      notice.style.border = '1px solid var(--price-up-border)';
    } else {
      notice.style.backgroundColor = 'var(--surface-cream)';
      notice.style.color = 'var(--text-charcoal)';
      notice.style.border = '1px solid var(--subtle-border)';
    }
  }

  // Update Single Primary Execution Button
  const btnTrade = document.getElementById('btnExecuteTradeOrder');
  if (btnTrade) {
    btnTrade.disabled = !isValid;
    if (isBuy) {
      btnTrade.className = 'btn btn-primary';
      btnTrade.style.backgroundColor = isValid ? 'var(--price-up)' : '#9CA3AF';
      btnTrade.style.borderColor = isValid ? 'var(--price-up)' : '#9CA3AF';
      btnTrade.textContent = isValid ? `Confirm BUY ${qty} Shares` : `Cannot BUY (Check Balance)`;
    } else {
      btnTrade.className = 'btn btn-primary';
      btnTrade.style.backgroundColor = isValid ? 'var(--price-down)' : '#9CA3AF';
      btnTrade.style.borderColor = isValid ? 'var(--price-down)' : '#9CA3AF';
      btnTrade.textContent = isValid ? `Confirm SELL ${qty} Shares` : `Cannot SELL (Check Holdings)`;
    }
  }

  // Stepper Button states
  const qMinus = document.getElementById('qMinusBtn');
  if (qMinus) qMinus.disabled = qty <= 1;

  // Hidden proxy buttons for script/test backwards compatibility
  const btnBuy = document.getElementById('btnExecuteBuy');
  const btnSell = document.getElementById('btnExecuteSell');
  if (btnBuy) btnBuy.disabled = !isValid || !isBuy;
  if (btnSell) btnSell.disabled = !isValid || isBuy;
}

function executeModalTrade(explicitSide = null) {
  if (!currentTradeModalTicker) return;
  const side = explicitSide || currentTradeModalSide;
  const input = document.getElementById('tradeQuantityInput');
  const qty = parseInt(input ? input.value : '0', 10);
  if (!qty || qty <= 0) return;
  sendOrder(currentTradeModalTicker, side, qty);
  closeTradeModal();
}

// Company Details Modal
function openDetailsModal(ticker) {
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;
  const f = stock.fundamentals || {};

  const high52 = Number(stock.week52High || f.high_52w || (stock.base_price * 1.25));
  const low52 = Number(stock.week52Low || f.low_52w || (stock.base_price * 0.75));
  const curPrice = Number(stock.currentPrice || stock.base_price);
  const is52H = !!(stock.isNew52WHigh || curPrice >= high52);
  const is52L = !!(stock.isNew52WLow || curPrice <= low52);

  document.getElementById('modalTitle').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('modalSummary').textContent = f.summary || `${stock.name} is a leading corporation in the ${stock.sector} sector.`;
  document.getElementById('modalSector').textContent = stock.sector;
  document.getElementById('modalHigh52').textContent = `₹${high52.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('modalLow52').textContent = `₹${low52.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('modalPE').textContent = f.pe_ratio !== undefined ? f.pe_ratio : 'N/A';
  document.getElementById('modalMarketCap').textContent = f.market_cap || 'N/A';
  document.getElementById('modalDE').textContent = f.debt_to_equity !== undefined ? f.debt_to_equity : 'N/A';

  const elIndustry = document.getElementById('modalIndustry');
  if (elIndustry) elIndustry.textContent = f.industry || stock.sector;
  const elROE = document.getElementById('modalROE');
  if (elROE) elROE.textContent = f.roe || 'N/A';
  const elROCE = document.getElementById('modalROCE');
  if (elROCE) elROCE.textContent = f.roce || 'N/A';
  const elBookValue = document.getElementById('modalBookValue');
  if (elBookValue) elBookValue.textContent = f.book_value || 'N/A';
  const elPromoter = document.getElementById('modalPromoter');
  if (elPromoter) elPromoter.textContent = f.promoter_holding || 'N/A';
  const elDividend = document.getElementById('modalDividend');
  if (elDividend) elDividend.textContent = f.dividend_yield || 'N/A';
  const elBeta = document.getElementById('modalBeta');
  if (elBeta) elBeta.textContent = (stock.beta || 1.0).toFixed(2);

  // 52W Breakout alert banner
  const alertEl = document.getElementById('modal52WAlert');
  if (alertEl) {
    if (is52H) {
      alertEl.style.display = 'block';
      alertEl.style.background = '#FEF3C7';
      alertEl.style.color = '#B45309';
      alertEl.style.border = '1px solid #F59E0B';
      alertEl.style.padding = '8px 12px';
      alertEl.style.marginBottom = '12px';
      alertEl.style.borderRadius = '6px';
      alertEl.style.fontSize = '12px';
      alertEl.style.fontWeight = '800';
      alertEl.innerHTML = `🔥 52-WEEK RECORD HIGH BREAKOUT: Current price ₹${curPrice.toFixed(2)} has surged past the 52-week peak!`;
    } else if (is52L) {
      alertEl.style.display = 'block';
      alertEl.style.background = '#E0F2FE';
      alertEl.style.color = '#0369A1';
      alertEl.style.border = '1px solid #38BDF8';
      alertEl.style.padding = '8px 12px';
      alertEl.style.marginBottom = '12px';
      alertEl.style.borderRadius = '6px';
      alertEl.style.fontSize = '12px';
      alertEl.style.fontWeight = '800';
      alertEl.innerHTML = `❄️ 52-WEEK RECORD LOW BREAKDOWN: Current price ₹${curPrice.toFixed(2)} has touched a fresh 52-week low!`;
    } else {
      alertEl.style.display = 'none';
    }
  }

  // 52W Meter Bar
  const elLowText = document.getElementById('modalLow52Text');
  const elHighText = document.getElementById('modalHigh52Text');
  const elCMP = document.getElementById('modalCMP');
  const elBar = document.getElementById('modal52WBar');
  if (elLowText) elLowText.textContent = `₹${low52.toFixed(2)}`;
  if (elHighText) elHighText.textContent = `₹${high52.toFixed(2)}`;
  if (elCMP) elCMP.textContent = `₹${curPrice.toFixed(2)}`;
  if (elBar) {
    const range = high52 - low52;
    const pct = range > 0 ? Math.min(100, Math.max(0, ((curPrice - low52) / range) * 100)) : 50;
    elBar.style.width = `${pct.toFixed(1)}%`;
  }

  document.getElementById('detailsModal').classList.remove('hidden');
}

function closeDetailsModal() {
  document.getElementById('detailsModal').classList.add('hidden');
}

// Full interactive chart modal
function openFullChartModal(ticker) {
  currentSelectedTickerForChart = ticker;
  updateFullChartModalData(ticker);
  document.getElementById('fullChartModal').classList.remove('hidden');
}

function closeFullChartModal() {
  currentSelectedTickerForChart = null;
  document.getElementById('fullChartModal').classList.add('hidden');
}

function updateFullChartModalData(ticker) {
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
  const isUp = pctVal >= 0;

  document.getElementById('chartModalSector').textContent = stock.sector;
  document.getElementById('chartModalTicker').textContent = stock.ticker;
  document.getElementById('chartModalPrice').textContent = `₹${stock.currentPrice.toFixed(2)}`;
  document.getElementById('chartModalPrice').className = isUp ? 'price-up' : 'price-down';
  document.getElementById('chartModalPct').textContent = `${isUp ? '+' : ''}${pctVal.toFixed(2)}% ${isUp ? '▲' : '▼'}`;
  document.getElementById('chartModalPct').className = isUp ? 'price-up' : 'price-down';

  document.getElementById('chartModalOpen').textContent = `₹${stock.dayOpenPrice.toFixed(2)}`;
  document.getElementById('chartModalHigh').textContent = `₹${stock.dayHigh.toFixed(2)}`;
  document.getElementById('chartModalLow').textContent = `₹${stock.dayLow.toFixed(2)}`;
  const chartBaseEl = document.getElementById('chartModalBase');
  if (chartBaseEl) {
    chartBaseEl.textContent = `₹${(stock.base_price || stock.dayOpenPrice).toFixed(2)}`;
  }

  if (window.drawInteractiveMainChart) {
    drawInteractiveMainChart('largeChartCanvas', stock, document.getElementById('largeChartWrap'));
  } else {
    drawSmoothBezierSparkline('largeChartCanvas', stock.history, stock.dayOpenPrice, isUp, true);
  }
}

// Rules & Help Modal
function openRulesHelpModal() {
  document.getElementById('rulesHelpModal').classList.remove('hidden');
}

function closeRulesHelpModal() {
  document.getElementById('rulesHelpModal').classList.add('hidden');
}

let orderToastTimeout = null;
function showOrderToast(message, isSuccess) {
  const toast = document.getElementById('orderToast');
  if (!toast) return;
  if (orderToastTimeout) clearTimeout(orderToastTimeout);

  toast.innerHTML = `
    <span style="font-size: 16px; margin-right: 6px;">${isSuccess ? '✓' : '⚠️'}</span>
    <span style="flex: 1; word-break: break-word;">${message}</span>
    <button onclick="document.getElementById('orderToast').classList.add('hidden')" style="background: none; border: none; color: inherit; cursor: pointer; padding: 0 4px; font-weight: 700; font-size: 14px; opacity: 0.7;">✕</button>
  `;
  toast.className = `toast-notice ${isSuccess ? 'toast-success' : 'toast-error'}`;
  toast.classList.remove('hidden');

  // Give students 6500ms to read detailed error messages, 3500ms for short success
  const duration = isSuccess ? 3500 : 6500;
  orderToastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ==========================================
// LIQUIDATE PORTFOLIO MODAL & QUICK ACTIONS
// ==========================================
function openLiquidateModal() {
  if (!latestState || !latestState.portfolio) return;
  const p = latestState.portfolio;
  const heldStocks = latestState.companies.filter((c) => (p.holdings[c.ticker] || 0) > 0);

  if (heldStocks.length === 0) {
    showOrderToast('💼 Your portfolio is already 100% Cash in Hand! No active shares to sell.', false);
    return;
  }

  const tbody = document.getElementById('liquidateTableBody');
  const feeBps = latestState.gameState.transactionFeeBps || 0;
  let totalEstNet = 0;
  let totalEstFee = 0;

  tbody.innerHTML = heldStocks.map((stock) => {
    const qty = p.holdings[stock.ticker] || 0;
    const gross = qty * stock.currentPrice;
    const fee = (gross * feeBps) / 10000;
    const net = gross - fee;
    totalEstNet += net;
    totalEstFee += fee;

    return `
      <tr style="border-bottom: 1px solid var(--subtle-border);">
        <td style="padding: 6px;">
          <strong>${stock.ticker}</strong>
          ${stock.isHalted ? '<span class="badge badge-paused" style="font-size: 9px; margin-left: 4px;">HALTED</span>' : ''}
        </td>
        <td style="padding: 6px; font-weight: 700;">${qty}</td>
        <td style="padding: 6px;">₹${stock.currentPrice.toFixed(2)}</td>
        <td style="padding: 6px; text-align: right; font-weight: 700; color: var(--price-up);">
          ₹${net.toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('liquidateTotalEstCash').textContent = `₹${totalEstNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('liquidateEstFee').textContent = `₹${totalEstFee.toFixed(2)} (${feeBps} bps)`;
  const cashAfter = (p.cash || 0) + totalEstNet;
  document.getElementById('liquidateEstCashAfter').textContent = `₹${cashAfter.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById('liquidateModal').classList.remove('hidden');
}

function closeLiquidateModal() {
  const modal = document.getElementById('liquidateModal');
  if (modal) modal.classList.add('hidden');
}

function executeLiquidateAll() {
  if (!ws || !sessionToken) return;
  const btn = document.getElementById('btnConfirmLiquidate');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Liquidating All Shares...';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '⚡ Yes, Sell All Shares Now';
    }, 1500);
  }
  ws.send(JSON.stringify({
    action: 'LIQUIDATE_ALL',
    session_token: sessionToken
  }));
}

function quickSellAllStock(ticker, qty) {
  if (!ws || !sessionToken || !latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  if (latestState.gameState.isPaused || latestState.gameState.isConcluded) {
    showOrderToast('⏸️ Market is currently paused. Cannot sell right now.', false);
    return;
  }

  if (stock.isHalted) {
    showOrderToast(`⚡ Circuit Breaker Halt: Trading in ${stock.ticker} is currently frozen.`, false);
    return;
  }

  // ⚡ Fast 1-Click Execution: Zero blocking browser popups!
  sendOrder(stock.ticker, 'SELL', qty);
}

// ==========================================
// 5. PROJECTOR VIEW RENDERER
// ==========================================
// 5. INTELLIGENT PROJECTOR VIEW & MULTI-SCENE CYCLE ENGINE
// ==========================================
let localProjectorCycleIndex = 0;
let lastProjectorCycleSwitchTime = Date.now();
let currentProjectorBoardPage = 1;
let projectorCardsPerPage = 6;
let isProjectorBoardPaused = false;
let projectorBoardAutoFlipInterval = null;
let currentProjectorActiveScene = 'SCENE_MARKET_BOARD';
const PROJECTOR_CYCLE_SCENES = ['SCENE_MARKET_BOARD', 'SCENE_INDICES', 'SCENE_STRATEGY', 'SCENE_LEADERBOARD', 'SCENE_NEWS'];

function renderProjectorView(state) {
  const { gameState, companies, leaderboard, marketIndices, teamSectorAllocations, projectorState } = state;
  if (!gameState || !companies) return;

  const dayEl = document.getElementById('projDayText');
  if (dayEl) dayEl.textContent = `DAY ${gameState.currentDay} / ${gameState.totalDays}`;

  const isScheduled = gameState.status === 'SCHEDULED';
  const isStandby = (gameState.status === 'STANDBY' || (gameState.elapsedSeconds === 0 && gameState.status !== 'LIVE' && gameState.status !== 'COUNTDOWN')) && !isScheduled;
  const isDayCompleted = gameState.status === 'DAY_COMPLETED' || gameState.status === 'MARKET_CLOSED';
  const isPaused = gameState.isPaused && !isStandby && !isScheduled && !gameState.isConcluded && !isDayCompleted;
  const isMarketClosed = isDayCompleted;

  const remMs = (isScheduled && gameState.scheduledStartTime)
    ? Math.max(0, new Date(gameState.scheduledStartTime).getTime() - Date.now())
    : 0;
  const remSec = Math.floor(remMs / 1000);

  // Standby & Scheduled Banner
  const projStandbyBanner = document.getElementById('projStandbyBanner');
  if (projStandbyBanner) {
    if (isScheduled) {
      // Dedicated auditorium hero timer (#projEventOpeningHero) handles scheduled state
      projStandbyBanner.classList.add('hidden');
    } else if (isStandby) {
      projStandbyBanner.classList.remove('hidden');
      const bBadge = document.getElementById('projStandbyDayBadge');
      const bTitle = document.getElementById('projStandbyTitle');
      const bSub = document.getElementById('projStandbySub');
      if (bBadge) bBadge.textContent = `DAY ${gameState.currentDay} STANDBY`;
      if (bTitle) bTitle.textContent = `Day ${gameState.currentDay} Standby • Waiting for Host to Open Floor`;
      if (bSub) bSub.textContent = gameState.currentDay > 1 
        ? `Day ${gameState.currentDay - 1} concluded! Stand by for host to launch the opening countdown.`
        : `Market opening shortly. Stand by on your trading terminals for host signal.`;
    } else {
      projStandbyBanner.classList.add('hidden');
    }
  }

  // Day Completed Presentation Banner
  const projDayCompletedBanner = document.getElementById('projDayCompletedBanner');
  if (projDayCompletedBanner) {
    if (isDayCompleted) {
      projDayCompletedBanner.classList.remove('hidden');
      const bBadge = document.getElementById('projDayCompletedBadge');
      const bTitle = document.getElementById('projDayCompletedTitle');
      const bSub = document.getElementById('projDayCompletedSub');
      if (bBadge) bBadge.textContent = `DAY ${gameState.currentDay} COMPLETED`;
      if (bTitle) bTitle.textContent = `Day ${gameState.currentDay} Concluded • Official Session Standings`;
      if (bSub) bSub.textContent = gameState.currentDay < gameState.totalDays
        ? `Day ${gameState.currentDay} trading has ended. All portfolios audited and locked. Waiting for host to launch Day ${gameState.currentDay + 1}.`
        : `Championship trading has concluded. All portfolios audited and locked. Ready for awards ceremony.`;
    } else {
      projDayCompletedBanner.classList.add('hidden');
    }
  }

  // Paused Announcement Banner
  const projPauseBanner = document.getElementById('projPauseBanner');
  if (projPauseBanner) {
    if (isPaused) {
      projPauseBanner.classList.remove('hidden');
      const pTitle = document.getElementById('projPauseTitle');
      const pSub = document.getElementById('projPauseSub');
      if (pTitle) pTitle.textContent = gameState.pauseMode === 'BLACKOUT' ? 'Market Under Blind Blackout' : 'Market Paused by Host Control';
      if (pSub) pSub.textContent = gameState.pauseMode === 'BLACKOUT' 
        ? 'Desks are in blind mode. Prices and orders are paused until host resumes with 3-second countdown.'
        : 'All share prices and portfolio balances are frozen safely. Trading will resume with a 3-second live countdown.';
    } else {
      projPauseBanner.classList.add('hidden');
    }
  }

  const clockEl = document.getElementById('projClockText');
  if (clockEl) {
    if (isScheduled) {
      clockEl.textContent = `OPENS IN: ${formatMMSS(remSec)}`;
      clockEl.style.color = '#D97706';
    } else if (isStandby) {
      clockEl.textContent = `STANDBY • 00:00`;
      clockEl.style.color = '';
    } else if (isDayCompleted) {
      clockEl.textContent = `SESSION CONCLUDED`;
      clockEl.style.color = 'var(--champagne-accent)';
    } else if (isPaused) {
      clockEl.textContent = `PAUSED • ${formatMMSS(gameState.elapsedSeconds)}`;
      clockEl.style.color = 'var(--warning-amber)';
    } else {
      clockEl.textContent = `CLOCK: ${formatMMSS(gameState.elapsedSeconds)}`;
      clockEl.style.color = '';
    }
  }

  const statusEl = document.getElementById('projStatusText');
  if (statusEl) {
    if (isScheduled) {
      statusEl.textContent = `⏳ OPENS IN ${formatMMSS(remSec)}`;
      statusEl.className = 'badge badge-champagne';
    } else if (isStandby) {
      statusEl.textContent = `DAY ${gameState.currentDay} STANDBY`;
      statusEl.className = 'badge badge-champagne';
    } else if (isDayCompleted) {
      statusEl.textContent = `🔔 DAY ${gameState.currentDay} CONCLUDED`;
      statusEl.className = 'badge badge-champagne';
    } else if (isPaused) {
      statusEl.textContent = gameState.pauseMode === 'BLACKOUT' ? '🕶️ BLACKOUT PAUSED' : '⏸️ MARKET PAUSED';
      statusEl.className = 'badge badge-paused';
    } else {
      statusEl.textContent = 'ACTIVE TRADING';
      statusEl.className = 'badge badge-active';
    }
  }

  const tickerEl = document.getElementById('projectorTickerText');
  if (tickerEl) {
    if (isScheduled) {
      tickerEl.textContent = `⏳ PRE-MARKET COUNTDOWN: Day ${gameState.currentDay} opens in ${formatMMSS(remSec)}. All terminals armed. Review your desk strategies!`;
    } else if (isStandby) {
      tickerEl.textContent = `⏳ STANDBY: Day ${gameState.currentDay} will open with a 3-second live countdown when host starts the session. Review your desk strategies.`;
    } else if (isDayCompleted) {
      tickerEl.textContent = `🔔 DAY ${gameState.currentDay} CONCLUDED: Trading has ended. Audited standings and net worth valuations displayed on leaderboard. Please wait for host to start Day ${gameState.currentDay + 1}.`;
    } else if (isPaused) {
      tickerEl.textContent = `⏸️ MARKET PAUSED: All trading is frozen. Market will resume with an authoritative 3-second countdown.`;
    } else if (gameState.newsHistory && gameState.newsHistory.length > 0) {
      const latestNews = gameState.newsHistory[0];
      tickerEl.textContent = `[DAY ${latestNews.day} • ${latestNews.type || 'WIRE'}] "${(latestNews.headline || '').toUpperCase()}" — ${latestNews.simple_explanation || ''}`;
    } else {
      tickerEl.textContent = `🔴 LIVE MARKET • Day ${gameState.currentDay || 1} • Continuous Order Matching • Real-time Net Worth Standings`;
    }
  }

  const isWinnerActive = (projectorState && projectorState.isWinnerActive) || (gameState.status === 'WINNER_ANNOUNCEMENT');
  const mainStage = document.getElementById('projectorMainStage');
  const winnerStage = document.getElementById('projectorWinnerStage');

  // If winner announcement is triggered by host, show embedded winner stage on projector
  if (isWinnerActive) {
    if (mainStage) mainStage.classList.add('hidden');
    if (winnerStage) winnerStage.classList.remove('hidden');
    const sceneBadge = document.getElementById('projSceneBadge');
    if (sceneBadge) {
      sceneBadge.textContent = '👑 AWARDS CEREMONY: GRAND WINNER REVEAL';
      sceneBadge.className = 'badge badge-champagne';
    }
    renderEmbeddedProjectorWinnerStage(state);
    return;
  }

  // Live market normal display: show mainStage
  if (winnerStage) winnerStage.classList.add('hidden');
  if (mainStage) mainStage.classList.remove('hidden');

  const mode = (projectorState && projectorState.mode) || 'AUTO_CYCLE';
  const durationSec = (projectorState && projectorState.sceneDurationSeconds) || 12;

  let activeScene = 'SCENE_MARKET_BOARD';
  if (isDayCompleted || (isStandby && gameState.currentDay > 1)) {
    // When a day concludes, immediately show the audited Leaderboard to the audience
    activeScene = 'SCENE_LEADERBOARD';
  } else if (mode === 'FIXED_SCREEN') {
    activeScene = (projectorState && projectorState.currentScene) || 'SCENE_MARKET_BOARD';
  } else {
    // AUTO_CYCLE: Rotate scenes based on durationSec
    const now = Date.now();
    if (now - lastProjectorCycleSwitchTime >= durationSec * 1000) {
      localProjectorCycleIndex = (localProjectorCycleIndex + 1) % PROJECTOR_CYCLE_SCENES.length;
      lastProjectorCycleSwitchTime = now;
    }
    activeScene = PROJECTOR_CYCLE_SCENES[localProjectorCycleIndex];
  }

  // Update Scene Badge in header
  const sceneBadge = document.getElementById('projSceneBadge');
  if (sceneBadge) {
    const sceneNames = {
      SCENE_MARKET_BOARD: 'ALL-STOCKS BOARD',
      SCENE_INDICES: 'MARKET INDICES',
      SCENE_STRATEGY: 'SECTOR STRATEGY',
      SCENE_LEADERBOARD: 'LIVE STANDINGS',
      SCENE_NEWS: 'BREAKING WIRES'
    };
    const sName = sceneNames[activeScene] || activeScene;
    if (mode === 'AUTO_CYCLE') {
      const remainingSec = Math.max(1, durationSec - Math.floor((Date.now() - lastProjectorCycleSwitchTime) / 1000));
      sceneBadge.textContent = `🔄 CYCLE: ${sName} (${remainingSec}s)`;
      sceneBadge.className = 'badge badge-champagne';
    } else {
      sceneBadge.textContent = `📌 FIXED: ${sName}`;
      sceneBadge.className = 'badge badge-sage';
    }
  }

  currentProjectorActiveScene = activeScene;

  // Toggle scene visibility
  const sceneElements = {
    SCENE_MARKET_BOARD: document.getElementById('projSceneMarketBoardWrapper') || document.getElementById('projSceneMarketBoard'),
    SCENE_INDICES: document.getElementById('projSceneIndices'),
    SCENE_STRATEGY: document.getElementById('projSceneStrategy'),
    SCENE_LEADERBOARD: document.getElementById('projSceneLeaderboard'),
    SCENE_NEWS: document.getElementById('projSceneNews')
  };

  const heroEl = document.getElementById('projEventOpeningHero');

  if (isScheduled) {
    if (heroEl) {
      heroEl.classList.remove('hidden');
      renderProjectorHeroCountdown(state, remSec);
    }
    if (sceneBadge) {
      sceneBadge.textContent = `⏳ PRE-MARKET: OPENS IN ${formatMMSS(remSec)}`;
      sceneBadge.className = 'badge badge-champagne';
    }
    // Hide standard scenes while auditorium hero countdown is active
    Object.keys(sceneElements).forEach((sKey) => {
      const el = sceneElements[sKey];
      if (el) el.classList.add('hidden');
    });
  } else {
    if (heroEl) heroEl.classList.add('hidden');
    // Normal scene toggling:
    Object.keys(sceneElements).forEach((sKey) => {
      const el = sceneElements[sKey];
      if (el) {
        if (sKey === activeScene) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });

    // Render scene-specific contents
    if (activeScene === 'SCENE_MARKET_BOARD') {
      renderProjectorMarketBoard((companies || []).filter((c) => c.isEnabled !== false));
    } else if (activeScene === 'SCENE_INDICES') {
      renderProjectorIndices(projIndicesList);
    } else if (activeScene === 'SCENE_STRATEGY') {
      renderProjectorStrategy(teamSectorAllocations || state.teamSectorAllocations || []);
    } else if (activeScene === 'SCENE_LEADERBOARD') {
      renderProjectorLeaderboard(leaderboard || state.leaderboard || [], gameState);
    } else if (activeScene === 'SCENE_NEWS') {
      renderProjectorNews(gameState.newsHistory || []);
    }
  }

  // Always render persistent real-time indices ticker strip on projector
  const projIndicesList = marketIndices || (gameState && gameState.marketIndices) || calculateClientIndices(companies);
  renderAllIndicesBars(projIndicesList);
}

// ==========================================
// AUDITORIUM PROJECTOR HERO COUNTDOWN ENGINE
// ==========================================
let projectorHeroTickerHandle = null;

function renderProjectorHeroCountdown(state, remSec) {
  const { gameState, companies, leaderboard } = state;
  if (!gameState) return;

  const titleEl = document.getElementById('projHeroEventTitle');
  const instEl = document.getElementById('projHeroInstitution');
  const sessionPill = document.getElementById('projHeroSessionPill');
  const digitsEl = document.getElementById('projHeroTimerDigits');
  const fillEl = document.getElementById('projHeroProgressBarFill');
  const targetTimeEl = document.getElementById('projHeroTargetTimeDisplay');
  const desksEl = document.getElementById('projHeroDesksCount');
  const equitiesEl = document.getElementById('projHeroEquitiesCount');
  const durEl = document.getElementById('projHeroDurationDisplay');
  const circuitEl = document.getElementById('projHeroCircuitDisplay');

  if (titleEl) titleEl.textContent = gameState.title || 'The Trading Floor Championship 2026';
  if (instEl) instEl.textContent = gameState.institution || 'Gujarat Technological University • SSASIT';
  if (sessionPill) sessionPill.textContent = `DAY ${gameState.currentDay || 1} PRE-MARKET`;

  if (desksEl) {
    const count = Object.keys(leaderboard || {}).length || 3;
    desksEl.textContent = `${count} Desks Armed`;
  }
  if (equitiesEl) {
    const compCount = (companies || []).filter(c => c.isEnabled !== false).length || 8;
    equitiesEl.textContent = `${compCount} Real Equities`;
  }
  if (durEl) {
    const mins = Math.round((gameState.dayDurationSeconds || 1800) / 60);
    durEl.textContent = `${mins} Minutes`;
  }
  if (circuitEl) {
    circuitEl.textContent = `±${gameState.circuitBreakerPercent || 20}% Circuit Limit`;
  }

  // Format digits
  const hrs = Math.floor(remSec / 3600);
  const mins = Math.floor((remSec % 3600) / 60);
  const secs = remSec % 60;
  let formatted = '';
  if (hrs > 0) {
    formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (digitsEl) {
    if (remSec <= 3 && remSec > 0) {
      digitsEl.textContent = `${remSec}`;
      digitsEl.style.transform = 'scale(1.18)';
      digitsEl.style.color = '#F59E0B';
      setTimeout(() => { if (digitsEl) digitsEl.style.transform = 'scale(1)'; }, 150);
    } else if (remSec === 0) {
      digitsEl.textContent = 'OPEN!';
      digitsEl.style.color = 'var(--price-up)';
    } else {
      digitsEl.textContent = formatted;
      digitsEl.style.color = '#FFFFFF';
    }
  }

  if (targetTimeEl && gameState.scheduledStartTime) {
    try {
      const dt = new Date(gameState.scheduledStartTime);
      targetTimeEl.textContent = `Scheduled Floor Opening: ${dt.toLocaleTimeString()} • Synchronized Live Clock`;
    } catch (e) {
      targetTimeEl.textContent = `Opening in ${formatted}`;
    }
  }

  if (fillEl) {
    const maxSec = 300;
    const pct = Math.min(100, Math.max(5, (remSec / maxSec) * 100));
    fillEl.style.width = `${pct}%`;
  }

  ensureProjectorHeroTicker();
}

function ensureProjectorHeroTicker() {
  if (projectorHeroTickerHandle) return;
  projectorHeroTickerHandle = setInterval(() => {
    if (!latestState || !latestState.gameState) return;
    const gs = latestState.gameState;
    if (gs.status !== 'SCHEDULED' || !gs.scheduledStartTime) {
      clearInterval(projectorHeroTickerHandle);
      projectorHeroTickerHandle = null;
      return;
    }
    const remMs = Math.max(0, new Date(gs.scheduledStartTime).getTime() - Date.now());
    const remSec = Math.floor(remMs / 1000);
    const digitsEl = document.getElementById('projHeroTimerDigits');
    const hrs = Math.floor(remSec / 3600);
    const mins = Math.floor((remSec % 3600) / 60);
    const secs = remSec % 60;
    const formatted = hrs > 0
      ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (digitsEl) {
      if (remSec <= 3 && remSec > 0) {
        digitsEl.textContent = `${remSec}`;
        digitsEl.style.transform = 'scale(1.18)';
        digitsEl.style.color = '#F59E0B';
        setTimeout(() => { if (digitsEl) digitsEl.style.transform = 'scale(1)'; }, 150);
      } else if (remSec === 0) {
        digitsEl.textContent = 'OPEN!';
        digitsEl.style.color = 'var(--price-up)';
      } else {
        digitsEl.textContent = formatted;
        digitsEl.style.color = '#FFFFFF';
      }
    }
    const clockEl = document.getElementById('projClockText');
    if (clockEl) clockEl.textContent = `OPENS IN: ${formatted}`;
    const statusEl = document.getElementById('projStatusText');
    if (statusEl) statusEl.textContent = `⏳ OPENS IN ${formatted}`;
    const fillEl = document.getElementById('projHeroProgressBarFill');
    if (fillEl) {
      const pct = Math.min(100, Math.max(5, (remSec / 300) * 100));
      fillEl.style.width = `${pct}%`;
    }
  }, 1000);
}

// Scene 1: All-Stocks High-Visibility Grid with Automatic Zero-Scroll Pagination, Live Rankings & Spotlight
let _resumeAutoRotateTimeout = null;
let _newsReactionDismissTimeout = null;

function renderProjectorSpotlight(sortedCompanies) {
  if (!sortedCompanies || sortedCompanies.length === 0) return;

  const topGainer = sortedCompanies[0];
  const topLoser = sortedCompanies[sortedCompanies.length - 1];

  let advCount = 0;
  let decCount = 0;
  sortedCompanies.forEach((stock) => {
    const ref = stock.dayOpenPrice || stock.referencePrice || stock.base_price || stock.currentPrice || 1;
    const cur = Number(stock.currentPrice || 0);
    const pct = ref > 0 ? ((cur - ref) / ref) * 100 : 0;
    if (pct > 0.001) advCount++;
    else if (pct < -0.001) decCount++;
  });

  // Top Percentage Gainer Card Elements
  const tgTicker = document.getElementById('projTopGainerTicker');
  const tgName = document.getElementById('projTopGainerName');
  const tgPrice = document.getElementById('projTopGainerPrice');
  const tgDelta = document.getElementById('projTopGainerDelta');

  if (topGainer) {
    const refG = topGainer.dayOpenPrice || topGainer.referencePrice || topGainer.base_price || topGainer.currentPrice || 1;
    const curG = Number(topGainer.currentPrice || 0);
    const pctG = refG > 0 ? ((curG - refG) / refG) * 100 : 0;
    if (tgTicker) tgTicker.textContent = topGainer.ticker;
    if (tgName) tgName.textContent = topGainer.name || topGainer.ticker;
    if (tgPrice) tgPrice.textContent = '₹' + curG.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (tgDelta) {
      tgDelta.textContent = `${pctG >= 0 ? '+' : ''}${pctG.toFixed(2)}% ▲`;
      tgDelta.style.background = '#15803D';
    }
  }

  // Top Percentage Loser Card Elements
  const tlTicker = document.getElementById('projTopLoserTicker');
  const tlName = document.getElementById('projTopLoserName');
  const tlPrice = document.getElementById('projTopLoserPrice');
  const tlDelta = document.getElementById('projTopLoserDelta');

  if (topLoser) {
    const refL = topLoser.dayOpenPrice || topLoser.referencePrice || topLoser.base_price || topLoser.currentPrice || 1;
    const curL = Number(topLoser.currentPrice || 0);
    const pctL = refL > 0 ? ((curL - refL) / refL) * 100 : 0;
    if (tlTicker) tlTicker.textContent = topLoser.ticker;
    if (tlName) tlName.textContent = topLoser.name || topLoser.ticker;
    if (tlPrice) tlPrice.textContent = '₹' + curL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (tlDelta) {
      tlDelta.textContent = `${pctL.toFixed(2)}% ▼`;
      tlDelta.style.background = '#DC2626';
    }
  }

  // Market Breadth Elements
  const advEl = document.getElementById('projAdvancingCount');
  const decEl = document.getElementById('projDecliningCount');
  if (advEl) advEl.textContent = `${advCount} ▲ Advancing`;
  if (decEl) decEl.textContent = `${decCount} ▼ Declining`;
}

function renderProjectorMarketBoard(companies) {
  const grid = document.getElementById('projSceneMarketBoard');
  if (!grid) return;
  const activeCompanies = (companies || []).filter((c) => c.isEnabled !== false);

  // 1. Sort by performance ranking (highest % gainer first, decliners last, deterministic tie-break by ticker)
  const sortedCompanies = [...activeCompanies].sort((a, b) => {
    const refA = a.dayOpenPrice || a.referencePrice || a.base_price || a.currentPrice || 1;
    const refB = b.dayOpenPrice || b.referencePrice || b.base_price || b.currentPrice || 1;
    const pctA = refA > 0 ? ((a.currentPrice - refA) / refA) * 100 : 0;
    const pctB = refB > 0 ? ((b.currentPrice - refB) / refB) * 100 : 0;
    if (Math.abs(pctB - pctA) > 0.0001) return pctB - pctA;
    return (a.ticker || '').localeCompare(b.ticker || '');
  });

  // Assign global ranks
  sortedCompanies.forEach((stock, idx) => {
    stock.globalRank = idx + 1;
  });

  // 2. Permanently update the Spotlight Bar (Top Gainer & Top Loser across ALL active companies)
  renderProjectorSpotlight(sortedCompanies);

  // 3. Pagination Math (Configurable cards per page, default 6 = 3 cols x 2 rows, fits 1080p without scrolling)
  const totalCards = sortedCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / projectorCardsPerPage));

  if (currentProjectorBoardPage > totalPages) currentProjectorBoardPage = 1;
  if (currentProjectorBoardPage < 1) currentProjectorBoardPage = 1;

  const startIdx = (currentProjectorBoardPage - 1) * projectorCardsPerPage;
  const pageCompanies = sortedCompanies.slice(startIdx, startIdx + projectorCardsPerPage);

  // Update Page Indicator
  const pageIndicator = document.getElementById('projBoardPageIndicator');
  if (pageIndicator) {
    if (totalPages > 1) {
      pageIndicator.textContent = `📄 Page ${currentProjectorBoardPage} of ${totalPages} (Ranks #${startIdx + 1}–#${Math.min(startIdx + projectorCardsPerPage, totalCards)} of ${totalCards})`;
    } else {
      pageIndicator.textContent = `📄 Page 1 of 1 (All ${totalCards} Stocks Ranked)`;
    }
  }

  // Initialize auto-rotation interval once (Rotates every 8 seconds when market board is active)
  if (!projectorBoardAutoFlipInterval) {
    projectorBoardAutoFlipInterval = setInterval(() => {
      if (isProjectorBoardPaused) return;
      if (currentProjectorActiveScene !== 'SCENE_MARKET_BOARD') return;
      const act = ((latestState && latestState.companies) || []).filter((c) => c.isEnabled !== false);
      const pages = Math.max(1, Math.ceil(act.length / projectorCardsPerPage));
      if (pages > 1) {
        currentProjectorBoardPage = (currentProjectorBoardPage % pages) + 1;
        renderProjectorMarketBoard(act);
      }
    }, 8000);
  }

  // 4. Render or reorder cards for the CURRENT PAGE ONLY
  const currentPageTickers = pageCompanies.map((s) => s.ticker).join(',');
  const renderedTickers = Array.from(grid.children).map((el) => el.getAttribute('data-ticker')).join(',');

  if (currentPageTickers !== renderedTickers) {
    // Check if the current set of cards matches the rendered cards (just reordered by ranking)
    const currentSet = new Set(pageCompanies.map((s) => s.ticker));
    const renderedSet = new Set(Array.from(grid.children).map((el) => el.getAttribute('data-ticker')));
    const isSameStockSet = currentSet.size === renderedSet.size && [...currentSet].every((t) => renderedSet.has(t));

    if (isSameStockSet) {
      // Smooth reordering: rearrange existing DOM elements to preserve canvases and animations
      pageCompanies.forEach((stock) => {
        const cardEl = document.getElementById(`projCard_${stock.ticker}`);
        if (cardEl) grid.appendChild(cardEl);
      });
    } else {
      // Page flipped or universe modified: rebuild page cards
      grid.innerHTML = pageCompanies.map((stock) => {
        const curPrice = Number(stock.currentPrice || 0);
        return `
          <div id="projCard_${stock.ticker}" data-ticker="${stock.ticker}" class="projector-card">
            <div class="projector-card-header">
              <div class="projector-card-top">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="projRank_${stock.ticker}" class="projector-rank-badge">#${stock.globalRank}</span>
                  <span class="projector-ticker" title="${escapeHtml(stock.name || stock.ticker)}">${stock.ticker}</span>
                </div>
                <span id="projPrice_${stock.ticker}" class="projector-price price-up">₹${curPrice.toFixed(2)}</span>
              </div>
              <div class="projector-card-sub" style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                <span id="projDelta_${stock.ticker}" class="projector-delta price-up">+0.00% ▲</span>
                <span id="proj52w_${stock.ticker}" class="projector-52w-strip" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); font-weight: 600;">52W Range</span>
                <span class="projector-sector">${escapeHtml(stock.sector || '')}</span>
              </div>
            </div>
            <div style="height: 80px; margin-top: 8px; flex: 1; min-height: 60px;">
              <canvas id="projCanvas_${stock.ticker}" width="420" height="80" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 5. Update prices, deltas, rank badges, and Bezier sparklines IN-PLACE (zero timer resets)
  pageCompanies.forEach((stock) => {
    const ref = stock.dayOpenPrice || stock.referencePrice || stock.currentPrice || 1;
    const curPrice = Number(stock.currentPrice || 0);
    const pctVal = ref > 0 ? ((curPrice - ref) / ref) * 100 : 0;
    const pct = isNaN(pctVal) ? '0.0' : pctVal.toFixed(1);
    const isUp = pctVal >= 0;

    const cardEl = document.getElementById(`projCard_${stock.ticker}`);
    const priceEl = document.getElementById(`projPrice_${stock.ticker}`);
    const deltaEl = document.getElementById(`projDelta_${stock.ticker}`);
    const rankEl = document.getElementById(`projRank_${stock.ticker}`);

    if (cardEl) {
      cardEl.className = `projector-card ${stock.isHalted ? 'halted' : ''}`;
    }

    if (rankEl) {
      rankEl.textContent = `#${stock.globalRank}`;
    }

    if (priceEl) {
      priceEl.textContent = '₹' + curPrice.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      priceEl.className = `projector-price ${isUp ? 'price-up' : 'price-down'}`;
    }

    if (deltaEl) {
      deltaEl.textContent = stock.isHalted
        ? `⛔ HALTED (${stock.haltDirection || 'CIRCUIT'})`
        : `${isUp ? '+' : ''}${pct}% ${isUp ? '▲' : '▼'}`;
      deltaEl.className = isUp ? 'price-up' : 'price-down';
    }

    const w52El = document.getElementById(`proj52w_${stock.ticker}`);
    if (w52El) {
      const high52 = Number(stock.week52High || (stock.fundamentals && stock.fundamentals.high_52w) || (ref * 1.25));
      const low52 = Number(stock.week52Low || (stock.fundamentals && stock.fundamentals.low_52w) || (ref * 0.75));
      const isNew52H = !!(stock.isNew52WHigh || curPrice >= high52);
      const isNew52L = !!(stock.isNew52WLow || curPrice <= low52);
      if (isNew52H) {
        w52El.innerHTML = `<span style="background: #FEF3C7; color: #B45309; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #F59E0B; animation: pulse 1.5s infinite;">🔥 52W HIGH ₹${curPrice.toFixed(2)}</span>`;
      } else if (isNew52L) {
        w52El.innerHTML = `<span style="background: #E0F2FE; color: #0369A1; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #38BDF8;">❄️ 52W LOW ₹${curPrice.toFixed(2)}</span>`;
      } else {
        w52El.textContent = `52W: ₹${low52.toFixed(0)} - ₹${high52.toFixed(0)}`;
      }
    }

    if (window.drawSmoothMiniSparkline) {
      drawSmoothMiniSparkline(`projCanvas_${stock.ticker}`, stock.history, ref, isUp);
    } else {
      drawSmoothBezierSparkline(`projCanvas_${stock.ticker}`, stock.history, ref, isUp, false);
    }
  });
}

function projectorNextBoardPage() {
  const active = ((latestState && latestState.companies) || []).filter((c) => c.isEnabled !== false);
  const totalPages = Math.max(1, Math.ceil(active.length / projectorCardsPerPage));
  currentProjectorBoardPage = (currentProjectorBoardPage % totalPages) + 1;
  renderProjectorMarketBoard(active);

  // Resume auto-rotation automatically after 12s so manual overrides never permanently halt rotation
  if (_resumeAutoRotateTimeout) clearTimeout(_resumeAutoRotateTimeout);
  isProjectorBoardPaused = true;
  _resumeAutoRotateTimeout = setTimeout(() => {
    isProjectorBoardPaused = false;
  }, 12000);
}

function projectorPrevBoardPage() {
  const active = ((latestState && latestState.companies) || []).filter((c) => c.isEnabled !== false);
  const totalPages = Math.max(1, Math.ceil(active.length / projectorCardsPerPage));
  currentProjectorBoardPage = currentProjectorBoardPage <= 1 ? totalPages : currentProjectorBoardPage - 1;
  renderProjectorMarketBoard(active);

  // Resume auto-rotation automatically after 12s
  if (_resumeAutoRotateTimeout) clearTimeout(_resumeAutoRotateTimeout);
  isProjectorBoardPaused = true;
  _resumeAutoRotateTimeout = setTimeout(() => {
    isProjectorBoardPaused = false;
  }, 12000);
}

function projectorToggleBoardPause() {
  isProjectorBoardPaused = !isProjectorBoardPaused;
  const btn = document.getElementById('btnProjToggleBoardPause');
  if (btn) btn.textContent = isProjectorBoardPaused ? '▶' : '⏸';
  showOrderToast(isProjectorBoardPaused ? '⏸ Projector page auto-flip paused' : '▶ Projector page auto-flip resumed', true);
}

// ==========================================
// TV BROADCAST POST-NEWS REACTION SPOTLIGHT
// ==========================================
function handleNewsReactionSpotlight(data) {
  if (!data) return;
  playInstitutionalSound('reaction_start_chime');

  const overlay = document.getElementById('projNewsReactionSpotlightOverlay');
  if (!overlay) return;

  const secEl = document.getElementById('projReactionSector');
  const hEl = document.getElementById('projReactionHeadline');
  const nameEl = document.getElementById('projReactionStockName');
  const oldPriceEl = document.getElementById('projReactionOldPrice');
  const startTimeEl = document.getElementById('projReactionStartTime');
  const newPriceEl = document.getElementById('projReactionNewPrice');
  const endTimeEl = document.getElementById('projReactionEndTime');
  const deltaBadgeEl = document.getElementById('projReactionDeltaBadge');

  if (secEl) secEl.textContent = `${data.sector || 'EQUITIES'} • ${data.ticker}`;
  if (hEl) hEl.textContent = `"${data.headline}"`;
  if (nameEl) nameEl.textContent = `${data.name || data.ticker} (${data.ticker})`;
  if (oldPriceEl) oldPriceEl.textContent = `₹${(data.startPrice || 0).toFixed(2)}`;
  if (startTimeEl) startTimeEl.textContent = `Pre-Reaction Price • ${data.startTimeStr || '10:00'}`;
  if (newPriceEl) newPriceEl.textContent = `₹${(data.endPrice || 0).toFixed(2)}`;
  if (endTimeEl) endTimeEl.textContent = `Post-Reaction Price • ${data.endTimeStr || '10:01'}`;

  const isUp = data.isUp !== undefined ? data.isUp : (data.endPrice >= data.startPrice);
  if (deltaBadgeEl) {
    deltaBadgeEl.textContent = `${isUp ? '+' : ''}${(data.deltaPct || 0).toFixed(2)}% ${isUp ? 'SURGE ▲' : 'PLUNGE ▼'}`;
    deltaBadgeEl.style.background = isUp ? 'var(--price-up)' : 'var(--price-down)';
  }

  // Draw smooth trajectory graph on canvas
  drawNewsReactionTrajectory('projReactionChartCanvas', data.history || [data.startPrice, data.endPrice], data.startPrice, data.endPrice, isUp, data.startTimeStr, data.endTimeStr);

  overlay.classList.remove('hidden');

  if (_newsReactionDismissTimeout) clearTimeout(_newsReactionDismissTimeout);
  _newsReactionDismissTimeout = setTimeout(() => {
    overlay.classList.add('hidden');
  }, 14000);
}

function dismissNewsReactionSpotlight() {
  if (_newsReactionDismissTimeout) clearTimeout(_newsReactionDismissTimeout);
  const overlay = document.getElementById('projNewsReactionSpotlightOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function drawNewsReactionTrajectory(canvasId, history, startPrice, endPrice, isUp, startTimeStr, endTimeStr) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width || 800;
  const h = canvas.height || 150;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#FDFCF9';
  ctx.fillRect(0, 0, w, h);

  // Gridlines
  ctx.strokeStyle = '#E6DEC9';
  ctx.lineWidth = 1;
  for (let y = 30; y < h - 20; y += 30) {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(w - 30, y);
    ctx.stroke();
  }

  const pts = (history && history.length >= 2) ? history : [startPrice, (startPrice + endPrice) / 2, endPrice];
  const minP = Math.min(...pts) * 0.995;
  const maxP = Math.max(...pts) * 1.005;
  const range = maxP - minP || 1;

  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 25;
  const paddingBottom = 35;
  const plotW = w - paddingLeft - paddingRight;
  const plotH = h - paddingTop - paddingBottom;

  const coords = pts.map((p, idx) => {
    const x = paddingLeft + (idx / (pts.length - 1)) * plotW;
    const y = paddingTop + plotH - ((p - minP) / range) * plotH;
    return { x, y, p };
  });

  // Area gradient fill
  const strokeColor = isUp ? '#059669' : '#DC2626';
  const grad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
  grad.addColorStop(0, isUp ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
  }
  ctx.lineTo(coords[coords.length - 1].x, h - paddingBottom);
  ctx.lineTo(coords[0].x, h - paddingBottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line stroke
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Highlight Start Point
  const first = coords[0];
  ctx.beginPath();
  ctx.arc(first.x, first.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#D97706';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Start Label
  ctx.fillStyle = '#4B5563';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`₹${startPrice.toFixed(2)} (${startTimeStr || 'Start'})`, first.x - 10, first.y - 12);

  // Highlight End Point
  const last = coords[coords.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // End Label
  ctx.fillStyle = strokeColor;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`₹${endPrice.toFixed(2)} (${endTimeStr || 'Finish'})`, last.x - 70, last.y - 14);
}

// Scene 2: Real Market Indices Overview
function renderProjectorIndices(indicesObj) {
  const container = document.getElementById('projSceneIndices');
  if (!container || !indicesObj) return;

  const indexList = Array.isArray(indicesObj) ? indicesObj : Object.values(indicesObj);
  if (!indexList.length) return;

  container.innerHTML = indexList.map((idx) => {
    const val = idx.currentValue !== undefined ? idx.currentValue : (idx.value || 0);
    const pct = idx.changePct !== undefined ? idx.changePct : 0;
    const pts = idx.change !== undefined ? idx.change : (idx.changePoints || 0);
    const isUp = pct >= 0;
    const tickers = idx.tickers || idx.constituents || [];
    const count = idx.constituentsCount !== undefined ? idx.constituentsCount : tickers.length;

    return `
      <div class="luxury-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid var(--card-border);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge badge-champagne" style="font-size: 11px; margin-bottom: 4px;">${escapeHtml(idx.sector || 'MARKET BENCHMARK')}</span>
              <h2 style="font-size: 20px; font-weight: 900; color: var(--text-forest); margin: 0;">${escapeHtml(idx.name || idx.id || 'Index')}</h2>
            </div>
            <span class="badge ${isUp ? 'badge-active' : 'badge-halted'}" style="font-size: 13px; font-family: var(--font-mono); font-weight: 800;">
              ${isUp ? '+' : ''}${pct.toFixed(2)}% ${isUp ? '▲' : '▼'}
            </span>
          </div>

          <div style="margin: 14px 0;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Benchmark Value</div>
            <div style="font-family: var(--font-mono); font-size: 32px; font-weight: 900; color: var(--text-forest); margin-top: 2px;">
              ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 700;" class="${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${pts.toFixed(2)} points from base
            </div>
          </div>
        </div>

        <div class="cream-panel" style="padding: 10px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 4px;">
            <span>Constituents: <strong>${count} Stocks</strong></span>
            <span>Weighting: <strong>${idx.weighting || 'Equal-Weighted'}</strong></span>
          </div>
          <div style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            Symbols: ${tickers.join(', ')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Projector Sector Colors & SVG Donut Chart Synthesizer
const PROJECTOR_SECTOR_COLORS = {
  'BANKING & FINANCE': '#6366F1',
  'BANKING': '#6366F1',
  'INFORMATION TECHNOLOGY': '#2563EB',
  'IT': '#2563EB',
  'AUTOMOBILE': '#EF4444',
  'AUTO': '#EF4444',
  'ENERGY & POWER': '#F59E0B',
  'ENERGY': '#F59E0B',
  'PHARMACEUTICALS': '#14B8A6',
  'PHARMA': '#14B8A6',
  'FMCG & CONSUMER': '#8B5CF6',
  'FMCG': '#8B5CF6',
  'METALS & MINING': '#64748B',
  'METALS': '#64748B',
  'CONGLOMERATE': '#EC4899',
  'CASH': '#10B981',
  'UNINVESTED': '#10B981'
};

function getProjectorSectorColor(sectorName) {
  if (!sectorName) return '#0284C7';
  const upper = String(sectorName).toUpperCase();
  for (const [k, color] of Object.entries(PROJECTOR_SECTOR_COLORS)) {
    if (upper.includes(k)) return color;
  }
  return '#0284C7';
}

function generateProjectorDonutSVG(slices) {
  const r = 36;
  const c = 2 * Math.PI * r;
  let cumulative = 0;
  const paths = slices.map((s) => {
    if (s.pct <= 0.2) return '';
    const strokeDash = `${((s.pct / 100) * c).toFixed(2)} ${c.toFixed(2)}`;
    const offset = (-((cumulative / 100) * c)).toFixed(2);
    cumulative += s.pct;
    return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${s.color}" stroke-width="13" stroke-dasharray="${strokeDash}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"></circle>`;
  }).join('');

  const cashSlice = slices.find((s) => s.isCash);
  const investedPct = Math.max(0, 100 - (cashSlice ? cashSlice.pct : 0));

  return `
    <svg viewBox="0 0 100 100" style="width: 100px; height: 100px; flex-shrink: 0;">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="13"></circle>
      ${paths}
      <text x="50" y="47" text-anchor="middle" font-size="13" font-weight="900" fill="var(--text-forest)" font-family="var(--font-mono)">${investedPct.toFixed(0)}%</text>
      <text x="50" y="59" text-anchor="middle" font-size="7" font-weight="800" fill="var(--text-muted)" text-transform="uppercase">INVESTED</text>
    </svg>
  `;
}

function formatNewsTimestamp(ts) {
  if (!ts) return '';
  if (typeof ts === 'string' && (ts.includes('AM') || ts.includes('PM')) && !ts.includes('T')) {
    return ts;
  }
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Scene 3: Team Strategy & Macro Sector Allocations (Audience-Friendly, Zero Stock Leakage)
function renderProjectorStrategy(allocations) {
  const container = document.getElementById('projSceneStrategy');
  if (!container) return;

  if (!allocations || allocations.length === 0) {
    container.innerHTML = `
      <div class="luxury-card" style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted);">
        No team sector positions established yet. Teams are currently evaluating market entry opportunities.
      </div>
    `;
    return;
  }

  // Calculate Market-Wide Capital Deployment & Hottest Sector on the Floor
  let totalCash = 0;
  let totalNetWorth = 0;
  const sectorTotalValues = {};

  allocations.forEach((team) => {
    const nw = Number(team.netWorth || team.portfolioValue || 0);
    const cVal = Number(team.cashAmount != null ? team.cashAmount : (team.cashPct ? (nw * team.cashPct / 100) : nw));
    totalCash += cVal;
    totalNetWorth += nw;
    const secList = Object.entries(team.sectorPcts || team.sectorAllocations || {});
    secList.forEach(([sec, pct]) => {
      const sVal = (pct / 100) * nw;
      sectorTotalValues[sec] = (sectorTotalValues[sec] || 0) + sVal;
    });
  });

  const totalInvested = Math.max(0, totalNetWorth - totalCash);
  const roomInvestedPct = totalNetWorth > 0 ? (totalInvested / totalNetWorth) * 100 : 0;
  const roomCashPct = totalNetWorth > 0 ? (totalCash / totalNetWorth) * 100 : 100;

  // Identify Hottest Sector
  let hotSector = 'Equities';
  let hotSectorVal = 0;
  Object.entries(sectorTotalValues).forEach(([sec, val]) => {
    if (val > hotSectorVal) {
      hotSectorVal = val;
      hotSector = sec;
    }
  });

  const marketStance = roomInvestedPct >= 65
    ? { text: '🔥 AGGRESSIVE RISK-ON', bg: '#DCFCE7', color: '#166534' }
    : roomInvestedPct >= 35
    ? { text: '⚖️ BALANCED STRATEGY', bg: '#EFF6FF', color: '#1E40AF' }
    : { text: '🛡️ DEFENSIVE CASH STANCE', bg: '#FEF3C7', color: '#92400E' };

  // Overview Banner Card
  const overviewHtml = `
    <div class="luxury-card" style="grid-column: 1 / -1; padding: 14px 20px; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border-left: 5px solid var(--champagne-accent); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
          <span style="font-size: 16px;">🔥</span>
          <span style="font-size: 13px; font-weight: 900; color: var(--text-forest); text-transform: uppercase; letter-spacing: 0.05em;">Auditorium Strategy Wire • Capital Posture</span>
          <span class="badge" style="background: ${marketStance.bg}; color: ${marketStance.color}; font-size: 10px; font-weight: 800;">${marketStance.text}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          Total Floor Capital: <strong>${formatINR(totalNetWorth)}</strong> &bull; Total Invested: <strong style="color: var(--price-up);">${formatINR(totalInvested)} (${roomInvestedPct.toFixed(1)}%)</strong> &bull; Liquid Reserves: <strong style="color: #047857;">${formatINR(totalCash)} (${roomCashPct.toFixed(1)}%)</strong>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="text-align: right;">
          <span style="display: block; font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Most Favored Sector</span>
          <span style="font-size: 14px; font-weight: 900; color: var(--text-forest);">${hotSector}</span>
        </div>
        <div style="width: 14px; height: 14px; border-radius: 999px; background: ${getProjectorSectorColor(hotSector)};"></div>
      </div>
    </div>
  `;

  const teamCardsHtml = allocations.map((team) => {
    const secList = Object.entries(team.sectorPcts || team.sectorAllocations || {});
    const nw = Number(team.netWorth || team.portfolioValue || 0);
    const cashPct = Number(team.cashPct || 0);

    // Prepare slices for SVG Donut
    const slices = [];
    secList.forEach(([sec, pct]) => {
      slices.push({
        pct: Number(pct || 0),
        color: getProjectorSectorColor(sec),
        label: sec,
        isCash: false
      });
    });
    slices.push({
      pct: cashPct,
      color: '#10B981',
      label: 'Cash Reserves',
      isCash: true
    });

    const isConcentrated = team.isConcentrated || (secList.length > 0 && secList[0][1] >= 50);
    const dominantSec = team.dominantSector || (secList.length > 0 ? secList[0][0] : 'None');
    const dominantPct = team.dominantSectorPct || (secList.length > 0 ? secList[0][1].toFixed(0) : '0');

    return `
      <div class="luxury-card" style="padding: 16px; border: 2px solid var(--card-border); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-champagne" style="font-size: 11px; font-weight: 900;">RANK #${team.rank || '—'}</span>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text-forest); margin: 0;">${escapeHtml(team.teamName)}</h3>
            </div>
            <span style="font-family: var(--font-mono); font-size: 15px; font-weight: 900; color: var(--text-forest);">
              ${formatINR(nw)}
            </span>
          </div>

          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span class="badge ${isConcentrated ? 'badge-halted' : 'badge-sage'}" style="font-size: 10px; padding: 3px 8px;">
              ${isConcentrated ? `⚠️ CONCENTRATED (${dominantSec} ${dominantPct}%)` : `🛡️ DIVERSIFIED DESK`}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">
              💵 Cash: ${cashPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 16px; margin-top: 4px;">
          <!-- SVG Pie / Donut Chart -->
          ${generateProjectorDonutSVG(slices)}

          <!-- Sector Breakdown Progress Bars -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0;">
            ${secList.slice(0, 3).map(([sec, pct]) => {
              const secColor = getProjectorSectorColor(sec);
              const pVal = Number(pct || 0);
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                    <span style="color: var(--text-muted); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: ${secColor}; margin-right: 4px;"></span>
                      ${escapeHtml(sec)}
                    </span>
                    <span style="font-family: var(--font-mono); font-weight: 800; color: var(--text-forest);">${pVal.toFixed(1)}%</span>
                  </div>
                  <div style="height: 6px; background: #F1F5F9; border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(100, pVal)}%; background: ${secColor}; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}

            <!-- Cash Reserve Bar -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                <span style="color: #047857; font-weight: 700;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: #10B981; margin-right: 4px;"></span>
                  Uninvested Cash
                </span>
                <span style="font-family: var(--font-mono); font-weight: 800; color: #047857;">${cashPct.toFixed(1)}%</span>
              </div>
              <div style="height: 6px; background: #F1F5F9; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, cashPct)}%; background: #10B981; border-radius: 3px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = overviewHtml + teamCardsHtml;
}

// Scene 4: Daily & Championship Leaderboard
function renderProjectorLeaderboard(leaderboard, gameState) {
  const container = document.getElementById('projSceneLeaderboard');
  if (!container) return;

  const startCash = (gameState && gameState.startingCash) || 500000;
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid var(--subtle-border); padding-bottom: 12px;">
      <div>
        <h2 style="font-size: 22px; font-weight: 900; color: var(--text-forest); margin: 0; font-family: var(--font-serif);">
          Championship Leaderboard &bull; Day ${gameState ? gameState.currentDay : 1}
        </h2>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
          Audited Net Worth (Cash + Live Stock Holdings Valuation - Deducted Brokerage)
        </div>
      </div>
      <div class="cream-panel" style="padding: 6px 14px; font-size: 12px; font-weight: 800; color: var(--champagne-accent);">
        STARTING CAPITAL: ${formatINR(startCash)}
      </div>
    </div>

    <!-- Confidentiality & Anti-Copy Protection Notice -->
    <div style="background: rgba(30, 41, 59, 0.04); border: 1px solid var(--subtle-border); border-radius: 8px; padding: 7px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 600;">
      <span>🔒 <strong>Anti-Copy Strategy Shield:</strong> Specific stock holdings and share quantities are concealed to protect proprietary team strategies.</span>
      <span style="font-family: var(--font-mono); color: var(--text-forest); font-weight: 700;">★ RANKED BY AUDITED NET WORTH</span>
    </div>

    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid var(--subtle-border); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
            <th style="padding: 10px;">Rank</th>
            <th style="padding: 10px;">Team Desk</th>
            <th style="padding: 10px; text-align: right;">Cash Available</th>
            <th style="padding: 10px; text-align: right;">Stock Valuation</th>
            <th style="padding: 10px; text-align: right;">Net Portfolio Worth</th>
            <th style="padding: 10px; text-align: right;">Profit / Loss</th>
            <th style="padding: 10px; text-align: right;">Return %</th>
            <th style="padding: 10px; text-align: center;">Trades</th>
          </tr>
        </thead>
        <tbody style="font-family: var(--font-mono);">
          ${leaderboard.map((item, idx) => {
            const pnl = item.netWorth - startCash;
            const retPct = startCash > 0 ? (pnl / startCash) * 100 : 0;
            const isUp = pnl >= 0;
            let rankBadge = `<span style="font-weight: 800;">#${idx + 1}</span>`;
            if (idx === 0) rankBadge = `<span class="badge badge-champagne" style="font-size: 12px;">🥇 #1</span>`;
            else if (idx === 1) rankBadge = `<span class="badge" style="background: #F1F5F9; color: #475569; font-size: 12px;">🥈 #2</span>`;
            else if (idx === 2) rankBadge = `<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 12px;">🥉 #3</span>`;

            return `
              <tr style="border-bottom: 1px solid var(--subtle-border); ${idx < 3 ? 'background: #FAF9F6;' : ''}">
                <td style="padding: 10px;">${rankBadge}</td>
                <td style="padding: 10px; font-family: var(--font-sans); font-weight: 800; color: var(--text-forest);">${escapeHtml(item.name)}</td>
                <td style="padding: 10px; text-align: right;">${formatINR(item.cash)}</td>
                <td style="padding: 10px; text-align: right;">${formatINR(item.holdingsValue)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 900; color: var(--text-forest); font-size: 15px;">${formatINR(item.netWorth)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isUp ? 'price-up' : 'price-down'}">
                  ${isUp ? '+' : ''}${formatINR(pnl)}
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isUp ? 'price-up' : 'price-down'}">
                  ${isUp ? '+' : ''}${retPct.toFixed(2)}%
                </td>
                <td style="padding: 10px; text-align: center; font-weight: 700; color: var(--text-muted);">${item.tradeCount || 0}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Scene 5: Breaking Wire News Feed
function renderProjectorNews(newsHistory) {
  const container = document.getElementById('projSceneNews');
  if (!container) return;

  if (!newsHistory || newsHistory.length === 0) {
    container.innerHTML = `
      <div style="padding: 36px; text-align: center; color: var(--text-muted);">
        No published wires yet. Live market monitoring in progress.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid var(--subtle-border); padding-bottom: 12px;">
      <h2 style="font-size: 22px; font-weight: 900; color: var(--text-forest); margin: 0; font-family: var(--font-serif);">
        ⚡ Breaking Financial Wires &bull; Official Dispatch Archive
      </h2>
      <span class="badge badge-champagne" style="font-size: 12px; font-weight: 800;">VERIFIED REUTERS/BLOOMBERG FORMAT</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 14px;">
      ${newsHistory.map((item) => `
        <div class="cream-panel" style="padding: 16px; border-left: 5px solid var(--champagne-accent); background: #FAF9F6; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-champagne" style="font-size: 11px; font-weight: 800;">DAY ${item.day || 1}</span>
              <span class="badge badge-outline" style="font-size: 11px; font-weight: 700;">${item.type || 'NEWS WIRE'}</span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); font-weight: 700;">
              🕒 ${formatNewsTimestamp(item.timestamp)}
            </span>
          </div>
          <h3 style="font-size: 17px; font-weight: 800; color: var(--text-forest); margin: 0 0 6px 0; line-height: 1.3;">
            ${escapeHtml(item.headline || '')}
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 0;">
            ${escapeHtml(item.simple_explanation || item.article || '')}
          </p>
        </div>
      `).join('')}
    </div>
  `;
}

// Fallback client indices calculation if server payload is brief
function calculateClientIndices(companies) {
  if (!companies || companies.length === 0) return {};
  const base = 10000;
  const sectorGroups = {
    'NIFTY_TF20': { name: 'Championship Benchmark 20', sector: 'BROAD MARKET', tickers: companies.map((c) => c.ticker) },
    'BANK_TF': { name: 'Championship Banking Index', sector: 'BANKING & FINANCE', tickers: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'BAJFINANCE'] },
    'IT_TF': { name: 'Championship IT Index', sector: 'INFORMATION TECHNOLOGY', tickers: ['TCS', 'INFY'] },
    'AUTO_TF': { name: 'Championship Auto Index', sector: 'AUTOMOTIVE', tickers: ['TATAMOTORS', 'MARUTI', 'M&M'] },
    'ENERGY_TF': { name: 'Championship Energy Index', sector: 'POWER & ENERGY', tickers: ['RELIANCE', 'NTPC', 'POWERGRID'] },
    'METALS_TF': { name: 'Championship Metals Index', sector: 'METALS & MINING', tickers: ['TATASTEEL', 'JSWSTEEL'] }
  };

  const results = {};
  Object.entries(sectorGroups).forEach(([key, conf]) => {
    const list = companies.filter((c) => conf.tickers.includes(c.ticker));
    if (list.length === 0) return;
    let sumRel = 0;
    list.forEach((c) => {
      const b = c.base_price || c.dayOpenPrice || c.currentPrice || 1;
      sumRel += c.currentPrice / b;
    });
    const avgRel = sumRel / list.length;
    const val = +(base * avgRel).toFixed(2);
    const chgPoints = +(val - base).toFixed(2);
    const chgPct = +(((val - base) / base) * 100).toFixed(2);

    results[key] = {
      id: key,
      name: conf.name,
      sector: conf.sector,
      value: val,
      changePoints: chgPoints,
      changePct: chgPct,
      constituentsCount: list.length,
      tickers: conf.tickers
    };
  });
  return results;
}

// Embedded Winner Presentation Stage Renderer (Natively on Projector Screen)
function renderEmbeddedProjectorWinnerStage(state) {
  const snapshot = state.finalResultsSnapshot || generateClientSnapshotFromLeaderboard(state);
  const rankings = snapshot.rankings || snapshot.teams || [];
  const curScene = (state.projectorState && state.projectorState.winnerScene) ||
                   (state.presentationState && state.presentationState.scene) ||
                   'SCENE_INTRO';

  const scenes = ['projSceneIntro', 'projSceneBronze', 'projSceneSilver', 'projSceneChampion', 'projScenePodium', 'projSceneStandings'];
  scenes.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.add('hidden');
  });

  const badge = document.getElementById('projWinnerStageBadge');
  const normalizedScene = curScene.replace('SCENE_', '');

  if (normalizedScene === 'BRONZE') {
    const bronzeTeam = rankings[2] || rankings[rankings.length - 1] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    const elTeam = document.getElementById('projPresBronzeTeam');
    if (elTeam) elTeam.textContent = bronzeTeam.teamName;
    const elMem = document.getElementById('projPresBronzeMembers');
    if (elMem) elMem.textContent = bronzeTeam.members ? `Traders: ${bronzeTeam.members}` : '';
    const elVal = document.getElementById('projPresBronzeVal');
    if (elVal) elVal.textContent = formatINR(bronzeTeam.totalPortfolioValue || bronzeTeam.finalPortfolioValue || 0);

    const pnl = bronzeTeam.netProfitLoss !== undefined ? bronzeTeam.netProfitLoss : (bronzeTeam.netProfitOrLoss || 0);
    const pnlEl = document.getElementById('projPresBronzePnl');
    if (pnlEl) {
      pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
      pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    }

    const retPct = bronzeTeam.returnPct !== undefined ? bronzeTeam.returnPct : 0;
    const retEl = document.getElementById('projPresBronzeReturn');
    if (retEl) {
      retEl.textContent = `${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%`;
      retEl.className = retPct >= 0 ? 'price-up' : 'price-down';
    }

    const sceneEl = document.getElementById('projSceneBronze');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 2: 🥉 BRONZE MEDALIST';
  } else if (normalizedScene === 'SILVER') {
    const silverTeam = rankings[1] || rankings[0] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    const elTeam = document.getElementById('projPresSilverTeam');
    if (elTeam) elTeam.textContent = silverTeam.teamName;
    const elMem = document.getElementById('projPresSilverMembers');
    if (elMem) elMem.textContent = silverTeam.members ? `Traders: ${silverTeam.members}` : '';
    const elVal = document.getElementById('projPresSilverVal');
    if (elVal) elVal.textContent = formatINR(silverTeam.totalPortfolioValue || silverTeam.finalPortfolioValue || 0);

    const pnl = silverTeam.netProfitLoss !== undefined ? silverTeam.netProfitLoss : (silverTeam.netProfitOrLoss || 0);
    const pnlEl = document.getElementById('projPresSilverPnl');
    if (pnlEl) {
      pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
      pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    }

    const retPct = silverTeam.returnPct !== undefined ? silverTeam.returnPct : 0;
    const retEl = document.getElementById('projPresSilverReturn');
    if (retEl) {
      retEl.textContent = `${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%`;
      retEl.className = retPct >= 0 ? 'price-up' : 'price-down';
    }

    const sceneEl = document.getElementById('projSceneSilver');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 3: 🥈 SILVER RUNNER-UP';
  } else if (normalizedScene === 'CHAMPION') {
    const champ = rankings[0] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    const elTeam = document.getElementById('projPresChampionTeam');
    if (elTeam) elTeam.textContent = champ.teamName;
    const elMem = document.getElementById('projPresChampionMembers');
    if (elMem) elMem.textContent = champ.members ? `Traders: ${champ.members}` : '';
    const elVal = document.getElementById('projPresChampionVal');
    if (elVal) elVal.textContent = formatINR(champ.totalPortfolioValue || champ.finalPortfolioValue || 0);

    const pnl = champ.netProfitLoss !== undefined ? champ.netProfitLoss : (champ.netProfitOrLoss || 0);
    const pnlEl = document.getElementById('projPresChampionPnl');
    if (pnlEl) {
      pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
      pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    }

    const retPct = champ.returnPct !== undefined ? champ.returnPct : 0;
    const retEl = document.getElementById('projPresChampionReturn');
    if (retEl) {
      retEl.textContent = `${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%`;
      retEl.className = retPct >= 0 ? 'price-up' : 'price-down';
    }

    const sceneEl = document.getElementById('projSceneChampion');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 4: 🏆 GRAND CHAMPION';
    createPresentationConfetti();
  } else if (normalizedScene === 'PODIUM') {
    const t1 = rankings[0] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };
    const t2 = rankings[1] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };
    const t3 = rankings[2] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };

    const p1Team = document.getElementById('projPodium1Team');
    if (p1Team) p1Team.textContent = t1.teamName;
    const p1Val = document.getElementById('projPodium1Val');
    if (p1Val) p1Val.textContent = formatINR(t1.totalPortfolioValue || t1.finalPortfolioValue || 0);
    const p1Ret = document.getElementById('projPodium1Return');
    if (p1Ret) p1Ret.textContent = `${(t1.returnPct || 0) >= 0 ? '+' : ''}${(t1.returnPct || 0).toFixed(2)}%`;

    const p2Team = document.getElementById('projPodium2Team');
    if (p2Team) p2Team.textContent = t2.teamName;
    const p2Val = document.getElementById('projPodium2Val');
    if (p2Val) p2Val.textContent = formatINR(t2.totalPortfolioValue || t2.finalPortfolioValue || 0);
    const p2Ret = document.getElementById('projPodium2Return');
    if (p2Ret) p2Ret.textContent = `${(t2.returnPct || 0) >= 0 ? '+' : ''}${(t2.returnPct || 0).toFixed(2)}%`;

    const p3Team = document.getElementById('projPodium3Team');
    if (p3Team) p3Team.textContent = t3.teamName;
    const p3Val = document.getElementById('projPodium3Val');
    if (p3Val) p3Val.textContent = formatINR(t3.totalPortfolioValue || t3.finalPortfolioValue || 0);
    const p3Ret = document.getElementById('projPodium3Return');
    if (p3Ret) p3Ret.textContent = `${(t3.returnPct || 0) >= 0 ? '+' : ''}${(t3.returnPct || 0).toFixed(2)}%`;

    const sceneEl = document.getElementById('projScenePodium');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 5: 🎖️ GRAND PODIUM';
  } else if (normalizedScene === 'STANDINGS' || normalizedScene === 'LEADERBOARD') {
    const tbody = document.getElementById('projPresLeaderboardTbody');
    if (tbody) {
      tbody.innerHTML = rankings.map((r, idx) => {
        const val = r.totalPortfolioValue || r.finalPortfolioValue || 0;
        const pnl = r.netProfitLoss !== undefined ? r.netProfitLoss : (r.netProfitOrLoss || 0);
        const retPct = r.returnPct !== undefined ? r.returnPct : 0;
        const isUp = pnl >= 0;
        return `
          <tr style="border-bottom: 1px solid var(--subtle-border); ${idx < 3 ? 'background: #FAF9F6;' : ''}">
            <td style="padding: 10px; font-weight: 800;">#${r.rank || (idx + 1)}</td>
            <td style="padding: 10px; font-family: var(--font-sans); font-weight: 800; color: var(--text-forest);">${r.teamName}</td>
            <td style="padding: 10px; text-align: right;">${formatINR(r.cash || 0)}</td>
            <td style="padding: 10px; text-align: right;">${formatINR(r.holdingsValue || 0)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 800;">${formatINR(val)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${formatINR(pnl)}
            </td>
            <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${retPct.toFixed(2)}%
            </td>
          </tr>
        `;
      }).join('');
    }
    const sceneEl = document.getElementById('projSceneStandings');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 6: 📋 FULL OFFICIAL CLASSIFICATION';
  } else {
    // Default: Intro / Settlement
    const sceneEl = document.getElementById('projSceneIntro');
    if (sceneEl) sceneEl.classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 1: ⚖️ FINAL SETTLEMENT AUDIT';
  }
}

// ==========================================
// 6. ORGANIC BEZIER CANVAS CHART ENGINE
// ==========================================
// High-FPS Bezier spline interpolation with luxury ivory & pastel palette styling
function drawSmoothBezierSparkline(canvasId, history, dayOpenPrice, isUp, isLarge = false) {
  const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
  if (!canvas || !history || history.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const prices = history.map((pt) => pt.price);
  const minP = Math.min(...prices, dayOpenPrice) * 0.998;
  const maxP = Math.max(...prices, dayOpenPrice) * 1.002;
  const range = Math.max(0.01, maxP - minP);

  const paddingY = isLarge ? 24 : 8;
  const usableH = h - paddingY * 2;

  // Map to canvas coordinate space
  const points = history.map((pt, idx) => ({
    x: (idx / (history.length - 1)) * w,
    y: h - ((pt.price - minP) / range) * usableH - paddingY
  }));

  const strokeColor = isUp ? '#218653' : '#C64B4B';
  const glowRgba = isUp ? 'rgba(33, 134, 83, 0.12)' : 'rgba(198, 75, 75, 0.12)';

  // Day Open Reference Line (subtle dashed line)
  const openY = h - ((dayOpenPrice - minP) / range) * usableH - paddingY;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#D5CEBF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, openY);
  ctx.lineTo(w, openY);
  ctx.stroke();
  ctx.restore();

  // Smooth Spline Curve using Cubic Bezier
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = isLarge ? 3.5 : 2.5;
  ctx.stroke();

  // Gradient Area Fill Under Line
  const lastPt = points[points.length - 1];
  ctx.lineTo(lastPt.x, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, glowRgba);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Price-head point
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, isLarge ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
}

// ==========================================
// 7. REAL-TIME MARKET INDICES & TOURNAMENT FLOW CONTROLLER
// ==========================================
function renderAllIndicesBars(indicesInput) {
  if (!indicesInput) return;
  const list = Array.isArray(indicesInput) ? indicesInput : Object.values(indicesInput);
  if (list.length === 0) return;

  const html = list.map((idx) => {
    const val = idx.currentValue !== undefined ? idx.currentValue : (idx.value || 0);
    const pct = idx.changePct !== undefined ? idx.changePct : 0;
    const pts = idx.change !== undefined ? idx.change : (idx.changePoints || 0);
    const isUp = pct >= 0;
    const sign = isUp ? '+' : '';
    const name = idx.name || idx.id || 'Index';

    let icon = '📊';
    if (name.includes('NIFTY') || name.includes('Benchmark') || name.includes('Broad')) icon = '🏛️';
    else if (name.includes('BANK')) icon = '🏦';
    else if (name.includes('IT') || name.includes('Tech')) icon = '💻';
    else if (name.includes('AUTO') || name.includes('Mobility')) icon = '🚗';
    else if (name.includes('ENERGY') || name.includes('Power')) icon = '⚡';
    else if (name.includes('METALS') || name.includes('Infra')) icon = '🏗️';
    else if (name.includes('CONSUMER') || name.includes('PHARMA') || name.includes('FMCG')) icon = '🛒';

    return `
      <div class="index-chip" title="${escapeHtml(name)}: ${val.toFixed(2)} (${sign}${pct.toFixed(2)}%)">
        <span style="font-size: 13px;">${icon}</span>
        <span class="index-chip-name">${escapeHtml(name.replace('Championship ', '').replace('Index', ''))}</span>
        <span class="index-chip-val">${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span class="index-chip-pct ${isUp ? 'up' : 'down'}">${sign}${pct.toFixed(2)}% ${isUp ? '▲' : '▼'}</span>
      </div>
    `;
  }).join('');

  const traderBar = document.getElementById('traderIndicesTickerBar');
  if (traderBar) traderBar.innerHTML = html;

  const hostBar = document.getElementById('hostIndicesTickerBar');
  if (hostBar) hostBar.innerHTML = html;

  const projBar = document.getElementById('projIndicesTickerBar');
  if (projBar) projBar.innerHTML = html;
}

function calculateClientIndices(companiesList) {
  if (!companiesList || !companiesList.length) return [];
  const enabled = companiesList.filter((c) => c.isEnabled !== false);
  if (enabled.length === 0) return [];

  const broadBase = 25000;
  const avgRatio = enabled.reduce((acc, c) => acc + (c.currentPrice / (c.base_price || c.dayOpenPrice || 100)), 0) / enabled.length;
  const broadVal = +(broadBase * avgRatio).toFixed(2);
  const broadChg = +(broadVal - broadBase).toFixed(2);
  const broadPct = +(((broadVal - broadBase) / broadBase) * 100).toFixed(2);

  function calcSub(id, name, sectorName, base, tickers) {
    const subs = enabled.filter((c) => tickers.includes(c.ticker));
    if (subs.length === 0) return null;
    const r = subs.reduce((acc, c) => acc + (c.currentPrice / (c.base_price || c.dayOpenPrice || 100)), 0) / subs.length;
    const v = +(base * r).toFixed(2);
    const chg = +(v - base).toFixed(2);
    const chgPct = +(((v - base) / base) * 100).toFixed(2);
    return {
      id,
      name,
      sector: sectorName,
      baseValue: base,
      currentValue: v,
      value: v,
      change: chg,
      changePoints: chg,
      changePct: chgPct,
      constituents: subs.map((s) => s.ticker),
      tickers: subs.map((s) => s.ticker),
      constituentsCount: subs.length,
      weighting: 'Equal-Weighted'
    };
  }

  return [
    {
      id: 'NIFTY_TF20',
      name: 'TTF NIFTY 20 (Benchmark)',
      sector: 'MARKET BENCHMARK',
      baseValue: broadBase,
      currentValue: broadVal,
      value: broadVal,
      change: broadChg,
      changePoints: broadChg,
      changePct: broadPct,
      constituents: enabled.map((s) => s.ticker),
      tickers: enabled.map((s) => s.ticker),
      constituentsCount: enabled.length,
      weighting: 'Equal-Weighted'
    },
    calcSub('BANK_TF', 'TTF BANK NIFTY', 'BANKING & FINANCE', 50000, ['HDFCBANK', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'CROWNBNK']),
    calcSub('IT_TF', 'TTF IT (Tech)', 'INFORMATION TECH', 35000, ['TCS', 'INFY', 'NEXUSTECH', 'CYBERINF']),
    calcSub('AUTO_TF', 'TTF AUTO (Mobility)', 'AUTOMOBILE', 22000, ['TATAMOTORS', 'MARUTI', 'M&M', 'APEXAUTO', 'VELOCAR']),
    calcSub('ENERGY_TF', 'TTF ENERGY & POWER', 'ENERGY & POWER', 18000, ['RELIANCE', 'NTPC', 'POWERGRID', 'ADANIGREEN']),
    calcSub('METALS_TF', 'TTF METALS & INFRA', 'METALS & INFRA', 12000, ['LT', 'TATASTEEL', 'JSWSTEEL']),
    calcSub('CONSUMER_TF', 'TTF CONSUMER & PHARMA', 'CONSUMER & PHARMA', 16000, ['ITC', 'HINDUNILVR', 'SUNPHARMA', 'TITAN'])
  ].filter(Boolean);
}

function updateHostTournamentFlow(state) {
  const gs = state.gameState;
  if (!gs) return;

  const day = gs.currentDay || 1;
  const total = gs.totalDays || 3;
  const isConcluded = gs.isConcluded || (day >= total && gs.elapsedSeconds >= gs.dayDurationSeconds);
  const isWinnerActive = (gs.presentationState && gs.presentationState.active) || (gs.projectorState && gs.projectorState.isWinnerActive);
  const isScheduled = gs.status === 'SCHEDULED';
  const isPre = day === 1 && (isScheduled || gs.status === 'PRE_EVENT_COUNTDOWN' || (gs.elapsedSeconds === 0 && gs.status !== 'LIVE'));
  const isStandby = (gs.status === 'STANDBY' || (gs.elapsedSeconds === 0 && gs.status !== 'LIVE' && !isPre)) && !isScheduled;
  const remSec = Math.max(0, (gs.dayDurationSeconds || 1800) - gs.elapsedSeconds);

  // Update dynamic step pills
  const dynamicStepsContainer = document.getElementById('hostDynamicFlowSteps');
  if (dynamicStepsContainer) {
    let html = '';
    html += `<span class="flow-step-pill ${isPre ? 'active' : 'completed'}">Pre-Event</span>`;
    html += `<span style="color: var(--text-muted); font-size: 11px;">➔</span>`;
    for (let i = 1; i <= total; i++) {
      let cls = 'flow-step-pill';
      if (i < day) cls += ' completed';
      else if (i === day) {
        if (gs.status === 'DAY_COMPLETED' || isConcluded) cls += ' completed';
        else cls += ' active';
      }
      html += `<span class="${cls}">Day ${i}</span>`;
      html += `<span style="color: var(--text-muted); font-size: 11px;">➔</span>`;
    }
    html += `<span class="flow-step-pill ${isWinnerActive || isConcluded ? 'active' : ''}">🏆 Winner Reveal</span>`;
    dynamicStepsContainer.innerHTML = html;
  }

  // Update legacy step pills if present
  const pPre = document.getElementById('flowStepPre');
  const pD1 = document.getElementById('flowStepDay1');
  const pD2 = document.getElementById('flowStepDay2');
  const pD3 = document.getElementById('flowStepDay3');
  const pRev = document.getElementById('flowStepReveal');

  if (pPre) pPre.className = `flow-step-pill ${isPre ? 'active' : 'completed'}`;
  if (pD1) {
    if (day === 1 && !isConcluded && !isPre) pD1.className = 'flow-step-pill active';
    else if (day > 1 || isConcluded) pD1.className = 'flow-step-pill completed';
    else pD1.className = 'flow-step-pill';
  }
  if (pD2) {
    if (day === 2 && !isConcluded) pD2.className = 'flow-step-pill active';
    else if (day > 2 || isConcluded) pD2.className = 'flow-step-pill completed';
    else pD2.className = 'flow-step-pill';
  }
  if (pD3) {
    if (day >= 3 && !isConcluded) pD3.className = 'flow-step-pill active';
    else if (isConcluded) pD3.className = 'flow-step-pill completed';
    else pD3.className = 'flow-step-pill';
  }
  if (pRev) {
    if (isConcluded || isWinnerActive) pRev.className = 'flow-step-pill active';
    else pRev.className = 'flow-step-pill';
  }

  // Update title & subtitle
  const titleEl = document.getElementById('flowStageTitle');
  const subEl = document.getElementById('flowStageSub');
  const btnEl = document.getElementById('btnFlowPrimaryAction');
  const btnPauseSoft = document.getElementById('btnHostPauseSoft');
  const btnPauseBlackout = document.getElementById('btnHostPauseBlackout');
  const btnSchedule = document.getElementById('btnFlowScheduleAction');
  const btnCancelSchedule = document.getElementById('btnFlowCancelSchedule');

  function disablePauseButtons(reason) {
    if (btnPauseSoft) {
      btnPauseSoft.disabled = true;
      btnPauseSoft.style.opacity = '0.45';
      btnPauseSoft.style.cursor = 'not-allowed';
      btnPauseSoft.title = reason;
    }
    if (btnPauseBlackout) {
      btnPauseBlackout.disabled = true;
      btnPauseBlackout.style.opacity = '0.45';
      btnPauseBlackout.style.cursor = 'not-allowed';
      btnPauseBlackout.title = reason;
    }
  }

  function enablePauseButtons() {
    if (btnPauseSoft) {
      btnPauseSoft.disabled = false;
      btnPauseSoft.style.opacity = '1';
      btnPauseSoft.style.cursor = 'pointer';
      btnPauseSoft.title = 'Freeze trading orders while keeping prices visible';
    }
    if (btnPauseBlackout) {
      btnPauseBlackout.disabled = false;
      btnPauseBlackout.style.opacity = '1';
      btnPauseBlackout.style.cursor = 'pointer';
      btnPauseBlackout.title = 'Blackout Blind';
    }
  }

  if (isWinnerActive) {
    if (titleEl) titleEl.textContent = '👑 Winner Presentation Active';
    if (subEl) subEl.textContent = `Current: ${(gs.presentationState?.scene || 'INTRO').replace('SCENE_', '')} • Synchronized with Projector`;
    if (btnEl) {
      btnEl.textContent = 'Advance Winner Scene ➔';
      btnEl.className = 'btn btn-champagne';
      btnEl.style.backgroundColor = '';
      btnEl.style.borderColor = '';
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Awards ceremony is active');
  } else if (isConcluded) {
    if (titleEl) titleEl.textContent = `🏆 All ${total} Days Completed!`;
    if (subEl) subEl.textContent = 'Books finalized • Ready for Stage Winner Presentation';
    if (btnEl) {
      btnEl.textContent = '👑 Launch Winner Reveal ➔';
      btnEl.className = 'btn btn-champagne';
      btnEl.style.backgroundColor = '';
      btnEl.style.borderColor = '';
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Championship is completed');
  } else if (isScheduled) {
    const remMs = gs.scheduledStartTime ? Math.max(0, new Date(gs.scheduledStartTime).getTime() - Date.now()) : 0;
    const schSec = Math.floor(remMs / 1000);
    if (titleEl) titleEl.textContent = `⏱️ Day ${day} Scheduled`;
    if (subEl) subEl.textContent = `Opens in ${formatMMSS(schSec)} • Terminals armed with live countdown`;
    if (btnEl) {
      btnEl.textContent = `▶ Start Day ${day} Now (Override Timer)`;
      btnEl.className = 'btn btn-primary';
      btnEl.style.backgroundColor = 'var(--price-up)';
      btnEl.style.borderColor = 'var(--price-up)';
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.remove('hidden');
    disablePauseButtons('Market is currently in scheduled countdown mode');
  } else if (isPre) {
    if (titleEl) titleEl.textContent = '⏱️ Pre-Event Setup & Waiting Room';
    if (subEl) subEl.textContent = 'Tournament Draft Ready • Press Start (3-2-1) or Schedule Timer';
    if (btnEl) {
      btnEl.textContent = '▶ Start Market (3-2-1)';
      btnEl.className = 'btn btn-primary';
      btnEl.style.backgroundColor = 'var(--price-up)';
      btnEl.style.borderColor = 'var(--price-up)';
    }
    if (btnSchedule) {
      btnSchedule.classList.remove('hidden');
      btnSchedule.textContent = '⏱️ Schedule Event Timer';
    }
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Cannot pause before market has opened');
  } else if (isStandby || gs.status === 'STANDBY') {
    if (titleEl) titleEl.textContent = `⏳ Day ${day} on Standby`;
    if (subEl) subEl.textContent = day > 1 
      ? `Day ${day - 1} concluded • Standings ready • Press Start (3-2-1) or Schedule Day ${day}`
      : `Floor Ready • Press Start (3-2-1) or Schedule Day ${day}`;
    if (btnEl) {
      btnEl.textContent = `▶ Start Day ${day} (3-2-1)`;
      btnEl.className = 'btn btn-primary';
      btnEl.style.backgroundColor = 'var(--price-up)';
      btnEl.style.borderColor = 'var(--price-up)';
    }
    if (btnSchedule) {
      btnSchedule.classList.remove('hidden');
      btnSchedule.textContent = `⏱️ Schedule Day ${day} Timer`;
    }
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Cannot pause while session is in standby');
  } else if (gs.status === 'DAY_COMPLETED') {
    if (titleEl) titleEl.textContent = `🔔 Day ${day} Concluded`;
    const isAutoEnd = !!(gs.isAutomaticEnd || gs.concludedReason === 'TIMER_EXPIRY');
    if (subEl) {
      subEl.textContent = isAutoEnd
        ? 'The trading timer has ended. Results have been finalized, and trading cannot be resumed for this day.'
        : (day < total
            ? `Daily standings saved • Ready to advance to Day ${day + 1} or extend tournament`
            : `All planned days completed • Ready for Championship Finalization`);
    }
    if (btnEl) {
      if (day < total) {
        btnEl.textContent = `▶ Start Day ${day + 1} (3-2-1)`;
        btnEl.className = 'btn btn-primary';
        btnEl.style.backgroundColor = 'var(--price-up)';
        btnEl.style.borderColor = 'var(--price-up)';
      } else {
        btnEl.textContent = `🏆 Finalize Championship & Reveal Winner`;
        btnEl.className = 'btn btn-champagne';
        btnEl.style.backgroundColor = '';
        btnEl.style.borderColor = '';
      }
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Day has concluded');
  } else if (gs.isPaused) {
    if (titleEl) titleEl.textContent = `⏸️ Day ${day} Paused (${gs.pauseMode === 'BLACKOUT' ? 'Blackout' : 'Soft Freeze'})`;
    if (subEl) subEl.textContent = `${formatMMSS(gs.elapsedSeconds)} elapsed • Press Resume to continue trading`;
    if (btnEl) {
      btnEl.textContent = '▶ Resume Trading (3-2-1)';
      btnEl.className = 'btn btn-primary';
      btnEl.style.backgroundColor = 'var(--price-up)';
      btnEl.style.borderColor = 'var(--price-up)';
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    disablePauseButtons('Market is already paused');
  } else {
    // Active Day Live Trading
    if (titleEl) titleEl.textContent = `🟢 Day ${day} of ${total} Live`;
    if (subEl) subEl.textContent = `${formatMMSS(remSec)} remaining in session • Market Active`;
    if (btnEl) {
      if (day < total) {
        btnEl.textContent = `🔔 Conclude Day ${day} (${formatMMSS(remSec)} rem)`;
        btnEl.className = 'btn btn-sage';
        btnEl.style.backgroundColor = '';
        btnEl.style.borderColor = '';
      } else {
        btnEl.textContent = `🔔 Conclude Day ${day} ➔ Finalize Champion`;
        btnEl.className = 'btn btn-champagne';
        btnEl.style.backgroundColor = '';
        btnEl.style.borderColor = '';
      }
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    enablePauseButtons();
  }

  // Synchronize Canonical Market Operations Bar in Hub 3 (Live Market)
  const btnMktResume = document.getElementById('btnMarketResume');
  const btnMktPauseSoft = document.getElementById('btnMarketPauseSoft');
  const btnMktPauseBlackout = document.getElementById('btnMarketPauseBlackout');
  const btnMktCloseSession = document.getElementById('btnMarketCloseSession');
  const mktOpsBadge = document.getElementById('marketOpsLiveBadge');

  if (mktOpsBadge) {
    if (gs.status === 'LIVE') {
      mktOpsBadge.textContent = `🟢 LIVE TRADING • DAY ${day}/${total}`;
      mktOpsBadge.className = 'badge badge-active';
    } else if (gs.status === 'DAY_COMPLETED') {
      mktOpsBadge.textContent = `🔔 DAY ${day} CONCLUDED`;
      mktOpsBadge.className = 'badge badge-champagne';
    } else if (gs.isPaused) {
      mktOpsBadge.textContent = `⏸️ PAUSED (${gs.pauseMode === 'BLACKOUT' ? 'BLACKOUT' : 'SOFT FREEZE'})`;
      mktOpsBadge.className = 'badge badge-paused';
    } else if (gs.status === 'COUNTDOWN') {
      mktOpsBadge.textContent = `⏱️ COUNTDOWN IN PROGRESS (3-2-1)`;
      mktOpsBadge.className = 'badge badge-active';
    } else if (isConcluded || isWinnerActive) {
      mktOpsBadge.textContent = `🏆 CHAMPIONSHIP COMPLETE`;
      mktOpsBadge.className = 'badge badge-champagne';
    } else {
      mktOpsBadge.textContent = `⏳ DAY ${day} STANDBY`;
      mktOpsBadge.className = 'badge badge-champagne';
    }
  }

  if (btnMktResume && btnMktPauseSoft && btnMktPauseBlackout && btnMktCloseSession) {
    if (gs.status === 'LIVE') {
      btnMktResume.classList.add('hidden');
      btnMktResume.disabled = true;

      btnMktPauseSoft.classList.remove('hidden');
      btnMktPauseSoft.disabled = false;
      btnMktPauseSoft.title = 'Freeze trading orders while keeping prices visible to participants';

      btnMktPauseBlackout.classList.remove('hidden');
      btnMktPauseBlackout.disabled = false;
      btnMktPauseBlackout.title = 'Blackout Blind: Hide prices and freeze trading';

      btnMktCloseSession.classList.remove('hidden');
      btnMktCloseSession.disabled = false;
      btnMktCloseSession.textContent = `🔔 Conclude Day ${day}`;
      btnMktCloseSession.className = 'btn btn-outline';
      btnMktCloseSession.style.borderColor = '#2563EB';
      btnMktCloseSession.style.color = '#1D4ED8';
      btnMktCloseSession.style.background = '';
      btnMktCloseSession.onclick = () => openConcludeDayModal();
    } else if (gs.isPaused) {
      btnMktResume.classList.remove('hidden');
      btnMktResume.disabled = false;
      btnMktResume.textContent = '▶ Resume 3-2-1';
      btnMktResume.title = 'Resume live trading with 3-2-1 voice countdown';
      btnMktResume.onclick = () => hostResumeMarket();

      btnMktPauseSoft.classList.add('hidden');
      btnMktPauseSoft.disabled = true;

      btnMktPauseBlackout.classList.add('hidden');
      btnMktPauseBlackout.disabled = true;

      btnMktCloseSession.classList.remove('hidden');
      btnMktCloseSession.disabled = false;
      btnMktCloseSession.textContent = `🔔 Conclude Day ${day}`;
      btnMktCloseSession.className = 'btn btn-outline';
      btnMktCloseSession.style.borderColor = '#2563EB';
      btnMktCloseSession.style.color = '#1D4ED8';
      btnMktCloseSession.style.background = '';
      btnMktCloseSession.onclick = () => openConcludeDayModal();
    } else if (gs.status === 'DAY_COMPLETED') {
      btnMktResume.classList.add('hidden');
      btnMktResume.disabled = true;

      btnMktPauseSoft.classList.add('hidden');
      btnMktPauseSoft.disabled = true;

      btnMktPauseBlackout.classList.add('hidden');
      btnMktPauseBlackout.disabled = true;

      btnMktCloseSession.classList.remove('hidden');
      btnMktCloseSession.disabled = false;
      if (day < total) {
        btnMktCloseSession.textContent = `▶ Start Day ${day + 1} (3-2-1)`;
        btnMktCloseSession.className = 'btn btn-primary';
        btnMktCloseSession.style.background = 'var(--price-up)';
        btnMktCloseSession.style.borderColor = 'var(--price-up)';
        btnMktCloseSession.style.color = '#FFFFFF';
        btnMktCloseSession.onclick = () => openStartNextDayModal();
      } else {
        btnMktCloseSession.textContent = '🏆 Finalize Championship & Reveal Winner';
        btnMktCloseSession.className = 'btn btn-champagne';
        btnMktCloseSession.style.background = '';
        btnMktCloseSession.style.borderColor = '';
        btnMktCloseSession.style.color = '';
        btnMktCloseSession.onclick = () => hostStartWinnerPresentation();
      }
    } else if (gs.status === 'STANDBY' || isPre) {
      btnMktResume.classList.remove('hidden');
      btnMktResume.disabled = false;
      btnMktResume.textContent = `▶ Start Day ${day} (3-2-1)`;
      btnMktResume.title = 'Open market and start live trading with 3-2-1 voice countdown';
      btnMktResume.onclick = () => hostResumeMarket();

      btnMktPauseSoft.classList.add('hidden');
      btnMktPauseSoft.disabled = true;

      btnMktPauseBlackout.classList.add('hidden');
      btnMktPauseBlackout.disabled = true;

      btnMktCloseSession.classList.add('hidden');
      btnMktCloseSession.disabled = true;
    } else if (gs.status === 'COUNTDOWN') {
      btnMktResume.disabled = true;
      btnMktPauseSoft.disabled = true;
      btnMktPauseBlackout.disabled = true;
      btnMktCloseSession.disabled = true;
    } else if (isConcluded || isWinnerActive) {
      btnMktResume.classList.add('hidden');
      btnMktPauseSoft.classList.add('hidden');
      btnMktPauseBlackout.classList.add('hidden');
      btnMktCloseSession.classList.remove('hidden');
      btnMktCloseSession.disabled = false;
      btnMktCloseSession.textContent = '👑 Winner Presentation';
      btnMktCloseSession.className = 'btn btn-champagne';
      btnMktCloseSession.onclick = () => hostStartWinnerPresentation();
    }
  }

  // Render Persistent Contextual Operation Buttons in Flow Actions Container
  const actionsContainer = document.getElementById('hostFlowActionsContainer');
  if (actionsContainer) {
    let actHtml = '';
    if (gs.status === 'LIVE') {
      actHtml += `<button type="button" onclick="openConcludeDayModal()" class="btn btn-sage" style="font-weight: 700;">🔔 Conclude Day ${day}</button>`;
      actHtml += `<button type="button" onclick="hostPauseMarket('VISIBLE_FROZEN')" class="btn btn-outline" style="font-weight: 700;">⏸ Pause</button>`;
      actHtml += `<button type="button" onclick="hostPauseMarket('BLACKOUT')" class="btn btn-outline" style="font-weight: 700;">🕶️ Blackout</button>`;
      actHtml += `<button type="button" onclick="openCircuitHaltTestModal()" class="btn btn-outline" style="font-weight: 700; border-color: #F59E0B; color: #B45309;" title="Test real-world Upper or Lower circuit limit halts live">⚡ Test Circuit</button>`;
      actHtml += `<button type="button" onclick="openEmergencyStopModal()" class="btn btn-danger" style="font-weight: 700; background: #991B1B; color: #FFF; border: none;">🛑 Emergency Stop</button>`;
    } else if (gs.status === 'DAY_COMPLETED' || gs.status === 'STANDBY' || gs.status === 'MARKET_CLOSED') {
      if (day < total) {
        actHtml += `<button type="button" onclick="openStartNextDayModal()" class="btn btn-primary" style="font-weight: 700; background: var(--price-up); border: none;">▶ Start Day ${day + 1} (3-2-1)</button>`;
        actHtml += `<button type="button" onclick="openAddDayModal()" class="btn btn-outline" style="font-weight: 700;">➕ Add Next Day (Extend to Day ${total + 1})</button>`;
        actHtml += `<button type="button" onclick="openFinishEventModal()" class="btn btn-champagne" style="font-weight: 700;">🏆 Finish Event Early</button>`;
      } else {
        actHtml += `<button type="button" onclick="hostStartWinnerPresentation()" class="btn btn-champagne" style="font-weight: 700;">🏆 Finalize Championship & Reveal Winner</button>`;
        actHtml += `<button type="button" onclick="openAddDayModal()" class="btn btn-outline" style="font-weight: 700;">➕ Add Next Day (Extend to Day ${total + 1})</button>`;
      }
    } else if (gs.isPaused) {
      actHtml += `<button type="button" onclick="hostResumeMarket()" class="btn btn-primary" style="font-weight: 700; background: var(--price-up); border: none;">▶ Resume Trading (3-2-1)</button>`;
      actHtml += `<button type="button" onclick="openConcludeDayModal()" class="btn btn-sage" style="font-weight: 700;">🔔 Conclude Day ${day}</button>`;
    } else if (gs.status === 'EMERGENCY_STOP') {
      actHtml += `<button type="button" onclick="hostResumeMarket()" class="btn btn-primary" style="font-weight: 700; background: var(--price-up); border: none;">▶ Resume from Emergency Halt</button>`;
      actHtml += `<button type="button" onclick="openConcludeDayModal()" class="btn btn-sage" style="font-weight: 700;">🔔 Conclude Day ${day}</button>`;
    }
    actionsContainer.innerHTML = actHtml;
  }

  // Update Next Step Hero Card in Hub 1 Overview
  const nextIcon = document.getElementById('nextStepIcon');
  const nextTitle = document.getElementById('nextStepTitle');
  const nextDesc = document.getElementById('nextStepDesc');
  const nextBadgePhase = document.getElementById('nextStepBadgePhase');
  const nextBtn = document.getElementById('btnNextStepAction');
  const nextHint = document.getElementById('nextStepSecondaryHint');

  // Update Readiness Checklist Tiles
  const chkTeams = document.getElementById('chkTextTeams');
  const chkUniv = document.getElementById('chkTextUniverse');
  const chkSched = document.getElementById('chkTextSchedule');
  const chkNews = document.getElementById('chkTextNews');
  const chkLock = document.getElementById('chkTextLock');
  const chkLockIcon = document.getElementById('chkIconLock');

  if (chkTeams) {
    const teamCount = (state.allTeamsList && state.allTeamsList.length) || (state.teams && Object.keys(state.teams).length) || 16;
    chkTeams.textContent = `${teamCount} Teams Configured & Ready`;
  }
  if (chkUniv) {
    const totalUniv = (state.allCompaniesUniverse && state.allCompaniesUniverse.length) || (state.companies && state.companies.length) || 20;
    const activeUniv = (state.allCompaniesUniverse || state.companies || []).filter((c) => c.isEnabled !== false).length;
    chkUniv.textContent = `${activeUniv} / ${totalUniv} Companies Active`;
  }
  if (chkSched) {
    chkSched.textContent = `Day ${day}/${total} • ${formatMMSS(gs.dayDurationSeconds || 1800)} Duration`;
  }
  if (chkNews) {
    const newsCount = (state.newsEvents && state.newsEvents.length) || 12;
    chkNews.textContent = `${newsCount} Stories Scheduled & Ready`;
  }
  if (chkLock && chkLockIcon) {
    if (gs.configLocked) {
      chkLock.textContent = 'Configuration Locked (Frozen)';
      chkLockIcon.textContent = '🔒';
    } else {
      chkLock.textContent = 'Draft Setup Mode (Unlocked)';
      chkLockIcon.textContent = '🔓';
    }
  }

  // Update Next Step card content based on authoritative state:
  if (isWinnerActive) {
    if (nextIcon) nextIcon.textContent = '👑';
    if (nextBadgePhase) nextBadgePhase.textContent = 'CEREMONY MODE';
    if (nextTitle) nextTitle.textContent = 'Winner Presentation Active on Stage';
    if (nextDesc) nextDesc.textContent = `Currently projecting ${(gs.presentationState?.scene || 'INTRO').replace('SCENE_', '')}. Use Stage & Sound controls or Projector remote to advance scenes.`;
    if (nextBtn) {
      nextBtn.textContent = 'Advance Winner Scene ➔';
      nextBtn.className = 'btn btn-champagne';
    }
    if (nextHint) nextHint.textContent = 'State: WINNER_ANNOUNCEMENT';
  } else if (isConcluded) {
    if (nextIcon) nextIcon.textContent = '🏆';
    if (nextBadgePhase) nextBadgePhase.textContent = 'TOURNAMENT COMPLETE';
    if (nextTitle) nextTitle.textContent = `All ${total} Competition Days Completed!`;
    if (nextDesc) nextDesc.textContent = 'All student trades and closing prices have been finalized. The audited standings are ready for the ceremonial reveal.';
    if (nextBtn) {
      nextBtn.textContent = '👑 Launch Winner Presentation ➔';
      nextBtn.className = 'btn btn-champagne';
    }
    if (nextHint) nextHint.textContent = 'State: CONCLUDED';
  } else if (isScheduled) {
    const remMs = gs.scheduledStartTime ? Math.max(0, new Date(gs.scheduledStartTime).getTime() - Date.now()) : 0;
    const schSec = Math.floor(remMs / 1000);
    if (nextIcon) nextIcon.textContent = '⏱️';
    if (nextBadgePhase) nextBadgePhase.textContent = 'ARMED COUNTDOWN';
    if (nextTitle) nextTitle.textContent = `Market Scheduled to Open in ${formatMMSS(schSec)}`;
    if (nextDesc) nextDesc.textContent = `Session will automatically launch at ${new Date(gs.scheduledStartTime).toLocaleTimeString()}. Trading desks are displaying the synchronized countdown.`;
    if (nextBtn) {
      nextBtn.textContent = `▶ Open Floor Immediately ➔`;
      nextBtn.className = 'btn btn-primary';
    }
    if (nextHint) nextHint.textContent = `Scheduled target: ${new Date(gs.scheduledStartTime).toLocaleTimeString()}`;
  } else if (!gs.configLocked && gs.status === 'STANDBY' && gs.elapsedSeconds === 0) {
    if (nextIcon) nextIcon.textContent = '🔒';
    if (nextBadgePhase) nextBadgePhase.textContent = 'PRE-EVENT REVIEW';
    if (nextTitle) nextTitle.textContent = 'Review Setup & Lock Tournament';
    if (nextDesc) nextDesc.textContent = 'Tournament parameters, starting capital, and stock universe are in draft mode. Review the configuration and confirm the lock before market launch.';
    if (nextBtn) {
      nextBtn.textContent = '🔒 Review & Lock Event ➔';
      nextBtn.className = 'btn btn-primary';
    }
    if (nextHint) nextHint.textContent = 'Configuration is currently editable';
  } else if (gs.status === 'DAY_COMPLETED') {
    if (nextIcon) nextIcon.textContent = '🔔';
    if (nextBadgePhase) nextBadgePhase.textContent = day < total ? `DAY ${day} CONCLUDED` : 'ALL SESSIONS COMPLETED';
    if (nextTitle) nextTitle.textContent = day < total ? `Day ${day} Results Audited & Standings Saved` : `All ${total} Days Completed — Standings Finalized`;
    if (nextDesc) nextDesc.textContent = day < total
      ? `Day ${day} trading session is officially concluded. Daily student portfolios are locked. Review audited standings or launch Day ${day + 1} with synchronized countdown.`
      : 'All tournament trading sessions have concluded. All portfolios are locked for ceremonial winner announcement.';
    if (nextBtn) {
      nextBtn.textContent = day < total ? `▶ Start Day ${day + 1} (3-2-1) ➔` : '🏆 Finalize Champion & Reveal Winner ➔';
      nextBtn.className = day < total ? 'btn btn-primary' : 'btn btn-champagne';
    }
    if (nextHint) nextHint.textContent = day < total ? `Awaiting Host command to start Day ${day + 1}` : 'Championship ready for ceremonial reveal';
  } else if (gs.isPaused) {
    if (nextIcon) nextIcon.textContent = '⏸️';
    if (nextBadgePhase) nextBadgePhase.textContent = gs.pauseMode === 'BLACKOUT' ? 'BLACKOUT PAUSE' : 'SOFT FREEZE';
    if (nextTitle) nextTitle.textContent = `Market is Paused (${gs.pauseMode === 'BLACKOUT' ? 'Blind Blackout' : 'Prices Visible'})`;
    if (nextDesc) nextDesc.textContent = 'Trading orders are frozen on all student desks. When ready to resume, click below to trigger a synchronized 3-2-1 countdown across all screens.';
    if (nextBtn) {
      nextBtn.textContent = '▶ Resume Market (3-2-1 Countdown) ➔';
      nextBtn.className = 'btn btn-primary';
    }
    if (nextHint) nextHint.textContent = `Paused at ${formatMMSS(gs.elapsedSeconds)}`;
  } else if (gs.status === 'LIVE') {
    if (nextIcon) nextIcon.textContent = '🟢';
    if (nextBadgePhase) nextBadgePhase.textContent = 'LIVE FLOOR';
    if (nextTitle) nextTitle.textContent = `Day ${day} Active Trading Session`;
    if (nextDesc) nextDesc.textContent = `${formatMMSS(remSec)} remaining in session. Orders are executing dynamically. Monitor halts and news shocks on the Live Floor.`;
    if (nextBtn) {
      nextBtn.textContent = '📈 Go to Live Floor ➔';
      nextBtn.className = 'btn btn-sage';
    }
    if (nextHint) nextHint.textContent = `Clock: ${formatMMSS(gs.elapsedSeconds)} / ${formatMMSS(gs.dayDurationSeconds || 1800)}`;
  } else if (isStandby) {
    if (nextIcon) nextIcon.textContent = '▶';
    if (nextBadgePhase) nextBadgePhase.textContent = `DAY ${day} STANDBY`;
    if (nextTitle) nextTitle.textContent = `Day ${day} Floor Ready to Launch`;
    if (nextDesc) nextDesc.textContent = day > 1
      ? `Day ${day - 1} results finalized. Ready to launch Day ${day} trading session with synchronized 3-2-1 countdown.`
      : 'Configuration locked. All trading terminals are armed. Click to start market with synchronized 3-2-1 countdown.';
    if (nextBtn) {
      nextBtn.textContent = `▶ Start Day ${day} (3-2-1) ➔`;
      nextBtn.className = 'btn btn-primary';
    }
    if (nextHint) nextHint.textContent = 'Standby mode: awaiting start command';
  }
}

// ==========================================
// DISTINCT LIFECYCLE MODAL CONTROLLERS
// ==========================================
function openConcludeDayModal() {
  const gs = latestState?.gameState;
  const day = gs?.currentDay || 1;
  const el = document.getElementById('concludeDayConfirmText');
  if (el) el.textContent = `Are you sure you want to conclude Day ${day}? This will stop active trading, freeze positions, and save audited Day ${day} leaderboard records.`;
  const m = document.getElementById('modalConcludeDay');
  if (m) m.classList.remove('hidden');
}
function closeConcludeDayModal() {
  const m = document.getElementById('modalConcludeDay');
  if (m) m.classList.add('hidden');
}
let lastConcludeDayActionTime = 0;
function executeConcludeDay() {
  closeConcludeDayModal();
  if (Date.now() - lastConcludeDayActionTime < 500) return;
  lastConcludeDayActionTime = Date.now();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: sessionToken }));
  }
}

function openStartNextDayModal() {
  const gs = latestState?.gameState;
  const nextDay = (gs?.currentDay || 1) + 1;
  const el = document.getElementById('startNextDayConfirmText');
  if (el) el.textContent = `Ready to begin Day ${nextDay}? Cash and holdings from Day ${nextDay - 1} carry over seamlessly, and Day ${nextDay} news events will be loaded.`;
  const m = document.getElementById('modalStartNextDay');
  if (m) m.classList.remove('hidden');
}
function closeStartNextDayModal() {
  const m = document.getElementById('modalStartNextDay');
  if (m) m.classList.add('hidden');
}
let lastStartNextDayActionTime = 0;
function executeStartNextDay() {
  closeStartNextDayModal();
  if (Date.now() - lastStartNextDayActionTime < 500) return;
  lastStartNextDayActionTime = Date.now();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_START_NEXT_DAY', session_token: sessionToken }));
  }
}

function executeStartNextDayAndSchedule() {
  closeStartNextDayModal();
  if (Date.now() - lastStartNextDayActionTime < 500) return;
  lastStartNextDayActionTime = Date.now();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_START_NEXT_DAY', session_token: sessionToken }));
  }
  setTimeout(() => {
    openScheduleEventModal();
  }, 400);
}

function openAddDayModal() {
  const gs = latestState?.gameState;
  const total = gs?.totalDays || 3;
  const newTotal = total + 1;
  const el = document.getElementById('addDayConfirmText');
  if (el) el.textContent = `Extend tournament from ${total} days to ${newTotal} days? All previous day snapshots, portfolios, and historical records are strictly preserved, and new balanced news stories will be scheduled for Day ${newTotal}.`;
  const m = document.getElementById('modalAddDay');
  if (m) m.classList.remove('hidden');
}
function closeAddDayModal() {
  const m = document.getElementById('modalAddDay');
  if (m) m.classList.add('hidden');
}
function executeAddDay() {
  closeAddDayModal();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_ADD_DAY', session_token: sessionToken }));
  }
}

function openFinishEventModal() {
  const m = document.getElementById('modalFinishEvent');
  if (m) m.classList.remove('hidden');
}
function closeFinishEventModal() {
  const m = document.getElementById('modalFinishEvent');
  if (m) m.classList.add('hidden');
}
function executeFinishEvent() {
  closeFinishEventModal();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_FINISH_EVENT', session_token: sessionToken }));
  }
}

function openEmergencyStopModal() {
  if (latestState && latestState.gameState && latestState.gameState.isPaused) {
    showOrderToast('⏸️ Market is already paused / halted. Use "Resume" to restart trading.', false);
    return;
  }
  const m = document.getElementById('modalEmergencyStop');
  if (m) m.classList.remove('hidden');
}
function closeEmergencyStopModal() {
  const m = document.getElementById('modalEmergencyStop');
  if (m) m.classList.add('hidden');
}
function closeLifecycleModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}
function executeEmergencyStop() {
  closeEmergencyStopModal();
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_EMERGENCY_STOP', session_token: sessionToken }));
  }
}

function openCircuitHaltTestModal() {
  const m = document.getElementById('modalCircuitTest');
  const sel = document.getElementById('circuitTestStockSelect');
  if (sel && latestState && latestState.companies) {
    const active = latestState.companies.filter((c) => c.isEnabled !== false);
    sel.innerHTML = active.map((c) => {
      const cur = Number(c.currentPrice || 0);
      const haltNote = c.isHalted ? ` [HALTED: ${c.haltDirection || 'CIRCUIT'}]` : '';
      return `<option value="${c.ticker}">${c.ticker} — ${c.name || c.ticker} (₹${cur.toFixed(2)})${haltNote}</option>`;
    }).join('');
  }
  if (m) m.classList.remove('hidden');
}

function closeCircuitTestModal() {
  const m = document.getElementById('modalCircuitTest');
  if (m) m.classList.add('hidden');
}

function triggerCircuitTest(direction) {
  const sel = document.getElementById('circuitTestStockSelect');
  if (!sel || !sel.value) {
    showOrderToast('Please select a stock first.', false);
    return;
  }
  const ticker = sel.value;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showOrderToast('WebSocket connection is offline.', false);
    return;
  }

  if (direction === 'RELEASE') {
    ws.send(JSON.stringify({
      action: 'HOST_UNHALT_STOCK',
      ticker,
      session_token: sessionToken
    }));
    showOrderToast(`🔓 Released circuit halt for ${ticker}. Normal trading resumed.`, true);
  } else {
    ws.send(JSON.stringify({
      action: 'HOST_TRIGGER_CIRCUIT_BREAKER',
      ticker,
      direction,
      session_token: sessionToken
    }));
    showOrderToast(`⚡ Circuit Breaker triggered on ${ticker} (${direction} Limit).`, true);
  }
  closeCircuitTestModal();
}

// Inline confirm action — no blocking browser dialogs
let pendingFlowAction = null;
let pendingFlowActionTimeout = null;

function handleFlowPrimaryAction() {
  if (!latestState || !latestState.gameState) return;
  const gs = latestState.gameState;
  const day = gs.currentDay || 1;
  const total = gs.totalDays || 3;
  const isConcluded = gs.isConcluded || (day >= total && gs.elapsedSeconds >= gs.dayDurationSeconds);
  const isWinnerActive = (gs.presentationState && gs.presentationState.active) || (gs.projectorState && gs.projectorState.isWinnerActive);

  if (isWinnerActive) {
    presNextScene();
    return;
  }

  if (isConcluded) {
    hostStartWinnerPresentation();
    return;
  }

  if (gs.status === 'SCHEDULED' || gs.status === 'PRE_EVENT_COUNTDOWN' || gs.status === 'STANDBY' || (gs.elapsedSeconds === 0 && gs.status !== 'LIVE')) {
    hostResumeMarket();
    return;
  }

  if (gs.status === 'DAY_COMPLETED') {
    if (day < total) {
      openStartNextDayModal();
    } else {
      hostStartWinnerPresentation();
    }
    return;
  }

  if (gs.isPaused) {
    hostResumeMarket();
    return;
  }

  // Active trading
  if (day < total) {
    openConcludeDayModal();
  } else {
    openFinishEventModal();
  }
}

// Conclude the current day: finalize snapshot + advance to next day
function hostConcludeAndAdvanceDay() {
  if (!ws || !sessionToken) return;
  // Step 1: Finalize current day's official results snapshot
  ws.send(JSON.stringify({ action: 'HOST_FINALIZE_DAY', session_token: sessionToken }));
  // Step 2: Advance to next day after a short delay to let finalization broadcast first
  setTimeout(() => {
    ws.send(JSON.stringify({ action: 'HOST_NEXT_DAY', session_token: sessionToken }));
    showOrderToast(`✓ Day finalized and advanced. Day ${(latestState?.gameState?.currentDay || 1) + 1} standby mode active.`, true);
  }, 600);
}

// Toast-based inline confirmation (no browser dialogs)
let _inlineConfirmTimeout = null;
function showInlineConfirmToast(message, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
  if (_inlineConfirmTimeout) clearTimeout(_inlineConfirmTimeout);
  const toast = document.getElementById('orderToast');
  if (!toast) { onConfirm(); return; }

  if (orderToastTimeout) clearTimeout(orderToastTimeout);

  toast.innerHTML = `
    <span style="flex: 1; word-break: break-word;">${message}</span>
    <button onclick="_resolveInlineConfirm(true)" style="background: var(--price-up); border: none; color: white; cursor: pointer; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 12px; margin-left: 8px; flex-shrink: 0;">${confirmLabel}</button>
    <button onclick="_resolveInlineConfirm(false)" style="background: none; border: 1px solid rgba(255,255,255,0.4); color: inherit; cursor: pointer; padding: 4px 10px; border-radius: 4px; font-size: 12px; margin-left: 6px; flex-shrink: 0;">${cancelLabel}</button>
  `;
  toast.className = 'toast-notice toast-error'; // amber-ish
  toast.style.background = '#92400E';
  toast.style.color = '#FEF3C7';
  toast.classList.remove('hidden');

  window._pendingInlineConfirmCallback = onConfirm;
  _inlineConfirmTimeout = setTimeout(() => { _resolveInlineConfirm(false); }, 12000);
}

function _resolveInlineConfirm(confirmed) {
  if (_inlineConfirmTimeout) clearTimeout(_inlineConfirmTimeout);
  const toast = document.getElementById('orderToast');
  if (toast) toast.classList.add('hidden');
  toast.style.background = '';
  toast.style.color = '';
  if (confirmed && typeof window._pendingInlineConfirmCallback === 'function') {
    window._pendingInlineConfirmCallback();
  }
  window._pendingInlineConfirmCallback = null;
}

// ==========================================
// 8. HOST MATRIX CONTROLLER RENDERER & ACTIONS
// ==========================================
const HOST_PRIMARY_HUBS = ['home', 'event', 'market', 'stage'];
const HOST_TAB_ALIASES = {
  'home': 'home',
  'overview': 'home',
  'event': 'event',
  'setup': 'event',
  'universe': 'event',
  'companies': 'event',
  'launcher': 'event',
  'market': 'market',
  'floor': 'market',
  'stocks': 'market',
  'news': 'market',
  'leaderboard': 'market',
  'trades': 'market',
  'stage': 'stage',
  'results': 'stage',
  'reports': 'stage',
  'projector': 'stage',
  'sound': 'stage',
  'commentary': 'stage',
  'analysis': 'stage',
  'day': 'stage',
  'exports': 'stage'
};

function switchHostTab(tabName) {
  const targetHub = HOST_TAB_ALIASES[tabName] || tabName;
  activeHostTab = tabName;

  // Confidentiality safeguard: always re-hide private news impacts when leaving market view
  if (targetHub !== 'market') {
    hidePrivateNewsDetailsNow();
  }

  HOST_PRIMARY_HUBS.forEach((hub) => {
    const btn = document.getElementById(`hostTabBtn${hub.charAt(0).toUpperCase() + hub.slice(1)}`);
    const content = document.getElementById(`hostTabContent${hub.charAt(0).toUpperCase() + hub.slice(1)}`);
    if (btn) btn.className = hub === targetHub ? 'btn btn-sage' : 'btn btn-outline';
    if (content) {
      if (hub === targetHub) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });

  // Backward compatibility alias button styles & panels:
  const legacyMap = {
    'home': ['overview'],
    'event': ['setup', 'universe', 'launcher'],
    'market': ['floor', 'stocks', 'news', 'leaderboard', 'trades'],
    'stage': ['reports', 'projector', 'sound', 'commentary', 'day', 'analysis', 'exports']
  };

  Object.keys(legacyMap).forEach((hub) => {
    legacyMap[hub].forEach((sub) => {
      const subBtn = document.getElementById(`hostTabBtn${sub.charAt(0).toUpperCase() + sub.slice(1)}`);
      const subContent = document.getElementById(`hostTabContent${sub.charAt(0).toUpperCase() + sub.slice(1)}`);
      if (subBtn) {
        subBtn.className = (sub === tabName || hub === targetHub) ? 'btn btn-sage' : 'btn btn-outline';
      }
      if (subContent) {
        if (hub === targetHub) {
          subContent.classList.remove('hidden');
        } else {
          subContent.classList.add('hidden');
        }
      }
    });
  });

  // If a specific setup section was requested
  if (targetHub === 'event') {
    if (tabName === 'universe' || tabName === 'companies') switchSetupSection('universe');
    else if (tabName === 'launcher') switchSetupSection('teams');
  }

  if (targetHub === 'stage' && currentRole === 'HOST') {
    hostRefreshCheckpoints();
  }

  if (latestState) {
    renderHostView(latestState);
  }
}

// ==========================================
// GUIDED EVENT SETUP CONTROLLER (#eventSetupView)
// ==========================================

const DEFAULT_CATALOGUE_COMPANIES = [
  { ticker: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy & Conglomerate', base_price: 2950, beta: 1.05, exchange: 'NSE' },
  { ticker: 'TATAMOTORS', name: 'Tata Motors Passenger & Commercial', sector: 'Automobile', base_price: 980, beta: 1.40, exchange: 'NSE' },
  { ticker: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Automobile', base_price: 12400, beta: 0.85, exchange: 'NSE' },
  { ticker: 'M&M', name: 'Mahindra & Mahindra', sector: 'Automobile', base_price: 2850, beta: 1.15, exchange: 'NSE' },
  { ticker: 'TCS', name: 'Tata Consultancy Services', sector: 'Information Technology', base_price: 4150, beta: 0.75, exchange: 'NSE' },
  { ticker: 'INFY', name: 'Infosys', sector: 'Information Technology', base_price: 1880, beta: 1.10, exchange: 'NSE' },
  { ticker: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', base_price: 1680, beta: 0.95, exchange: 'NSE' },
  { ticker: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', base_price: 1240, beta: 1.05, exchange: 'NSE' },
  { ticker: 'SBIN', name: 'State Bank of India', sector: 'Banking', base_price: 820, beta: 1.30, exchange: 'NSE' },
  { ticker: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Banking', base_price: 7200, beta: 1.25, exchange: 'NSE' },
  { ticker: 'LT', name: 'Larsen & Toubro', sector: 'Conglomerate', base_price: 3600, beta: 1.10, exchange: 'NSE' },
  { ticker: 'AIRTEL', name: 'Bharti Airtel', sector: 'Conglomerate', base_price: 1550, beta: 0.80, exchange: 'NSE' },
  { ticker: 'ITC', name: 'ITC Limited', sector: 'Consumer', base_price: 490, beta: 0.65, exchange: 'NSE' },
  { ticker: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'Consumer', base_price: 2750, beta: 0.60, exchange: 'NSE' },
  { ticker: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries', sector: 'Pharma', base_price: 1720, beta: 0.70, exchange: 'NSE' },
  { ticker: 'NTPC', name: 'NTPC Limited', sector: 'Energy', base_price: 410, beta: 0.90, exchange: 'NSE' },
  { ticker: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Energy', base_price: 340, beta: 0.70, exchange: 'NSE' },
  { ticker: 'TATASTEEL', name: 'Tata Steel', sector: 'Metals', base_price: 165, beta: 1.35, exchange: 'NSE' },
  { ticker: 'JSWSTEEL', name: 'JSW Steel', sector: 'Metals', base_price: 980, beta: 1.25, exchange: 'NSE' },
  { ticker: 'TITAN', name: 'Titan Company', sector: 'Consumer', base_price: 3450, beta: 1.05, exchange: 'NSE' }
];

let setupSelectedTickers = new Set(DEFAULT_CATALOGUE_COMPANIES.map((c) => c.ticker));
let setupCatalogueSearchTerm = '';
let setupCatalogueSectorFilter = 'ALL';
let setupInitialized = false;
let activeSetupSection = 'details';
let setupCurrentTeamsList = [];

function updateLoginEventStatusBanner(state) {
  const banner = document.getElementById('loginEventStatusBanner');
  if (!banner) return;
  const iconEl = document.getElementById('loginEventStatusIcon');
  const titleEl = document.getElementById('loginEventStatusTitle');
  const descEl = document.getElementById('loginEventStatusDesc');

  const gs = (state && state.gameState) ? state.gameState : (state && state.configLocked !== undefined ? state : {});
  const isLocked = !!gs.configLocked;
  const status = gs.status || 'SETUP';

  if (!isLocked && status === 'SETUP') {
    if (iconEl) iconEl.textContent = '⏳';
    if (titleEl) {
      titleEl.textContent = 'COMPETITION SETUP IN PROGRESS';
      titleEl.style.color = 'var(--warning-amber)';
    }
    if (descEl) {
      descEl.textContent = 'The host is configuring tournament settings and stock universe. Team logins will unlock live.';
    }
    banner.style.borderColor = 'var(--subtle-border)';
    banner.style.background = 'var(--surface-cream)';
  } else if (status === 'LIVE' || status === 'COUNTDOWN') {
    if (iconEl) iconEl.textContent = '🟢';
    if (titleEl) {
      titleEl.textContent = `FLOOR LIVE • DAY ${gs.currentDay || 1} IN PROGRESS`;
      titleEl.style.color = 'var(--price-up)';
    }
    if (descEl) {
      descEl.textContent = 'Trading session is currently active. All configured team terminals may connect.';
    }
    banner.style.borderColor = 'var(--price-up)';
    banner.style.background = '#F0FDF4';
  } else if (status === 'DAY_COMPLETED') {
    if (iconEl) iconEl.textContent = '🔔';
    if (titleEl) {
      titleEl.textContent = `DAY ${gs.currentDay || 1} CONCLUDED • LOGINS ACTIVE`;
      titleEl.style.color = '#3f6292';
    }
    if (descEl) {
      descEl.textContent = `Day ${gs.currentDay || 1} trading has ended. Teams may log in to review final portfolio standings.`;
    }
    banner.style.borderColor = '#3f6292';
    banner.style.background = 'rgba(63, 98, 146, 0.06)';
  } else if (status === 'COMPLETED' || gs.isConcluded) {
    if (iconEl) iconEl.textContent = '🏆';
    if (titleEl) {
      titleEl.textContent = 'CHAMPIONSHIP CONCLUDED';
      titleEl.style.color = '#B45309';
    }
    if (descEl) {
      descEl.textContent = 'All competition days have finished. Final rankings and awards are permanently recorded.';
    }
    banner.style.borderColor = 'var(--champagne-accent)';
    banner.style.background = '#FFFBEB';
  } else {
    // STANDBY or config locked
    if (iconEl) iconEl.textContent = '🟢';
    if (titleEl) {
      titleEl.textContent = 'COMPETITION READY • LOGINS OPEN';
      titleEl.style.color = 'var(--price-up)';
    }
    if (descEl) {
      descEl.textContent = 'Tournament setup is locked and confirmed. All team credentials are active.';
    }
    banner.style.borderColor = 'var(--price-up)';
    banner.style.background = '#F0FDF4';
  }
}

function initOrRestoreEventSetup() {
  let draft = null;
  try {
    const raw = localStorage.getItem('ttf_setup_draft');
    if (raw) draft = JSON.parse(raw);
  } catch (e) {}

  const gs = (latestState && latestState.gameState) || {};

  // Step 1: Details
  const titleEl = document.getElementById('setupEventTitle');
  const instEl = document.getElementById('setupInstitution');
  const cashEl = document.getElementById('setupStartingCash');
  const daysEl = document.getElementById('setupTotalDays');
  const durEl = document.getElementById('setupDayDuration');
  const feeEl = document.getElementById('setupTransactionFee');
  const cbEl = document.getElementById('setupCircuitBreaker');
  const riskEl = document.getElementById('setupRiskProfile');

  if (titleEl) titleEl.value = (draft && draft.title) || gs.title || 'The Trading Floor Championship 2026';
  if (instEl) instEl.value = (draft && draft.institution) || gs.institution || 'Gujarat Technological University';
  if (cashEl) cashEl.value = String((draft && draft.startingCash) || gs.startingCash || 500000);
  if (daysEl) daysEl.value = String((draft && draft.totalDays) || gs.totalDays || 3);
  if (durEl) durEl.value = String((draft && draft.dayDurationSeconds) || gs.dayDurationSeconds || 1800);
  if (feeEl) feeEl.value = String((draft && draft.transactionFeeBps !== undefined) ? draft.transactionFeeBps : (gs.transactionFeeBps !== undefined ? gs.transactionFeeBps : 0));
  if (cbEl) cbEl.value = String((draft && draft.circuitBreakerPercent) || gs.circuitBreakerPercent || 20);
  if (riskEl) riskEl.value = (draft && draft.riskProfile) || gs.riskProfile || 'BALANCED';

  // Step 2: Dynamic Teams Roster (supports any N >= 1)
  let teamsData = (draft && Array.isArray(draft.teams) && draft.teams.length >= 1) ? draft.teams : null;
  if (!teamsData && latestState && Array.isArray(latestState.allTeamsList) && latestState.allTeamsList.length >= 1) {
    teamsData = latestState.allTeamsList.map((t, idx) => ({
      slot: idx + 1,
      id: t.id || `team_${idx + 1}`,
      name: t.name || `Team ${idx + 1}`,
      username: t.username || `team${idx + 1}`,
      password: t.password || `trade${idx + 1}00`,
      members: t.members || `Trader ${idx + 1}A, Trader ${idx + 1}B`
    }));
  }
  if (!teamsData) {
    teamsData = [];
    for (let i = 1; i <= 16; i++) {
      teamsData.push({
        slot: i,
        id: `team_${i}`,
        name: `Team ${i}`,
        username: `team${i}`,
        password: `trade${i}00`,
        members: `Trader ${i}A, Trader ${i}B`
      });
    }
  }
  renderSetupTeamsRoster(teamsData);

  // Step 3: Stock Selection Catalogue
  if (draft && Array.isArray(draft.selectedTickers) && draft.selectedTickers.length >= 4) {
    setupSelectedTickers = new Set(draft.selectedTickers);
  } else if (latestState && latestState.allCompaniesUniverse && latestState.allCompaniesUniverse.length > 0) {
    const enabled = latestState.allCompaniesUniverse.filter((c) => c.isEnabled !== false).map((c) => c.ticker);
    setupSelectedTickers = new Set(enabled.length >= 4 ? enabled : latestState.allCompaniesUniverse.map((c) => c.ticker));
  } else {
    setupSelectedTickers = new Set(DEFAULT_CATALOGUE_COMPANIES.map((c) => c.ticker));
  }
  renderStockCatalogueGrid();

  // Step 4 & 5
  updateNewsPreviewFromSelection();
  updateReviewStats();
  setupInitialized = true;
}

function saveSetupDraft() {
  const teams = getSetupTeamsArray();
  const draft = {
    title: (document.getElementById('setupEventTitle')?.value || '').trim(),
    institution: (document.getElementById('setupInstitution')?.value || '').trim(),
    startingCash: parseFloat(document.getElementById('setupStartingCash')?.value) || 500000,
    totalDays: parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3,
    dayDurationSeconds: parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800,
    transactionFeeBps: parseInt(document.getElementById('setupTransactionFee')?.value, 10) || 0,
    circuitBreakerPercent: parseFloat(document.getElementById('setupCircuitBreaker')?.value) || 20,
    riskProfile: document.getElementById('setupRiskProfile')?.value || 'BALANCED',
    selectedTickers: Array.from(setupSelectedTickers),
    teams
  };

  try {
    localStorage.setItem('ttf_setup_draft', JSON.stringify(draft));
  } catch (e) {}

  const indicator = document.getElementById('setupAutoSaveIndicator');
  if (indicator) {
    indicator.textContent = '💾 Draft Auto-Saved';
    indicator.style.opacity = '1';
    clearTimeout(indicator._fadeTimer);
    indicator._fadeTimer = setTimeout(() => {
      indicator.style.opacity = '0.7';
    }, 1500);
  }

  updateReviewStats();
}

function switchSetupSection(sec) {
  activeSetupSection = sec;
  const sections = ['details', 'teams', 'universe', 'news', 'review'];
  sections.forEach((s) => {
    const btn = document.getElementById(`setupNavBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    const content = document.getElementById(`setupSection${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (btn) {
      if (s === sec) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    if (content) {
      if (s === sec) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });

  if (sec === 'teams') {
    if (!setupInitialized) initOrRestoreEventSetup();
  } else if (sec === 'universe') {
    renderStockCatalogueGrid();
    if (latestState) renderHostUniverseView(latestState.allCompaniesUniverse || latestState.companies || []);
  } else if (sec === 'news') {
    updateNewsPreviewFromSelection();
  } else if (sec === 'review') {
    updateReviewStats();
  }
}

function renderSetupTeamsRoster(teamsList) {
  setupCurrentTeamsList = Array.isArray(teamsList) && teamsList.length > 0 ? teamsList : [];
  if (setupCurrentTeamsList.length === 0) {
    for (let i = 1; i <= 16; i++) {
      setupCurrentTeamsList.push({
        slot: i,
        id: `team_${i}`,
        username: `team${i}`,
        name: `Team ${i}`,
        password: `trade${i}00`,
        members: `Trader ${i}A, Trader ${i}B`
      });
    }
  }

  const tbody = document.getElementById('setupTeamsRosterTbody');
  if (!tbody) return;

  const headerCount = document.getElementById('setupTeamsCountHeader');
  if (headerCount) headerCount.textContent = setupCurrentTeamsList.length;

  tbody.innerHTML = setupCurrentTeamsList.map((t, idx) => {
    const i = idx + 1;
    const name = escapeHtml(t.name || `Team ${i}`);
    const username = `team${i}`;
    const password = escapeHtml(t.password || `trade${i}00`);
    const members = escapeHtml(t.members || '');

    return `
      <tr style="border-bottom: 1px solid var(--subtle-border); transition: background 0.15s ease;">
        <td style="padding: 10px 12px; font-weight: 800; color: var(--champagne-accent);">
          <span class="badge badge-champagne" style="font-size: 11px;">#${i}</span>
        </td>
        <td style="padding: 6px 12px;">
          <input type="text" id="setupTeamName_${i}" class="form-input" style="padding: 6px 10px; font-size: 12px; font-weight: 700; color: var(--text-forest);" value="${name}" oninput="saveSetupDraft()" placeholder="Team ${i}" />
        </td>
        <td style="padding: 10px 12px; font-weight: 800; color: #1E40AF; font-size: 12px;">
          ${username}
        </td>
        <td style="padding: 6px 12px;">
          <input type="text" id="setupTeamPass_${i}" class="form-input" style="padding: 6px 10px; font-size: 12px; font-family: var(--font-mono); color: var(--text-charcoal); background: #FAF9F6;" value="${password}" oninput="saveSetupDraft()" placeholder="Password" />
        </td>
        <td style="padding: 6px 12px;">
          <input type="text" id="setupTeamMembers_${i}" class="form-input" style="padding: 6px 10px; font-size: 12px;" value="${members}" oninput="saveSetupDraft()" placeholder="Trader ${i}A, Trader ${i}B" />
        </td>
        <td style="padding: 6px 12px; text-align: center;">
          <button type="button" onclick="removeSetupTeamRow(${idx})" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: var(--error-red); border-color: rgba(198,75,75,0.3);" title="Delete Team Desk">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

function getSetupTeamsArray() {
  const currentTeams = [];
  const tbody = document.getElementById('setupTeamsRosterTbody');
  const rowCount = tbody ? tbody.children.length : setupCurrentTeamsList.length;
  const count = Math.max(1, rowCount || setupCurrentTeamsList.length);

  for (let i = 1; i <= count; i++) {
    const nameInput = document.getElementById(`setupTeamName_${i}`);
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    const membersInput = document.getElementById(`setupTeamMembers_${i}`);
    if (nameInput || passInput) {
      currentTeams.push({
        slot: i,
        id: `team_${i}`,
        username: `team${i}`,
        name: (nameInput ? nameInput.value : `Team ${i}`).trim() || `Team ${i}`,
        password: (passInput ? passInput.value : `trade${i}00`).trim() || `trade${i}00`,
        members: (membersInput ? membersInput.value : '').trim()
      });
    } else if (setupCurrentTeamsList[i - 1]) {
      currentTeams.push(setupCurrentTeamsList[i - 1]);
    }
  }
  return currentTeams.length > 0 ? currentTeams : setupCurrentTeamsList;
}

function applyTeamCountPreset(targetCount) {
  const current = getSetupTeamsArray();
  const nextTeams = [];
  for (let i = 1; i <= targetCount; i++) {
    if (current[i - 1]) {
      nextTeams.push({
        ...current[i - 1],
        slot: i,
        id: `team_${i}`,
        username: `team${i}`
      });
    } else {
      nextTeams.push({
        slot: i,
        id: `team_${i}`,
        username: `team${i}`,
        name: `Team ${i}`,
        password: `trade${i}00`,
        members: `Trader ${i}A, Trader ${i}B`
      });
    }
  }
  setupCurrentTeamsList = nextTeams;
  renderSetupTeamsRoster(nextTeams);
  saveSetupDraft();
  updateReviewStats();
  showOrderToast(`✓ Updated team roster to ${targetCount} participant desk${targetCount > 1 ? 's' : ''}.`, true);
}

function addSetupTeamRow() {
  const current = getSetupTeamsArray();
  const nextIndex = current.length + 1;
  current.push({
    slot: nextIndex,
    id: `team_${nextIndex}`,
    username: `team${nextIndex}`,
    name: `Team ${nextIndex}`,
    password: `trade${nextIndex}00`,
    members: `Trader ${nextIndex}A, Trader ${nextIndex}B`
  });
  setupCurrentTeamsList = current;
  renderSetupTeamsRoster(current);
  saveSetupDraft();
  updateReviewStats();
  showOrderToast(`✓ Added Desk #${nextIndex} (${current.length} total desks).`, true);
}

function removeSetupTeamRow(idx) {
  const current = getSetupTeamsArray();
  if (current.length <= 1) {
    showOrderToast('⚠️ Minimum 1 team required for the championship.', false);
    return;
  }
  current.splice(idx, 1);
  const reindexed = current.map((t, i) => ({
    ...t,
    slot: i + 1,
    id: `team_${i + 1}`,
    username: `team${i + 1}`
  }));
  setupCurrentTeamsList = reindexed;
  renderSetupTeamsRoster(reindexed);
  saveSetupDraft();
  updateReviewStats();
  showOrderToast(`✓ Removed team desk. ${reindexed.length} desks remaining.`, true);
}

function generateRandomTeamPins() {
  const current = getSetupTeamsArray();
  for (let i = 1; i <= current.length; i++) {
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    if (passInput) {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      passInput.value = pin;
    }
  }
  saveSetupDraft();
  showOrderToast(`🎲 Generated random 6-digit PINs for all ${current.length} teams!`, true);
}

function resetDefaultTeamCredentials() {
  const current = getSetupTeamsArray();
  for (let i = 1; i <= current.length; i++) {
    const nameInput = document.getElementById(`setupTeamName_${i}`);
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    if (nameInput) nameInput.value = `Team ${i}`;
    if (passInput) passInput.value = `trade${i}00`;
  }
  saveSetupDraft();
  showOrderToast(`🔄 Reset all ${current.length} teams to standard credentials (trade100..trade${current.length}00).`, true);
}

function copySetupCredentialsToClipboard() {
  const teams = getSetupTeamsArray();
  const origin = window.location.origin;
  const lines = [
    `THE TRADING FLOOR CHAMPIONSHIP 2026 — ${teams.length} TEAMS CREDENTIALS`,
    '============================================================',
    ''
  ];
  teams.forEach((t) => {
    lines.push(`Desk #${t.slot}: ${t.name}`);
    lines.push(`   Username: ${t.username}`);
    lines.push(`   Password: ${t.password}`);
    lines.push(`   Direct Access: ${origin}/?team=${t.username}&pass=${encodeURIComponent(t.password)}`);
    lines.push('');
  });

  const fullText = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText)
      .then(() => showOrderToast(`📋 All ${teams.length} team credentials copied to clipboard!`, true))
      .catch(() => fallbackCopy(fullText));
  } else {
    fallbackCopy(fullText);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showOrderToast('📋 Team credentials copied to clipboard!', true);
  } catch (e) {
    showOrderToast('⚠️ Could not copy to clipboard. Please copy manually.', false);
  }
  document.body.removeChild(ta);
}

function downloadSetupCredentialsCsv() {
  const teams = getSetupTeamsArray();
  const origin = window.location.origin;
  const rows = [
    ['Desk Slot', 'Team Name', 'Username', 'Password', 'Direct URL']
  ];
  teams.forEach((t) => {
    const url = `${origin}/?team=${t.username}&pass=${encodeURIComponent(t.password)}`;
    const safeName = /^[=+\-@]/.test(t.name) ? `'${t.name}` : t.name;
    const safePass = /^[=+\-@]/.test(t.password) ? `'${t.password}` : t.password;
    rows.push([t.slot, `"${safeName.replace(/"/g, '""')}"`, t.username, `"${safePass.replace(/"/g, '""')}"`, url]);
  });
  const csvContent = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TheTradingFloor_${teams.length}_Team_Credentials.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showOrderToast(`📥 Downloaded TheTradingFloor_${teams.length}_Team_Credentials.csv`, true);
}

function getAvailableStocks() {
  if (latestState && latestState.allCompaniesUniverse && latestState.allCompaniesUniverse.length > 0) {
    return latestState.allCompaniesUniverse;
  }
  return DEFAULT_CATALOGUE_COMPANIES;
}

function renderStockCatalogueGrid() {
  const grid = document.getElementById('stockCatalogueGrid');
  if (!grid) return;

  const allStocks = getAvailableStocks();
  const search = setupCatalogueSearchTerm.toLowerCase();
  const sector = setupCatalogueSectorFilter;

  const filtered = allStocks.filter((s) => {
    const matchesSearch = !search ||
      s.ticker.toLowerCase().includes(search) ||
      s.name.toLowerCase().includes(search) ||
      (s.sector && s.sector.toLowerCase().includes(search));
    const matchesSector = sector === 'ALL' ||
      (s.sector && s.sector.toLowerCase().includes(sector.toLowerCase()));
    return matchesSearch && matchesSector;
  });

  const selectedCountEl = document.getElementById('catalogueSelectedCount');
  if (selectedCountEl) selectedCountEl.textContent = setupSelectedTickers.size;
  const badgeEl = document.getElementById('catalogueSelectedCountBadge');
  if (badgeEl) {
    if (setupSelectedTickers.size < 4) {
      badgeEl.className = 'badge badge-paused';
      badgeEl.innerHTML = `⚠️ <span id="catalogueSelectedCount">${setupSelectedTickers.size}</span> / ${allStocks.length} Stocks (Min 4 Required)`;
    } else {
      badgeEl.className = 'badge badge-active';
      badgeEl.innerHTML = `✓ <span id="catalogueSelectedCount">${setupSelectedTickers.size}</span> / ${allStocks.length} Stocks Selected`;
    }
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted); background: var(--surface-cream); border-radius: var(--radius-sm); border: 1px dashed var(--subtle-border);">
        No corporate equities found matching "${escapeHtml(search)}". Try a different query.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((s) => {
    const isSelected = setupSelectedTickers.has(s.ticker);
    const basePrice = s.base_price !== undefined ? s.base_price : (s.currentPrice || 1000);

    return `
      <div onclick="toggleStockSelection('${s.ticker}')" class="stock-catalogue-card" style="padding: 14px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.18s ease; user-select: none; background: #FFFFFF; ${isSelected ? 'border: 2px solid var(--price-up); box-shadow: 0 4px 12px rgba(33,134,83,0.12);' : 'border: 1px solid var(--subtle-border); opacity: 0.65;'}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 900; font-size: 15px; color: var(--text-forest); font-family: var(--font-mono);">${s.ticker}</span>
              <span class="badge" style="font-size: 9px; padding: 2px 5px; background: #EEF2F6; color: #475569;">NSE</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-charcoal); margin-top: 2px; line-height: 1.3;">${escapeHtml(s.name)}</div>
          </div>
          <div style="text-align: right;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--price-up); cursor: pointer;" onclick="event.stopPropagation(); toggleStockSelection('${s.ticker}')" />
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--subtle-border); font-size: 11px;">
          <span class="badge" style="font-size: 10px; background: var(--surface-cream); color: var(--text-muted);">${escapeHtml(s.sector || 'Equities')}</span>
          <div style="text-align: right;">
            <span style="color: var(--text-muted); font-size: 10px;">Ref Price:</span>
            <span style="font-weight: 800; color: var(--text-forest); font-family: var(--font-mono); margin-left: 2px;">₹${basePrice.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterStockCatalogue() {
  const searchInput = document.getElementById('stockCatalogueSearch');
  setupCatalogueSearchTerm = (searchInput ? searchInput.value : '').trim();
  renderStockCatalogueGrid();
}

function filterCatalogueBySector(sector) {
  setupCatalogueSectorFilter = sector;
  const pills = document.querySelectorAll('#catalogueSectorPills button');
  pills.forEach((p) => {
    if (p.getAttribute('data-sector') === sector) p.classList.add('active');
    else p.classList.remove('active');
  });
  renderStockCatalogueGrid();
}

function toggleStockSelection(ticker) {
  if (setupSelectedTickers.has(ticker)) {
    if (setupSelectedTickers.size <= 4) {
      showOrderToast('⚠️ Minimum 4 stocks required to preserve market index diversity.', false);
      return;
    }
    setupSelectedTickers.delete(ticker);
  } else {
    setupSelectedTickers.add(ticker);
  }
  renderStockCatalogueGrid();
  updateNewsPreviewFromSelection();
  saveSetupDraft();
  updateReviewStats();
}

function selectStockPreset(preset) {
  const allStocks = getAvailableStocks();
  if (preset === 'all') {
    setupSelectedTickers = new Set(allStocks.map((c) => c.ticker));
    showOrderToast(`✓ Selected all ${setupSelectedTickers.size} NSE corporate equities.`, true);
  } else if (preset === 'top12') {
    const top12 = ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS', 'LT', 'INFY', 'ICICIBANK', 'ITC', 'BAJFINANCE', 'AIRTEL', 'SUNPHARMA', 'TITAN'];
    const valid = top12.filter((t) => allStocks.some((c) => c.ticker === t));
    setupSelectedTickers = new Set(valid);
    showOrderToast(`✓ Selected top 12 diversified market leaders across all sectors.`, true);
  } else if (preset === 'top8') {
    const top8 = ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS', 'LT', 'INFY', 'ICICIBANK', 'ITC'];
    const valid = top8.filter((t) => allStocks.some((c) => c.ticker === t));
    setupSelectedTickers = new Set(valid);
    showOrderToast(`✓ Selected top 8 mega-cap equities.`, true);
  } else if (preset === 'clear') {
    const min4 = ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS'].filter((t) => allStocks.some((c) => c.ticker === t));
    setupSelectedTickers = new Set(min4.length >= 4 ? min4 : allStocks.slice(0, 4).map((c) => c.ticker));
    showOrderToast('⚠️ Deselected all non-essential stocks (retained minimum 4 required).', false);
  }
  renderStockCatalogueGrid();
  updateNewsPreviewFromSelection();
  saveSetupDraft();
  updateReviewStats();
}

function generateClientNewsPreview(selectedTickers, totalDays, dayDurationSeconds) {
  const templates = [
    { title: 'Strong Institutional Q3 Earnings Growth', pct: 4.5, exp: 'Quarterly financial filings exceed consensus forecasts; institutional liquidity accelerates.' },
    { title: 'Supply Chain Friction and Cost Escalations', pct: -3.8, exp: 'Input cost pressures and logistics delays weigh slightly on near-term operating margins.' },
    { title: 'Mega Infrastructure Expansion Contract Secured', pct: 6.2, exp: 'Major capital project allotment awarded, bolstering long-term revenue order books.' },
    { title: 'Sectoral Regulatory Audit & Compliance Review', pct: -2.5, exp: 'Exchange regulatory body initiates routine compliance inspection across leading participants.' },
    { title: 'Strategic Green Energy & Technology Initiative', pct: 5.0, exp: 'Enterprise announces capital expenditure drive into next-generation sustainable technology.' },
    { title: 'Monetary Policy Committee Neutral Stance Update', pct: 2.0, exp: 'Central bank benchmark rate decision maintains favorable institutional liquidity environment.' }
  ];

  const news = [];
  const tickers = selectedTickers.length > 0 ? selectedTickers : ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS'];
  let eventIdx = 0;

  for (let day = 1; day <= totalDays; day++) {
    const triggers = [
      Math.floor(dayDurationSeconds * 0.25),
      Math.floor(dayDurationSeconds * 0.50),
      Math.floor(dayDurationSeconds * 0.75)
    ];

    triggers.forEach((triggerSec) => {
      const t = tickers[eventIdx % tickers.length];
      const tmpl = templates[eventIdx % templates.length];
      eventIdx++;

      news.push({
        day,
        trigger_second: triggerSec,
        headline: `${t}: ${tmpl.title}`,
        simple_explanation: tmpl.exp,
        ticker: t,
        impact_pct: tmpl.pct
      });
    });
  }
  return news;
}

function updateNewsPreviewFromSelection() {
  const container = document.getElementById('setupNewsPreviewList');
  if (!container) return;

  const totalDays = parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3;
  const dayDuration = parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800;
  const tickers = Array.from(setupSelectedTickers);

  const previewEvents = generateClientNewsPreview(tickers, totalDays, dayDuration);

  container.innerHTML = previewEvents.map((ev) => {
    const isUp = ev.impact_pct >= 0;
    return `
      <div class="cream-panel" style="padding: 14px; border: 1px solid var(--subtle-border); border-radius: var(--radius-sm); background: #FFFFFF;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span class="badge badge-champagne" style="font-size: 10px; font-weight: 800;">
            DAY ${ev.day} &bull; AT ${formatMMSS(ev.trigger_second)}
          </span>
          <span class="badge ${isUp ? 'badge-active' : 'badge-paused'}" style="font-size: 10px; font-weight: 800;">
            ${ev.ticker} ${isUp ? '+' : ''}${ev.impact_pct}%
          </span>
        </div>
        <div style="font-weight: 800; font-size: 13px; color: var(--text-forest); margin-bottom: 4px; line-height: 1.35;">
          ${escapeHtml(ev.headline)}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
          ${escapeHtml(ev.simple_explanation)}
        </div>
      </div>
    `;
  }).join('');
}

function regenerateNewsTimeline() {
  updateNewsPreviewFromSelection();
  showOrderToast('🔄 News timeline regenerated dynamically from selected stocks.', true);
}

function updateReviewStats() {
  const cash = parseFloat(document.getElementById('setupStartingCash')?.value) || 500000;
  const totalDays = parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3;
  const dayDuration = parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800;
  const cb = parseFloat(document.getElementById('setupCircuitBreaker')?.value) || 20;
  const teams = getSetupTeamsArray();

  const statTeams = document.getElementById('reviewStatTeams');
  const statStocks = document.getElementById('reviewStatStocks');
  const statCash = document.getElementById('reviewStatCash');
  const statSchedule = document.getElementById('reviewStatSchedule');

  if (statTeams) statTeams.textContent = `${teams.length} Team${teams.length > 1 ? 's' : ''} Configured`;
  if (statStocks) statStocks.textContent = `${setupSelectedTickers.size} Stocks Active`;
  if (statCash) statCash.textContent = `₹${cash.toLocaleString('en-IN')} / Team`;
  if (statSchedule) statSchedule.textContent = `${totalDays} Days • ${Math.round(dayDuration / 60)}m / Day (±${cb}%)`;
}

function openLockSetupConfirmModal() {
  const title = (document.getElementById('setupEventTitle')?.value || '').trim();
  if (!title) {
    showOrderToast('⚠️ Event title cannot be empty. Please enter an event title in Step 1.', false);
    switchSetupSection('details');
    return;
  }

  if (setupSelectedTickers.size < 4) {
    showOrderToast('⚠️ Please select at least 4 stocks in Step 3 before locking setup.', false);
    switchSetupSection('universe');
    return;
  }

  const teams = getSetupTeamsArray();
  if (teams.length < 1) {
    showOrderToast('⚠️ At least 1 participating team is required in Step 2.', false);
    switchSetupSection('teams');
    return;
  }

  const names = new Set();
  for (let i = 0; i < teams.length; i++) {
    if (!teams[i].name) {
      showOrderToast(`⚠️ Team #${teams[i].slot} name cannot be empty.`, false);
      switchSetupSection('teams');
      return;
    }
    if (!teams[i].password) {
      showOrderToast(`⚠️ Team #${teams[i].slot} password cannot be empty.`, false);
      switchSetupSection('teams');
      return;
    }
    const lowerName = teams[i].name.toLowerCase();
    if (names.has(lowerName)) {
      showOrderToast(`⚠️ Duplicate team name "${teams[i].name}" detected. Each team must have a unique name.`, false);
      switchSetupSection('teams');
      return;
    }
    names.add(lowerName);
  }

  const modal = document.getElementById('lockSetupConfirmModal');
  if (modal) modal.classList.remove('hidden');
}

function closeLockSetupConfirmModal() {
  const modal = document.getElementById('lockSetupConfirmModal');
  if (modal) modal.classList.add('hidden');
  const btn = document.getElementById('btnSubmitLockSetup');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Yes, Lock Event & Open Logins';
  }
}

function submitLockEventSetup() {
  closeLockSetupConfirmModal();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showOrderToast('⚠️ Server connection not open. Please reconnect.', false);
    return;
  }

  const btn = document.getElementById('btnSubmitLockSetup');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting & Locking...';
  }

  const title = (document.getElementById('setupEventTitle')?.value || '').trim();
  const institution = (document.getElementById('setupInstitution')?.value || '').trim();
  const startingCash = parseFloat(document.getElementById('setupStartingCash')?.value) || 500000;
  const totalDays = parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3;
  const dayDurationSeconds = parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800;
  const transactionFeeBps = parseInt(document.getElementById('setupTransactionFee')?.value, 10) || 0;
  const circuitBreakerPercent = parseFloat(document.getElementById('setupCircuitBreaker')?.value) || 20;
  const riskProfile = document.getElementById('setupRiskProfile')?.value || 'BALANCED';
  const teams = getSetupTeamsArray();
  let selectedTickers = Array.from(setupSelectedTickers || []);
  if (!selectedTickers || selectedTickers.length < 4) {
    const fallbackTickers = (latestState && latestState.allCompaniesUniverse && latestState.allCompaniesUniverse.length >= 4)
      ? latestState.allCompaniesUniverse.map((c) => c.ticker)
      : DEFAULT_CATALOGUE_COMPANIES.map((c) => c.ticker);
    selectedTickers = Array.from(new Set([...(selectedTickers || []), ...fallbackTickers]));
  }

  ws.send(JSON.stringify({
    action: 'HOST_SET_EVENT_LOCK',
    session_token: sessionToken,
    eventTitle: title,
    institution,
    startingCash,
    totalDays,
    dayDurationSeconds,
    transactionFeeBps,
    circuitBreakerPercent,
    riskProfile,
    teams,
    selectedTickers
  }));

  showOrderToast(`🔒 Submitting tournament setup & activating ${teams.length} team credentials...`, true);
}

// Post-Lock Day 1 Launch Modal Controllers
function openPostLockDay1Modal(teamsCount) {
  const modal = document.getElementById('postLockDay1Modal');
  if (!modal) return;
  const span = document.getElementById('postLockTeamsCountSpan');
  if (span) span.textContent = `${teamsCount || 'configured'}`;
  modal.classList.remove('hidden');
}

function closePostLockDay1Modal() {
  const modal = document.getElementById('postLockDay1Modal');
  if (modal) modal.classList.add('hidden');
}

function executePostLockStartNow() {
  closePostLockDay1Modal();
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_START_DAY1_NOW',
    session_token: sessionToken
  }));
  switchSpaView('HOST');
  showOrderToast('🚀 Launching Day 1! 3-2-1 Synchronized Countdown initiated.', true);
}

function togglePostLockScheduleSection() {
  const sec = document.getElementById('postLockScheduleSection');
  if (!sec) return;
  sec.classList.toggle('hidden');
  const input = document.getElementById('postLockScheduledTimeInput');
  if (input && !input.value) {
    const now = new Date(Date.now() + 5 * 60 * 1000);
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
    input.value = localIso;
  }
}

function confirmPostLockSchedule() {
  const input = document.getElementById('postLockScheduledTimeInput');
  if (!input || !input.value) {
    showOrderToast('⚠️ Please choose a scheduled opening date and time.', false);
    return;
  }
  const scheduledTime = new Date(input.value).toISOString();
  closePostLockDay1Modal();
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_SCHEDULE_EVENT',
    session_token: sessionToken,
    scheduledStartTime: scheduledTime
  }));
  switchSpaView('HOST');
  showOrderToast('📅 Event scheduled! Participant waiting rooms armed with synchronized countdown.', true);
}

function executePostLockStartLater() {
  closePostLockDay1Modal();
  switchSpaView('HOST');
  showOrderToast('🏛️ Event ready on Standby. You can launch Day 1 anytime from the Host Operations bar.', true);
}

function saveEventDetailsFromSetup() {
  if (!ws || !sessionToken || currentRole !== 'HOST') return;
  const title = (document.getElementById('setupEventTitle').value || '').trim();
  const startingCash = parseFloat(document.getElementById('setupStartingCash').value) || 500000;
  const totalDays = parseInt(document.getElementById('setupTotalDays').value, 10) || 3;
  const dayDurationSeconds = parseInt(document.getElementById('setupDayDuration').value, 10) || 1800;
  const transactionFeeBps = parseInt(document.getElementById('setupTransactionFee').value, 10) || 0;
  const circuitBreakerPercent = parseFloat(document.getElementById('setupCircuitBreaker').value) || 20;

  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_EVENT_CONFIG',
    session_token: sessionToken,
    title,
    startingCash,
    totalDays,
    dayDurationSeconds,
    transactionFeeBps,
    circuitBreakerPercent
  }));

  showOrderToast('✓ Tournament details saved successfully!', true);
}

function hostLockEventSetup() {
  if (!ws || !sessionToken || currentRole !== 'HOST') return;
  showInlineConfirmToast(
    'Confirm & Lock Event? This permanently freezes starting capital, team rosters, tradeable stock selection, and news timeline. This ensures a fair, audit-grade tournament.',
    () => {
      ws.send(JSON.stringify({
        action: 'HOST_SET_EVENT_LOCK',
        session_token: sessionToken
      }));
      showOrderToast('🔒 Tournament configuration permanently locked!', true);
    },
    'Confirm & Lock',
    'Cancel'
  );
}

function hostUnlockEventSetup() {
  if (!ws || !sessionToken || currentRole !== 'HOST') return;
  const gs = latestState?.gameState;
  if (gs && (gs.status === 'LIVE' || gs.elapsedSeconds > 0 || gs.currentDay > 1)) {
    showOrderToast('Cannot unlock settings: The competition has already started. Event settings are permanently frozen during live trading.', false);
    return;
  }
  showInlineConfirmToast(
    'Unlock Event Configuration? This will allow editing tournament parameters and stock selections. Settings will re-lock automatically when complete.',
    () => {
      ws.send(JSON.stringify({
        action: 'HOST_UNLOCK_EVENT_CONFIG',
        session_token: sessionToken
      }));
      showOrderToast('🔓 Event configuration unlocked for editing.', true);
    },
    'Unlock Settings',
    'Keep Locked'
  );
}

// 60-Second Reveal Timer for Host News Private Impacts
let hostPrivateNewsRevealed = false;
let hostRevealCountdownTimer = null;
let hostRevealSecondsLeft = 60;

function togglePrivateNewsDetails() {
  if (hostPrivateNewsRevealed) {
    hidePrivateNewsDetailsNow();
  } else {
    revealPrivateNewsDetails();
  }
}

function revealPrivateNewsDetails() {
  hostPrivateNewsRevealed = true;
  hostRevealSecondsLeft = 60;
  const banner = document.getElementById('privateNewsRevealBanner');
  const countEl = document.getElementById('revealCountdownSec');
  const btn = document.getElementById('btnRevealPrivateNews');
  if (banner) banner.classList.remove('hidden');
  if (countEl) countEl.textContent = '60';
  if (btn) {
    btn.textContent = '🔒 Hide Private Details';
    btn.className = 'btn btn-sage';
  }

  if (hostRevealCountdownTimer) clearInterval(hostRevealCountdownTimer);
  hostRevealCountdownTimer = setInterval(() => {
    hostRevealSecondsLeft--;
    const cEl = document.getElementById('revealCountdownSec');
    if (cEl) cEl.textContent = hostRevealSecondsLeft;
    if (hostRevealSecondsLeft <= 0) {
      hidePrivateNewsDetailsNow();
    }
  }, 1000);

  if (latestState) renderHostNews(latestState);
}

function hidePrivateNewsDetailsNow() {
  hostPrivateNewsRevealed = false;
  if (hostRevealCountdownTimer) {
    clearInterval(hostRevealCountdownTimer);
    hostRevealCountdownTimer = null;
  }
  const banner = document.getElementById('privateNewsRevealBanner');
  const btn = document.getElementById('btnRevealPrivateNews');
  if (banner) banner.classList.add('hidden');
  if (btn) {
    btn.textContent = '👁️ Reveal Private News Details';
    btn.className = 'btn btn-outline';
  }
  if (latestState) renderHostNews(latestState);
}

function acknowledgeClientResetAndLogout() {
  const modal = document.getElementById('clientResetModal');
  if (modal) modal.classList.add('hidden');
  sessionToken = null;
  localStorage.removeItem('tf_session_token');
  localStorage.removeItem('tf_current_role');
  localStorage.removeItem('tf_current_username');
  window.location.hash = '#loginView';
  showLoginView();
  showOrderToast('You have been logged out following competition reset.', false);
}

function handleNextStepAction() {
  if (!latestState || !latestState.gameState) return;
  const gs = latestState.gameState;
  const isConcluded = gs.isConcluded || (gs.currentDay >= gs.totalDays && gs.elapsedSeconds >= gs.dayDurationSeconds);
  const isWinnerActive = (gs.presentationState && gs.presentationState.active) || (gs.projectorState && gs.projectorState.isWinnerActive);

  if (isWinnerActive) {
    presNextScene();
  } else if (isConcluded) {
    hostStartWinnerPresentation();
  } else if (gs.status === 'SCHEDULED') {
    confirmScheduleOrStartEvent();
  } else if (!gs.configLocked && gs.status === 'STANDBY' && gs.elapsedSeconds === 0) {
    switchHostTab('setup');
    switchSetupSection('review');
  } else if (gs.isPaused) {
    hostResumeMarket();
  } else if (gs.status === 'LIVE') {
    switchHostTab('floor');
  } else {
    handleFlowPrimaryAction();
  }
}

function hostAudioSelfTest() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    }
  } catch (e) {}

  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_TEST_SOUND_CUE',
      session_token: sessionToken,
      cueName: 'countdown_tick',
      category: 'lifecycle'
    }));
  }
  showOrderToast('🔔 Audio self-test dispatched (Local tone + remote venue cue confirmed)', true);
}

function renderSetupSections(state) {
  if (!state) return;
  const { gameState, allCompaniesUniverse, companies, newsEvents } = state;
  const gs = gameState || {};

  // Update Section 1 Details Inputs if not actively typing
  const titleInput = document.getElementById('setupEventTitle');
  const instInput = document.getElementById('setupInstitution');
  const cashInput = document.getElementById('setupStartingCash');
  const daysInput = document.getElementById('setupTotalDays');
  const durInput = document.getElementById('setupDayDuration');
  const feeInput = document.getElementById('setupTransactionFee');
  const cbInput = document.getElementById('setupCircuitBreaker');

  if (titleInput && document.activeElement !== titleInput && gs.title) titleInput.value = gs.title;
  if (instInput && document.activeElement !== instInput && gs.institution) instInput.value = gs.institution;
  if (cashInput && document.activeElement !== cashInput && gs.startingCash) cashInput.value = gs.startingCash;
  if (daysInput && document.activeElement !== daysInput && gs.totalDays) daysInput.value = gs.totalDays;
  if (durInput && document.activeElement !== durInput && gs.dayDurationSeconds) durInput.value = gs.dayDurationSeconds;
  if (feeInput && document.activeElement !== feeInput && gs.transactionFeeBps !== undefined) feeInput.value = gs.transactionFeeBps;
  if (cbInput && document.activeElement !== cbInput && gs.circuitBreakerPercent) cbInput.value = gs.circuitBreakerPercent;

  const isSetupLocked = !!gs.configLocked;
  [titleInput, instInput, cashInput, daysInput, durInput, feeInput, cbInput].forEach((inp) => {
    if (inp) {
      inp.disabled = isSetupLocked;
      if (isSetupLocked) {
        inp.style.backgroundColor = '#F8FAFC';
        inp.style.cursor = 'not-allowed';
        inp.title = 'Configuration is locked for competition integrity';
      } else {
        inp.style.backgroundColor = '';
        inp.style.cursor = '';
        inp.title = '';
      }
    }
  });

  // Update Section 2 Teams Roster in Setup
  const setupTeamsTbody = document.getElementById('setupTeamsTbody');
  if (setupTeamsTbody) {
    const teamsList = state.allTeamsList || state.teams || [];
    const maxTeams = Math.max(16, teamsList.length);
    const origin = window.location.origin;
    const rows = [];
    for (let i = 1; i <= maxTeams; i++) {
      const username = `team${i}`;
      const password = `trade${i}00`;
      const foundTeam = teamsList.find((t) => t.id === username || t.id === `team_${i}` || t.name === `Team ${i}` || t.name === `TEAM ${i}`) || {};
      const teamName = foundTeam.name || `Team ${i}`;
      const members = foundTeam.members || '—';
      const directUrl = `${origin}/?team=${username}&pass=${password}`;
      rows.push(`
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px; font-weight: 700; color: var(--champagne-accent);">Desk #${i}</td>
          <td style="padding: 8px; font-weight: 700; color: var(--text-forest);">${escapeHtml(teamName)}</td>
          <td style="padding: 8px; font-family: var(--font-sans); color: var(--text-muted); font-size: 11px;">${escapeHtml(members)}</td>
          <td style="padding: 8px; font-weight: 800; color: #1E40AF;">${username}</td>
          <td style="padding: 8px; color: var(--text-charcoal); background-color: var(--surface-cream); border-radius: 4px;">${password}</td>
          <td style="padding: 8px; text-align: center;">
            <button onclick="openTerminalTab('/?team=${username}&pass=${password}')" class="btn btn-sage" style="padding: 3px 10px; font-size: 11px;">
              Launch Desk
            </button>
          </td>
          <td style="padding: 8px; text-align: center;">
            <button onclick="copyToClipboard('${directUrl}')" class="btn btn-outline" style="padding: 3px 8px; font-size: 11px;" title="Copy Desk Link">
              🔗 Copy
            </button>
          </td>
        </tr>
      `);
    }
    setupTeamsTbody.innerHTML = rows.join('');
  }

  // Update Section 3 Stock Universe in Setup
  const setupUniverseTbody = document.getElementById('setupUniverseTbody');
  const lockedNotice = document.getElementById('setupUniverseLockedNotice');
  const controlsWrap = document.getElementById('setupUniverseControlsWrap');

  if (gs.configLocked) {
    if (lockedNotice) lockedNotice.classList.remove('hidden');
    if (controlsWrap) controlsWrap.style.display = 'none';
  } else {
    if (lockedNotice) lockedNotice.classList.add('hidden');
    if (controlsWrap) controlsWrap.style.display = 'flex';
  }

  const universe = allCompaniesUniverse || companies || [];
  if (setupUniverseTbody && universe.length > 0) {
    setupUniverseTbody.innerHTML = universe.map((c) => {
      const isEnabled = c.isEnabled !== false;
      const basePrice = c.base_price !== undefined ? c.base_price : c.currentPrice;
      const curPrice = c.currentPrice !== undefined ? c.currentPrice : basePrice;
      return `
        <tr style="border-bottom: 1px solid var(--subtle-border); ${!isEnabled ? 'opacity: 0.5;' : ''}">
          <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${c.ticker}</td>
          <td style="padding: 8px;">
            <div style="font-weight: 600;">${c.name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Verified Real NSE Listed Company &bull; Beta: ${c.beta || 1.0}</div>
          </td>
          <td style="padding: 8px;"><span class="badge" style="font-size: 10px;">${c.sector}</span></td>
          <td style="padding: 8px; text-align: right; font-weight: 600;">₹${basePrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${curPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: center;">
            ${gs.configLocked ? `
              <span class="badge ${isEnabled ? 'badge-active' : 'badge-paused'}" style="font-size: 10px;">
                ${isEnabled ? '● Active' : '○ Disabled'}
              </span>
            ` : `
              <button onclick="toggleShareActive('${c.ticker}')" class="badge ${isEnabled ? 'badge-active' : 'badge-paused'}" style="cursor: pointer; border: none; font-size: 11px; padding: 4px 8px;">
                ${isEnabled ? '● Active' : '○ Disabled'}
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update Section 5 News Plan Preview in Setup
  const setupNewsList = document.getElementById('setupNewsPreviewList');
  if (setupNewsList && newsEvents && newsEvents.length > 0) {
    setupNewsList.innerHTML = newsEvents.map((ev) => {
      const impacts = ev.impacts || {};
      const impactPills = Object.entries(impacts).map(([ticker, val]) => {
        const delta = val.delta_pct || val.base_pct || 0;
        const isUp = delta >= 0;
        return `<span class="badge ${isUp ? 'badge-active' : 'badge-paused'}" style="font-size: 10px; margin-right: 4px;">${ticker} ${isUp ? '+' : ''}${delta}%</span>`;
      }).join(' ');

      return `
        <div class="cream-panel" style="padding: 14px; border: 1px solid var(--subtle-border); position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="badge badge-champagne" style="font-size: 10px; font-weight: 800;">DAY ${ev.day || 1} &bull; AT ${formatMMSS(ev.trigger_second || 0)}</span>
            <span class="badge badge-sage" style="font-size: 10px;">SCHEDULED STORY</span>
          </div>
          <div style="font-weight: 800; font-size: 13px; color: var(--text-forest); margin-bottom: 6px; line-height: 1.4;">
            ${escapeHtml(ev.headline)}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            ${escapeHtml(ev.simple_explanation || '')}
          </div>
          <div style="border-top: 1px dashed var(--subtle-border); padding-top: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Host Price Impacts Preview:</span>
            <div style="margin-top: 4px;">${impactPills || '<span style="font-size: 10px; color: var(--text-muted);">None</span>'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Update Section 6 Review Stats
  const revTeams = document.getElementById('reviewStatTeams');
  const revStocks = document.getElementById('reviewStatStocks');
  const revCash = document.getElementById('reviewStatCash');
  const revNews = document.getElementById('reviewStatNews');
  const revLock = document.getElementById('reviewStatLock');

  if (revTeams) revTeams.textContent = `${(state.allTeamsList && state.allTeamsList.length) || 16} Teams`;
  if (revStocks) revStocks.textContent = `${universe.filter((c) => c.isEnabled !== false).length} / ${universe.length} Verified (NSE)`;
  if (revCash) revCash.textContent = `₹${(gs.startingCash || 500000).toLocaleString('en-IN')} / Team`;
  if (revNews) revNews.textContent = `${newsEvents ? newsEvents.length : 12} Pre-Scheduled Stories`;
  if (revLock) {
    if (gs.configLocked) {
      revLock.textContent = '🔒 CONFIG LOCKED';
      revLock.style.color = '#059669';
    } else {
      revLock.textContent = '🔓 UNLOCKED (DRAFT)';
      revLock.style.color = '#2563EB';
    }
  }

  // Update Unlock vs Lock buttons visibility across Setup and Banner
  const canUnlock = !!(gs.configLocked && gs.status === 'STANDBY' && (gs.elapsedSeconds === 0 || !gs.elapsedSeconds) && (gs.currentDay === 1 || !gs.currentDay));
  const btnUnlockTop = document.getElementById('btnUnlockEventConfig');
  const btnUnlockRev = document.getElementById('btnUnlockEventReview');
  const btnLockTop = document.getElementById('btnLockEventSetupTop');
  const btnLockMain = document.getElementById('btnLockEventSetup');

  if (btnUnlockTop) {
    if (canUnlock) btnUnlockTop.classList.remove('hidden');
    else btnUnlockTop.classList.add('hidden');
  }
  if (btnUnlockRev) {
    if (canUnlock) btnUnlockRev.classList.remove('hidden');
    else btnUnlockRev.classList.add('hidden');
  }
  if (btnLockTop) {
    if (gs.configLocked) btnLockTop.classList.add('hidden');
    else btnLockTop.classList.remove('hidden');
  }
  if (btnLockMain) {
    if (gs.configLocked) {
      btnLockMain.textContent = '🔒 Configuration Locked';
      btnLockMain.disabled = true;
      btnLockMain.style.opacity = '0.6';
    } else {
      btnLockMain.textContent = '🔒 Confirm & Lock Event Now';
      btnLockMain.disabled = false;
      btnLockMain.style.opacity = '1';
    }
  }
}

function renderHostActivityFeed(state) {
  const tbody = document.getElementById('hostLiveActivityFeed');
  if (!tbody) return;

  const events = [];
  if (state.recentTrades && state.recentTrades.length > 0) {
    state.recentTrades.slice(0, 8).forEach((tr) => {
      events.push({
        time: tr.timestamp,
        type: tr.type === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
        desc: `${tr.teamName} ${tr.type} ${tr.quantity} shares of ${tr.ticker} @ ₹${tr.price.toFixed(2)} (Cash after: ₹${tr.cashAfter.toFixed(2)})`
      });
    });
  }

  if (state.newsEvents && state.newsEvents.length > 0) {
    state.newsEvents.filter((e) => e.triggered).forEach((ne) => {
      events.push({
        time: formatMMSS(ne.trigger_second || 0),
        type: 'NEWS_WIRE',
        desc: `Published breaking wire: "${ne.headline}"`
      });
    });
  }

  if (state.gameState && state.gameState.isPaused) {
    events.unshift({
      time: formatMMSS(state.gameState.elapsedSeconds || 0),
      type: 'MARKET_PAUSE',
      desc: `Market paused by Host in ${state.gameState.pauseMode || 'VISIBLE_FROZEN'} mode.`
    });
  }

  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td style="padding: 8px 10px; color: var(--text-muted); font-size: 11px;">${new Date().toLocaleTimeString()}</td>
        <td style="padding: 8px 10px;"><span class="badge badge-champagne" style="font-size: 9px;">SYSTEM_ONLINE</span></td>
        <td style="padding: 8px 10px; font-family: var(--font-sans); color: var(--text-forest);">Tournament floor ready. Awaiting market start command.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.slice(0, 10).map((ev) => `
    <tr style="border-bottom: 1px solid var(--subtle-border);">
      <td style="padding: 6px 10px; color: var(--text-muted); font-size: 11px;">${ev.time}</td>
      <td style="padding: 6px 10px;"><span class="badge ${ev.type.includes('BUY') ? 'badge-active' : (ev.type.includes('SELL') ? 'badge-paused' : 'badge-champagne')}" style="font-size: 9px;">${ev.type}</span></td>
      <td style="padding: 6px 10px; font-family: var(--font-sans); color: var(--text-forest);">${escapeHtml(ev.desc)}</td>
    </tr>
  `).join('');
}

function renderHostView(state) {
  const { gameState, companies, leaderboard, newsEvents, recentTrades, allCompaniesUniverse } = state;
  if (!gameState) return;

  // Render Real-Time Market Indices Bar & Tournament Flow Stepper
  renderAllIndicesBars(state.marketIndices || (state.gameState && state.gameState.marketIndices) || calculateClientIndices(companies));
  updateHostTournamentFlow(state);
  renderSetupSections(state);
  renderHostActivityFeed(state);

  let hostStatusText = 'LIVE';
  if (gameState.status === 'SCHEDULED') {
    const remMs = gameState.scheduledStartTime ? Math.max(0, new Date(gameState.scheduledStartTime).getTime() - Date.now()) : 0;
    const schTime = gameState.scheduledStartTime ? new Date(gameState.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    hostStatusText = `SCHEDULED (Opens at ${schTime} • in ${formatMMSS(Math.floor(remMs / 1000))})`;
  } else if (gameState.isPaused) {
    hostStatusText = gameState.pauseMode === 'BLACKOUT' ? 'BLACKOUT PAUSED' : 'PAUSED';
  }

  const modeBadge = document.getElementById('hostScenarioModeBadge');
  if (modeBadge) {
    modeBadge.textContent = `${(state.scenarioMode || (latestState && latestState.scenarioMode) || 'live').toUpperCase()} MODE`;
  }
  const clockInfo = document.getElementById('hostClockInfo');
  if (clockInfo) {
    clockInfo.textContent =
      `Day ${gameState.currentDay} / ${gameState.totalDays} • Clock: ${formatMMSS(gameState.elapsedSeconds)} / ${formatMMSS(gameState.dayDurationSeconds)} • Status: ${hostStatusText} • Shift Offset: ${gameState.totalShiftOffsetSeconds || 0}s • Fee: ${gameState.transactionFeeBps || 0} bps`;
  }

  // Render Configuration Lock Status Banner
  const lockBanner = document.getElementById('hostConfigLockBanner');
  const lockIcon = document.getElementById('hostConfigLockIcon');
  const lockTitle = document.getElementById('hostConfigLockTitle');
  const lockDesc = document.getElementById('hostConfigLockDesc');
  const lockBadge = document.getElementById('hostConfigLockBadge');

  if (gameState.configLocked) {
    if (lockBanner) lockBanner.classList.add('hidden');
  } else {
    if (lockBanner) lockBanner.classList.remove('hidden');
    if (lockIcon) lockIcon.textContent = '🔓';
    if (lockTitle) lockTitle.textContent = 'CONFIGURATION UNLOCKED (DRAFT SETUP MODE)';
    if (lockDesc) lockDesc.textContent = 'Tournament parameters, starting capital, and share universe are currently editable. Launching or scheduling will lock them.';
    if (lockBadge) {
      lockBadge.textContent = 'DRAFT MODE';
      lockBadge.style.background = '#E2E8F0';
      lockBadge.style.color = '#334155';
    }
  }

  // Streamline Host Controls: lock/dim controls not useful after game has begun
  const isGameActive = gameState.status === 'LIVE' || gameState.status === 'PAUSED' || gameState.status === 'COUNTDOWN' || gameState.configLocked;
  const btnTeamSetup = document.getElementById('btnHostTeamSetup');
  const btnSettings = document.getElementById('btnHostSettings');
  const btnLoadTest = document.getElementById('btnHostLoadTest');
  const btnLoadLive = document.getElementById('btnHostLoadLive');

  if (btnTeamSetup) {
    btnTeamSetup.style.opacity = isGameActive ? '0.5' : '1';
    btnTeamSetup.title = isGameActive ? 'Team rosters are locked during active championship' : 'Configure Teams & Logins';
  }
  if (btnSettings) {
    btnSettings.style.opacity = isGameActive ? '0.5' : '1';
    btnSettings.title = isGameActive ? 'Event settings are locked during active championship' : 'Configure Tournament Settings';
  }
  if (btnLoadTest) {
    btnLoadTest.style.display = isGameActive ? 'none' : 'inline-flex';
  }
  if (btnLoadLive) {
    btnLoadLive.style.display = isGameActive ? 'none' : 'inline-flex';
  }

  // 1. Render Stocks Table (Only selected/enabled universe stocks are visible on the live floor; disabled shares are hidden)
  const allUniverse = (allCompaniesUniverse && allCompaniesUniverse.length > 0) ? allCompaniesUniverse : (companies || []);
  const stockList = allUniverse.filter((stock) => stock.isEnabled !== false);
  const stocksTbody = document.getElementById('hostStocksTbody');
  if (stocksTbody && stockList && stockList.length > 0) {
    stocksTbody.innerHTML = stockList.map((stock) => {
      const openPrice = stock.dayOpenPrice !== undefined ? stock.dayOpenPrice : (stock.base_price || stock.currentPrice || 100);
      const curPrice = stock.currentPrice !== undefined ? stock.currentPrice : (stock.base_price || openPrice);
      const pctVal = openPrice > 0 ? ((curPrice - openPrice) / openPrice) * 100 : 0;
      const isUp = pctVal >= 0;
      const isEnabled = stock.isEnabled !== false;
      return `
        <tr style="border-bottom: 1px solid var(--subtle-border); ${!isEnabled ? 'opacity: 0.6; background-color: rgba(0,0,0,0.02);' : ''}">
          <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${stock.ticker}</td>
          <td style="padding: 8px;">${escapeHtml(stock.name || stock.ticker)}</td>
          <td style="padding: 8px; color: var(--text-muted); font-size: 11px;">${escapeHtml(stock.sector || 'Equities')}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${curPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${openPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${pctVal.toFixed(2)}%
          </td>
          <td style="padding: 8px; text-align: center;">
            <span class="badge ${stock.isHalted ? 'badge-halted' : (isEnabled ? 'badge-active' : 'badge-paused')}" style="font-size: 10px; padding: 2px 6px;">
              ${stock.isHalted ? `HALTED (${stock.haltDirection || 'CIRCUIT'})` : (isEnabled ? 'ACTIVE' : 'DISABLED')}
            </span>
          </td>
          <td style="padding: 8px; text-align: center;">
            ${stock.isHalted ? `
              <button onclick="hostUnhaltStock('${stock.ticker}')" class="btn btn-primary" style="padding: 3px 8px; font-size: 11px;">
                Release Halt
              </button>
            ` : `
              <button onclick="toggleShareActive('${stock.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px;">
                ${isEnabled ? 'Disable' : 'Enable'}
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. High-performance selective tab rendering (only updates active tab to prevent DOM lag)
  if (activeHostTab === 'universe' || activeHostTab === 'setup') {
    renderHostUniverseView(allCompaniesUniverse || companies || []);
    renderHostLauncherTab(state);
  }
  if (activeHostTab === 'launcher') {
    renderHostLauncherTab(state);
  } else if (activeHostTab === 'projector' || activeHostTab === 'stage') {
    renderHostProjectorTab(state);
    renderHostCommentaryTab(state);
    renderHostSoundTab(state);
  } else if (activeHostTab === 'commentary') {
    renderHostCommentaryTab(state);
  } else if (activeHostTab === 'day' || activeHostTab === 'reports') {
    renderHostDayTab(state);
    renderHostAnalysis(state);
  } else if (activeHostTab === 'analysis') {
    renderHostAnalysis(state);
  } else if (activeHostTab === 'sound') {
    renderHostSoundTab(state);
  } else if (activeHostTab === 'news' || activeHostTab === 'floor') {
    renderHostNews(state);
  }

  // 3. Render Leaderboard Table
  if (leaderboard) {
    document.getElementById('hostLeaderboardTbody').innerHTML = leaderboard.map((t, idx) => {
      const isUp = t.pnlPct >= 0;
      return `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px; font-weight: 800;">#${idx + 1}</td>
          <td style="padding: 8px; font-weight: 700; color: var(--text-forest);">${escapeHtml(t.name)}</td>
          <td style="padding: 8px; color: var(--text-muted); font-size: 11px;">${escapeHtml(t.members || '—')}</td>
          <td style="padding: 8px; text-align: right;">${formatINR(t.cash)}</td>
          <td style="padding: 8px; text-align: right;">${formatINR(t.holdingsValue)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800;">${formatINR(t.netWorth)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${t.pnlPct.toFixed(2)}%
          </td>
          <td style="padding: 8px; text-align: center;">${t.tradeCount}</td>
        </tr>
      `;
    }).join('');
  }

  // 4. Render Trade Stream Table (if tab is active or initially)
  if (recentTrades && (activeHostTab === 'trades' || activeHostTab === 'stocks')) {
    const tradesTbody = document.getElementById('hostRecentTradesTbody');
    if (tradesTbody) {
      if (recentTrades.length === 0) {
        tradesTbody.innerHTML = `<tr><td colspan="10" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No trades executed yet.</td></tr>`;
      } else {
        tradesTbody.innerHTML = recentTrades.map((tr) => `
          <tr style="border-bottom: 1px solid var(--subtle-border);">
            <td style="padding: 8px;">#${tr.seq}</td>
            <td style="padding: 8px;">${tr.timestamp}</td>
            <td style="padding: 8px; font-weight: 700;">${escapeHtml(tr.teamName)}</td>
            <td style="padding: 8px;"><span class="badge ${tr.type === 'BUY' ? 'badge-active' : 'badge-paused'}" style="font-size: 9px; padding: 2px 5px;">${tr.type}</span></td>
            <td style="padding: 8px; font-weight: 700;">${tr.ticker}</td>
            <td style="padding: 8px; text-align: right;">${tr.quantity}</td>
            <td style="padding: 8px; text-align: right;">₹${tr.price.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right;">₹${tr.grossValue.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; color: var(--text-muted);">₹${tr.fee.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-weight: 700;">₹${tr.cashAfter.toFixed(2)}</td>
          </tr>
        `).join('');
      }
    }
  }
}

// Host Matrix Actions
let lastPauseActionTime = 0;
function hostPauseMarket(mode = 'VISIBLE_FROZEN') {
  if (!ws || !sessionToken) return;
  const gs = latestState?.gameState;
  if (gs && (gs.status === 'DAY_COMPLETED' || gs.isConcluded)) {
    showOrderToast(`Cannot pause: Day ${gs.currentDay || 1} has already concluded.`, false);
    return;
  }
  if (gs && gs.isPaused) {
    showOrderToast('Trading is already paused. Resume trading when you are ready.', false);
    return;
  }
  if (Date.now() - lastPauseActionTime < 400) return;
  lastPauseActionTime = Date.now();
  ws.send(JSON.stringify({ action: 'HOST_PAUSE', session_token: sessionToken, pauseMode: mode }));
}

let lastResumeActionTime = 0;
function hostResumeMarket() {
  if (!ws || !sessionToken) return;
  const gs = latestState?.gameState;
  if (gs && (gs.status === 'DAY_COMPLETED' || gs.isConcluded)) {
    showOrderToast(`Day ${gs.currentDay || 1} has ended. Trading cannot be resumed. Review the results and prepare the next day.`, false);
    return;
  }
  if (gs && !gs.isPaused && gs.status === 'LIVE') {
    showOrderToast('Trading is already active. Market is running live.', false);
    return;
  }
  if (Date.now() - lastResumeActionTime < 400) return;
  lastResumeActionTime = Date.now();
  ws.send(JSON.stringify({ action: 'HOST_RESUME_COUNTDOWN', session_token: sessionToken }));
}

function hostCancelSchedule() {
  if (!ws || !sessionToken || currentRole !== 'HOST') return;
  showInlineConfirmToast(
    'Cancel the scheduled countdown and return to Standby?',
    () => {
      ws.send(JSON.stringify({ action: 'HOST_CANCEL_SCHEDULE', session_token: sessionToken }));
      showOrderToast('Scheduled timer cancelled. Event returned to Standby.', true);
    },
    'Cancel Schedule',
    'Keep'
  );
}

function hostNextDay() {
  if (!ws || !sessionToken) return;
  // Used for direct calls; handleFlowPrimaryAction uses hostConcludeAndAdvanceDay
  ws.send(JSON.stringify({ action: 'HOST_NEXT_DAY', session_token: sessionToken }));
}

function hostTriggerNews(event_id) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_TRIGGER_NEWS', session_token: sessionToken, event_id }));
}

function hostUnhaltStock(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_UNHALT_STOCK', session_token: sessionToken, ticker }));
}

function hostSwitchScenario(mode) {
  if (!ws || !sessionToken) return;
  showInlineConfirmToast(
    `Switch scenario mode to ${mode.toUpperCase()}? This resets the market engine.`,
    () => ws.send(JSON.stringify({ action: 'HOST_SWITCH_SCENARIO', session_token: sessionToken, mode })),
    'Switch',
    'Cancel'
  );
}

function hostConcludeChampionship() {
  if (!ws || !sessionToken) return;
  // Finalize last day first, then pause the market as concluded
  ws.send(JSON.stringify({ action: 'HOST_FINALIZE_DAY', session_token: sessionToken }));
  setTimeout(() => {
    ws.send(JSON.stringify({ action: 'HOST_CONCLUDE_CHAMPIONSHIP', session_token: sessionToken }));
    showOrderToast('🏆 Championship concluded! Launching winner ceremony...', true);
    setTimeout(() => hostStartWinnerPresentation(), 800);
  }, 600);
}

// ==========================================
// 8. SHARE UNIVERSE MANAGEMENT CONTROLLERS
// ==========================================
function renderHostUniverseView(universe) {
  if (!universe) return;
  const total = universe.length;
  const activeCount = universe.filter((c) => c.isEnabled !== false).length;
  const disabledCount = total - activeCount;
  const sectorsSet = new Set(universe.map((c) => c.sector));

  const statTotal = document.getElementById('universeStatTotal');
  const statActive = document.getElementById('universeStatActive');
  const statDisabled = document.getElementById('universeStatDisabled');
  const statSectors = document.getElementById('universeStatSectors');

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = activeCount;
  if (statDisabled) statDisabled.textContent = disabledCount;
  if (statSectors) statSectors.textContent = sectorsSet.size;

  const tbody = document.getElementById('hostUniverseTbody');
  if (!tbody) return;

  tbody.innerHTML = universe.map((c) => {
    const isEnabled = c.isEnabled !== false;
    const currentPrice = c.currentPrice !== undefined ? c.currentPrice : c.base_price;
    const basePrice = c.base_price !== undefined ? c.base_price : currentPrice;
    const vol = c.volatility_factor || 0.004;
    const beta = c.beta || 1.0;

    return `
      <tr style="border-bottom: 1px solid var(--subtle-border); ${!isEnabled ? 'opacity: 0.6; background-color: rgba(0,0,0,0.02);' : ''}">
        <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${c.ticker}</td>
        <td style="padding: 8px;">
          <div style="font-weight: 600;">${c.name}</div>
          ${c.fundamentals && c.fundamentals.summary ? `<div style="font-size: 11px; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.fundamentals.summary}</div>` : ''}
        </td>
        <td style="padding: 8px;">
          <span class="badge" style="background-color: var(--surface-cream); border: 1px solid var(--subtle-border); font-size: 10px;">${c.sector}</span>
        </td>
        <td style="padding: 8px; text-align: right; font-weight: 600;">₹${basePrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; font-weight: 700;">₹${currentPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="toggleShareActive('${c.ticker}')" class="badge ${isEnabled ? 'badge-active' : 'badge-paused'}" style="cursor: pointer; border: none; font-size: 11px; padding: 4px 8px;" title="Click to ${isEnabled ? 'disable and exclude' : 'enable and include'}">
            ${isEnabled ? '● Active in Market' : '○ Disabled'}
          </button>
        </td>
        <td style="padding: 8px; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button onclick="openShareEditorModal('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px;" title="Edit share details">✏️</button>
            <button onclick="duplicateShare('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px;" title="Duplicate as template">📋</button>
            <button onclick="deleteShare('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; color: var(--error-red); border-color: var(--error-border);" title="Delete share">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleShareActive(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_TOGGLE_SHARE', session_token: sessionToken, ticker }));
}

// Terminal Launcher & Logins Manager
function renderHostLauncherTab(state) {
  const tbody = document.getElementById('hostLauncherTbody');
  if (!tbody) return;

  const origin = window.location.origin;
  const teamsList = state.teams || state.leaderboard || [];
  const maxTeams = Math.max(16, teamsList.length);
  const rows = [];

  for (let i = 1; i <= maxTeams; i++) {
    const username = `team${i}`;
    const password = `trade${i}00`;
    const foundTeam = teamsList.find((t) => t.id === username || t.id === `team_${i}` || t.name === `Team ${i}` || t.name === `TEAM ${i}`) || {};
    const teamName = foundTeam.name || `Team ${i}`;
    const members = foundTeam.members || '—';
    const directUrl = `${origin}/?team=${username}&pass=${password}`;

    rows.push(`
      <tr style="border-bottom: 1px solid var(--subtle-border);">
        <td style="padding: 8px; font-weight: 700; color: var(--champagne-accent);">Desk #${i}</td>
        <td style="padding: 8px; font-weight: 700; color: var(--text-forest);">${escapeHtml(teamName)}</td>
        <td style="padding: 8px; font-family: var(--font-sans); color: var(--text-muted); font-size: 11px;">${escapeHtml(members)}</td>
        <td style="padding: 8px; font-weight: 800; color: #1E40AF;">${username}</td>
        <td style="padding: 8px; color: var(--text-charcoal); background-color: var(--surface-cream); border-radius: 4px;">${password}</td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="openTerminalTab('/?team=${username}&pass=${password}')" class="btn btn-sage" style="padding: 3px 10px; font-size: 11px;">
            Launch Desk
          </button>
        </td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="copyToClipboard('${directUrl}')" class="btn btn-outline" style="padding: 3px 8px; font-size: 11px;" title="Copy Desk Link">
            🔗 Copy Link
          </button>
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = rows.join('');
}

function openTerminalTab(path) {
  window.open(path, '_blank');
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showOrderToast('✓ Copied to clipboard!', true);
    }).catch(() => {
      prompt('Copy this link:', text);
    });
  } else {
    prompt('Copy this link:', text);
  }
}

function copyAllCredentialsToClipboard() {
  const origin = window.location.origin;
  let text = `==========================================================\n`;
  text += `THE TRADING FLOOR CHAMPIONSHIP 2026 — TERMINAL CREDENTIALS\n`;
  text += `==========================================================\n\n`;
  text += `[HOST MASTER CONTROL]\nURL: ${origin}/?role=host\nUsername: host\nPassword: host2026\n\n`;
  text += `[AUDITORIUM STAGE PROJECTOR]\nURL: ${origin}/?role=projector\nUsername: projector\nPassword: screen2026\n\n`;
  text += `[TRADER TERMINALS (TEAMS 1 - 16)]\n`;
  for (let i = 1; i <= 16; i++) {
    text += `Team ${i}: Username: team${i} | Password: trade${i}00 | Direct Link: ${origin}/?team=team${i}\n`;
  }
  text += `\nGeneral Login: ${origin}/\n`;

  copyToClipboard(text);
}

// ==========================================
// INTELLIGENT PROJECTOR, COMMENTARY & DAY LIFECYCLE CONTROLLERS
// ==========================================
function renderHostProjectorTab(state) {
  const pState = state.projectorState || { mode: 'AUTO_CYCLE', currentScene: 'SCENE_MARKET_BOARD', sceneDurationSeconds: 12 };
  const modeAutoBtn = document.getElementById('btnProjModeAuto');
  const modeFixedBtn = document.getElementById('btnProjModeFixed');
  if (modeAutoBtn && modeFixedBtn) {
    if (pState.mode === 'FIXED_SCREEN') {
      modeAutoBtn.className = 'btn btn-outline';
      modeFixedBtn.className = 'btn btn-sage';
    } else {
      modeAutoBtn.className = 'btn btn-sage';
      modeFixedBtn.className = 'btn btn-outline';
    }
  }

  const durationInput = document.getElementById('hostProjDurationInput');
  if (durationInput && !durationInput.matches(':focus')) {
    durationInput.value = pState.sceneDurationSeconds || 12;
  }

  const sceneBtns = {
    'SCENE_MARKET_BOARD': document.getElementById('btnSceneMarketBoard'),
    'SCENE_INDICES': document.getElementById('btnSceneIndices'),
    'SCENE_STRATEGY': document.getElementById('btnSceneStrategy'),
    'SCENE_LEADERBOARD': document.getElementById('btnSceneLeaderboard'),
    'SCENE_NEWS': document.getElementById('btnSceneNews')
  };

  const active = pState.currentScene || 'SCENE_MARKET_BOARD';
  Object.keys(sceneBtns).forEach((sKey) => {
    const btn = sceneBtns[sKey];
    if (btn) {
      if (sKey === active) {
        btn.style.borderColor = 'var(--champagne-accent)';
        btn.style.background = '#FEF3C7';
        btn.style.fontWeight = '800';
      } else {
        btn.style.borderColor = '';
        btn.style.background = '';
        btn.style.fontWeight = 'normal';
      }
    }
  });
}

function renderHostCommentaryTab(state) {
  const listEl = document.getElementById('hostAnchorCommentaryList');
  if (!listEl) return;

  const prompts = state.anchorCommentary || [];
  if (prompts.length === 0) {
    listEl.innerHTML = `
      <div class="cream-panel" style="padding: 24px; text-align: center; color: var(--text-muted);">
        Awaiting live market orders to formulate strategic anchor commentary observations...
      </div>
    `;
    return;
  }

  listEl.innerHTML = prompts.map((item) => {
    let catColor = '#2563EB';
    let catBg = '#EFF6FF';
    if (item.category === 'CONCENTRATION') {
      catColor = '#DC2626';
      catBg = '#FEF2F2';
    } else if (item.category === 'CASH_POSITION') {
      catColor = '#059669';
      catBg = '#ECFDF5';
    } else if (item.category === 'INDEX_MOMENTUM') {
      catColor = '#7C3AED';
      catBg = '#F5F3FF';
    } else if (item.category === 'RANK_MOVEMENT') {
      catColor = '#D97706';
      catBg = '#FFFBEB';
    }

    return `
      <div class="cream-panel" style="padding: 16px; border-left: 4px solid ${catColor}; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge" style="background: ${catBg}; color: ${catColor}; font-size: 10px; font-weight: 800;">
              ${item.category}
            </span>
            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
              ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
          <p style="font-size: 14px; color: var(--text-forest); font-weight: 600; margin: 0; line-height: 1.5;">
            "${item.prompt}"
          </p>
        </div>
        <button onclick="copyToClipboard('${item.prompt.replace(/'/g, "\\'")}')" class="btn btn-outline" style="padding: 6px 12px; font-size: 11px; flex-shrink: 0;" title="Copy for Host/Anchor Speech">
          📋 Copy
        </button>
      </div>
    `;
  }).join('');
}

function renderHostDayTab(state) {
  const container = document.getElementById('hostDaySnapshotsContainer');
  if (!container) return;

  const curDay = (state.gameState && state.gameState.currentDay) || 1;
  const totalDays = (state.gameState && state.gameState.totalDays) || 3;
  const snapshots = (state.gameState && state.gameState.dailyLeaderboards) || {};

  let html = `
    <div style="margin-bottom: 20px;">
      <div class="cream-panel" style="padding: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 16px; font-weight: 900; color: var(--text-forest);">ACTIVE TOURNAMENT DAY ${curDay} OF ${totalDays}</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            Click 'Finalize Current Day Standings' at the end of each session to freeze the official daily closing snapshot.
          </div>
        </div>
        <span class="badge badge-champagne" style="font-size: 13px; font-weight: 800;">PORTFOLIO MODEL: CONTINUOUS OVERNIGHT</span>
      </div>
    </div>
  `;

  const snapshotKeys = Object.keys(snapshots);
  if (snapshotKeys.length === 0) {
    html += `
      <div style="padding: 32px; text-align: center; color: var(--text-muted); border: 2px dashed var(--subtle-border); border-radius: var(--radius-md);">
        No completed daily snapshots finalized yet. Day 1 is currently in progress.
      </div>
    `;
  } else {
    html += snapshotKeys.map((key) => {
      const snap = snapshots[key];
      return `
        <div class="luxury-card" style="margin-bottom: 20px; padding: 18px; border: 2px solid var(--card-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--subtle-border); padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text-forest); margin: 0;">
                📅 Official Finalized Standings &bull; Day ${snap.day}
              </h3>
              <span style="font-size: 11px; color: var(--text-muted);">Finalized at ${new Date(snap.finalizedAt).toLocaleTimeString()}</span>
            </div>
            <span class="badge badge-sage" style="font-size: 11px; font-weight: 800;">VERIFIED SNAPSHOT</span>
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--subtle-border); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px;">Rank</th>
                  <th style="padding: 6px;">Desk Name</th>
                  <th style="padding: 6px; text-align: center;">Rank Delta</th>
                  <th style="padding: 6px; text-align: right;">Day Open Value</th>
                  <th style="padding: 6px; text-align: right;">Day Close Value</th>
                  <th style="padding: 6px; text-align: right;">Daily P&amp;L</th>
                  <th style="padding: 6px; text-align: right;">Daily Return %</th>
                  <th style="padding: 6px; text-align: right;">Cumulative Return %</th>
                </tr>
              </thead>
              <tbody style="font-family: var(--font-mono);">
                ${(snap.rankings || []).map((r) => {
                  let deltaBadge = '<span style="color: var(--text-muted);">• 0</span>';
                  if (r.rankDelta > 0) deltaBadge = `<span style="color: var(--price-up); font-weight: 800;">▲ +${r.rankDelta}</span>`;
                  else if (r.rankDelta < 0) deltaBadge = `<span style="color: var(--price-down); font-weight: 800;">▼ ${r.rankDelta}</span>`;

                  const isDailyUp = r.dailyPnl >= 0;
                  const isCumUp = r.cumulativeReturnPct >= 0;

                  return `
                    <tr style="border-bottom: 1px solid var(--subtle-border);">
                      <td style="padding: 6px; font-weight: 800;">#${r.rank}</td>
                      <td style="padding: 6px; font-family: var(--font-sans); font-weight: 700; color: var(--text-forest);">${r.teamName}</td>
                      <td style="padding: 6px; text-align: center;">${deltaBadge}</td>
                      <td style="padding: 6px; text-align: right;">${formatINR(r.openingPortfolioValue)}</td>
                      <td style="padding: 6px; text-align: right; font-weight: 800;">${formatINR(r.closingPortfolioValue)}</td>
                      <td style="padding: 6px; text-align: right; font-weight: 700;" class="${isDailyUp ? 'price-up' : 'price-down'}">
                        ${isDailyUp ? '+' : ''}${formatINR(r.dailyPnl)}
                      </td>
                      <td style="padding: 6px; text-align: right; font-weight: 700;" class="${isDailyUp ? 'price-up' : 'price-down'}">
                        ${isDailyUp ? '+' : ''}${r.dailyReturnPct.toFixed(2)}%
                      </td>
                      <td style="padding: 6px; text-align: right; font-weight: 800;" class="${isCumUp ? 'price-up' : 'price-down'}">
                        ${isCumUp ? '+' : ''}${r.cumulativeReturnPct.toFixed(2)}%
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }
  container.innerHTML = html;
}

function hostSetProjectorMode(mode) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_PROJECTOR_MODE',
    session_token: sessionToken,
    mode: mode
  }));
}

function hostSetProjectorScene(scene) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_PROJECTOR_MODE',
    session_token: sessionToken,
    mode: 'FIXED_SCREEN',
    scene: scene
  }));
}

function hostSaveProjectorDuration() {
  if (!ws || !sessionToken) return;
  const input = document.getElementById('hostProjDurationInput');
  const dur = input ? parseInt(input.value, 10) : 12;
  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_PROJECTOR_MODE',
    session_token: sessionToken,
    sceneDurationSeconds: dur
  }));
  showOrderToast(`✓ Projector scene duration set to ${dur}s`, true);
}

function hostFinalizeDay() {
  if (!ws || !sessionToken) return;
  const day = latestState ? latestState.gameState.currentDay : '';
  showInlineConfirmToast(
    `Finalize Day ${day} standings? This records official closing prices and locks the daily snapshot.`,
    () => {
      ws.send(JSON.stringify({ action: 'HOST_FINALIZE_DAY', session_token: sessionToken }));
      showOrderToast(`✓ Day ${day} finalized! Official snapshot locked.`, true);
    },
    'Finalize Day',
    'Cancel'
  );
}

function hostExitWinnerPresentation() {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_EXIT_WINNER_PRESENTATION',
    session_token: sessionToken
  }));
  showOrderToast('✓ Exited winner presentation mode. Restored live market cycle.', true);
}

function openShareEditorModal(ticker) {
  const modal = document.getElementById('shareEditorModal');
  if (!modal) return;

  const originalInput = document.getElementById('shareEditOriginalTicker');
  const tickerInput = document.getElementById('shareEditTicker');
  const nameInput = document.getElementById('shareEditName');
  const sectorInput = document.getElementById('shareEditSector');
  const basePriceInput = document.getElementById('shareEditBasePrice');
  const volInput = document.getElementById('shareEditVol');
  const betaInput = document.getElementById('shareEditBeta');
  const descInput = document.getElementById('shareEditDescription');
  const enabledInput = document.getElementById('shareEditEnabled');
  const title = document.getElementById('shareEditorModalTitle');

  if (ticker && latestState) {
    const list = latestState.allCompaniesUniverse || latestState.companies || [];
    const stock = list.find((c) => c.ticker === ticker);
    if (stock) {
      originalInput.value = stock.ticker;
      tickerInput.value = stock.ticker;
      tickerInput.disabled = true;
      nameInput.value = stock.name;
      sectorInput.value = stock.sector;
      basePriceInput.value = stock.base_price || stock.currentPrice;
      volInput.value = stock.volatility_factor || 0.004;
      betaInput.value = stock.beta || 1.0;
      descInput.value = (stock.fundamentals && stock.fundamentals.summary) || '';
      enabledInput.checked = stock.isEnabled !== false;
      title.textContent = `Edit Company Share — ${stock.ticker}`;
      modal.classList.remove('hidden');
      return;
    }
  }

  // Adding new share
  originalInput.value = '';
  tickerInput.value = '';
  tickerInput.disabled = false;
  nameInput.value = '';
  sectorInput.value = '';
  basePriceInput.value = '100.00';
  volInput.value = '0.004';
  betaInput.value = '1.0';
  descInput.value = '';
  enabledInput.checked = true;
  title.textContent = 'Add New Company to Market Universe';
  modal.classList.remove('hidden');
}

function closeShareEditorModal() {
  const modal = document.getElementById('shareEditorModal');
  if (modal) modal.classList.add('hidden');
}

function saveShareEditorForm(e) {
  if (e) e.preventDefault();
  if (!ws || !sessionToken) return;

  const originalTicker = document.getElementById('shareEditOriginalTicker').value;
  const ticker = document.getElementById('shareEditTicker').value.trim().toUpperCase();
  const name = document.getElementById('shareEditName').value.trim();
  const sector = document.getElementById('shareEditSector').value.trim();
  const base_price = parseFloat(document.getElementById('shareEditBasePrice').value);
  const volatility_factor = parseFloat(document.getElementById('shareEditVol').value) || 0.004;
  const beta = parseFloat(document.getElementById('shareEditBeta').value) || 1.0;
  const summary = document.getElementById('shareEditDescription').value.trim();
  const isEnabled = document.getElementById('shareEditEnabled').checked;

  if (!ticker || isNaN(base_price) || base_price <= 0) {
    alert('Please enter a valid ticker symbol and positive starting base price.');
    return;
  }

  if (originalTicker) {
    ws.send(JSON.stringify({
      action: 'HOST_EDIT_SHARE',
      session_token: sessionToken,
      ticker: originalTicker,
      name,
      sector,
      base_price,
      volatility_factor,
      beta,
      summary
    }));
  } else {
    ws.send(JSON.stringify({
      action: 'HOST_ADD_SHARE',
      session_token: sessionToken,
      ticker,
      name,
      sector,
      base_price,
      volatility_factor,
      beta,
      summary
    }));
  }

  closeShareEditorModal();
}

function duplicateShare(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_DUPLICATE_SHARE', session_token: sessionToken, ticker }));
}

function deleteShare(ticker) {
  if (!ws || !sessionToken) return;
  if (confirm(`Permanently remove ${ticker} from the market universe? Existing team holdings in this stock will be cleared.`)) {
    ws.send(JSON.stringify({ action: 'HOST_DELETE_SHARE', session_token: sessionToken, ticker }));
  }
}

function applyMarketTemplate(templateId) {
  if (!ws || !sessionToken) return;
  const map = {
    'balanced': 'all_active',
    'all': 'all_active',
    'tech_auto': 'tech_auto_focus',
    'high_vol': 'high_volatility',
    'defensive': 'banking_defensive'
  };
  const targetId = map[templateId] || templateId;
  ws.send(JSON.stringify({ action: 'HOST_APPLY_MARKET_TEMPLATE', session_token: sessionToken, templateId: targetId }));
}

function hostRandomizePrices(variancePct = 10) {
  if (!ws || !sessionToken) return;
  if (confirm(`Randomize active share base prices by up to ±${variancePct}%? This establishes new baseline prices for tournament rounds.`)) {
    ws.send(JSON.stringify({ action: 'HOST_RANDOMIZE_PRICES', session_token: sessionToken, variancePct }));
  }
}

function hostResetUniverseBaseline() {
  if (!ws || !sessionToken) return;
  if (confirm('Reset the entire stock universe back to the official 12 blue-chip baseline? This discards custom shares.')) {
    ws.send(JSON.stringify({ action: 'HOST_RESET_UNIVERSE_BASELINE', session_token: sessionToken }));
  }
}

function downloadUniverseExport(format = 'json') {
  const url = format === 'csv' ? '/api/export/universe-csv' : '/api/export/universe';
  window.open(url, '_blank');
}

function dismissPodiumCeremony() {
  document.getElementById('winnerPodiumModal').classList.add('hidden');
  if (currentRole === 'HOST' && ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_DISMISS_PODIUM', session_token: sessionToken }));
  }
}

function downloadReport(type) {
  if (!sessionToken) return;
  let endpoint = '';
  if (type === 'standings') endpoint = '/api/export/standings';
  else if (type === 'trades') endpoint = '/api/export/trades';
  else if (type === 'audit-csv') endpoint = '/api/export/audit-csv';
  else if (type === 'audit-json') endpoint = '/api/audit-log';

  if (endpoint) {
    window.open(`${endpoint}?token=${encodeURIComponent(sessionToken)}`, '_blank');
  }
}

// Custom News Modal
function openCustomNewsModal() {
  if (!latestState) return;
  const select = document.getElementById('newsTickerInput');
  select.innerHTML = `<option value="ALL">ALL COMPANIES (GLOBAL MACRO)</option>` +
    latestState.companies.map((c) => `<option value="${c.ticker}">${c.ticker} — ${c.name}</option>`).join('');
  document.getElementById('customNewsModal').classList.remove('hidden');
}

function closeCustomNewsModal() {
  document.getElementById('customNewsModal').classList.add('hidden');
}

document.getElementById('customNewsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || !sessionToken) return;

  const headline = document.getElementById('newsHeadlineInput').value;
  const explanation = document.getElementById('newsExplanationInput').value;
  const ticker = document.getElementById('newsTickerInput').value;
  const deltaPct = document.getElementById('newsDeltaInput').value;
  const durationSec = document.getElementById('newsDurationInput').value;

  ws.send(JSON.stringify({
    action: 'HOST_CREATE_CUSTOM_NEWS',
    session_token: sessionToken,
    headline,
    explanation,
    ticker,
    deltaPct,
    durationSec
  }));

  closeCustomNewsModal();
});

// Event Settings Modal
function openEventSettingsModal() {
  if (!latestState) return;
  const g = latestState.gameState;
  document.getElementById('settingEventTitle').value = g.title || '';
  document.getElementById('settingDayDuration').value = g.dayDurationSeconds || 1800;
  document.getElementById('settingTotalDays').value = g.totalDays || 3;
  document.getElementById('settingCircuitPercent').value = g.circuitBreakerPercent || 20;
  document.getElementById('settingStartingCash').value = g.startingCash || 500000;
  document.getElementById('settingFeeBps').value = g.transactionFeeBps || 0;
  document.getElementById('eventSettingsModal').classList.remove('hidden');
}

function closeEventSettingsModal() {
  document.getElementById('eventSettingsModal').classList.add('hidden');
}

document.getElementById('eventSettingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || !sessionToken) return;

  const title = document.getElementById('settingEventTitle').value.trim();
  const dayDurationSeconds = parseInt(document.getElementById('settingDayDuration').value, 10);
  const totalDays = parseInt(document.getElementById('settingTotalDays').value, 10);
  const circuitBreakerPercent = parseFloat(document.getElementById('settingCircuitPercent').value);
  const startingCash = parseFloat(document.getElementById('settingStartingCash').value);
  const transactionFeeBps = parseInt(document.getElementById('settingFeeBps').value, 10) || 0;

  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_EVENT_CONFIG',
    session_token: sessionToken,
    title,
    dayDurationSeconds,
    totalDays,
    circuitBreakerPercent,
    startingCash,
    transactionFeeBps
  }));

  closeEventSettingsModal();
});

// Teams Setup Manager & CSV
let localTeamsRoster = [];

function openTeamSetupModal() {
  if (!latestState) return;
  if (latestState.allTeamsList && latestState.allTeamsList.length > 0) {
    localTeamsRoster = JSON.parse(JSON.stringify(latestState.allTeamsList));
  } else if (localTeamsRoster.length === 0) {
    generateTeamRows(12);
    return;
  }
  renderTeamsSetupTable();
  document.getElementById('teamSetupModal').classList.remove('hidden');
}

function closeTeamSetupModal() {
  document.getElementById('teamSetupModal').classList.add('hidden');
}

function generateTeamRows(count) {
  const defaultNames = [
    'Dalal Street Titans', 'Bullish Bears', 'Alpha Hedge', 'Quantum Traders',
    'Apex Capital', 'Vanguard Vipers', 'Sterling Bulls', 'Maverick Fund',
    'Zenith Asset Mgmt', 'Phoenix Wealth', 'Starlight Equity', 'Omega Syndicate',
    'Matrix Capital', 'Falcon Traders', 'Centurion Wealth', 'Ironclad Asset'
  ];

  localTeamsRoster = [];
  for (let i = 1; i <= count; i++) {
    localTeamsRoster.push({
      id: `team_${i}`,
      username: `team${i}`,
      name: defaultNames[i - 1] || `Team ${i}`,
      members: `Trader ${i}A, Trader ${i}B`,
      password: `trade${i}00`,
      startingCash: latestState?.gameState?.startingCash || 500000
    });
  }
  renderTeamsSetupTable();
  document.getElementById('teamSetupModal').classList.remove('hidden');
}

function addNewTeamRow() {
  const newNum = localTeamsRoster.length + 1;
  localTeamsRoster.push({
    id: `team_${newNum}`,
    username: `team${newNum}`,
    name: `Team ${newNum}`,
    members: '',
    password: `trade${newNum}00`,
    startingCash: latestState?.gameState?.startingCash || 500000
  });
  renderTeamsSetupTable();
}

function deleteTeamRow(index) {
  if (localTeamsRoster.length <= 2) {
    alert('At least 2 teams are required for a championship competition.');
    return;
  }
  localTeamsRoster.splice(index, 1);
  localTeamsRoster.forEach((t, idx) => {
    t.id = `team_${idx + 1}`;
    t.username = `team${idx + 1}`;
  });
  renderTeamsSetupTable();
}

function renderTeamsSetupTable() {
  const tbody = document.getElementById('teamsSetupTbody');
  tbody.innerHTML = localTeamsRoster.map((t, idx) => `
    <tr style="border-bottom: 1px solid var(--subtle-border);">
      <td style="padding: 8px; font-family: var(--font-mono); font-weight: 700; color: var(--text-forest);">${t.username}</td>
      <td style="padding: 8px;">
        <input type="text" value="${t.name}" onchange="localTeamsRoster[${idx}].name = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px;" />
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${t.members || ''}" onchange="localTeamsRoster[${idx}].members = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px;" placeholder="Trader names..." />
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${t.password || `trade${idx + 1}00`}" onchange="localTeamsRoster[${idx}].password = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono); width: 110px;" />
      </td>
      <td style="padding: 8px; text-align: center;">
        <button onclick="deleteTeamRow(${idx})" class="modal-close-btn" style="color: var(--error-red);">✕</button>
      </td>
    </tr>
  `).join('');
}

function exportTeamsCsv() {
  const headers = ['Username', 'Team Name', 'Members', 'Password'];
  const rows = localTeamsRoster.map((t) => [
    `"${t.username}"`,
    `"${t.name.replace(/"/g, '""')}"`,
    `"${(t.members || '').replace(/"/g, '""')}"`,
    `"${t.password}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TEAM_ROSTER_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function saveTeamsConfiguration() {
  if (!ws || !sessionToken) return;
  const resetBalances = document.getElementById('resetBalancesCheckbox').checked;

  if (confirm(`Apply and save roster of ${localTeamsRoster.length} teams? ${resetBalances ? 'All portfolios will be reset to Starting Cash.' : ''}`)) {
    ws.send(JSON.stringify({
      action: 'HOST_CONFIGURE_TEAMS',
      session_token: sessionToken,
      teams: localTeamsRoster,
      resetBalances
    }));
    closeTeamSetupModal();
  }
}

// ==========================================
// 8. WINNER PODIUM CEREMONY RENDERER
// ==========================================
function showWinnerPodium(winnerData, title) {
  if (!winnerData) return;
  const modal = document.getElementById('winnerPodiumModal');
  document.getElementById('podiumEventTitle').textContent = title || 'Championship Grand Finale';

  // 1st Place Gold
  const gold = winnerData.first;
  if (gold) {
    document.getElementById('goldTeamName').textContent = gold.name;
    document.getElementById('goldTeamMembers').textContent = gold.members ? `Members: ${gold.members}` : '';
    document.getElementById('goldNetWorth').textContent = formatINR(gold.netWorth);
    document.getElementById('goldPnl').textContent = `${gold.pnlPct >= 0 ? '+' : ''}${gold.pnlPct}% Profit Return`;
  }

  // 2nd Place Silver
  const silver = winnerData.second;
  if (silver) {
    document.getElementById('silverTeamName').textContent = silver.name;
    document.getElementById('silverTeamMembers').textContent = silver.members ? `Members: ${silver.members}` : '';
    document.getElementById('silverNetWorth').textContent = formatINR(silver.netWorth);
    document.getElementById('silverPnl').textContent = `${silver.pnlPct >= 0 ? '+' : ''}${silver.pnlPct}% Return`;
  }

  // 3rd Place Bronze
  const bronze = winnerData.third;
  if (bronze) {
    document.getElementById('bronzeTeamName').textContent = bronze.name;
    document.getElementById('bronzeTeamMembers').textContent = bronze.members ? `Members: ${bronze.members}` : '';
    document.getElementById('bronzeNetWorth').textContent = formatINR(bronze.netWorth);
    document.getElementById('bronzePnl').textContent = `${bronze.pnlPct >= 0 ? '+' : ''}${bronze.pnlPct}% Return`;
  }

  // Complete Rankings Table
  const tbody = document.getElementById('podiumRankingsTbody');
  if (winnerData.fullRankings) {
    tbody.innerHTML = winnerData.fullRankings.map((t, idx) => {
      const isUp = t.pnlPct >= 0;
      let badge = `${idx + 1}`;
      if (idx === 0) badge = '🥇 1st';
      else if (idx === 1) badge = '🥈 2nd';
      else if (idx === 2) badge = '🥉 3rd';

      return `
        <tr style="border-bottom: 1px solid var(--subtle-border); ${idx < 3 ? 'font-weight: 700; background-color: var(--surface-cream);' : ''}">
          <td style="padding: 8px; color: var(--champagne-accent);">${badge}</td>
          <td style="padding: 8px; color: var(--text-forest);">${t.name}</td>
          <td style="padding: 8px; font-family: var(--font-sans); font-size: 11px; color: var(--text-muted);">${t.members || '—'}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">${formatINR(t.cash)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800; color: var(--text-charcoal);">${formatINR(t.netWorth)}</td>
          <td style="padding: 8px; text-align: right;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${t.pnlPct}%
          </td>
        </tr>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
  createConfettiBurst();
}

function createConfettiBurst() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#B49A70', '#218653', '#D4AF37', '#8C9CAE', '#263D35', '#E3EBE3'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${Math.random() * 6 + 6}px`;
    piece.style.height = `${Math.random() * 10 + 10}px`;
    piece.style.animationDuration = `${Math.random() * 2.5 + 2.5}s`;
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    container.appendChild(piece);
  }
}

// ==========================================
// 9. GLOBAL OVERLAYS (NEWS & 3-2-1 RESUME)
// ==========================================
let breakingNewsToastTimer = null;
let currentBreakingNewsObj = null;

function showBreakingNewsToast(news) {
  if (!news) return;
  currentBreakingNewsObj = news;

  const banner = document.getElementById('breakingNewsToastBanner');
  if (!banner) {
    showNewsFlashModal(news);
    return;
  }

  // Populate Banner Elements
  const eventTypeEl = document.getElementById('bannerEventType');
  const headlineEl = document.getElementById('bannerHeadline');
  const expEl = document.getElementById('bannerExplanation');
  const trafficBadge = document.getElementById('bannerTrafficBadge');
  const progressBar = document.getElementById('bannerProgressBar');

  if (eventTypeEl) eventTypeEl.textContent = `DAY ${news.day || 1} • ${news.type || 'MARKET WIRE'}`;
  if (headlineEl) headlineEl.textContent = news.headline;
  if (expEl) expEl.textContent = news.simple_explanation || news.explanation || '';

  if (trafficBadge) {
    const isGood = (news.sentiment === 'POSITIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('GOOD')) || (news.deltaPct > 0);
    const isBad = (news.sentiment === 'NEGATIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('BAD')) || (news.deltaPct < 0);
    if (isGood) {
      trafficBadge.textContent = '🟢 POSITIVE IMPACT';
      trafficBadge.className = 'badge-news-good';
    } else if (isBad) {
      trafficBadge.textContent = '🔴 NEGATIVE IMPACT';
      trafficBadge.className = 'badge-news-bad';
    } else {
      trafficBadge.textContent = '🔵 NEUTRAL NOTICE';
      trafficBadge.className = 'badge-news-neutral';
    }
  }

  // Also prepare full modal in case user wants to expand
  prepareFullNewsModal(news);

  // Animate progress bar across 15 seconds
  if (progressBar) {
    progressBar.style.transition = 'none';
    progressBar.style.width = '100%';
    setTimeout(() => {
      if (progressBar) {
        progressBar.style.transition = 'width 15s linear';
        progressBar.style.width = '0%';
      }
    }, 60);
  }

  // Non-blocking presentation: trader continues placing orders without interruption
  banner.classList.remove('hidden', 'banner-exit');

  // Add notification pill to Trader News Tab button if available
  const newsTabBtn = document.querySelector('[data-trader-tab="news"]');
  if (newsTabBtn) {
    let badge = newsTabBtn.querySelector('.news-tab-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'news-tab-badge';
      badge.textContent = '● NEW';
      newsTabBtn.appendChild(badge);
    }
  }

  // Auto-dismiss after 15 seconds with smooth slide-up
  if (breakingNewsToastTimer) clearTimeout(breakingNewsToastTimer);
  breakingNewsToastTimer = setTimeout(() => {
    dismissBreakingNewsBanner();
  }, 15000);
}

function dismissBreakingNewsBanner() {
  if (breakingNewsToastTimer) clearTimeout(breakingNewsToastTimer);
  const banner = document.getElementById('breakingNewsToastBanner');
  if (banner) {
    banner.classList.add('banner-exit');
    setTimeout(() => {
      banner.classList.add('hidden');
      banner.classList.remove('banner-exit');
    }, 400);
  }
}

function openFullNewsModalFromBanner() {
  dismissBreakingNewsBanner();
  if (currentBreakingNewsObj) {
    showNewsFlashModal(currentBreakingNewsObj);
  }
}

function prepareFullNewsModal(news) {
  const modal = document.getElementById('newsFlashModal');
  if (!modal) return;
  const evtEl = document.getElementById('flashEventType');
  const headEl = document.getElementById('flashHeadline');
  const expEl = document.getElementById('flashExplanation');
  const trafficBadge = document.getElementById('flashTrafficBadge');
  const tickersEl = document.getElementById('flashAffectedTickers');
  const mandateEl = document.getElementById('flashDeskMandate');
  const barEl = document.getElementById('flashCountdownBar');

  if (evtEl) evtEl.textContent = `DAY ${news.day || 1} • ${news.type || 'MARKET WIRE'}`;
  if (headEl) headEl.textContent = news.headline;
  if (expEl) expEl.textContent = news.simple_explanation || news.explanation || '';

  const isGood = (news.sentiment === 'POSITIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('GOOD')) || (news.deltaPct > 0);
  const isBad = (news.sentiment === 'NEGATIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('BAD')) || (news.deltaPct < 0);

  if (trafficBadge) {
    if (isGood) {
      trafficBadge.textContent = '🟢 BULLISH RALLY (BUY SURGE)';
      trafficBadge.className = 'badge-news-good';
    } else if (isBad) {
      trafficBadge.textContent = '🔴 PANIC SELLOFF (HIGH RISK)';
      trafficBadge.className = 'badge-news-bad';
    } else {
      trafficBadge.textContent = '⚡ HIGH VOLATILITY SHOCK';
      trafficBadge.className = 'badge-news-neutral';
    }
  }

  if (tickersEl) {
    if (news.ticker) {
      tickersEl.textContent = `TARGET: ${news.ticker}`;
      tickersEl.style.display = 'inline-block';
    } else if (news.sector) {
      tickersEl.textContent = `SECTOR: ${news.sector.toUpperCase()}`;
      tickersEl.style.display = 'inline-block';
    } else {
      tickersEl.textContent = 'BROAD MARKET IMPACT';
      tickersEl.style.display = 'inline-block';
    }
  }

  if (mandateEl) {
    if (isGood) {
      mandateEl.innerHTML = '🚀 <strong>DESK MANDATE:</strong> Bullish momentum incoming. Monitor ask prices and protect against premature profit-taking.';
      mandateEl.style.borderColor = '#86EFAC';
      mandateEl.style.background = '#F0FDF4';
      mandateEl.style.color = '#166534';
    } else if (isBad) {
      mandateEl.innerHTML = '⚠️ <strong>DESK MANDATE:</strong> Extreme downside pressure expected. Re-evaluate open positions and limit orders immediately!';
      mandateEl.style.borderColor = '#FCA5A5';
      mandateEl.style.background = '#FEF2F2';
      mandateEl.style.color = '#991B1B';
    } else {
      mandateEl.innerHTML = '⚡ <strong>DESK MANDATE:</strong> Macro realignment across all sectors. High spread expected on matching order books.';
      mandateEl.style.borderColor = '#FCD34D';
      mandateEl.style.background = '#FEF3C7';
      mandateEl.style.color = '#92400E';
    }
  }

  if (barEl) {
    barEl.style.width = '100%';
  }
}

function showNewsFlashModal(news) {
  prepareFullNewsModal(news);
  const modal = document.getElementById('newsFlashModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let remaining = 20;
  const badge = document.getElementById('flashCountdownBadge');
  const barEl = document.getElementById('flashCountdownBar');
  if (badge) badge.textContent = `Auto-closing in ${remaining}s`;
  if (barEl) barEl.style.width = '100%';

  if (flashTimerHandle) clearInterval(flashTimerHandle);
  flashTimerHandle = setInterval(() => {
    remaining--;
    if (badge) badge.textContent = `Auto-closing in ${remaining}s`;
    if (barEl) barEl.style.width = `${(remaining / 20) * 100}%`;
    if (remaining <= 0) {
      dismissNewsFlash();
    }
  }, 1000);
}

function dismissNewsFlash() {
  if (flashTimerHandle) clearInterval(flashTimerHandle);
  const modal = document.getElementById('newsFlashModal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// AUTHORITATIVE SYNCHRONIZED RESUME COUNTDOWN ENGINE
// ==========================================
let currentCountdownId = null;
let countdownAnimFrameHandle = null;
let lastAnnouncedSecond = null;
let lastCountdownFinishedTime = 0;
let serverClockOffsetMs = 0; // localTime - serverTime

function playCountdownTone(count) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = count === 3 ? 660 : (count === 2 ? 880 : 1100);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch (e) {}
}

function syncAuthoritativeCountdown(countdownData) {
  if (!countdownData) return;
  if (!isLoggedIn || currentRole === null) return;
  if (latestState && latestState.gameState && (latestState.gameState.status === 'DAY_COMPLETED' || latestState.gameState.isConcluded)) return;

  const countdownId = countdownData.countdownId || countdownData.id;
  const targetServerTimeMs = countdownData.targetServerTimeMs;
  const serverTimeMs = countdownData.serverTimeMs;
  if (serverTimeMs) {
    serverClockOffsetMs = Date.now() - serverTimeMs;
  }

  currentCountdownId = countdownId;
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  const titleEl = document.getElementById('countdownTitle');
  const subEl = document.getElementById('countdownSubtitle');
  if (!overlay || !numEl) return;

  const isResuming = latestState && latestState.gameState && latestState.gameState.isPaused && latestState.gameState.status !== 'STANDBY' && latestState.gameState.status !== 'SCHEDULED';
  if (titleEl) titleEl.textContent = isResuming ? 'MARKET RESUMING IN' : 'MARKET STARTING IN';
  if (subEl) subEl.textContent = 'GET READY ON YOUR TERMINALS!';

  overlay.classList.remove('hidden');

  if (countdownAnimFrameHandle) {
    cancelAnimationFrame(countdownAnimFrameHandle);
    countdownAnimFrameHandle = null;
  }

  lastAnnouncedSecond = null;

  function updateCountdownTick() {
    const estimatedServerNow = Date.now() - serverClockOffsetMs;
    const remainingMs = targetServerTimeMs - estimatedServerNow;

    if (remainingMs > 2000) {
      if (lastAnnouncedSecond !== 3) {
        lastAnnouncedSecond = 3;
        numEl.textContent = '3';
        numEl.style.transform = 'scale(1.25)';
        numEl.style.color = '#FFFFFF';
        setTimeout(() => { if (numEl) numEl.style.transform = 'scale(1)'; }, 140);
        playCountdownTone(3);
      }
    } else if (remainingMs > 1000) {
      if (lastAnnouncedSecond !== 2) {
        lastAnnouncedSecond = 2;
        numEl.textContent = '2';
        numEl.style.transform = 'scale(1.25)';
        numEl.style.color = '#FFFFFF';
        setTimeout(() => { if (numEl) numEl.style.transform = 'scale(1)'; }, 140);
        playCountdownTone(2);
      }
    } else if (remainingMs > 0) {
      if (lastAnnouncedSecond !== 1) {
        lastAnnouncedSecond = 1;
        numEl.textContent = '1';
        numEl.style.transform = 'scale(1.25)';
        numEl.style.color = '#FFFFFF';
        setTimeout(() => { if (numEl) numEl.style.transform = 'scale(1)'; }, 140);
        playCountdownTone(1);
      }
    } else if (remainingMs > -900) {
      if (lastAnnouncedSecond !== 'GO') {
        lastAnnouncedSecond = 'GO';
        lastCountdownFinishedTime = Date.now();
        numEl.textContent = 'GO!';
        numEl.style.transform = 'scale(1.4)';
        numEl.style.color = 'var(--price-up)';
        if (titleEl) titleEl.textContent = 'MARKET IS OPEN!';
        if (subEl) subEl.textContent = 'START TRADING NOW!';
        playInstitutionalSound('bell_open');
      }
    } else {
      cancelAuthoritativeCountdown();
      return;
    }

    countdownAnimFrameHandle = requestAnimationFrame(updateCountdownTick);
  }

  countdownAnimFrameHandle = requestAnimationFrame(updateCountdownTick);
}

function cancelAuthoritativeCountdown() {
  if (countdownAnimFrameHandle) {
    cancelAnimationFrame(countdownAnimFrameHandle);
    countdownAnimFrameHandle = null;
  }
  currentCountdownId = null;
  lastAnnouncedSecond = null;
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  const titleEl = document.getElementById('countdownTitle');
  const subEl = document.getElementById('countdownSubtitle');
  if (overlay) overlay.classList.add('hidden');
  if (numEl) {
    numEl.style.transform = 'scale(1)';
    numEl.style.color = '';
  }
  if (titleEl) titleEl.textContent = 'MARKET STARTING IN';
  if (subEl) subEl.textContent = 'GET READY ON YOUR TERMINALS!';
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && latestState && latestState.gameState) {
    if (latestState.gameState.activeCountdown) {
      syncAuthoritativeCountdown(latestState.gameState.activeCountdown);
    }
  }
});

// ==========================================
// NEWS CONTROL CENTRE (HOST CONTROLLERS)
// ==========================================
let currentHostNewsDayFilter = 'ALL';
let hostNewsLiveTickerHandle = null;

function filterHostNewsDay(day) {
  currentHostNewsDayFilter = day;
  ['ALL', 1, 2, 3].forEach((d) => {
    const btn = document.getElementById(`newsDayFilter_${d}`);
    if (btn) {
      if (String(d) === String(day)) {
        btn.className = 'btn btn-sage';
      } else {
        btn.className = 'btn btn-outline';
      }
    }
  });
  if (latestState) {
    renderHostNews(latestState);
  }
}

function ensureHostNewsTicker() {
  if (hostNewsLiveTickerHandle) return;
  hostNewsLiveTickerHandle = setInterval(() => {
    if (activeHostTab === 'news' && latestState) {
      updateHostNewsLiveTimers(latestState);
    }
  }, 1000);
}

function formatNewsImpactsHtml(ev) {
  // Fairness protection: hide private impacts by default unless explicitly revealed by host
  if (!hostPrivateNewsRevealed) {
    return `
      <div style="margin-bottom: 12px; background: #F8FAFC; border: 1px dashed #CBD5E1; padding: 8px 12px; border-radius: 4px; font-size: 11px; color: #64748B; display: flex; align-items: center; justify-content: space-between;">
        <span>🔒 Private Price Impact Details Hidden</span>
        <span style="font-size: 10px; color: #94A3B8; font-weight: 700;">Fairness Safeguard</span>
      </div>
    `;
  }

  if (ev.impacts && typeof ev.impacts === 'object') {
    const keys = Object.keys(ev.impacts);
    if (keys.length > 0) {
      if (ev.impacts.GLOBAL_WEIGHTED) {
        const basePct = ev.impacts.GLOBAL_WEIGHTED.base_pct || 0;
        const isUp = basePct >= 0;
        return `
          <div style="margin-bottom: 12px;">
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Broad Market Impact</span>
            <span class="badge ${isUp ? 'badge-news-good' : 'badge-news-bad'}" style="font-size: 11px; font-weight: 800;">
              🌐 ALL STOCKS (Beta-Weighted): ${isUp ? '+' : ''}${basePct.toFixed(1)}%
            </span>
          </div>
        `;
      }

      const pills = keys.map((ticker) => {
        const item = ev.impacts[ticker];
        const delta = item && item.delta_pct !== undefined ? item.delta_pct : 0;
        const isUp = delta >= 0;
        const displayName = ticker.startsWith('SECTOR_') ? `${ticker.replace('SECTOR_', '')} SECTOR` : ticker;
        return `
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; font-weight: 800; background: ${isUp ? 'rgba(33, 134, 83, 0.1)' : 'rgba(220, 38, 38, 0.1)'}; color: ${isUp ? 'var(--price-up)' : 'var(--price-down)'}; border: 1px solid ${isUp ? 'rgba(33, 134, 83, 0.25)' : 'rgba(220, 38, 38, 0.25)'};">
            ${displayName} ${isUp ? '+' : ''}${delta.toFixed(1)}%
          </span>
        `;
      }).join(' ');

      return `
        <div style="margin-bottom: 12px;">
          <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Target Companies &amp; Price Impact</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">${pills}</div>
        </div>
      `;
    }
  }

  const impactVal = ev.deltaPct !== undefined ? ev.deltaPct : (ev.targetPriceMultiplier ? (ev.targetPriceMultiplier - 1) * 100 : 0);
  const isUp = impactVal >= 0;
  return `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 11px; margin-bottom: 14px;">
      <div class="cream-panel" style="padding: 6px 10px;">
        <span style="color: var(--text-muted); display: block; font-size: 9px; text-transform: uppercase;">Affected Target</span>
        <strong style="color: var(--text-forest);">${ev.ticker || ev.scope || 'Broad Market'}</strong>
      </div>
      <div class="cream-panel" style="padding: 6px 10px;">
        <span style="color: var(--text-muted); display: block; font-size: 9px; text-transform: uppercase;">Engine Price Shock</span>
        <strong class="${isUp ? 'price-up' : 'price-down'}">${isUp ? '+' : ''}${Number(impactVal).toFixed(1)}%</strong>
      </div>
    </div>
  `;
}

function updateHostNewsLiveTimers(state) {
  if (!state || !state.gameState) return;
  const gs = state.gameState;
  const currentDay = gs.currentDay || 1;
  const elapsed = gs.elapsedSeconds || 0;
  const allNews = state.allScheduledNews || state.newsEvents || [];

  // Update Next Scheduled Wire Banner
  const bannerEl = document.getElementById('hostNewsNextBanner');
  if (bannerEl) {
    const upcoming = allNews.find((ev) => {
      const isTrig = ev.triggered || ev.status === 'PUBLISHED';
      const isCanc = ev.cancelled || ev.status === 'CANCELLED';
      const evDay = ev.day || 1;
      return !isTrig && !isCanc && evDay === currentDay && (ev.trigger_second || 0) >= elapsed;
    });

    if (upcoming) {
      const rem = Math.max(0, (upcoming.trigger_second || 0) - elapsed);
      bannerEl.innerHTML = `<span style="color:var(--price-up);">⚡ ${escapeHtml(upcoming.headline.slice(0, 50))}...</span> in <strong style="color:var(--text-forest);">${formatMMSS(rem)}</strong> (Day ${upcoming.day || 1} @ ${formatMMSS(upcoming.trigger_second || 0)})`;
    } else {
      const futureWire = allNews.find((ev) => {
        const isTrig = ev.triggered || ev.status === 'PUBLISHED';
        const isCanc = ev.cancelled || ev.status === 'CANCELLED';
        const evDay = ev.day || 1;
        return !isTrig && !isCanc && evDay > currentDay;
      });
      if (futureWire) {
        bannerEl.innerHTML = `All Day ${currentDay} wires triggered. Next wires scheduled for <strong>Day ${futureWire.day || (currentDay + 1)}</strong>.`;
      } else {
        bannerEl.innerHTML = `✅ All championship scheduled market wires concluded.`;
      }
    }
  }

  // Update each card timer badge
  allNews.forEach((ev) => {
    const badgeEl = document.getElementById(`newsTimerBadge_${ev.event_id || ev.id}`);
    if (!badgeEl) return;

    const isTriggered = ev.triggered || ev.status === 'PUBLISHED';
    const isCancelled = ev.cancelled || ev.status === 'CANCELLED';
    const evDay = ev.day || 1;

    if (isCancelled) {
      badgeEl.innerHTML = `<span class="badge" style="background:#FEE2E2; color:#991B1B;">❌ CANCELLED</span>`;
    } else if (isTriggered) {
      badgeEl.innerHTML = `<span class="badge badge-active">🟢 PUBLISHED • ACTIVE IMPACT</span>`;
    } else if (evDay < currentDay) {
      badgeEl.innerHTML = `<span class="badge" style="background:#F3F4F6; color:#6B7280;">⚪ DAY ${evDay} CONCLUDED</span>`;
    } else if (evDay > currentDay) {
      badgeEl.innerHTML = `<span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;">📅 DAY ${evDay} @ ${formatMMSS(ev.trigger_second || 0)}</span>`;
    } else {
      const remSec = Math.max(0, (ev.trigger_second || 0) - elapsed);
      if (gs.status === 'RUNNING' || gs.status === 'LIVE') {
        if (remSec === 0) {
          badgeEl.innerHTML = `<span class="badge" style="background:#DCFCE7; color:#166534; font-weight:800;">⚡ TRIGGERING NOW...</span>`;
        } else if (remSec <= 60) {
          badgeEl.innerHTML = `<span class="badge news-imminent-pulse" style="background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; font-weight:800;">⚠️ IMMINENT: IN ${remSec}s</span>`;
        } else {
          badgeEl.innerHTML = `<span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;">⏱️ Triggers in ${formatMMSS(remSec)}</span>`;
        }
      } else if (gs.isPaused) {
        badgeEl.innerHTML = `<span class="badge badge-paused">⏸️ PAUSED (${formatMMSS(remSec)} rem)</span>`;
      } else {
        badgeEl.innerHTML = `<span class="badge badge-champagne">⏳ AT ${formatMMSS(ev.trigger_second || 0)}</span>`;
      }
    }
  });
}

function renderHostNews(state) {
  ensureHostNewsTicker();
  const newsContainer = document.getElementById('hostNewsList');
  if (!newsContainer) return;

  let newsItems = state.allScheduledNews || state.newsEvents || [];
  if (newsItems.length === 0) {
    newsContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No breaking news scheduled. Click "+ Create Breaking News" to broadcast wire items.</div>`;
    return;
  }

  // Filter by day if selected
  if (currentHostNewsDayFilter !== 'ALL') {
    const targetDay = Number(currentHostNewsDayFilter);
    newsItems = newsItems.filter((ev) => (ev.day || 1) === targetDay);
  }

  const currentDay = (state.gameState && state.gameState.currentDay) || 1;
  const elapsedSec = (state.gameState && state.gameState.elapsedSeconds) || 0;
  const isLocked = state.gameState && (state.gameState.isEventLocked || state.gameState.configLocked);

  newsContainer.innerHTML = newsItems.map((ev) => {
    const isTriggered = ev.triggered || ev.status === 'PUBLISHED';
    const isCancelled = ev.cancelled || ev.status === 'CANCELLED';
    const evDay = ev.day || 1;
    const triggerSec = ev.trigger_second || 0;
    const remSec = !isTriggered && !isCancelled && evDay === currentDay ? Math.max(0, triggerSec - elapsedSec) : 0;

    let initialBadge = '';
    if (isCancelled) {
      initialBadge = '<span class="badge" style="background:#FEE2E2; color:#991B1B;">❌ CANCELLED</span>';
    } else if (isTriggered) {
      initialBadge = '<span class="badge badge-active">🟢 PUBLISHED • ACTIVE IMPACT</span>';
    } else if (evDay < currentDay) {
      initialBadge = `<span class="badge" style="background:#F3F4F6; color:#6B7280;">⚪ DAY ${evDay} CONCLUDED</span>`;
    } else if (evDay > currentDay) {
      initialBadge = `<span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;">📅 DAY ${evDay} @ ${formatMMSS(triggerSec)}</span>`;
    } else {
      if (remSec <= 60 && remSec > 0 && (state.gameState.status === 'LIVE' || state.gameState.status === 'RUNNING')) {
        initialBadge = `<span class="badge news-imminent-pulse" style="background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; font-weight:800;">⚠️ IMMINENT: IN ${remSec}s</span>`;
      } else {
        initialBadge = `<span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;">⏱️ Triggers in ${formatMMSS(remSec)}</span>`;
      }
    }

    return `
      <div class="cream-panel" style="padding: 16px; border: 1px solid ${isTriggered ? 'var(--subtle-border)' : 'var(--champagne-accent)'}; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge badge-champagne" style="font-size: 10px; font-weight: 800;">DAY ${evDay}</span>
              <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); font-weight: 700;">${ev.event_id || ev.id}</span>
              <span style="font-size: 10px; color: var(--text-muted);">@ ${formatMMSS(triggerSec)}</span>
            </div>
            <div id="newsTimerBadge_${ev.event_id || ev.id}">${initialBadge}</div>
          </div>

          <h4 style="font-size: 15px; font-weight: 800; color: var(--text-forest); margin: 0 0 6px 0; line-height: 1.35;">${escapeHtml(ev.headline)}</h4>
          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-bottom: 12px;">${escapeHtml(ev.simple_explanation || ev.explanation || '')}</p>

          ${formatNewsImpactsHtml(ev)}
        </div>

        <div>
          ${isLocked ? `
            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <span>🔒 Automated Event Schedule Locked</span>
            </div>
          ` : ''}

          <div style="display: flex; gap: 6px;">
            ${!isTriggered && !isCancelled ? `
              <button onclick="hostPublishNewsNow('${ev.event_id || ev.id}')" class="btn btn-sage" style="flex: 2; padding: 6px 10px; font-size: 11px; font-weight: 700;">
                ⚡ Trigger Wire Now
              </button>
              ${!isLocked ? `
                <button onclick="hostCancelNews('${ev.event_id || ev.id}')" class="btn btn-outline" style="flex: 1; padding: 6px 8px; font-size: 11px; color: var(--error-red);">
                  Cancel
                </button>
              ` : ''}
            ` : `
              <button onclick="hostPublishNewsNow('${ev.event_id || ev.id}')" class="btn btn-outline" style="flex: 1; padding: 6px 10px; font-size: 11px;">
                Re-Trigger Wire
              </button>
            `}
            <button onclick="hostDuplicateNews('${ev.event_id || ev.id}')" class="btn btn-outline" style="padding: 6px 8px; font-size: 11px;" title="Duplicate News Item">
              📋
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateHostNewsLiveTimers(state);
}

function hostPublishNewsNow(eventId) {
  if (!ws || !sessionToken) return;
  // Server expects 'event_id' field name
  ws.send(JSON.stringify({ action: 'HOST_PUBLISH_NEWS_NOW', session_token: sessionToken, event_id: eventId }));
  showOrderToast('⚡ News wire published! Price shock transmitted to all desks.', true);
}

function hostCancelNews(eventId) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_CANCEL_NEWS', session_token: sessionToken, event_id: eventId }));
  showOrderToast('News item cancelled and removed from the schedule.', true);
}

function hostDuplicateNews(eventId) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_DUPLICATE_NEWS', session_token: sessionToken, event_id: eventId }));
  showOrderToast('📋 News item duplicated. Edit the copy in the news centre.', true);
}

// ==========================================
// FINANCIAL ANALYSIS & TEAM INVESTMENT CONTROLLERS
// ==========================================
let currentInvestSort = 'rank_asc';
let currentInvestFilter = '';

function filterTeamInvestments() {
  const searchInput = document.getElementById('hostInvestSearch');
  const sortSelect = document.getElementById('hostInvestSort');
  if (searchInput) currentInvestFilter = (searchInput.value || '').trim().toLowerCase();
  if (sortSelect) currentInvestSort = sortSelect.value || 'rank_asc';
  if (latestState) renderHostAnalysis(latestState);
}

function renderHostAnalysis(state) {
  const tbody = document.getElementById('hostFinancialAnalysisTbody');
  if (!tbody) return;

  let rawList = state.teamInvestments;
  if (!rawList || rawList.length === 0) {
    if (state.finalResultsSnapshot && state.finalResultsSnapshot.rankings) {
      rawList = state.finalResultsSnapshot.rankings.map(r => ({
        rank: r.rank,
        teamId: r.teamId || `team_${r.rank}`,
        teamName: r.teamName,
        members: r.members || '',
        startingCash: r.startingCash || 1000000,
        availableCash: r.cash,
        investedCost: (r.startingCash || 1000000) - r.cash,
        holdingsMarketValue: r.holdingsValue,
        portfolioValue: r.totalPortfolioValue,
        netPnl: r.netProfitLoss,
        returnPct: r.returnPct,
        tradeCount: r.tradeCount,
        distinctHoldings: r.holdingsCount || 0,
        brokerageFees: r.brokerageFees || 0
      }));
    } else if (state.teams) {
      rawList = Object.keys(state.teams).map((tId, idx) => {
        const t = state.teams[tId];
        return {
          rank: idx + 1,
          teamId: tId,
          teamName: t.name || tId,
          members: t.members || '',
          startingCash: t.startingCash || 1000000,
          availableCash: t.cash || 0,
          investedCost: 0,
          holdingsMarketValue: (t.totalValue || t.cash || 0) - (t.cash || 0),
          portfolioValue: t.totalValue || t.cash || 0,
          netPnl: (t.totalValue || t.cash || 0) - (t.startingCash || 1000000),
          returnPct: ((t.totalValue || t.cash || 0) - (t.startingCash || 1000000)) / (t.startingCash || 1000000) * 100,
          tradeCount: (t.tradeHistory || []).length,
          distinctHoldings: Object.keys(t.holdings || {}).filter(k => (t.holdings[k] || 0) > 0).length,
          brokerageFees: 0
        };
      });
    } else {
      rawList = [];
    }
  }

  // Filter
  let filtered = rawList;
  if (currentInvestFilter) {
    filtered = rawList.filter(t => 
      (t.teamName || '').toLowerCase().includes(currentInvestFilter) ||
      (t.members || '').toLowerCase().includes(currentInvestFilter) ||
      (t.teamId || '').toLowerCase().includes(currentInvestFilter)
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (currentInvestSort) {
      case 'rank_desc': return (b.rank || 0) - (a.rank || 0);
      case 'val_desc': return (b.portfolioValue || 0) - (a.portfolioValue || 0);
      case 'pnl_desc': return (b.netPnl || 0) - (a.netPnl || 0);
      case 'cash_desc': return (b.availableCash || 0) - (a.availableCash || 0);
      case 'cost_desc': return (b.investedCost || 0) - (a.investedCost || 0);
      case 'mkt_desc': return (b.holdingsMarketValue || 0) - (a.holdingsMarketValue || 0);
      case 'return_desc': return (b.returnPct || 0) - (a.returnPct || 0);
      case 'name_asc': return (a.teamName || '').localeCompare(b.teamName || '');
      case 'rank_asc':
      default:
        return (a.rank || 0) - (b.rank || 0);
    }
  });

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No matching team portfolios found.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((team) => {
    const isProfit = (team.netPnl !== undefined ? team.netPnl : 0) >= 0;
    const pnlVal = team.netPnl !== undefined ? team.netPnl : 0;
    const retVal = team.returnPct !== undefined ? team.returnPct : 0;
    const availCash = team.availableCash !== undefined ? team.availableCash : 0;
    const invCost = team.investedCost !== undefined ? team.investedCost : 0;
    const mktVal = team.holdingsMarketValue !== undefined ? team.holdingsMarketValue : 0;
    const portVal = team.portfolioValue !== undefined ? team.portfolioValue : 0;
    const distinctHoldings = team.distinctHoldings !== undefined ? team.distinctHoldings : (team.holdingsDetail ? team.holdingsDetail.length : '—');

    return `
      <tr style="border-bottom: 1px solid var(--subtle-border);">
        <td style="padding: 10px; font-weight: 800; color: ${team.rank === 1 ? 'var(--champagne-accent)' : 'inherit'};">#${team.rank}</td>
        <td style="padding: 10px; font-weight: 700; color: var(--text-forest);">${escapeHtml(team.teamName)}</td>
        <td style="padding: 10px; color: var(--text-muted); font-size: 11px;">${escapeHtml(team.members || '—')}</td>
        <td style="padding: 10px; text-align: right;">${formatINR(team.startingCash || 1000000)}</td>
        <td style="padding: 10px; text-align: right; color: #1E293B; font-weight: 600;">${formatINR(availCash)}</td>
        <td style="padding: 10px; text-align: right; color: var(--text-muted);">${formatINR(invCost)}</td>
        <td style="padding: 10px; text-align: right; font-weight: 600;">${formatINR(mktVal)}</td>
        <td style="padding: 10px; text-align: right; font-weight: 800; color: var(--text-forest);">${formatINR(portVal)}</td>
        <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isProfit ? 'price-up' : 'price-down'}">
          ${isProfit ? '+' : ''}${formatINR(pnlVal)}
        </td>
        <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isProfit ? 'price-up' : 'price-down'}">
          ${isProfit ? '+' : ''}${retVal.toFixed(2)}%
        </td>
        <td style="padding: 10px; text-align: center;">${distinctHoldings}</td>
        <td style="padding: 10px; text-align: center;">${team.tradeCount || 0}</td>
        <td style="padding: 10px; text-align: center;">
          <button type="button" class="btn btn-outline" style="font-size: 11px; padding: 3px 8px;" onclick="openTeamInvestmentDetail('${team.teamId}')">🔍 View Details</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openTeamInvestmentDetail(teamId) {
  if (!latestState) return;
  const list = latestState.teamInvestments || [];
  let team = list.find(t => t.teamId === teamId);
  if (!team && latestState.teams && latestState.teams[teamId]) {
    const tData = latestState.teams[teamId];
    team = {
      teamId,
      teamName: tData.name || teamId,
      members: tData.members || '',
      availableCash: tData.cash || 0,
      startingCash: tData.startingCash || 1000000,
      portfolioValue: tData.totalValue || tData.cash || 0,
      investedCost: 0,
      holdingsMarketValue: (tData.totalValue || tData.cash || 0) - (tData.cash || 0),
      netPnl: (tData.totalValue || tData.cash || 0) - (tData.startingCash || 1000000),
      returnPct: ((tData.totalValue || tData.cash || 0) - (tData.startingCash || 1000000)) / (tData.startingCash || 1000000) * 100,
      tradeCount: (tData.tradeHistory || []).length,
      holdingsDetail: [],
      orders: tData.tradeHistory || []
    };
  }
  if (!team) return;

  const isProfit = (team.netPnl || 0) >= 0;
  const nameEl = document.getElementById('invModalTeamName');
  const memEl = document.getElementById('invModalTeamMembers');
  const cashEl = document.getElementById('invModalCash');
  const costEl = document.getElementById('invModalCost');
  const mktEl = document.getElementById('invModalMktVal');
  const totEl = document.getElementById('invModalTotalVal');
  const pnlEl = document.getElementById('invModalNetPnl');
  const retEl = document.getElementById('invModalReturnPct');
  const tradesEl = document.getElementById('invModalTrades');

  if (nameEl) nameEl.textContent = team.teamName;
  if (memEl) memEl.textContent = `Members: ${team.members || 'Unassigned'} • Team ID: ${team.teamId}`;
  if (cashEl) cashEl.textContent = formatINR(team.availableCash || 0);
  if (costEl) costEl.textContent = formatINR(team.investedCost || 0);
  if (mktEl) mktEl.textContent = formatINR(team.holdingsMarketValue || 0);
  if (totEl) totEl.textContent = formatINR(team.portfolioValue || 0);
  
  if (pnlEl) {
    pnlEl.textContent = `${isProfit ? '+' : ''}${formatINR(team.netPnl || 0)}`;
    pnlEl.className = isProfit ? 'price-up' : 'price-down';
  }

  if (retEl) {
    retEl.textContent = `${isProfit ? '+' : ''}${(team.returnPct || 0).toFixed(2)}%`;
    retEl.className = isProfit ? 'price-up' : 'price-down';
  }

  if (tradesEl) tradesEl.textContent = `${team.tradeCount || 0} trades`;

  // Render Horizontal Segmented Allocation Bar
  const allocBar = document.getElementById('invModalAllocBar');
  if (allocBar) {
    const totalVal = Math.max(1, team.portfolioValue || 1);
    const cashPct = Math.max(0, Math.min(100, ((team.availableCash || 0) / totalVal) * 100));
    const holdings = team.holdingsDetail || [];
    
    const palette = ['#3F6292', '#059669', '#8E6D3B', '#7C3AED', '#DB2777', '#0891B2', '#D97706', '#4B5563'];
    let segsHtml = '';
    segsHtml += `<div class="team-alloc-seg" style="width: ${cashPct.toFixed(1)}%; background: #D97706;" title="Available Cash: ${cashPct.toFixed(1)}% (₹${Math.round(team.availableCash || 0).toLocaleString('en-IN')})">Cash: ${cashPct.toFixed(0)}%</div>`;
    
    holdings.forEach((h, idx) => {
      const segPct = Math.max(0, Math.min(100, (h.marketValue / totalVal) * 100));
      if (segPct > 0.5) {
        const color = palette[idx % palette.length];
        segsHtml += `<div class="team-alloc-seg" style="width: ${segPct.toFixed(1)}%; background: ${color};" title="${h.ticker}: ${segPct.toFixed(1)}% (₹${Math.round(h.marketValue).toLocaleString('en-IN')})">${h.ticker}: ${segPct.toFixed(0)}%</div>`;
      }
    });
    allocBar.innerHTML = segsHtml;
  }

  // Render Holdings Table
  const hTbody = document.getElementById('invModalHoldingsTbody');
  if (hTbody) {
    const holdings = team.holdingsDetail || [];
    if (holdings.length === 0) {
      hTbody.innerHTML = `<tr><td colspan="10" style="padding: 20px; text-align: center; color: var(--text-muted); font-style: italic;">No equity positions held. Portfolio is 100% Liquid Cash.</td></tr>`;
    } else {
      hTbody.innerHTML = holdings.map(h => {
        const hUp = (h.unrealizedPnl || 0) >= 0;
        return `
          <tr style="border-bottom: 1px solid var(--subtle-border);">
            <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${escapeHtml(h.ticker)} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">${escapeHtml(h.name || '')}</span></td>
            <td style="padding: 8px; font-size: 11px; color: var(--text-muted);">${escapeHtml(h.sector || '')}</td>
            <td style="padding: 8px; text-align: center; font-weight: 700;">${h.qty}</td>
            <td style="padding: 8px; text-align: right;">₹${(h.avgBuyPrice || 0).toFixed(2)}</td>
            <td style="padding: 8px; text-align: right;">${formatINR(h.investedCost || 0)}</td>
            <td style="padding: 8px; text-align: right;">₹${(h.currentPrice || 0).toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-weight: 700;">${formatINR(h.marketValue || 0)}</td>
            <td style="padding: 8px; text-align: right; font-weight: 700;" class="${hUp ? 'price-up' : 'price-down'}">
              ${hUp ? '+' : ''}${formatINR(h.unrealizedPnl || 0)}
            </td>
            <td style="padding: 8px; text-align: right; font-weight: 700;" class="${hUp ? 'price-up' : 'price-down'}">
              ${hUp ? '+' : ''}${(h.returnPct || 0).toFixed(2)}%
            </td>
            <td style="padding: 8px; text-align: right; font-weight: 700; color: var(--text-muted);">${(h.allocPct || 0).toFixed(1)}%</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Orders Log
  const oTbody = document.getElementById('invModalOrdersTbody');
  if (oTbody) {
    const orders = team.orders || [];
    if (orders.length === 0) {
      oTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No orders executed yet.</td></tr>`;
    } else {
      oTbody.innerHTML = orders.slice(-15).reverse().map(o => `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 6px; font-size: 11px; color: var(--text-muted);">${new Date(o.timestamp).toLocaleTimeString()}</td>
          <td style="padding: 6px; font-weight: 800; color: ${o.orderType === 'BUY' ? 'var(--price-up)' : 'var(--price-down)'};">${o.orderType}</td>
          <td style="padding: 6px; font-weight: 700;">${escapeHtml(o.ticker)}</td>
          <td style="padding: 6px; text-align: center;">${o.quantity}</td>
          <td style="padding: 6px; text-align: right;">₹${(o.price || 0).toFixed(2)}</td>
          <td style="padding: 6px; text-align: right; font-weight: 700;">${formatINR(o.totalImpact || (o.quantity * o.price))}</td>
          <td style="padding: 6px; text-align: center;"><span class="badge badge-active" style="font-size: 9px; padding: 1px 6px;">FILLED</span></td>
        </tr>
      `).join('');
    }
  }

  const modal = document.getElementById('teamInvestmentDetailModal');
  if (modal) modal.classList.remove('hidden');
}

function closeTeamInvestmentDetail() {
  const modal = document.getElementById('teamInvestmentDetailModal');
  if (modal) modal.classList.add('hidden');
}

function downloadResultsSnapshotJSON() {
  if (!latestState) return;
  const snapshot = latestState.finalResultsSnapshot || generateClientSnapshotFromLeaderboard(latestState);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `Championship_Final_Financial_Analysis_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ==========================================
// DEDICATED SOUND SYSTEM & AUDIO CONTROLLERS
// ==========================================
function renderSoundConsoleView(state) {
  if (!state || !state.gameState) return;
  const audioSettings = state.gameState.audioSettings || {};
  const volDisplay = document.getElementById('soundConsoleVolumeDisplay');
  if (volDisplay) {
    const volPct = Math.round((audioSettings.masterVolume !== undefined ? audioSettings.masterVolume : 0.85) * 100);
    volDisplay.textContent = `${volPct}%${audioSettings.muted ? ' (Muted)' : ''}`;
  }
}

function renderHostSoundTab(state) {
  if (!state || !state.gameState) return;
  const audio = state.gameState.audioSettings || { masterVolume: 0.85, muted: false, categories: {} };

  const slider = document.getElementById('hostSoundMasterVolSlider');
  const valDisplay = document.getElementById('hostSoundMasterVolVal');
  if (slider && document.activeElement !== slider) {
    slider.value = Math.round(audio.masterVolume * 100);
  }
  if (valDisplay) {
    valDisplay.textContent = Math.round(audio.masterVolume * 100) + '%';
  }

  const btnMute = document.getElementById('btnHostToggleMute');
  if (btnMute) {
    btnMute.textContent = audio.muted ? '🔊 Unmute All Audio' : '🔇 Mute All Audio';
    btnMute.className = audio.muted ? 'btn btn-primary' : 'btn btn-outline';
  }

  const connBadge = document.getElementById('hostSoundConsoleConnBadge');
  if (connBadge) {
    if (state.gameState.soundConsoleConnected) {
      connBadge.className = 'badge badge-active';
      connBadge.style.background = '#ECFDF5';
      connBadge.style.color = '#065F46';
      connBadge.textContent = '🟢 Dedicated Sound Laptop Connected (Hardware Active)';
    } else {
      connBadge.className = 'badge';
      connBadge.style.background = '#FEE2E2';
      connBadge.style.color = '#991B1B';
      connBadge.textContent = '⚠️ No Dedicated Sound Laptop Connected';
    }
  }
}

function updateHostAudioSettings() {
  const slider = document.getElementById('hostSoundMasterVolSlider');
  const vol = slider ? Number(slider.value) / 100 : 0.85;
  const valDisplay = document.getElementById('hostSoundMasterVolVal');
  if (valDisplay) valDisplay.textContent = slider.value + '%';

  const catLifecycle = document.getElementById('audioCatLifecycle') ? document.getElementById('audioCatLifecycle').checked : true;
  const catNews = document.getElementById('audioCatNews') ? document.getElementById('audioCatNews').checked : true;
  const catAlerts = document.getElementById('audioCatAlerts') ? document.getElementById('audioCatAlerts').checked : true;
  const catPres = document.getElementById('audioCatPresentation') ? document.getElementById('audioCatPresentation').checked : true;

  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_UPDATE_AUDIO_SETTINGS',
      session_token: sessionToken,
      masterVolume: vol,
      categories: {
        lifecycle: catLifecycle,
        news: catNews,
        alerts: catAlerts,
        presentation: catPres
      }
    }));
  }
}

function toggleHostAudioMute() {
  if (!latestState || !latestState.gameState) return;
  const currentMuted = !!(latestState.gameState.audioSettings && latestState.gameState.audioSettings.muted);
  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_UPDATE_AUDIO_SETTINGS',
      session_token: sessionToken,
      muted: !currentMuted
    }));
  }
}

function testRemoteAudioCue(cueName, category) {
  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_TEST_SOUND_CUE',
      session_token: sessionToken,
      cueName: cueName,
      category: category
    }));
    showOrderToast(`Dispatched test cue [${cueName}] to all authorized sound outputs`, true);
  }
}

function testLocalSoundCue(cueName) {
  playInstitutionalSound(cueName);
}

let audioEngineContext = null;
function unlockAudioSystem() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioEngineContext) {
      audioEngineContext = new AudioCtx();
    }
    if (audioEngineContext.state === 'suspended') {
      audioEngineContext.resume();
    }
    const banner = document.getElementById('soundUnlockBanner');
    if (banner) banner.classList.add('hidden');
    const badge = document.getElementById('soundConsoleStatusBadge');
    if (badge) {
      badge.textContent = '🟢 Audio Engine Armed & Ready';
      badge.style.background = '#ECFDF5';
      badge.style.color = '#065F46';
      badge.style.borderColor = '#A7F3D0';
    }
    const ctxStatus = document.getElementById('soundConsoleContextStatus');
    if (ctxStatus) {
      ctxStatus.textContent = 'Running (Unlocked)';
      ctxStatus.style.color = 'var(--price-up)';
    }
    playInstitutionalSound('bell_open');
    showOrderToast('🔊 Audio Engine Activated! PA Speaker connection verified.', true);
  } catch (e) {
    console.error('Audio unlock error:', e);
  }
}

const processedCueIds = new Set();
let soundConsoleCueCounter = 0;
function handleIncomingAudioCue(msg) {
  if (!msg || !msg.cueId) return;
  if (processedCueIds.has(msg.cueId)) return;
  processedCueIds.add(msg.cueId);
  if (processedCueIds.size > 200) {
    const first = processedCueIds.values().next().value;
    processedCueIds.delete(first);
  }

  appendSoundConsoleLog(msg);

  // Check audio settings
  if (latestState && latestState.gameState && latestState.gameState.audioSettings) {
    const audio = latestState.gameState.audioSettings;
    if (audio.muted) return;
    if (msg.category && audio.categories && audio.categories[msg.category] === false) return;
  }

  // During active synchronized countdown or immediately following it, the visual countdown engine plays frame-locked tones locally
  // Ignore remote countdown_tick or bell_open to prevent duplicated/delayed sound clashes!
  if ((currentCountdownId || (Date.now() - lastCountdownFinishedTime < 1500)) && (msg.cueName === 'countdown_tick' || msg.cueName === 'bell_open')) {
    return;
  }

  playInstitutionalSound(msg.cueName);
}

function appendSoundConsoleLog(msg) {
  const tbody = document.getElementById('soundCueTableBody');
  if (!tbody) return;
  soundConsoleCueCounter++;
  const counterEl = document.getElementById('soundConsoleCuesCount');
  if (counterEl) counterEl.textContent = soundConsoleCueCounter;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--subtle-border)';
  tr.innerHTML = `
    <td style="padding: 8px;">${timeStr}</td>
    <td style="padding: 8px; color: var(--text-muted);">${msg.cueId.slice(0, 8)}...</td>
    <td style="padding: 8px; font-weight: 700; color: #5B21B6;">${msg.cueName}</td>
    <td style="padding: 8px;"><span class="badge" style="font-size: 9px;">${msg.category || 'general'}</span></td>
    <td style="padding: 8px; text-align: center;">${Math.round((msg.volume || 0.85) * 100)}%</td>
    <td style="padding: 8px; text-align: right; color: var(--price-up); font-weight: 700;">✓ Played</td>
  `;
  if (tbody.children.length === 1 && tbody.children[0].textContent.includes('No audio cues')) {
    tbody.innerHTML = '';
  }
  tbody.insertBefore(tr, tbody.firstChild);
}

// ==========================================
// CINEMATIC WINNER PRESENTATION STAGE
// ==========================================
function renderWinnerPresentationView(state) {
  if (!state || !state.gameState) return;
  const presState = state.gameState.presentationState || { currentScene: 'INTRO' };
  const snapshot = state.finalResultsSnapshot || generateClientSnapshotFromLeaderboard(state);

  // Show / hide host toolbar depending on whether user is HOST
  const hostToolbar = document.getElementById('presHostToolbar');
  if (hostToolbar) {
    if (currentRole === 'HOST') hostToolbar.classList.remove('hidden');
    else hostToolbar.classList.add('hidden');
  }

  renderPresentationScene(presState.currentScene, snapshot);
}

function generateClientSnapshotFromLeaderboard(state) {
  const lb = state.leaderboard || [];
  const startCash = (state.gameState && state.gameState.startingCash) || 500000;
  const rankings = lb.map((t, idx) => {
    const cash = t.cash !== undefined ? t.cash : 0;
    const holdingsVal = t.holdingsValue !== undefined ? t.holdingsValue : 0;
    const netWorth = t.netWorth !== undefined ? t.netWorth : (cash + holdingsVal);
    const pnl = netWorth - startCash;
    const retPct = startCash > 0 ? (pnl / startCash) * 100 : 0;
    return {
      rank: idx + 1,
      teamId: t.id || t.username,
      teamName: t.name,
      members: t.members || '',
      startingCash: startCash,
      cash: cash,
      holdingsValue: holdingsVal,
      totalPortfolioValue: netWorth,
      netProfitLoss: pnl,
      returnPct: retPct,
      tradeCount: t.tradeCount || 0,
      brokerageFees: t.brokerageFees || 0,
      summaryReview: pnl > 0 ? 'Profitable Equity Growth' : 'Capital Preservation'
    };
  });
  return {
    championshipTitle: (state.gameState && state.gameState.title) || 'The Trading Floor Championship 2026',
    finalizedAt: new Date().toISOString(),
    rankings: rankings
  };
}

function renderPresentationScene(sceneName, snapshot) {
  if (!snapshot || !snapshot.rankings) return;
  const scenes = ['sceneIntro', 'sceneBronze', 'sceneSilver', 'sceneChampion', 'scenePodium', 'sceneLeaderboard'];
  scenes.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.add('hidden');
  });

  const badge = document.getElementById('presSceneBadge');
  const rankings = snapshot.rankings || [];
  const normScene = (sceneName || '').replace(/^SCENE_/, '').toUpperCase();

  if (normScene === 'BRONZE') {
    const bronzeTeam = rankings[2] || rankings[rankings.length - 1] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    document.getElementById('presBronzeTeam').textContent = bronzeTeam.teamName;
    document.getElementById('presBronzeMembers').textContent = bronzeTeam.members ? `Traders: ${bronzeTeam.members}` : '';
    document.getElementById('presBronzeVal').textContent = formatINR(bronzeTeam.totalPortfolioValue);
    const pnl = bronzeTeam.netProfitLoss;
    const pnlEl = document.getElementById('presBronzePnl');
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
    pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    const retEl = document.getElementById('presBronzeReturn');
    retEl.textContent = `${bronzeTeam.returnPct >= 0 ? '+' : ''}${bronzeTeam.returnPct.toFixed(2)}%`;
    retEl.className = bronzeTeam.returnPct >= 0 ? 'price-up' : 'price-down';
    document.getElementById('sceneBronze').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 2: 🥉 BRONZE MEDALIST';
  } else if (normScene === 'SILVER') {
    const silverTeam = rankings[1] || rankings[0] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    document.getElementById('presSilverTeam').textContent = silverTeam.teamName;
    document.getElementById('presSilverMembers').textContent = silverTeam.members ? `Traders: ${silverTeam.members}` : '';
    document.getElementById('presSilverVal').textContent = formatINR(silverTeam.totalPortfolioValue);
    const pnl = silverTeam.netProfitLoss;
    const pnlEl = document.getElementById('presSilverPnl');
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
    pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    const retEl = document.getElementById('presSilverReturn');
    retEl.textContent = `${silverTeam.returnPct >= 0 ? '+' : ''}${silverTeam.returnPct.toFixed(2)}%`;
    retEl.className = silverTeam.returnPct >= 0 ? 'price-up' : 'price-down';
    document.getElementById('sceneSilver').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 3: 🥈 SILVER RUNNER-UP';
  } else if (normScene === 'CHAMPION' || normScene === 'GOLD') {
    const champ = rankings[0] || { teamName: '—', totalPortfolioValue: 0, netProfitLoss: 0, returnPct: 0 };
    document.getElementById('presChampionTeam').textContent = champ.teamName;
    document.getElementById('presChampionMembers').textContent = champ.members ? `Traders: ${champ.members}` : '';
    document.getElementById('presChampionVal').textContent = formatINR(champ.totalPortfolioValue);
    const pnl = champ.netProfitLoss;
    const pnlEl = document.getElementById('presChampionPnl');
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`;
    pnlEl.className = pnl >= 0 ? 'price-up' : 'price-down';
    const retEl = document.getElementById('presChampionReturn');
    retEl.textContent = `${champ.returnPct >= 0 ? '+' : ''}${champ.returnPct.toFixed(2)}%`;
    retEl.className = champ.returnPct >= 0 ? 'price-up' : 'price-down';
    document.getElementById('sceneChampion').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 4: 🏆 GRAND CHAMPION';
    playDramaticWinnerReveal();
  } else if (normScene === 'PODIUM') {
    const t1 = rankings[0] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };
    const t2 = rankings[1] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };
    const t3 = rankings[2] || { teamName: '—', totalPortfolioValue: 0, returnPct: 0 };

    document.getElementById('podium1Team').textContent = t1.teamName;
    document.getElementById('podium1Members').textContent = t1.members || '';
    document.getElementById('podium1Val').textContent = formatINR(t1.totalPortfolioValue);
    document.getElementById('podium1Return').textContent = `${t1.returnPct >= 0 ? '+' : ''}${t1.returnPct.toFixed(2)}%`;

    document.getElementById('podium2Team').textContent = t2.teamName;
    document.getElementById('podium2Members').textContent = t2.members || '';
    document.getElementById('podium2Val').textContent = formatINR(t2.totalPortfolioValue);
    document.getElementById('podium2Return').textContent = `${t2.returnPct >= 0 ? '+' : ''}${t2.returnPct.toFixed(2)}%`;

    document.getElementById('podium3Team').textContent = t3.teamName;
    document.getElementById('podium3Members').textContent = t3.members || '';
    document.getElementById('podium3Val').textContent = formatINR(t3.totalPortfolioValue);
    document.getElementById('podium3Return').textContent = `${t3.returnPct >= 0 ? '+' : ''}${t3.returnPct.toFixed(2)}%`;

    document.getElementById('scenePodium').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 5: 🎖️ GRAND PODIUM';
  } else if (normScene === 'LEADERBOARD' || normScene === 'STANDINGS') {
    const tbody = document.getElementById('presLeaderboardTbody');
    if (tbody) {
      tbody.innerHTML = rankings.map((r) => {
        const isUp = r.returnPct >= 0;
        return `
          <tr style="border-bottom: 1px solid var(--subtle-border);">
            <td style="padding: 10px; font-weight: 800; color: ${r.rank === 1 ? 'var(--champagne-accent)' : 'inherit'};">#${r.rank}</td>
            <td style="padding: 10px; font-weight: 800; color: var(--text-forest);">${escapeHtml(r.teamName)}</td>
            <td style="padding: 10px; color: var(--text-muted); font-size: 11px;">${escapeHtml(r.members || '—')}</td>
            <td style="padding: 10px; text-align: right;">${formatINR(r.startingCash)}</td>
            <td style="padding: 10px; text-align: right;">${formatINR(r.cash)}</td>
            <td style="padding: 10px; text-align: right;">${formatINR(r.holdingsValue)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 800;">${formatINR(r.totalPortfolioValue)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 700;" class="${r.netProfitLoss >= 0 ? 'price-up' : 'price-down'}">
              ${r.netProfitLoss >= 0 ? '+' : ''}${formatINR(r.netProfitLoss)}
            </td>
            <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${r.returnPct.toFixed(2)}%
            </td>
            <td style="padding: 10px; text-align: center;">${r.tradeCount}</td>
          </tr>
        `;
      }).join('');
    }
    document.getElementById('sceneLeaderboard').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 6: 📋 FULL OFFICIAL STANDINGS';
  } else {
    // Default INTRO
    document.getElementById('sceneIntro').classList.remove('hidden');
    if (badge) badge.textContent = 'STAGE PRESENTATION • SCENE 1: VERIFICATION & AUDIT';
  }
}

let winnerRevealTimer = null;

function playDramaticWinnerReveal() {
  const presView = document.getElementById('winnerPresentationView');
  if (presView) {
    presView.classList.remove('dramatic-screen-rumble');
    void presView.offsetWidth; // force browser layout reflow
    presView.classList.add('dramatic-screen-rumble');
  }

  // Cinematic screen flash
  const flash = document.createElement('div');
  flash.className = 'screen-flash-overlay';
  document.body.appendChild(flash);
  setTimeout(() => {
    if (flash.parentNode) flash.parentNode.removeChild(flash);
  }, 1400);

  // Sound Sequence:
  // 1) Dramatic heartbeat tension riser
  playInstitutionalSound('dramatic_tension_riser');

  // 2) Snare drumroll crescendo into seismic sub-bass boom
  setTimeout(() => {
    playInstitutionalSound('winner_drumroll_boom');
  }, 1200);

  // 3) Epic multi-octave brass victory fanfare & golden confetti storm
  setTimeout(() => {
    playInstitutionalSound('champion_fanfare_epic');
    createPresentationConfetti(180);
  }, 2300);

  // Stop camera rumble after 3.2s so scores and return percentages are crystal clear
  if (winnerRevealTimer) clearTimeout(winnerRevealTimer);
  winnerRevealTimer = setTimeout(() => {
    if (presView) presView.classList.remove('dramatic-screen-rumble');
  }, 3200);
}

function triggerDramaticDrumroll() {
  const presView = document.getElementById('winnerPresentationView');
  if (presView) {
    presView.classList.add('dramatic-screen-rumble');
    setTimeout(() => presView.classList.remove('dramatic-screen-rumble'), 1800);
  }
  playInstitutionalSound('dramatic_tension_riser');
  setTimeout(() => playInstitutionalSound('winner_drumroll_boom'), 1100);
}

function createPresentationConfetti(particleCount = 120) {
  ['presentationConfetti', 'projPresentationConfetti'].forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#B49A70', '#218653', '#D4AF37', '#8C9CAE', '#C64B4B', '#FFFFFF', '#F59E0B', '#10B981'];
    for (let i = 0; i < particleCount; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width = `${Math.random() * 9 + 6}px`;
      piece.style.height = `${Math.random() * 16 + 10}px`;
      piece.style.animationDuration = `${Math.random() * 2 + 2}s`;
      piece.style.animationDelay = `${Math.random() * 1.5}s`;
      container.appendChild(piece);
    }
  });
}

const PRES_SCENE_SEQUENCE = ['INTRO', 'BRONZE', 'SILVER', 'CHAMPION', 'PODIUM', 'LEADERBOARD'];
function hostSetPresentationScene(scene) {
  if (!ws || !sessionToken) return;
  const canonicalScene = scene.startsWith('SCENE_') ? scene : 'SCENE_' + scene;
  ws.send(JSON.stringify({
    action: 'HOST_SET_PRESENTATION_SCENE',
    session_token: sessionToken,
    scene: canonicalScene
  }));
}

function presNextScene() {
  const ps = (latestState && latestState.gameState && latestState.gameState.presentationState) || {};
  let curScene = (ps.scene || ps.currentScene || (latestState.projectorState && latestState.projectorState.winnerScene) || 'INTRO').replace(/^SCENE_/, '').toUpperCase();
  const idx = PRES_SCENE_SEQUENCE.indexOf(curScene);
  const nextScene = PRES_SCENE_SEQUENCE[Math.min(PRES_SCENE_SEQUENCE.length - 1, (idx === -1 ? 0 : idx) + 1)];
  hostSetPresentationScene(nextScene);
}

function presPrevScene() {
  const ps = (latestState && latestState.gameState && latestState.gameState.presentationState) || {};
  let curScene = (ps.scene || ps.currentScene || (latestState.projectorState && latestState.projectorState.winnerScene) || 'INTRO').replace(/^SCENE_/, '').toUpperCase();
  const idx = PRES_SCENE_SEQUENCE.indexOf(curScene);
  const prevScene = PRES_SCENE_SEQUENCE[Math.max(0, (idx === -1 ? 0 : idx) - 1)];
  hostSetPresentationScene(prevScene);
}

function hostStartWinnerPresentation() {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'HOST_START_WINNER_PRESENTATION',
    session_token: sessionToken
  }));
  switchSpaView('WINNER_DISPLAY');
}

// ==========================================
// SCHEDULE EVENT MODAL CONTROLLERS
// ==========================================
function openScheduleEventModal() {
  const modal = document.getElementById('scheduleEventModal');
  if (!modal) return;

  const gs = latestState?.gameState;
  const currentDay = gs?.currentDay || 1;

  if (gs) {
    const titleInput = document.getElementById('scheduleEventTitleInput');
    const instInput = document.getElementById('scheduleInstitutionInput');
    const durInput = document.getElementById('scheduleDurationSecInput');
    const policySelect = document.getElementById('schedulePausePolicySelect');

    if (titleInput) titleInput.value = gs.title || 'The Trading Floor Championship 2026';
    if (instInput) instInput.value = gs.institution || 'Gujarat Technological University';
    if (durInput) {
      durInput.value = gs.dayDurationSeconds || 1800;
      updateScheduleDurationDisplay();
    }
    if (policySelect) policySelect.value = gs.pausePolicy || 'TRADING_TIME';
  }

  // Update modal header for Day X
  const modalHeaderTitle = document.querySelector('#scheduleEventModal h2');
  if (modalHeaderTitle) {
    modalHeaderTitle.textContent = `Day ${currentDay} Schedule & Countdown`;
  }

  // Default to SCHEDULED mode with quick 2-min preset
  selectStartMode('SCHEDULED');
  setQuickScheduleMinutes(2);
  modal.classList.remove('hidden');
}

function closeScheduleEventModal() {
  const modal = document.getElementById('scheduleEventModal');
  if (modal) modal.classList.add('hidden');
}

let currentScheduleMode = 'IMMEDIATE';
function selectStartMode(mode) {
  currentScheduleMode = mode;
  const cardImm = document.getElementById('modeCardImmediate');
  const cardSch = document.getElementById('modeCardScheduled');
  const timeGroup = document.getElementById('scheduleTimeGroup');
  const btnSubmit = document.getElementById('btnConfirmScheduleStart');

  const radioImm = document.querySelector('input[name="eventStartMode"][value="IMMEDIATE"]');
  const radioSch = document.querySelector('input[name="eventStartMode"][value="SCHEDULED"]');

  if (mode === 'SCHEDULED') {
    if (radioSch) radioSch.checked = true;
    if (cardSch) cardSch.style.border = '2px solid var(--champagne-accent)';
    if (cardImm) cardImm.style.border = '1px solid var(--subtle-border)';
    if (timeGroup) timeGroup.classList.remove('hidden');
    if (btnSubmit) btnSubmit.textContent = '📅 Confirm Schedule & Arm Waiting Room';

    // Set default scheduled time to 2 minutes from now if empty (formatted for local datetime-local input)
    const dtInput = document.getElementById('scheduledStartTimeInput');
    if (dtInput && !dtInput.value) {
      const now = new Date(Date.now() + 2 * 60 * 1000);
      const offsetMs = now.getTimezoneOffset() * 60000;
      const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
      dtInput.value = localIso;
    }
  } else {
    if (radioImm) radioImm.checked = true;
    if (cardImm) cardImm.style.border = '2px solid var(--champagne-accent)';
    if (cardSch) cardSch.style.border = '1px solid var(--subtle-border)';
    if (timeGroup) timeGroup.classList.add('hidden');
    if (btnSubmit) btnSubmit.textContent = '🚀 Start Event Now';
  }
}

function setQuickScheduleMinutes(mins) {
  selectStartMode('SCHEDULED');
  const dtInput = document.getElementById('scheduledStartTimeInput');
  if (dtInput) {
    const target = new Date(Date.now() + mins * 60 * 1000);
    const offsetMs = target.getTimezoneOffset() * 60000;
    dtInput.value = new Date(target.getTime() - offsetMs).toISOString().slice(0, 16);
  }
}

function setScheduleDuration(sec) {
  const durInput = document.getElementById('scheduleDurationSecInput');
  if (durInput) {
    durInput.value = sec;
    updateScheduleDurationDisplay();
  }
}

function updateScheduleDurationDisplay() {
  const durInput = document.getElementById('scheduleDurationSecInput');
  const disp = document.getElementById('scheduleDurationMinDisplay');
  if (durInput && disp) {
    const mins = (Number(durInput.value) / 60).toFixed(1).replace('.0', '');
    disp.textContent = `${mins} minutes`;
  }
}

function confirmScheduleOrStartEvent() {
  if (!ws || !sessionToken || currentRole !== 'HOST') return;

  const durInput = document.getElementById('scheduleDurationSecInput');
  const durationSec = durInput ? Number(durInput.value) : 1800;
  const policySelect = document.getElementById('schedulePausePolicySelect');
  const pausePolicy = policySelect ? policySelect.value : 'TRADING_TIME';
  const titleInput = document.getElementById('scheduleEventTitleInput');
  const eventTitle = titleInput ? titleInput.value.trim() : 'The Trading Floor Championship 2026';
  const instInput = document.getElementById('scheduleInstitutionInput');
  const institution = instInput ? instInput.value.trim() : 'Gujarat Technological University';

  if (currentScheduleMode === 'SCHEDULED') {
    const dtInput = document.getElementById('scheduledStartTimeInput');
    const scheduledStartTime = dtInput ? dtInput.value : null;
    if (!scheduledStartTime) {
      alert('Please select a scheduled start date and time.');
      return;
    }
    ws.send(JSON.stringify({
      action: 'HOST_SCHEDULE_EVENT',
      session_token: sessionToken,
      startMode: 'SCHEDULED',
      scheduledStartTime: new Date(scheduledStartTime).toISOString(),
      durationSec: durationSec,
      pausePolicy: pausePolicy,
      eventTitle: eventTitle,
      institution: institution
    }));
    showOrderToast(`📅 Event scheduled for ${new Date(scheduledStartTime).toLocaleTimeString()}. Waiting room active on all screens.`, true);
  } else {
    ws.send(JSON.stringify({
      action: 'HOST_START_EVENT_NOW',
      session_token: sessionToken,
      durationSec: durationSec,
      pausePolicy: pausePolicy,
      eventTitle: eventTitle,
      institution: institution
    }));
    showOrderToast('🚀 Event launched immediately! Synchronized market opening broadcast.', true);
  }
  closeScheduleEventModal();
}

let circuitBannerTimeoutHandle = null;
let circuitBannerIntervalHandle = null;

function showCircuitAlertBanner(text) {
  const banner = document.getElementById('circuitBreakerAlertBanner');
  const alertText = document.getElementById('circuitAlertText');
  const cdText = document.getElementById('circuitAlertCountdownText');
  if (!banner) return;
  if (alertText) alertText.textContent = text;

  if (circuitBannerTimeoutHandle) {
    clearTimeout(circuitBannerTimeoutHandle);
    circuitBannerTimeoutHandle = null;
  }
  if (circuitBannerIntervalHandle) {
    clearInterval(circuitBannerIntervalHandle);
    circuitBannerIntervalHandle = null;
  }

  let remaining = 8;
  if (cdText) cdText.textContent = `(Auto-closing in ${remaining}s)`;
  banner.classList.remove('hidden');

  circuitBannerIntervalHandle = setInterval(() => {
    remaining--;
    if (cdText) cdText.textContent = `(Auto-closing in ${remaining}s)`;
    if (remaining <= 0) {
      if (circuitBannerIntervalHandle) {
        clearInterval(circuitBannerIntervalHandle);
        circuitBannerIntervalHandle = null;
      }
    }
  }, 1000);

  circuitBannerTimeoutHandle = setTimeout(() => {
    dismissCircuitAlertBanner();
  }, 8000);
}

function dismissCircuitAlertBanner() {
  if (circuitBannerTimeoutHandle) {
    clearTimeout(circuitBannerTimeoutHandle);
    circuitBannerTimeoutHandle = null;
  }
  if (circuitBannerIntervalHandle) {
    clearInterval(circuitBannerIntervalHandle);
    circuitBannerIntervalHandle = null;
  }
  const banner = document.getElementById('circuitBreakerAlertBanner');
  if (banner) banner.classList.add('hidden');
  document.body.classList.remove('circuit-strobe-active');
}

// ==========================================
// 10. CHAMPIONSHIP RESET & SETUP WIZARD
// ==========================================
function openResetChampionshipModal() {
  const modal = document.getElementById('resetChampionshipModal');
  const input = document.getElementById('resetConfirmInput');
  const btn = document.getElementById('btnConfirmResetChampionship');
  if (input) input.value = '';
  if (btn) btn.disabled = true;
  if (modal) modal.classList.remove('hidden');
}

function closeResetChampionshipModal() {
  const modal = document.getElementById('resetChampionshipModal');
  if (modal) modal.classList.add('hidden');
}

function onResetInputChange(val) {
  const btn = document.getElementById('btnConfirmResetChampionship');
  if (btn) {
    btn.disabled = (val || '').trim().toUpperCase() !== 'RESET';
  }
}

function confirmResetChampionship() {
  const input = document.getElementById('resetConfirmInput');
  if ((input.value || '').trim().toUpperCase() !== 'RESET') return;

  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      confirmation: 'RESET',
      session_token: sessionToken
    }));
  }
  closeResetChampionshipModal();
}

function openChampionshipWizardModal() {
  const modal = document.getElementById('championshipWizardModal');
  if (!modal) return;

  // 1. Populate current/default settings
  if (latestState && latestState.gameState) {
    const gs = latestState.gameState;
    const titleEl = document.getElementById('wizardEventTitle');
    const cashEl = document.getElementById('wizardStartingCash');
    const daysEl = document.getElementById('wizardTotalDays');
    const durEl = document.getElementById('wizardDayDuration');
    const feeEl = document.getElementById('wizardTransactionFee');
    const cbEl = document.getElementById('wizardCircuitBreaker');

    if (titleEl) titleEl.value = gs.title || 'The Trading Floor Championship 2026';
    if (cashEl) cashEl.value = gs.startingCash || 500000;
    if (daysEl) daysEl.value = String(gs.totalDays || 3);
    if (durEl) durEl.value = String(gs.dayDurationSeconds || 1800);
    if (feeEl) feeEl.value = String(gs.transactionFeeBps || 0);
    if (cbEl) cbEl.value = String(gs.circuitBreakerPercent || 20);
  }

  // 2. Populate Teams Table
  setWizardTeamCount(12);

  // 3. Populate Universe Checkboxes
  renderWizardUniverseCheckboxes();

  modal.classList.remove('hidden');
}

function closeChampionshipWizardModal() {
  const modal = document.getElementById('championshipWizardModal');
  if (modal) modal.classList.add('hidden');
}

const WIZARD_PRESET_NAMES = [
  'Dalal Street Titans', 'Bullish Bears', 'Alpha Hedge', 'Quantum Traders',
  'Apex Capital', 'Vanguard Vipers', 'Sterling Bulls', 'Maverick Fund',
  'Zenith Asset Mgmt', 'Phoenix Wealth', 'Starlight Equity', 'Omega Syndicate',
  'Matrix Capital', 'Falcon Traders', 'Centurion Wealth', 'Ironclad Asset',
  'Optima Quant', 'Aura Securities', 'Equinox Fund', 'Pinnacle Trading',
  'Taurus Capital', 'Frontier Hedge', 'Sigma Alpha', 'Hyperion Wealth'
];

function setWizardTeamCount(count) {
  const tbody = document.getElementById('wizardTeamsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    const name = WIZARD_PRESET_NAMES[i - 1] || `Team ${i}`;
    const username = `team${i}`;
    const password = `trade${i}00`;
    const members = `Trader ${i}A, Trader ${i}B`;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--subtle-border)';
    tr.innerHTML = `
      <td style="padding: 6px; font-weight: 700; color: var(--champagne-accent);">${i}</td>
      <td style="padding: 6px;"><input type="text" value="${escapeHtml(name)}" class="form-input wizard-team-name" style="padding: 4px 8px; font-size: 12px;" /></td>
      <td style="padding: 6px;"><input type="text" value="${username}" class="form-input wizard-team-username" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono);" /></td>
      <td style="padding: 6px;"><input type="text" value="${password}" class="form-input wizard-team-password" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono);" /></td>
      <td style="padding: 6px;"><input type="text" value="${escapeHtml(members)}" class="form-input wizard-team-members" style="padding: 4px 8px; font-size: 12px;" /></td>
      <td style="padding: 6px; text-align: center;"><button type="button" onclick="removeWizardTeamRow(this)" class="btn btn-outline" style="padding: 2px 6px; font-size: 11px; color: var(--error-red);">✕</button></td>
    `;
    tbody.appendChild(tr);
  }
}

function addWizardTeamRow() {
  const tbody = document.getElementById('wizardTeamsTbody');
  if (!tbody) return;
  const i = tbody.children.length + 1;
  const name = WIZARD_PRESET_NAMES[i - 1] || `Team ${i}`;
  const username = `team${i}`;
  const password = `trade${i}00`;
  const members = `Trader ${i}A, Trader ${i}B`;

  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--subtle-border)';
  tr.innerHTML = `
    <td style="padding: 6px; font-weight: 700; color: var(--champagne-accent);">${i}</td>
    <td style="padding: 6px;"><input type="text" value="${escapeHtml(name)}" class="form-input wizard-team-name" style="padding: 4px 8px; font-size: 12px;" /></td>
    <td style="padding: 6px;"><input type="text" value="${username}" class="form-input wizard-team-username" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono);" /></td>
    <td style="padding: 6px;"><input type="text" value="${password}" class="form-input wizard-team-password" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono);" /></td>
    <td style="padding: 6px;"><input type="text" value="${escapeHtml(members)}" class="form-input wizard-team-members" style="padding: 4px 8px; font-size: 12px;" /></td>
    <td style="padding: 6px; text-align: center;"><button type="button" onclick="removeWizardTeamRow(this)" class="btn btn-outline" style="padding: 2px 6px; font-size: 11px; color: var(--error-red);">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function removeWizardTeamRow(btn) {
  const row = btn.closest('tr');
  if (row) row.remove();
}

function renderWizardUniverseCheckboxes() {
  const container = document.getElementById('wizardUniverseContainer');
  if (!container) return;
  container.innerHTML = '';

  const universe = (latestState && (latestState.allCompaniesUniverse || latestState.companies)) || [];
  universe.forEach((c) => {
    const card = document.createElement('label');
    card.className = 'cream-panel';
    card.style.cssText = 'padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1px solid var(--subtle-border); border-radius: var(--radius-sm);';
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" value="${c.ticker}" class="wizard-universe-checkbox" ${c.isEnabled !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--price-up);" />
        <div>
          <span style="font-weight: 800; font-family: var(--font-mono); color: var(--text-forest);">${escapeHtml(c.ticker)}</span>
          <span style="font-size: 11px; color: var(--text-muted); display: block;">${escapeHtml(c.name)} • ${escapeHtml(c.sector)}</span>
        </div>
      </div>
      <div style="text-align: right; font-family: var(--font-mono);">
        <span style="font-weight: 700; color: var(--text-forest);">${formatINR(c.base_price || c.currentPrice)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleAllWizardUniverse(enabled) {
  document.querySelectorAll('.wizard-universe-checkbox').forEach((cb) => {
    cb.checked = !!enabled;
  });
}

function selectWizardUniversePreset(preset) {
  const checkboxes = document.querySelectorAll('.wizard-universe-checkbox');
  checkboxes.forEach((cb) => {
    if (preset === 'top6') {
      const top6 = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS', 'ITC'];
      cb.checked = top6.includes(cb.value);
    } else if (preset === 'balanced') {
      const balanced = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS', 'SUNPHARMA', 'HINDUNILVR', 'LICI'];
      cb.checked = balanced.includes(cb.value);
    }
  });
}

function submitChampionshipWizard() {
  const title = (document.getElementById('wizardEventTitle').value || '').trim();
  const startingCash = parseFloat(document.getElementById('wizardStartingCash').value) || 500000;
  const totalDays = parseInt(document.getElementById('wizardTotalDays').value, 10) || 3;
  const dayDurationSeconds = parseInt(document.getElementById('wizardDayDuration').value, 10) || 1800;
  const transactionFeeBps = parseInt(document.getElementById('wizardTransactionFee').value, 10) || 0;
  const circuitBreakerPercent = parseFloat(document.getElementById('wizardCircuitBreaker').value) || 20;

  // Gather Teams
  const teamRows = document.querySelectorAll('#wizardTeamsTbody tr');
  const teams = [];
  teamRows.forEach((tr, idx) => {
    const name = tr.querySelector('.wizard-team-name').value.trim() || `Team ${idx + 1}`;
    const username = tr.querySelector('.wizard-team-username').value.trim() || `team${idx + 1}`;
    const password = tr.querySelector('.wizard-team-password').value.trim() || `trade${idx + 1}00`;
    const members = tr.querySelector('.wizard-team-members').value.trim() || `Trader ${idx + 1}A, Trader ${idx + 1}B`;
    teams.push({ name, username, password, members, startingCash });
  });

  if (teams.length < 2) {
    alert('At least 2 teams are required to launch a championship.');
    return;
  }

  // Gather Selected Tickers
  const selectedTickers = [];
  document.querySelectorAll('.wizard-universe-checkbox:checked').forEach((cb) => {
    selectedTickers.push(cb.value);
  });

  if (selectedTickers.length < 2) {
    alert('Please select at least 2 companies for the tradeable market universe.');
    return;
  }

  const config = {
    title,
    startingCash,
    totalDays,
    dayDurationSeconds,
    transactionFeeBps,
    circuitBreakerPercent,
    teams,
    selectedTickers
  };

  if (ws && sessionToken && currentRole === 'HOST') {
    ws.send(JSON.stringify({
      action: 'HOST_INITIALIZE_NEW_CHAMPIONSHIP',
      config,
      session_token: sessionToken
    }));
  }
}

// -----------------------------------------------------------------------------
// Disaster Recovery & Checkpoints Client Engine
// -----------------------------------------------------------------------------
function hostCreateCheckpoint(label = 'manual') {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showOrderToast('WebSocket not connected. Cannot save checkpoint.', false);
    return;
  }
  showOrderToast('💾 Saving disaster recovery checkpoint...', true);
  ws.send(JSON.stringify({
    action: 'HOST_CREATE_CHECKPOINT',
    label,
    session_token: sessionToken
  }));
}

function hostRefreshCheckpoints() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    action: 'HOST_LIST_CHECKPOINTS',
    session_token: sessionToken
  }));
}

function renderHostCheckpointsTable(checkpoints) {
  const tbody = document.getElementById('hostCheckpointsTableBody');
  if (!tbody) return;

  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 16px; text-align: center; color: var(--text-muted);">
          No saved checkpoints yet. Click <strong>"Save Instant Checkpoint Now"</strong> to create a recovery point.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  checkpoints.forEach((cp) => {
    const min = Math.floor(cp.elapsedSeconds / 60);
    const sec = cp.elapsedSeconds % 60;
    const timeFormatted = `${min}m ${sec < 10 ? '0' : ''}${sec}s (${cp.elapsedSeconds}s)`;
    const dateFormatted = new Date(cp.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isAuto = cp.label === 'auto';
    const typeBadge = isAuto 
      ? `<span class="badge" style="background: #E0E7FF; color: #3730A3; font-size: 10px; font-weight: 700;">AUTO (120s)</span>`
      : `<span class="badge badge-champagne" style="font-size: 10px; font-weight: 700;">${escapeHtml(cp.label.toUpperCase())}</span>`;

    html += `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; font-family: var(--font-mono); font-weight: 700; color: #1E3A8A;">
          ${escapeHtml(cp.filename)}
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 400; font-family: var(--font-sans); margin-top: 2px;">
            Saved at ${dateFormatted}
          </div>
        </td>
        <td style="padding: 10px 14px; font-weight: 700; color: var(--text-forest);">
          Day ${cp.day}
        </td>
        <td style="padding: 10px 14px; font-family: var(--font-mono);">
          ${timeFormatted}
        </td>
        <td style="padding: 10px 14px;">
          ${typeBadge}
        </td>
        <td style="padding: 10px 14px; font-family: var(--font-mono); color: var(--text-muted);">
          ${cp.sizeKB} KB
        </td>
        <td style="padding: 10px 14px; text-align: right;">
          <button onclick="hostRestoreCheckpoint('${escapeHtml(cp.filename)}')" class="btn btn-outline" 
            style="padding: 4px 12px; font-size: 11px; font-weight: 800; border-color: #EF4444; color: #DC2626; background: #FEF2F2;"
            title="Restore game state to this exact second">
            🔄 Restore
          </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function hostRestoreCheckpoint(filename) {
  if (!filename) return;
  const confirmed = confirm(
    `⚠️ DISASTER RECOVERY & GAME RESTORE CONFIRMATION\n\n` +
    `Are you sure you want to restore the championship to checkpoint:\n"${filename}"?\n\n` +
    `• All 16 team cash balances, stock holdings, and trades will revert to this snapshot.\n` +
    `• Stock prices will revert to this exact point.\n` +
    `• The market will be loaded in a safe PAUSED state.\n` +
    `• You can then click "▶ Resume 3-2-1" when ready to continue the tournament.\n\n` +
    `Proceed with Restore?`
  );
  if (!confirmed) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showOrderToast('WebSocket not connected. Cannot restore checkpoint.', false);
    return;
  }

  showOrderToast('🔄 Restoring championship state from checkpoint...', true);
  ws.send(JSON.stringify({
    action: 'HOST_RESTORE_CHECKPOINT',
    filename,
    session_token: sessionToken
  }));
}

function hostUploadBackupFile(event) {
  const file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.gameState || !Array.isArray(data.companies) || !data.teams) {
        alert('Invalid backup file. The uploaded JSON does not contain valid championship data (missing gameState, companies, or teams).');
        return;
      }

      const confirmed = confirm(
        `⚠️ RESTORE FROM UPLOADED BACKUP FILE\n\n` +
        `File: "${file.name}"\n` +
        `Title: ${data.gameState.title || 'The Trading Floor'}\n` +
        `Day: ${data.gameState.currentDay || 1} (${data.gameState.elapsedSeconds || 0}s elapsed)\n` +
        `Teams: ${Object.keys(data.teams).length}\n\n` +
        `Restore this backup? The market will be restored in a safe PAUSED state ready for Host Resume.`
      );
      if (!confirmed) return;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showOrderToast('WebSocket not connected.', false);
        return;
      }

      showOrderToast('🔄 Uploading and restoring backup...', true);
      ws.send(JSON.stringify({
        action: 'HOST_RESTORE_CHECKPOINT',
        checkpointData: data,
        session_token: sessionToken
      }));
    } catch (err) {
      alert(`Error reading backup file: ${err.message}`);
    } finally {
      if (event.target) event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// Export Guided Setup Controller to window for inline HTML event attributes
window.initOrRestoreEventSetup = initOrRestoreEventSetup;
window.saveSetupDraft = saveSetupDraft;
window.switchSetupSection = switchSetupSection;
window.generateRandomTeamPins = generateRandomTeamPins;
window.resetDefaultTeamCredentials = resetDefaultTeamCredentials;
window.copySetupCredentialsToClipboard = copySetupCredentialsToClipboard;
window.downloadSetupCredentialsCsv = downloadSetupCredentialsCsv;
window.renderStockCatalogueGrid = renderStockCatalogueGrid;
window.filterStockCatalogue = filterStockCatalogue;
window.filterCatalogueBySector = filterCatalogueBySector;
window.toggleStockSelection = toggleStockSelection;
window.selectStockPreset = selectStockPreset;
window.updateNewsPreviewFromSelection = updateNewsPreviewFromSelection;
window.regenerateNewsTimeline = regenerateNewsTimeline;
window.openLockSetupConfirmModal = openLockSetupConfirmModal;
window.closeLockSetupConfirmModal = closeLockSetupConfirmModal;
window.submitLockEventSetup = submitLockEventSetup;
window.updateLoginEventStatusBanner = updateLoginEventStatusBanner;
window.applyTeamCountPreset = applyTeamCountPreset;
window.addSetupTeamRow = addSetupTeamRow;
window.removeSetupTeamRow = removeSetupTeamRow;
window.openPostLockDay1Modal = openPostLockDay1Modal;
window.closePostLockDay1Modal = closePostLockDay1Modal;
window.executePostLockStartNow = executePostLockStartNow;
window.togglePostLockScheduleSection = togglePostLockScheduleSection;
window.confirmPostLockSchedule = confirmPostLockSchedule;
window.executePostLockStartLater = executePostLockStartLater;
window.playDramaticWinnerReveal = playDramaticWinnerReveal;
window.triggerDramaticDrumroll = triggerDramaticDrumroll;

// Probe authoritative event readiness status for login screen immediately
try {
  fetch('/api/event-status')
    .then((res) => res.json())
    .then((data) => {
      if (data && data.configLocked !== undefined) {
        updateLoginEventStatusBanner({ gameState: data });
      }
    })
    .catch(() => {});
} catch (e) {}

// Initialize connection on load
connectWebSocket();


// ==========================================
// P1/P2: ENHANCED KEYBOARD SHORTCUTS & HELP MODAL
// Added: October 17, 2026
// ==========================================

// Show keyboard shortcuts help modal
function showKeyboardShortcutsHelp() {
  const existingModal = document.getElementById('keyboardHelpModal');
  if (existingModal) {
    existingModal.classList.remove('hidden');
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'keyboardHelpModal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '100000';
  
  const shortcuts = {
    'All Terminals': [
      { keys: ['?'], description: 'Show this keyboard shortcuts help' },
      { keys: ['Esc'], description: 'Close modal / Exit projector' }
    ],
    'Trader Terminal': [
      { keys: ['Enter'], description: 'Execute trade (when modal open)' },
      { keys: ['↑'], description: 'Increase quantity' },
      { keys: ['↓'], description: 'Decrease quantity' },
      { keys: ['Esc'], description: 'Close trade modal' }
    ],
    'Host Panel': [
      { keys: ['Ctrl', 'Space'], description: 'Pause/Resume market' },
      { keys: ['Ctrl', 'S'], description: 'Save checkpoint' },
      { keys: ['Ctrl', 'D'], description: 'Advance to next day' }
    ],
    'Projector View': [
      { keys: ['F'], description: 'Toggle fullscreen' },
      { keys: ['Space'], description: 'Pause/Resume board auto-flip' },
      { keys: ['Esc'], description: 'Exit projector terminal' }
    ]
  };

  let shortcutsHtml = '';
  for (const [section, items] of Object.entries(shortcuts)) {
    shortcutsHtml += `<div style="margin-bottom: 1.5em;">
      <h4 style="color: var(--champagne-accent); font-size: 0.9em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.8em;">${section}</h4>
      <div class="keyboard-shortcuts-grid">`;
    
    for (const item of items) {
      shortcutsHtml += `<div class="shortcut-item">
        <span class="shortcut-description">${item.description}</span>
        <div class="shortcut-keys">`;
      for (const key of item.keys) {
        shortcutsHtml += `<kbd class="key-badge">${key}</kbd>`;
      }
      shortcutsHtml += `</div></div>`;
    }
    
    shortcutsHtml += `</div></div>`;
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 720px; width: 92%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px solid var(--subtle-border);">
        <div>
          <h2 style="font-size: 1.6em; color: var(--text-forest); margin: 0 0 0.3em 0;">⌨️ Keyboard Shortcuts</h2>
          <p style="color: var(--text-muted); font-size: 0.9em; margin: 0;">Press <kbd class="key-badge">?</kbd> anytime to show this help</p>
        </div>
        <button type="button" onclick="closeKeyboardHelp()" class="btn btn-outline" style="font-size: 20px; padding: 8px 12px;">✕</button>
      </div>
      <div style="max-height: 60vh; overflow-y: auto;">
        ${shortcutsHtml}
      </div>
      <div style="margin-top: 1.5em; padding-top: 1em; border-top: 1px solid var(--subtle-border); text-align: center;">
        <button type="button" onclick="closeKeyboardHelp()" class="btn btn-primary">Got it, thanks!</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeKeyboardHelp();
  });
}

function closeKeyboardHelp() {
  const modal = document.getElementById('keyboardHelpModal');
  if (modal) modal.classList.add('hidden');
}

// Projector Fullscreen helper
function toggleProjectorFullscreen() {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Enhanced keyboard shortcuts handler (extends existing one at line 1965)
document.addEventListener('keydown', (e) => {
  // ESC closes keyboard help modal if open
  if (e.key === 'Escape') {
    const helpModal = document.getElementById('keyboardHelpModal');
    if (helpModal && !helpModal.classList.contains('hidden')) {
      e.preventDefault();
      closeKeyboardHelp();
      return;
    }
  }

  // Show help modal with ? key (Shift + /)
  if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    // Don't trigger if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    showKeyboardShortcutsHelp();
    return;
  }

  // HOST-specific shortcuts
  if (typeof currentRole !== 'undefined' && currentRole === 'HOST') {
    // Ctrl+Space: Pause/Resume market
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      const resumeBtn = document.getElementById('btnResumeMarket');
      const pauseBtn = document.getElementById('btnPauseMarket');
      if (resumeBtn && !resumeBtn.disabled && resumeBtn.offsetParent !== null) {
        resumeBtn.click();
      } else if (pauseBtn && !pauseBtn.disabled && pauseBtn.offsetParent !== null) {
        pauseBtn.click();
      }
      return;
    }

    // Ctrl+S: Save checkpoint
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      const saveBtn = document.getElementById('btnSaveCheckpoint');
      if (saveBtn && !saveBtn.disabled) saveBtn.click();
      return;
    }

    // Ctrl+D: Advance day (if day completed)
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      const advanceBtn = document.getElementById('btnAdvanceDay');
      if (advanceBtn && !advanceBtn.disabled && advanceBtn.offsetParent !== null) {
        advanceBtn.click();
      }
      return;
    }
  }

  // PROJECTOR-specific shortcuts
  if (typeof currentRole !== 'undefined' && currentRole === 'PROJECTOR') {
    // F: Toggle fullscreen
    if (e.key === 'f' || e.key === 'F') {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleProjectorFullscreen();
      }
      return;
    }

    // Space: Toggle board auto-flip
    if (e.code === 'Space' || e.key === ' ') {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (typeof projectorToggleBoardPause === 'function') {
          projectorToggleBoardPause();
        } else {
          const pauseFlipBtn = document.getElementById('btnProjToggleBoardPause');
          if (pauseFlipBtn) pauseFlipBtn.click();
        }
      }
      return;
    }
  }
});

// Add utility functions for button loading states
function setButtonLoading(buttonElement, isLoading) {
  if (!buttonElement) return;
  
  if (isLoading) {
    buttonElement.classList.add('btn-loading');
    buttonElement.disabled = true;
    buttonElement.dataset.originalText = buttonElement.textContent;
  } else {
    buttonElement.classList.remove('btn-loading');
    buttonElement.disabled = false;
    if (buttonElement.dataset.originalText) {
      buttonElement.textContent = buttonElement.dataset.originalText;
    }
  }
}

// Enhanced toast with action button support
function showEnhancedToast(message, isSuccess, actionText, actionCallback) {
  const existingToast = document.getElementById('orderToast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'orderToast';
  toast.className = 'order-toast ' + (isSuccess ? 'success' : 'error');
  
  if (actionText && actionCallback) {
    const wrapper = document.createElement('div');
    wrapper.className = 'toast-with-action';
    
    const msg = document.createElement('span');
    msg.textContent = message;
    wrapper.appendChild(msg);
    
    const btn = document.createElement('button');
    btn.className = 'toast-action-btn';
    btn.textContent = actionText;
    btn.onclick = () => {
      actionCallback();
      toast.remove();
    };
    wrapper.appendChild(btn);
    
    toast.appendChild(wrapper);
  } else {
    toast.textContent = message;
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

