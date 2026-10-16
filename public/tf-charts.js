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
