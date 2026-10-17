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
let latestState = null;
let flashTimerHandle = null;
let currentSelectedTickerForChart = null;

// Trader View Filtering & Tab State
let activeTraderTab = 'market';
let activeHostTab = 'stocks';
let traderSearchTerm = '';
let traderSectorFilterVal = 'ALL';

// Modal Trade State
let currentTradeModalTicker = null;
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
      sessionStorage.setItem('ttf_session_token', sessionToken);
      if (msg.initialState) {
        latestState = msg.initialState;
      }
      switchSpaView(msg.role);
      handleStateUpdate(msg.initialState);
      return;
    }

    if (msg.type === 'TICK_UPDATE') {
      handleStateUpdate(msg);
      return;
    }

    if (msg.type === 'NEWS_FLASH') {
      playInstitutionalSound('heavy_news_boom');
      showBreakingNewsToast(msg.news);
      return;
    }

    if (msg.type === 'CIRCUIT_BREAKER_ALERT') {
      playInstitutionalSound('emergency_klaxon');
      document.body.classList.add('circuit-strobe-active');
      setTimeout(() => { document.body.classList.remove('circuit-strobe-active'); }, 5000);
      const banner = document.getElementById('circuitBreakerAlertBanner');
      if (banner) {
        document.getElementById('circuitAlertText').textContent = `${msg.name || msg.ticker} (${msg.ticker}) HALTED at ₹${msg.price.toFixed(2)} due to ${msg.direction || '20%'} circuit limit breach.`;
        banner.classList.remove('hidden');
      }
      showOrderToast(`🚨 CIRCUIT BREAKER: ${msg.ticker} halted (${msg.direction} limit at ₹${msg.price.toFixed(2)})`, false);
      return;
    }

    if (msg.type === 'BELL_EVENT') {
      playInstitutionalSound(msg.bell === 'OPEN' ? 'bell_open' : 'bell_close');
      return;
    }

    if (msg.type === 'AUDIO_CUE') {
      handleIncomingAudioCue(msg);
      return;
    }

    if (msg.type === 'PRESENTATION_SCENE_UPDATE') {
      renderPresentationScene(msg.scene, msg.snapshot);
      return;
    }

    if (msg.type === 'COUNTDOWN_START') {
      syncAuthoritativeCountdown(msg);
      return;
    }

    if (msg.type === 'COUNTDOWN_CANCELLED') {
      cancelAuthoritativeCountdown();
      return;
    }

    if (msg.type === 'COUNTDOWN_FINISH') {
      cancelAuthoritativeCountdown();
      return;
    }

    if (msg.type === 'MARKET_PAUSED') {
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
      const softOverlay = document.getElementById('softPauseOverlay');
      const blackoutOverlay = document.getElementById('blackoutOverlay');
      if (softOverlay) softOverlay.classList.add('hidden');
      if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
      if (!currentCountdownId && (Date.now() - lastCountdownFinishedTime > 1500)) {
        playInstitutionalSound('bell_open');
      }
      showOrderToast('Trading Resumed: Floor is active!', true);
      return;
    }

    if (msg.type === 'DAY_TRANSITION') {
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
      playInstitutionalSound('order_placed');
      const timeStr = new Date(msg.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      showOrderToast(`📅 Event scheduled for ${timeStr}. Waiting room countdown armed.`, true);
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

    if (msg.type === 'EVENT_CONFIG_LOCKED') {
      if (latestState && latestState.gameState) {
        latestState.gameState.configLocked = true;
        latestState.gameState.status = msg.status || 'STANDBY';
      }
      updateLoginEventStatusBanner(latestState);
      if (currentRole === 'HOST') {
        const setupEl = document.getElementById('eventSetupView');
        const hostEl = document.getElementById('hostView');
        if (setupEl) setupEl.classList.add('hidden');
        if (hostEl) hostEl.classList.remove('hidden');
        showOrderToast(`🔒 ${msg.reason || 'Configuration locked! Live championship active and 16 team logins open.'}`, true);
      }
      return;
    }

    if (msg.type === 'EVENT_CONFIG_LOCKED_ACK') {
      if (currentRole === 'HOST') {
        if (msg.gameState && latestState) {
          latestState.gameState = msg.gameState;
        }
        const setupEl = document.getElementById('eventSetupView');
        const hostEl = document.getElementById('hostView');
        if (setupEl) setupEl.classList.add('hidden');
        if (hostEl) hostEl.classList.remove('hidden');
        showOrderToast('🔒 ' + (msg.message || 'Championship setup locked! 16 team credentials are live.'), true);
        if (latestState) renderHostView(latestState);
      }
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
  teamEquityHistory = [];
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

// ESC key to lock / return from Projector view
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentRole === 'PROJECTOR') {
    logoutTerminal();
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

  // Handle Dual Pause Overlays (Never show pause overlay when event is in pre-event lobby, SCHEDULED waiting room, STANDBY, or COUNTDOWN)
  const isPreEvent = state.gameState && (
    state.gameState.status === 'SCHEDULED' ||
    state.gameState.status === 'PRE_EVENT_COUNTDOWN' ||
    state.gameState.status === 'STANDBY' ||
    state.gameState.status === 'COUNTDOWN' ||
    state.gameState.status === 'NOT_STARTED' ||
    (state.gameState.elapsedSeconds === 0 && state.gameState.status !== 'LIVE')
  );
  const softOverlay = document.getElementById('softPauseOverlay');
  const blackoutOverlay = document.getElementById('blackoutOverlay');
  if (state.gameState && state.gameState.isPaused && !state.gameState.isConcluded && !isPreEvent) {
    if (currentRole !== 'HOST') {
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
  traderSearchTerm = (document.getElementById('traderStockSearch').value || '').toLowerCase().trim();
  traderSectorFilterVal = document.getElementById('traderSectorFilter').value;
  if (latestState && currentRole === 'TRADER') {
    renderTraderView(latestState);
  }
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
  if (gameState.isPaused) {
    statusEl.textContent = 'MARKET PAUSED';
    statusEl.className = 'badge badge-paused';
  } else {
    statusEl.textContent = 'ACTIVE TRADING';
    statusEl.className = 'badge badge-active';
  }

  // Dual Timer & Waiting Room Logic
  const waitingRoomOverlay = document.getElementById('traderWaitingRoomOverlay');
  const dualTimerLabel = document.getElementById('traderDualTimerLabel');
  const dualTimerValue = document.getElementById('traderDualTimerValue');
  const dualTimerWrap = document.getElementById('traderDualTimerWrap');
  const softPauseOverlay = document.getElementById('softPauseOverlay');
  const blackoutOverlay = document.getElementById('blackoutOverlay');

  const isPreEventTrader = gameState.status === 'SCHEDULED' || 
                           gameState.status === 'PRE_EVENT_COUNTDOWN' || 
                           gameState.status === 'STANDBY' ||
                           gameState.status === 'NOT_STARTED' ||
                           (gameState.elapsedSeconds === 0 && gameState.status !== 'LIVE' && gameState.status !== 'COUNTDOWN');

  if (isPreEventTrader) {
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
  } else {
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
  const filteredCompanies = companies.filter((stock) => {
    if (stock.isEnabled === false) return false;
    const matchesSearch = stock.ticker.toLowerCase().includes(traderSearchTerm) ||
      stock.name.toLowerCase().includes(traderSearchTerm);
    const matchesSector = traderSectorFilterVal === 'ALL' || stock.sector === traderSectorFilterVal;
    return matchesSearch && matchesSector;
  });

  const grid = document.getElementById('traderTabContentMarket');
  grid.innerHTML = filteredCompanies.map((stock) => {
    const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
    const pct = pctVal.toFixed(2);
    const isUp = pctVal >= 0;
    const heldQty = portfolio ? (portfolio.holdings[stock.ticker] || 0) : 0;
    const avgPrice = portfolio ? (portfolio.avgBuyPrice[stock.ticker] || 0) : 0;

    const quickLots = stock.lot_presets.slice(0, 3).map((lot) => {
      const feeBps = gameState.transactionFeeBps || 0;
      const totalCost = lot * stock.currentPrice * (1 + feeBps / 10000);
      const canBuy = !stock.isHalted && !gameState.isPaused && portfolio && portfolio.cash >= totalCost;
      const canSell = !stock.isHalted && !gameState.isPaused && heldQty >= lot;

      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <button onclick="sendOrder('${stock.ticker}', 'BUY', ${lot})"
            ${canBuy ? '' : 'disabled'}
            class="btn btn-buy">
            BUY +${lot}
          </button>
          <button onclick="sendOrder('${stock.ticker}', 'SELL', ${lot})"
            ${canSell ? '' : 'disabled'}
            class="btn btn-sell">
            SELL -${lot}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="stock-card ${stock.isHalted ? 'halted' : ''}">
        <div>
          <div class="stock-card-header">
            <div>
              <span class="stock-sector">${stock.sector}</span>
              <div class="stock-ticker">${stock.ticker}</div>
              <div class="stock-name">${stock.name}</div>
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
            <span class="stock-current-price ${isUp ? 'price-up' : 'price-down'}">
              ₹${stock.currentPrice.toFixed(2)}
            </span>
            <span class="stock-delta ${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${pct}% ${isUp ? '▲' : '▼'}
            </span>
          </div>

          <!-- Mini Canvas Sparkline -->
          <div class="sparkline-wrapper" onclick="openFullChartModal('${stock.ticker}')">
            <canvas id="traderCanvas_${stock.ticker}" width="280" height="60" style="width: 100%; height: 100%;"></canvas>
          </div>

          ${stock.isHalted ? `
            <div class="badge badge-halted" style="width: 100%; justify-content: center; margin-bottom: 8px;">
              ⛔ CIRCUIT BREAKER HALTED (${stock.haltDirection})
            </div>
          ` : ''}

          <!-- Portfolio Position on Card -->
          <div class="stock-holding-row">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Held</span>
              <strong style="font-family: var(--font-mono); color: var(--text-forest);">${heldQty} shares</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Avg Cost</span>
              <strong style="font-family: var(--font-mono); color: var(--text-muted);">₹${avgPrice.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div>
          <!-- Quick Lot Presets -->
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px;">
            ${quickLots}
          </div>
          <!-- Custom Quantity Trade Modal Trigger -->
          <button onclick="openTradeModal('${stock.ticker}')" class="btn btn-outline" style="width: 100%; padding: 6px; font-size: 11px;">
            Trade Custom Quantity...
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
function openTradeModal(ticker) {
  currentTradeModalTicker = ticker;
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  document.getElementById('tradeModalTicker').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('tradeModalSector').textContent = stock.sector;
  document.getElementById('tradeQuantityInput').value = stock.lot_presets[0] || 10;

  const notice = document.getElementById('tradeModalValidationNotice');
  if (notice) notice.classList.add('hidden');

  recalculateTradeModal();
  document.getElementById('tradeModal').classList.remove('hidden');
}

function closeTradeModal() {
  currentTradeModalTicker = null;
  document.getElementById('tradeModal').classList.add('hidden');
}

function setTradeLot(qty) {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;

  const input = document.getElementById('tradeQuantityInput');
  const feeBps = latestState.gameState.transactionFeeBps || 0;
  const currentHeld = p.holdings[stock.ticker] || 0;

  if (qty === 'MAX_BUY') {
    const costPerShare = stock.currentPrice * (1 + feeBps / 10000);
    const maxShares = Math.floor(p.cash / costPerShare);
    input.value = Math.max(0, maxShares);
  } else if (qty === 'SELL_ALL' || qty === 'MAX_SELL') {
    input.value = currentHeld;
  } else if (qty === '25%') {
    input.value = Math.max(1, Math.floor(currentHeld * 0.25));
  } else if (qty === '50%') {
    input.value = Math.max(1, Math.floor(currentHeld * 0.50));
  } else if (qty === '75%') {
    input.value = Math.max(1, Math.floor(currentHeld * 0.75));
  } else {
    input.value = qty;
  }
  recalculateTradeModal();
}

function recalculateTradeModal() {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;

  const qty = parseInt(document.getElementById('tradeQuantityInput').value, 10) || 0;
  const price = stock.currentPrice;
  const gross = +(qty * price).toFixed(2);
  const feeBps = latestState.gameState.transactionFeeBps || 0;
  const fee = +((gross * feeBps) / 10000).toFixed(2);
  const netBuyCost = +(gross + fee).toFixed(2);
  const netSellProceeds = +(gross - fee).toFixed(2);
  const currentHeld = p.holdings[stock.ticker] || 0;

  document.getElementById('tradeModalPrice').textContent = `₹${price.toFixed(2)}`;
  document.getElementById('tradeModalCash').textContent = formatINR(p.cash);
  document.getElementById('tradeModalHolding').textContent = `${currentHeld} shares`;

  document.getElementById('tradeModalGross').textContent = `₹${gross.toFixed(2)}`;
  document.getElementById('tradeModalFee').textContent = `₹${fee.toFixed(2)} (${feeBps} bps)`;
  document.getElementById('tradeModalNet').textContent = `₹${netBuyCost.toFixed(2)}`;

  const isMarketPaused = latestState.gameState.isPaused || latestState.gameState.isConcluded;
  const isStockHalted = stock.isHalted;
  const canBuy = !isMarketPaused && !isStockHalted && qty > 0 && p.cash >= netBuyCost;
  const canSell = !isMarketPaused && !isStockHalted && qty > 0 && currentHeld >= qty;

  const btnBuy = document.getElementById('btnExecuteBuy');
  const btnSell = document.getElementById('btnExecuteSell');
  btnBuy.disabled = !canBuy;
  btnSell.disabled = !canSell;

  if (qty > 0) {
    btnBuy.textContent = canBuy ? `Confirm BUY ${qty} Shares` : `BUY (Need ₹${netBuyCost.toLocaleString('en-IN')})`;
    btnSell.textContent = canSell ? `Confirm SELL ${qty} Shares` : `SELL (Need ${qty} Shares)`;
  } else {
    btnBuy.textContent = 'Confirm BUY';
    btnSell.textContent = 'Confirm SELL';
  }

  // Educational Live Status / Guidance Box
  const notice = document.getElementById('tradeModalValidationNotice');
  if (notice) {
    if (isMarketPaused) {
      notice.innerHTML = `<strong>⏸️ Market is currently paused</strong><br>The host has temporarily suspended trading. Orders cannot be placed right now.`;
      notice.style.backgroundColor = '#FEF3C7';
      notice.style.color = '#92400E';
      notice.style.border = '1px solid #FCD34D';
      notice.classList.remove('hidden');
    } else if (isStockHalted) {
      notice.innerHTML = `<strong>⚡ Circuit Breaker Halt</strong><br>Trading in ${stock.ticker} is halted (${stock.haltDirection} circuit limit reached). Orders are blocked until circuit cooling.`;
      notice.style.backgroundColor = '#FEE2E2';
      notice.style.color = '#991B1B';
      notice.style.border = '1px solid #F87171';
      notice.classList.remove('hidden');
    } else if (qty <= 0) {
      notice.innerHTML = `💡 Enter an order quantity above (1 or more shares), or select a quick shortcut button.`;
      notice.style.backgroundColor = '#F8F7F4';
      notice.style.color = 'var(--text-charcoal)';
      notice.style.border = '1px solid var(--subtle-border)';
      notice.classList.remove('hidden');
    } else if (p.cash < netBuyCost && currentHeld < qty) {
      const shortfall = (netBuyCost - p.cash).toFixed(2);
      const costPerUnit = price * (1 + feeBps / 10000);
      const maxAffordable = Math.floor(p.cash / costPerUnit);
      notice.innerHTML = `<strong>⚠️ Insufficient Cash & Shares:</strong><br>• BUY shortfall: ₹${Number(shortfall).toLocaleString('en-IN')} (you can afford at most <strong>${maxAffordable}</strong> shares)<br>• SELL shortage: you only own <strong>${currentHeld}</strong> shares.`;
      notice.style.backgroundColor = '#FEF2F2';
      notice.style.color = '#B91C1C';
      notice.style.border = '1px solid #FCA5A5';
      notice.classList.remove('hidden');
    } else if (p.cash < netBuyCost) {
      const shortfall = (netBuyCost - p.cash).toFixed(2);
      const costPerUnit = price * (1 + feeBps / 10000);
      const maxAffordable = Math.floor(p.cash / costPerUnit);
      notice.innerHTML = `<strong>💰 Insufficient Cash for BUY:</strong><br>Total cost is ₹${Number(netBuyCost).toLocaleString('en-IN')}, but available cash is ₹${Number(p.cash).toLocaleString('en-IN')} (shortfall: ₹${Number(shortfall).toLocaleString('en-IN')}). You can afford at most <strong>${maxAffordable}</strong> shares.`;
      notice.style.backgroundColor = '#FEF2F2';
      notice.style.color = '#B91C1C';
      notice.style.border = '1px solid #FCA5A5';
      notice.classList.remove('hidden');
    } else if (currentHeld < qty) {
      notice.innerHTML = `<strong>📉 Insufficient Shares for SELL:</strong><br>Your portfolio holds <strong>${currentHeld}</strong> shares of ${stock.ticker}. You cannot sell ${qty} shares.`;
      notice.style.backgroundColor = '#FEF2F2';
      notice.style.color = '#B91C1C';
      notice.style.border = '1px solid #FCA5A5';
      notice.classList.remove('hidden');
    } else {
      notice.innerHTML = `<strong>✓ Order Ready:</strong><br>• Buying ${qty} shares costs ₹${netBuyCost.toFixed(2)} (Cash left: ₹${(p.cash - netBuyCost).toFixed(2)})<br>• Selling ${qty} shares credits ₹${netSellProceeds.toFixed(2)} to Cash`;
      notice.style.backgroundColor = '#ECFDF5';
      notice.style.color = '#065F46';
      notice.style.border = '1px solid #A7F3D0';
      notice.classList.remove('hidden');
    }
  }
}

function executeModalTrade(type) {
  if (!currentTradeModalTicker) return;
  const qty = parseInt(document.getElementById('tradeQuantityInput').value, 10);
  if (!qty || qty <= 0) return;
  sendOrder(currentTradeModalTicker, type, qty);
}

// Company Details Modal
function openDetailsModal(ticker) {
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;
  const f = stock.fundamentals || {};

  document.getElementById('modalTitle').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('modalSummary').textContent = f.summary || `${stock.name} is a leading corporation in the ${stock.sector} sector.`;
  document.getElementById('modalSector').textContent = stock.sector;
  document.getElementById('modalFaceValue').textContent = `₹${(f.face_value || 1).toFixed(2)}`;
  document.getElementById('modalHigh52').textContent = `₹${(f.high_52w || stock.base_price).toLocaleString('en-IN')}`;
  document.getElementById('modalLow52').textContent = `₹${(f.low_52w || stock.base_price).toLocaleString('en-IN')}`;
  document.getElementById('modalPE').textContent = f.pe_ratio !== undefined ? f.pe_ratio : 'N/A';
  document.getElementById('modalMarketCap').textContent = f.market_cap || 'N/A';
  document.getElementById('modalDE').textContent = f.debt_to_equity !== undefined ? f.debt_to_equity : 'N/A';

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
let projectorCardsPerPage = 8;
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
  const isPaused = gameState.isPaused && !isStandby && !isScheduled && !gameState.isConcluded;
  const isMarketClosed = gameState.status === 'MARKET_CLOSED';

  const remMs = (isScheduled && gameState.scheduledStartTime)
    ? Math.max(0, new Date(gameState.scheduledStartTime).getTime() - Date.now())
    : 0;
  const remSec = Math.floor(remMs / 1000);

  // Standby & Scheduled Banner
  const projStandbyBanner = document.getElementById('projStandbyBanner');
  if (projStandbyBanner) {
    if (isScheduled) {
      projStandbyBanner.classList.remove('hidden');
      const bBadge = document.getElementById('projStandbyDayBadge');
      const bTitle = document.getElementById('projStandbyTitle');
      const bSub = document.getElementById('projStandbySub');
      if (bBadge) bBadge.textContent = `DAY ${gameState.currentDay} SCHEDULED`;
      if (bTitle) bTitle.textContent = `Day ${gameState.currentDay} Scheduled • Opens in ${formatMMSS(remSec)}`;
      if (bSub) bSub.textContent = `Trading desks are connected. Synchronized opening countdown is live in auditorium and all terminals.`;
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
    } else if (isPaused) {
      clockEl.textContent = `PAUSED • ${formatMMSS(gameState.elapsedSeconds)}`;
      clockEl.style.color = 'var(--warning-amber)';
    } else if (isMarketClosed) {
      clockEl.textContent = `SESSION CLOSED`;
      clockEl.style.color = 'var(--champagne-accent)';
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
    } else if (isPaused) {
      statusEl.textContent = gameState.pauseMode === 'BLACKOUT' ? '🕶️ BLACKOUT PAUSED' : '⏸️ MARKET PAUSED';
      statusEl.className = 'badge badge-paused';
    } else if (isMarketClosed) {
      statusEl.textContent = `🔔 DAY ${gameState.currentDay} CONCLUDED`;
      statusEl.className = 'badge badge-champagne';
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
    } else if (isPaused) {
      tickerEl.textContent = `⏸️ MARKET PAUSED: All trading is frozen. Market will resume with an authoritative 3-second countdown.`;
    } else if (isMarketClosed) {
      tickerEl.textContent = `🔔 DAY ${gameState.currentDay} CONCLUDED: Trading has ended. Audited standings and net worth valuations displayed on leaderboard.`;
    } else if (gameState.newsHistory && gameState.newsHistory.length > 0) {
      const latestNews = gameState.newsHistory[0];
      tickerEl.textContent = `[DAY ${latestNews.day} • ${latestNews.type || 'WIRE'}] "${(latestNews.headline || '').toUpperCase()}" — ${latestNews.simple_explanation || ''}`;
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
  if (isMarketClosed || (isStandby && gameState.currentDay > 1)) {
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

  Object.keys(sceneElements).forEach((sKey) => {
    const el = sceneElements[sKey];
    if (el) {
      if (sKey === activeScene) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  // Always render persistent real-time indices ticker strip on projector
  const projIndicesList = marketIndices || (gameState && gameState.marketIndices) || calculateClientIndices(companies);
  renderAllIndicesBars(projIndicesList);

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

// Scene 1: All-Stocks High-Visibility Grid with Automatic Zero-Scroll Pagination & Spotlight
function renderProjectorMarketBoard(companies) {
  const grid = document.getElementById('projSceneMarketBoard');
  if (!grid) return;
  const activeCompanies = (companies || []).filter((c) => c.isEnabled !== false);

  // 1. Permanently update the Spotlight Bar (Top Gainer & Top Loser across ALL active companies)
  renderProjectorSpotlight(activeCompanies);

  // 2. Pagination Math (Configurable cards per page, default 8 = 4 cols x 2 rows, fits 1080p without scrolling)
  const totalCards = activeCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / projectorCardsPerPage));

  if (currentProjectorBoardPage > totalPages) currentProjectorBoardPage = 1;
  if (currentProjectorBoardPage < 1) currentProjectorBoardPage = 1;

  const startIdx = (currentProjectorBoardPage - 1) * projectorCardsPerPage;
  const pageCompanies = activeCompanies.slice(startIdx, startIdx + projectorCardsPerPage);

  // Update Page Indicator
  const pageIndicator = document.getElementById('projBoardPageIndicator');
  if (pageIndicator) {
    if (totalPages > 1) {
      pageIndicator.textContent = `📄 Page ${currentProjectorBoardPage} of ${totalPages} (Stocks ${startIdx + 1}–${Math.min(startIdx + projectorCardsPerPage, totalCards)} of ${totalCards})`;
    } else {
      pageIndicator.textContent = `📄 Page 1 of 1 (All ${totalCards} Stocks)`;
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

  // 3. Render cards for the CURRENT PAGE ONLY
  const currentPageTickers = pageCompanies.map((s) => s.ticker).join(',');
  const renderedTickers = Array.from(grid.children).map((el) => el.getAttribute('data-ticker')).join(',');

  if (currentPageTickers !== renderedTickers) {
    grid.innerHTML = pageCompanies.map((stock) => `
      <div id="projCard_${stock.ticker}" data-ticker="${stock.ticker}" class="projector-card">
        <div class="projector-card-header">
          <div class="projector-card-top">
            <span class="projector-ticker" title="${escapeHtml(stock.name || stock.ticker)}">${stock.ticker}</span>
            <span id="projPrice_${stock.ticker}" class="projector-price price-up">₹${stock.currentPrice.toFixed(2)}</span>
          </div>
          <div class="projector-card-sub">
            <span id="projDelta_${stock.ticker}" class="projector-delta price-up">+0.00% ▲</span>
            <span class="projector-sector">${escapeHtml(stock.sector || '')}</span>
          </div>
        </div>
        <div style="height: 65px; margin-top: 6px;">
          <canvas id="projCanvas_${stock.ticker}" width="380" height="65" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
    `).join('');
  }

  // 4. Update prices, deltas, and Bezier sparklines IN-PLACE (zero timer resets)
  pageCompanies.forEach((stock) => {
    const ref = stock.dayOpenPrice || stock.referencePrice || stock.currentPrice;
    const pctVal = ref > 0 ? ((stock.currentPrice - ref) / ref) * 100 : 0;
    const pct = pctVal.toFixed(1);
    const isUp = pctVal >= 0;

    const cardEl = document.getElementById(`projCard_${stock.ticker}`);
    const priceEl = document.getElementById(`projPrice_${stock.ticker}`);
    const deltaEl = document.getElementById(`projDelta_${stock.ticker}`);

    if (cardEl) {
      cardEl.className = `projector-card ${stock.isHalted ? 'halted' : ''}`;
    }

    if (priceEl) {
      priceEl.textContent = '₹' + stock.currentPrice.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      priceEl.className = `projector-price ${isUp ? 'price-up' : 'price-down'}`;
    }

    if (deltaEl) {
      deltaEl.textContent = stock.isHalted
        ? `⛔ HALTED (${stock.haltDirection})`
        : `${isUp ? '+' : ''}${pct}% ${isUp ? '▲' : '▼'}`;
      deltaEl.className = isUp ? 'price-up' : 'price-down';
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
}

function projectorPrevBoardPage() {
  const active = ((latestState && latestState.companies) || []).filter((c) => c.isEnabled !== false);
  const totalPages = Math.max(1, Math.ceil(active.length / projectorCardsPerPage));
  currentProjectorBoardPage = currentProjectorBoardPage <= 1 ? totalPages : currentProjectorBoardPage - 1;
  renderProjectorMarketBoard(active);
}

function projectorToggleBoardPause() {
  isProjectorBoardPaused = !isProjectorBoardPaused;
  const btn = document.getElementById('btnProjToggleBoardPause');
  if (btn) btn.textContent = isProjectorBoardPaused ? '▶' : '⏸';
  showOrderToast(isProjectorBoardPaused ? '⏸ Projector page auto-flip paused' : '▶ Projector page auto-flip resumed', true);
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

  container.innerHTML = allocations.map((team) => {
    const secList = Object.entries(team.sectorAllocations || {});
    return `
      <div class="luxury-card" style="padding: 18px; border: 2px solid var(--card-border);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-champagne" style="font-size: 11px; font-weight: 900;">RANK #${team.rank || '—'}</span>
            <h3 style="font-size: 16px; font-weight: 800; color: var(--text-forest); margin: 0;">${team.teamName}</h3>
          </div>
          <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: var(--text-forest);">
            ${formatINR(team.portfolioValue)}
          </span>
        </div>

        <div style="margin-bottom: 12px;">
          <span class="badge ${team.isConcentrated ? 'badge-halted' : 'badge-sage'}" style="font-size: 10px; padding: 3px 8px;">
            ${team.isConcentrated ? `⚠️ HIGHLY CONCENTRATED (${team.dominantSector} ${team.dominantSectorPct}%)` : `🛡️ DIVERSIFIED PORTFOLIO`}
          </span>
        </div>

        <!-- Macro Sector Breakdown Progress Bars -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${secList.map(([sec, pct]) => `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                <span style="color: var(--text-muted); font-weight: 600;">${sec}</span>
                <span style="font-family: var(--font-mono); font-weight: 700; color: var(--text-forest);">${pct.toFixed(1)}%</span>
              </div>
              <div style="height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, pct)}%; background: #2563EB; border-radius: 3px;"></div>
              </div>
            </div>
          `).join('')}

          <!-- Cash Reserve -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #047857; font-weight: 700;">💵 Uninvested Cash Reserves</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: #047857;">${(team.cashPct || 0).toFixed(1)}%</span>
            </div>
            <div style="height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, team.cashPct || 0)}%; background: #10B981; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
                <td style="padding: 10px; font-family: var(--font-sans); font-weight: 800; color: var(--text-forest);">${item.name}</td>
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
        <div class="cream-panel" style="padding: 16px; border-left: 4px solid var(--champagne-accent);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-champagne" style="font-size: 11px;">DAY ${item.day}</span>
              <span class="badge badge-outline" style="font-size: 11px;">${item.type || 'NEWS WIRE'}</span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">
              ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
          <h3 style="font-size: 17px; font-weight: 800; color: var(--text-forest); margin: 0 0 4px 0;">
            ${item.headline}
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 0;">
            ${item.simple_explanation || item.article || ''}
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

  // Update step pills
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
    if (titleEl) titleEl.textContent = '🏆 All 3 Days Completed!';
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
        btnEl.textContent = `🔔 Conclude Day ${day} ➔ Advance to Day ${day + 1}`;
        btnEl.className = 'btn btn-sage';
        btnEl.style.backgroundColor = '';
        btnEl.style.borderColor = '';
      } else {
        btnEl.textContent = `🔔 Conclude Day 3 ➔ Finalize Champion`;
        btnEl.className = 'btn btn-champagne';
        btnEl.style.backgroundColor = '';
        btnEl.style.borderColor = '';
      }
    }
    if (btnSchedule) btnSchedule.classList.add('hidden');
    if (btnCancelSchedule) btnCancelSchedule.classList.add('hidden');
    enablePauseButtons();
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
    if (nextTitle) nextTitle.textContent = 'All Competition Days Completed!';
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

// Inline confirm action — no blocking browser dialogs
let pendingFlowAction = null;
let pendingFlowActionTimeout = null;

function handleFlowPrimaryAction() {
  if (!latestState || !latestState.gameState) return;
  const gs = latestState.gameState;
  const isConcluded = gs.isConcluded || (gs.currentDay >= gs.totalDays && gs.elapsedSeconds >= gs.dayDurationSeconds);
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

  if (gs.isPaused) {
    hostResumeMarket();
    return;
  }

  // Active trading: use inline confirmation toast — no browser dialogs
  if (gs.currentDay < gs.totalDays) {
    showInlineConfirmToast(
      `🔔 Conclude Day ${gs.currentDay} and advance to Day ${gs.currentDay + 1}? Current prices become next day's open.`,
      () => hostConcludeAndAdvanceDay(),
      'Conclude Day',
      'Cancel'
    );
  } else {
    showInlineConfirmToast(
      `🏆 Conclude Day ${gs.currentDay} and finalize the championship? This locks results and launches the winner ceremony.`,
      () => hostConcludeChampionship(),
      'Finalize Championship',
      'Cancel'
    );
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

function updateLoginEventStatusBanner(state) {
  const banner = document.getElementById('loginEventStatusBanner');
  if (!banner) return;
  const iconEl = document.getElementById('loginEventStatusIcon');
  const titleEl = document.getElementById('loginEventStatusTitle');
  const descEl = document.getElementById('loginEventStatusDesc');

  const isLocked = state && state.gameState && state.gameState.configLocked;
  if (isLocked) {
    if (iconEl) iconEl.textContent = '🟢';
    if (titleEl) {
      titleEl.textContent = 'COMPETITION READY • LOGINS OPEN';
      titleEl.style.color = 'var(--price-up)';
    }
    if (descEl) {
      descEl.textContent = 'The competition is active. All 16 team terminals can now authenticate.';
    }
    banner.style.borderColor = 'var(--price-up)';
    banner.style.background = '#F0FDF4';
  } else {
    if (iconEl) iconEl.textContent = '⏳';
    if (titleEl) {
      titleEl.textContent = 'EVENT SETUP IN PROGRESS';
      titleEl.style.color = 'var(--warning-amber)';
    }
    if (descEl) {
      descEl.textContent = 'The host is preparing the event. Team login will open once setup is complete.';
    }
    banner.style.borderColor = 'var(--subtle-border)';
    banner.style.background = 'var(--surface-cream)';
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

  if (titleEl) titleEl.value = (draft && draft.title) || gs.title || 'The Trading Floor Championship 2026';
  if (instEl) instEl.value = (draft && draft.institution) || gs.institution || 'Gujarat Technological University';
  if (cashEl) cashEl.value = String((draft && draft.startingCash) || gs.startingCash || 500000);
  if (daysEl) daysEl.value = String((draft && draft.totalDays) || gs.totalDays || 3);
  if (durEl) durEl.value = String((draft && draft.dayDurationSeconds) || gs.dayDurationSeconds || 1800);
  if (feeEl) feeEl.value = String((draft && draft.transactionFeeBps !== undefined) ? draft.transactionFeeBps : (gs.transactionFeeBps !== undefined ? gs.transactionFeeBps : 0));
  if (cbEl) cbEl.value = String((draft && draft.circuitBreakerPercent) || gs.circuitBreakerPercent || 20);

  // Step 2: 16 Teams Roster
  let teamsData = (draft && draft.teams && draft.teams.length === 16) ? draft.teams : null;
  if (!teamsData && latestState && latestState.allTeamsList && latestState.allTeamsList.length === 16) {
    teamsData = latestState.allTeamsList.map((t, idx) => ({
      slot: idx + 1,
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
  const teams = getSetup16TeamsArray();
  const draft = {
    title: (document.getElementById('setupEventTitle')?.value || '').trim(),
    institution: (document.getElementById('setupInstitution')?.value || '').trim(),
    startingCash: parseFloat(document.getElementById('setupStartingCash')?.value) || 500000,
    totalDays: parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3,
    dayDurationSeconds: parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800,
    transactionFeeBps: parseInt(document.getElementById('setupTransactionFee')?.value, 10) || 0,
    circuitBreakerPercent: parseFloat(document.getElementById('setupCircuitBreaker')?.value) || 20,
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
  const tbody = document.getElementById('setupTeamsRosterTbody');
  if (!tbody) return;

  tbody.innerHTML = teamsList.map((t, idx) => {
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
      </tr>
    `;
  }).join('');
}

function getSetup16TeamsArray() {
  const teams = [];
  for (let i = 1; i <= 16; i++) {
    const nameInput = document.getElementById(`setupTeamName_${i}`);
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    const membersInput = document.getElementById(`setupTeamMembers_${i}`);
    teams.push({
      slot: i,
      id: `team_${i}`,
      username: `team${i}`,
      name: (nameInput ? nameInput.value : `Team ${i}`).trim() || `Team ${i}`,
      password: (passInput ? passInput.value : `trade${i}00`).trim() || `trade${i}00`,
      members: (membersInput ? membersInput.value : '').trim()
    });
  }
  return teams;
}

function generateRandomTeamPins() {
  for (let i = 1; i <= 16; i++) {
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    if (passInput) {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      passInput.value = pin;
    }
  }
  saveSetupDraft();
  showOrderToast('🎲 Generated random 6-digit PINs for all 16 teams!', true);
}

function resetDefaultTeamCredentials() {
  for (let i = 1; i <= 16; i++) {
    const nameInput = document.getElementById(`setupTeamName_${i}`);
    const passInput = document.getElementById(`setupTeamPass_${i}`);
    if (nameInput) nameInput.value = `Team ${i}`;
    if (passInput) passInput.value = `trade${i}00`;
  }
  saveSetupDraft();
  showOrderToast('🔄 Reset all 16 teams to standard credentials (trade100..trade1600).', true);
}

function copySetupCredentialsToClipboard() {
  const teams = getSetup16TeamsArray();
  const origin = window.location.origin;
  const lines = [
    'THE TRADING FLOOR CHAMPIONSHIP 2026 — 16 TEAMS CREDENTIALS',
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
      .then(() => showOrderToast('📋 All 16 team credentials copied to clipboard!', true))
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
    showOrderToast('📋 All 16 team credentials copied to clipboard!', true);
  } catch (e) {
    showOrderToast('⚠️ Could not copy to clipboard. Please copy manually.', false);
  }
  document.body.removeChild(ta);
}

function downloadSetupCredentialsCsv() {
  const teams = getSetup16TeamsArray();
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
  a.download = 'TheTradingFloor_16_Team_Credentials.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showOrderToast('📥 Downloaded TheTradingFloor_16_Team_Credentials.csv', true);
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

  const statTeams = document.getElementById('reviewStatTeams');
  const statStocks = document.getElementById('reviewStatStocks');
  const statCash = document.getElementById('reviewStatCash');
  const statSchedule = document.getElementById('reviewStatSchedule');

  if (statTeams) statTeams.textContent = '16 Teams Configured';
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

  const teams = getSetup16TeamsArray();
  if (teams.length !== 16) {
    showOrderToast('⚠️ Exactly 16 teams are required in Step 2.', false);
    switchSetupSection('teams');
    return;
  }

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
  }

  const modal = document.getElementById('lockSetupConfirmModal');
  if (modal) modal.classList.remove('hidden');
}

function closeLockSetupConfirmModal() {
  const modal = document.getElementById('lockSetupConfirmModal');
  if (modal) modal.classList.add('hidden');
}

function submitLockEventSetup() {
  closeLockSetupConfirmModal();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showOrderToast('⚠️ Server connection not open. Please reconnect.', false);
    return;
  }

  const title = (document.getElementById('setupEventTitle')?.value || '').trim();
  const institution = (document.getElementById('setupInstitution')?.value || '').trim();
  const startingCash = parseFloat(document.getElementById('setupStartingCash')?.value) || 500000;
  const totalDays = parseInt(document.getElementById('setupTotalDays')?.value, 10) || 3;
  const dayDurationSeconds = parseInt(document.getElementById('setupDayDuration')?.value, 10) || 1800;
  const transactionFeeBps = parseInt(document.getElementById('setupTransactionFee')?.value, 10) || 0;
  const circuitBreakerPercent = parseFloat(document.getElementById('setupCircuitBreaker')?.value) || 20;
  const teams = getSetup16TeamsArray();
  const selectedTickers = Array.from(setupSelectedTickers);

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
    teams,
    selectedTickers
  }));

  showOrderToast('🔒 Submitting tournament setup & activating 16 team credentials...', true);
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

  document.getElementById('hostScenarioModeBadge').textContent = `${state.scenarioMode.toUpperCase()} MODE`;
  document.getElementById('hostClockInfo').textContent =
    `Day ${gameState.currentDay} / ${gameState.totalDays} • Clock: ${formatMMSS(gameState.elapsedSeconds)} / ${formatMMSS(gameState.dayDurationSeconds)} • Status: ${hostStatusText} • Shift Offset: ${gameState.totalShiftOffsetSeconds}s • Fee: ${gameState.transactionFeeBps || 0} bps`;

  // Render Configuration Lock Status Banner
  const lockIcon = document.getElementById('hostConfigLockIcon');
  const lockTitle = document.getElementById('hostConfigLockTitle');
  const lockDesc = document.getElementById('hostConfigLockDesc');
  const lockBadge = document.getElementById('hostConfigLockBadge');

  if (gameState.configLocked) {
    if (lockIcon) lockIcon.textContent = '🔒';
    if (lockTitle) lockTitle.textContent = 'EVENT CONFIGURATION LOCKED (LIVE TOURNAMENT ACTIVE)';
    if (lockDesc) lockDesc.textContent = 'Starting capital, tradeable share universe, and scoring formulas are locked on the server. Market simulation is authoritative.';
    if (lockBadge) {
      lockBadge.textContent = 'CONFIG LOCKED';
      lockBadge.style.background = '#FEE2E2';
      lockBadge.style.color = '#991B1B';
    }
  } else {
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
  if (latestState && latestState.gameState && latestState.gameState.isPaused) return; // Prevent double-pause!
  if (Date.now() - lastPauseActionTime < 400) return;
  lastPauseActionTime = Date.now();
  ws.send(JSON.stringify({ action: 'HOST_PAUSE', session_token: sessionToken, pauseMode: mode }));
}

let lastResumeActionTime = 0;
function hostResumeMarket() {
  if (!ws || !sessionToken) return;
  if (latestState && latestState.gameState && !latestState.gameState.isPaused && latestState.gameState.status === 'LIVE') return;
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

  if (evtEl) evtEl.textContent = `DAY ${news.day || 1} • ${news.type || 'MARKET WIRE'}`;
  if (headEl) headEl.textContent = news.headline;
  if (expEl) expEl.textContent = news.simple_explanation || news.explanation || '';

  if (trafficBadge) {
    const isGood = (news.sentiment === 'POSITIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('GOOD')) || (news.deltaPct > 0);
    const isBad = (news.sentiment === 'NEGATIVE') || (news.trafficLightBadge && news.trafficLightBadge.includes('BAD')) || (news.deltaPct < 0);
    if (isGood) {
      trafficBadge.textContent = '🟢 GOOD NEWS (PRICE UP)';
      trafficBadge.className = 'badge-news-good';
    } else if (isBad) {
      trafficBadge.textContent = '🔴 BAD NEWS (PRICE DOWN)';
      trafficBadge.className = 'badge-news-bad';
    } else {
      trafficBadge.textContent = '🔵 NEUTRAL UPDATE';
      trafficBadge.className = 'badge-news-neutral';
    }
  }
}

function showNewsFlashModal(news) {
  prepareFullNewsModal(news);
  const modal = document.getElementById('newsFlashModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let remaining = 20;
  const badge = document.getElementById('flashCountdownBadge');
  if (badge) badge.textContent = `Closing in ${remaining}s`;

  if (flashTimerHandle) clearInterval(flashTimerHandle);
  flashTimerHandle = setInterval(() => {
    remaining--;
    if (badge) badge.textContent = `Closing in ${remaining}s`;
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
// FINANCIAL ANALYSIS CONTROLLERS
// ==========================================
function renderHostAnalysis(state) {
  const tbody = document.getElementById('hostFinancialAnalysisTbody');
  if (!tbody) return;

  const snapshot = state.finalResultsSnapshot || generateClientSnapshotFromLeaderboard(state);
  const rankings = snapshot.rankings || [];

  if (rankings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No team portfolios active yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rankings.map((team) => {
    const isProfit = team.netProfitLoss >= 0;
    return `
      <tr style="border-bottom: 1px solid var(--subtle-border);">
        <td style="padding: 10px; font-weight: 800; color: ${team.rank === 1 ? 'var(--champagne-accent)' : 'inherit'};">#${team.rank}</td>
        <td style="padding: 10px; font-weight: 700; color: var(--text-forest);">${team.teamName}</td>
        <td style="padding: 10px; color: var(--text-muted); font-size: 11px;">${team.members || '—'}</td>
        <td style="padding: 10px; text-align: right;">${formatINR(team.startingCash)}</td>
        <td style="padding: 10px; text-align: right;">${formatINR(team.cash)}</td>
        <td style="padding: 10px; text-align: right;">${formatINR(team.holdingsValue)}</td>
        <td style="padding: 10px; text-align: right; font-weight: 800;">${formatINR(team.totalPortfolioValue)}</td>
        <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isProfit ? 'price-up' : 'price-down'}">
          ${isProfit ? '+' : ''}${formatINR(team.netProfitLoss)}
        </td>
        <td style="padding: 10px; text-align: right; font-weight: 800;" class="${isProfit ? 'price-up' : 'price-down'}">
          ${isProfit ? '+' : ''}${team.returnPct.toFixed(2)}%
        </td>
        <td style="padding: 10px; text-align: center;">${team.tradeCount}</td>
        <td style="padding: 10px; text-align: right; color: var(--text-muted);">${formatINR(team.brokerageFees || 0)}</td>
        <td style="padding: 10px; text-align: center;">
          <span class="badge ${isProfit ? 'badge-active' : 'badge-paused'}" style="font-size: 10px; padding: 2px 8px;">
            ${team.summaryReview || (isProfit ? 'Bullish Outperformance' : 'Defensive Position')}
          </span>
        </td>
      </tr>
    `;
  }).join('');
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
    createPresentationConfetti();
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

function createPresentationConfetti() {
  ['presentationConfetti', 'projPresentationConfetti'].forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#B49A70', '#218653', '#D4AF37', '#8C9CAE', '#C64B4B', '#FFFFFF'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width = `${Math.random() * 8 + 6}px`;
      piece.style.height = `${Math.random() * 14 + 10}px`;
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

  if (latestState && latestState.gameState) {
    const gs = latestState.gameState;
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

  // Default to immediate
  selectStartMode('IMMEDIATE');
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

function dismissCircuitAlertBanner() {
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

