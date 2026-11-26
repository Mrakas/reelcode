(function () {
  'use strict';
  var CASES = window.CASES || { recon: [], edit: [] };
  var TABLES = window.TABLES || { recon: [], edit: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- nav ---------- */
  var nav = $('#topnav');
  var onScroll = function () { nav.classList.toggle('solid', window.scrollY > window.innerHeight * 0.7); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* placeholder links: not yet public */
  document.querySelectorAll('a[data-todo]').forEach(function (a) {
    a.classList.add('todo'); a.title = 'Coming soon'; var sb = document.createElement('small'); sb.className = 'soon'; sb.textContent = 'soon'; a.appendChild(sb);
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- synced video groups ---------- */
  var ICON_PLAY = '<svg viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 14 14"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
  var fmt = function (t) { t = Math.max(0, t || 0); return (t < 10 ? '0' : '') + t.toFixed(1) + 's'; };

  function Group(container, ctlEl) {
    this.c = container; this.visible = false; this.paused = false;
    var self = this;
    if (ctlEl) {
      ctlEl.innerHTML = '';
      this.btn = el('button', null, ICON_PAUSE); this.btn.setAttribute('aria-label', 'Play or pause');
      this.rng = el('input'); this.rng.type = 'range'; this.rng.min = 0; this.rng.max = 1000; this.rng.value = 0; this.rng.setAttribute('aria-label', 'Seek');
      this.tt = el('span', 't', '00.0s');
      ctlEl.append(this.btn, this.rng, this.tt);
      this.btn.onclick = function () { self.paused = !self.paused; self.sync(); };
      this.rng.oninput = function () { var m = self.master(); if (!m || !m.duration) return; var t = m.duration * self.rng.value / 1000; self.vids().forEach(function (v) { try { v.currentTime = Math.min(t, (v.duration || t) - 0.05); } catch (e) {} }); };
    }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { self.visible = e.isIntersecting; self.sync(); }); }, { threshold: 0.15 });
    io.observe(container);
    setInterval(function () { self.tick(); }, 200);
  }
  Group.prototype.vids = function () { return Array.prototype.slice.call(this.c.querySelectorAll('video')); };
  Group.prototype.master = function () { return this.vids()[0]; };
  Group.prototype.load = function () {
    this.vids().forEach(function (v) { if (v.dataset.src && !v.src) { v.src = v.dataset.src; } });
  };
  Group.prototype.restart = function () { this.vids().forEach(function (v) { try { v.currentTime = 0; } catch (e) {} }); this.sync(); };
  Group.prototype.sync = function () {
    if (this.visible) this.load();
    var play = this.visible && !this.paused;
    this.vids().forEach(function (v) { if (play) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
    if (this.btn) this.btn.innerHTML = this.paused ? ICON_PLAY : ICON_PAUSE;
  };
  Group.prototype.tick = function () {
    var vs = this.vids(), m = vs[0];
    if (!m || !m.duration) return;
    if (this.rng && document.activeElement !== this.rng) this.rng.value = Math.round(1000 * m.currentTime / m.duration);
    if (this.tt) this.tt.textContent = fmt(m.currentTime) + ' / ' + fmt(m.duration);
    if (m.paused) return;
    vs.slice(1).forEach(function (v) {
      if (!v.duration || v.readyState < 2) return;
      var target = m.currentTime % v.duration;
      if (Math.abs(v.currentTime - target) > 0.2) { try { v.currentTime = target; } catch (e) {} }
    });
  };

  function videoTile(src, label, cls) {
    var t = el('div', 'tile' + (cls ? ' ' + cls : ''));
    var b = el('div', 'vbox');
    var v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
    v.dataset.src = src + '.mp4'; v.poster = src + '.jpg';
    b.appendChild(v); t.appendChild(b);
    t.appendChild(el('span', 'lab', esc(label)));
    return t;
  }

  /* ---------- teaser ---------- */
  var teaser = $('#teaser');
  if (teaser) {
    new Group(teaser, $('.vctl[data-for="teaser"]'));
    var hh = (CASES.edit || []).filter(function (c) { return c.id === 'hologram-hud'; })[0];
    if (hh) $('#teaser-instr').textContent = hh.instruction;
  }

  /* ---------- recon gallery ---------- */
  var rgrid = $('#recon-grid'), rtabs = $('#recon-tabs');
  var rgroup = new Group(rgrid, $('.vctl[data-for="recon-grid"]'));
  function showRecon(i) {
    var c = CASES.recon[i]; if (!c) return;
    rtabs.querySelectorAll('.chip').forEach(function (b, j) { b.classList.toggle('on', i === j); });
    rgrid.innerHTML = '';
    c.tiles.forEach(function (t) { rgrid.appendChild(videoTile(t.src, t.label, t.ref ? 'ref' : '')); });
    rgrid.appendChild(el('div', 'gallery-cap', esc(c.caption) + ' &middot; source: ' + esc(c.source) + ' &middot; all tiles show the same time window'));
    rgroup.paused = false; rgroup.sync();
  }
  CASES.recon.forEach(function (c, i) {
    var b = el('button', 'chip', '<img alt="" loading="lazy" src="' + c.tiles[0].src + '.jpg"><span>' + esc(c.short) + '</span>');
    b.title = c.caption; b.onclick = function () { showRecon(i); };
    rtabs.appendChild(b);
  });
  showRecon(0);

  /* ---------- edit gallery: reference + 3 random editors, before/after ---------- */
  var egrid = $('#edit-grid'), etabs = $('#edit-tabs');
  var egroup = new Group(egrid, $('.vctl[data-for="edit-grid"]'));
  var cur = 0;
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function headCell(html, cls) { return el('div', 'eg-head' + (cls ? ' ' + cls : ''), html); }
  function showEdit(i) {
    cur = i; var c = CASES.edit[i];
    etabs.querySelectorAll('.chip').forEach(function (b, j) { b.classList.toggle('on', i === j); });
    var runs = shuffle(c.runs).slice(0, 3);
    egrid.innerHTML = '';
    // header row
    egrid.appendChild(headCell('<span>Reference</span>', 'refh'));
    runs.forEach(function (r) { egrid.appendChild(headCell('<span>' + esc(r.model) + '</span>')); });
    // before row
    egrid.appendChild(videoTile(c.ref, 'Reference', 'ref'));
    runs.forEach(function (r) { var t = videoTile(r.before, 'Before', 'before'); t.querySelector('.lab').dataset.m = r.model; egrid.appendChild(t); });
    // after row: instruction card + edited videos
    var card = el('div', 'eg-instr');
    card.innerHTML = '<div class="axes">' + c.tags.map(function (t) { return '<span class="ax-tag ax-' + t + '">' + t + '</span>'; }).join('') + '</div>' +
      '<p class="lab2">Edit instruction</p><p class="txt">' + esc(c.instruction) + '</p>' +
      (c.runs.length > 3 ? '<button class="reroll" type="button">↻ Draw other editors</button>' : '');
    egrid.appendChild(card);
    runs.forEach(function (r) { var t = videoTile(r.after, 'After', 'after'); t.querySelector('.lab').dataset.m = r.model; egrid.appendChild(t); });
    var rr = card.querySelector('.reroll'); if (rr) rr.onclick = function () { showEdit(cur); };
    egroup.paused = false; egroup.sync();
  }
  CASES.edit.forEach(function (c, i) {
    var b = el('button', 'chip', '<img alt="" loading="lazy" src="' + c.ref + '.jpg"><span>' + esc(c.short) + '</span><i class="dots">' + c.tags.map(function (t) { return '<b class="ax-' + t + '"></b>'; }).join('') + '</i>');
    b.title = c.instruction; b.onclick = function () { showEdit(i); };
    etabs.appendChild(b);
  });
  if (CASES.edit.length) showEdit(0);

  /* ---------- guess game: blind A/B, then reveal judge scores ---------- */
  (function () {
    var G = window.GUESS || [], box = $('#guess'); if (!box || !G.length) return;
    var store = { get: function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    var tally = store.get('rcb-guess', { n: 0, agree: 0 });
    var order = shuffle(G.map(function (_, k) { return k; })), pos = 0, cur = null, flip = false, done = false;
    var L = $('#g-left'), Rt = $('#g-right'), ref = $('#g-ref'), msg = $('#guess-msg'), nxt = $('#guess-next'), sc = $('#guess-score');
    var gg = new Group(box.querySelector('.guess-grid'), null);
    function setV(v, src) { v.removeAttribute('src'); v.dataset.src = src + '.mp4'; v.poster = src + '.jpg'; }
    function score() { sc.innerHTML = tally.n ? '<b>' + tally.agree + '/' + tally.n + '</b><span>agreed with the judges</span>' : ''; }
    function load() {
      cur = G[order[pos % order.length]]; flip = Math.random() < 0.5; done = false;
      var A = flip ? cur.b : cur.a, B = flip ? cur.a : cur.b;
      setV(ref, cur.ref); setV(L.querySelector('video'), A.src); setV(Rt.querySelector('video'), B.src);
      [L, Rt].forEach(function (b) { b.classList.remove('win', 'lose', 'chosen'); b.disabled = false; b.querySelector('.reveal-tag').innerHTML = ''; });
      msg.textContent = 'Which one is closer to the reference? Click A or B.'; nxt.classList.remove('show');
      gg.paused = false; gg.sync();
    }
    function pick(side) {
      if (done) return; done = true;
      var A = flip ? cur.b : cur.a, B = flip ? cur.a : cur.b, mine = side === 0 ? A : B, other = side === 0 ? B : A;
      var judgeSide = A.score >= B.score ? 0 : 1, agree = side === judgeSide;
      [[L, A, 0], [Rt, B, 1]].forEach(function (x) {
        x[0].disabled = true; x[0].classList.add(x[2] === judgeSide ? 'win' : 'lose'); if (x[2] === side) x[0].classList.add('chosen');
        x[0].querySelector('.reveal-tag').innerHTML = '<b>' + esc(x[1].model) + '</b><span>S<sub>recon</sub> ' + x[1].score.toFixed(1) + (x[2] === judgeSide ? ' · judges’ pick' : '') + '</span>';
      });
      var win = judgeSide === 0 ? A : B;
      msg.innerHTML = (agree ? '<b class="ok">You agree with the judges.</b> ' : '<b class="no">The judges picked the other one.</b> ') +
        esc(win.model) + ' scored higher (' + Math.max(A.score, B.score).toFixed(1) + ' vs ' + Math.min(A.score, B.score).toFixed(1) + ').';
      tally.n++; if (agree) tally.agree++; store.set('rcb-guess', tally); score();
      nxt.classList.add('show');
      if (window.RCB_VOTE_ENDPOINT) {   // optional: send the vote to a collector (not configured by default)
        try { fetch(window.RCB_VOTE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clip: cur.case, chosen: mine.model, other: other.model, chosen_score: mine.score, other_score: other.score, agree: agree, t: new Date().toISOString() }) }).catch(function () {}); } catch (e) {}
      }
    }
    L.onclick = function () { pick(0); }; Rt.onclick = function () { pick(1); };
    nxt.onclick = function () { pos++; load(); };
    score(); load();
  })();

  /* ---------- leaderboard ---------- */
  var VENDOR = [[/^GPT/, '#202124', 'openai'], [/^Claude/, '#c8775c', 'claude'], [/^Gemini/, '#2f9e55', 'gemini'], [/^Kimi/, '#1677ff', 'kimi'], [/^DeepSeek/, '#3b4fe0', 'deepseek'],
    [/^MiMo/, '#ff6a14', 'mimo'], [/^HY/, '#14a3c7', 'hunyuan'], [/^Qwen/, '#7b61ff', 'qwen'], [/^GLM/, '#2b6cf6', 'glm'], [/^MiniMax/, '#e2167e', 'minimax'], [/^Wan/, '#8b5cf6', 'wan']];
  var vlogo = function (n) { for (var i = 0; i < VENDOR.length; i++) if (VENDOR[i][0].test(n)) return 'static/logos/' + VENDOR[i][2] + '.svg'; return ''; };
  var vcol = function (n) { for (var i = 0; i < VENDOR.length; i++) if (VENDOR[i][0].test(n)) return VENDOR[i][1]; return '#999'; };
  var SPEC = {
    recon: {
      main: 'S<sub>recon</sub>',
      bands: [['Rubric · dimension fully passed', 6, '#f6b58f'], ['Holistic', 5, '#f2d36b'], ['Objective', 3, '#8fd3a8']],
      cols: ['R', 'Text', 'Layout', 'Style', 'Motion', 'Timing', 'H', 'Appear.', 'Motion', 'Fidelity', 'Quality', 'SSIM', 'DINOv2', 'CLIP'],
      note: 'S<sub>recon</sub> combines the rubric score R and the holistic score H (mean of four 1–5 ratings). Objective columns report frame similarity (×100). Click a column to sort; shaded cells mark the best value in each column.'
    },
    edit: {
      main: 'S<sub>edit</sub>',
      bands: [['All changes', 3, '#c9cfdc'], ['Where', 3, '#2b6fff'], ['When', 3, '#ff7a1a'], ['How', 3, '#12a37a']],
      cols: ['C', 'K', 'Q', 'C', 'K', 'Q', 'C', 'K', 'Q', 'C', 'K', 'Q'],
      note: 'S<sub>edit</sub> combines completion C, keep rate K and quality Q. Under Where / When / How, C is completion of that change type; K and Q average over tasks that contain it. Diffusion models edit pixels directly and are not ranked.'
    }
  };
  var lb = { stage: 'recon', group: 'all', sort: 0 };
  function renderLB() {
    var sp = SPEC[lb.stage], rows = TABLES[lb.stage].slice();
    rows = rows.filter(function (r) { return lb.group === 'all' || r.group.indexOf(lb.group) === 0; });
    var ncol = sp.cols.length + 1;
    var best = [];
    for (var k = 0; k < ncol; k++) best[k] = Math.max.apply(null, TABLES[lb.stage].filter(function (r) { return r.rank != null; }).map(function (r) { return r.v[k]; }));
    var h = '<thead><tr class="band"><th></th><th></th><th></th>';
    sp.bands.forEach(function (b) { h += '<th class="b" colspan="' + b[1] + '" style="--bc:' + b[2] + '">' + b[0] + '</th>'; });
    h += '</tr><tr class="cols"><th class="l" data-s="rank">#</th><th class="l">Model</th><th class="l' + (lb.sort === 0 ? ' sorted' : '') + '" data-s="0">' + sp.main + '</th>';
    sp.cols.forEach(function (c, i) { h += '<th data-s="' + (i + 1) + '"' + (lb.sort === i + 1 ? ' class="sorted"' : '') + '>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    var sorted = lb.sort === 'rank' ? rows.sort(function (a, b) { return (a.rank || 99) - (b.rank || 99); }) : rows.sort(function (a, b) { return b.v[lb.sort] - a.v[lb.sort]; });
    var maxMain = Math.max.apply(null, TABLES[lb.stage].map(function (r) { return r.v[0]; }));
    var showGroups = lb.sort === 'rank' && lb.group === 'all';
    var lastG = null;
    if (showGroups) sorted.sort(function (a, b) { var G = { C: 0, O: 1, D: 2 }; return G[a.group[0]] - G[b.group[0]] || (a.rank || 99) - (b.rank || 99); });
    sorted.forEach(function (r) {
      if (showGroups && r.group !== lastG) { h += '<tr class="grp"><td colspan="' + (ncol + 2) + '">' + r.group + '</td></tr>'; lastG = r.group; }
      var rk = r.rank == null ? '–' : (r.rank <= 3 ? '<span class="medal m' + r.rank + '">' + r.rank + '</span>' : r.rank);
      h += '<tr><td class="rk">' + rk + '</td><td class="l name"><span class="dot" style="background:' + vcol(r.name) + '"></span>' + esc(r.name) + (r.note ? ' §' : '') + (r.rank == null ? ' <small style="color:#999;font-weight:400">(diffusion)</small>' : '') + '</td>';
      h += '<td class="l main"><div class="bar"><b>' + r.v[0].toFixed(1) + '</b><i style="width:' + (72 * r.v[0] / maxMain).toFixed(1) + 'px"></i></div></td>';
      for (var k = 1; k < ncol; k++) h += '<td class="' + (r.rank != null && r.v[k] === best[k] ? 'best' : '') + '">' + r.v[k].toFixed(1) + '</td>';
      h += '</tr>';
    });
    h += '</tbody>';
    var t = $('#lb'); t.innerHTML = h;
    t.querySelectorAll('th[data-s]').forEach(function (th) {
      th.onclick = function () { var s = th.dataset.s; lb.sort = s === 'rank' ? 'rank' : +s; renderLB(); };
    });
    $('#lb-note').innerHTML = sp.note;
    $('#lb-group').querySelector('[data-k="Diffusion"]').style.display = lb.stage === 'edit' ? '' : 'none';
  }
  lb.sort = 'rank';
  document.querySelectorAll('.lb-stage-btns button').forEach(function (b) {
    b.onclick = function () { document.querySelectorAll('.lb-stage-btns button').forEach(function (x) { x.classList.toggle('on', x.dataset.k === b.dataset.k); }); lb.stage = b.dataset.k; if (lb.stage === 'recon' && lb.group === 'Diffusion') { lb.group = 'all'; syncGroupBtns(); } renderLB(); renderCharts(); };
  });
  function syncGroupBtns() { $('#lb-group').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.k === lb.group); }); }
  $('#lb-group').querySelectorAll('button').forEach(function (b) { b.onclick = function () { lb.group = b.dataset.k; syncGroupBtns(); renderLB(); }; });
  renderLB();

  /* ---------- charts: sorted bar chart + score vs cost scatter ---------- */
  function renderCharts() {
    var st = lb.stage, rows = TABLES[st].slice().sort(function (a, b) { return b.v[0] - a.v[0]; });
    var lab = st === 'recon' ? 'Reconstruction score S<sub>recon</sub>' : 'Editing score S<sub>edit</sub>';
    $('#bar-title').innerHTML = lab;
    var max = Math.ceil(rows[0].v[0] / 10) * 10 + 10, h = '';
    h += '<div class="bars">';
    [0, 20, 40, 60, 80].forEach(function (g) { if (g < max) h += '<i class="grid" style="top:' + (300 * (1 - g / max)).toFixed(1) + 'px"><em>' + g + '</em></i>'; });
    rows.forEach(function (r) {
      var c = vcol(r.name), diff = r.rank == null;
      h += '<div class="bcol' + (diff ? ' diff' : '') + '" title="' + esc(r.name) + ': ' + r.v[0].toFixed(1) + '">' +
        '<div class="bwrap"><div class="bar" style="height:' + (100 * r.v[0] / max).toFixed(1) + '%;background:' + c + '"><span>' + Math.round(r.v[0]) + '</span></div></div>' +
        '<div class="blogo"><img alt="" src="' + vlogo(r.name) + '"></div>' +
        '<div class="bname"><span>' + esc(r.name) + (diff ? ' †' : '') + (r.note ? ' §' : '') + '</span></div></div>';
    });
    h += '</div>';
    $('#bar-chart').innerHTML = h;

    // scatter: Pareto staircase + vendor logos (paper style)
    $('#sc-title').innerHTML = lab + ' vs. API cost per task';
    var pts = rows.filter(function (r) { return r.cost; });
    var W = 1080, H = 540, m = { l: 56, r: 30, t: 40, b: 58 };
    var xs = [0.003, 0.01, 0.03, 0.1, 0.3, 1], lx = function (x) { return Math.log10(x); };
    var cmin = Math.min.apply(null, pts.map(function (r) { return r.cost; })), cmax = Math.max.apply(null, pts.map(function (r) { return r.cost; }));
    var x0 = lx(cmin) - 0.25, x1 = lx(cmax) + 0.25, X = function (x) { return m.l + (lx(x) - x0) / (x1 - x0) * (W - m.l - m.r); };
    var smin = Math.min.apply(null, pts.map(function (r) { return r.v[0]; })), smax = Math.max.apply(null, pts.map(function (r) { return r.v[0]; }));
    var y0 = Math.floor((smin - 6) / 10) * 10, y1 = Math.ceil((smax + 8) / 10) * 10, Y = function (y) { return m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b); };
    // frontier: cheapest-first, keep each model that beats every cheaper one
    var byCost = pts.slice().sort(function (a, b) { return a.cost - b.cost; }), fr = [], best = -1;
    byCost.forEach(function (r) { if (r.v[0] > best) { fr.push(r); best = r.v[0]; } });
    var onF = {}; fr.forEach(function (r) { onF[r.name] = 1; });
    var FC = '#e8590c';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Score versus cost">';
    for (var g = y0; g <= y1; g += 10) svg += '<line class="g" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/><text class="ax" x="' + (m.l - 10) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + g + '</text>';
    xs.forEach(function (x) { if (lx(x) > x0 && lx(x) < x1) svg += '<line class="g" x1="' + X(x) + '" x2="' + X(x) + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/><text class="ax" x="' + X(x) + '" y="' + (H - m.b + 22) + '" text-anchor="middle">$' + x + '</text>'; });
    svg += '<text class="axt" x="' + ((W + m.l) / 2) + '" y="' + (H - 10) + '" text-anchor="middle">API cost per task in US$, log scale</text>';
    // staircase path + shaded region under it
    var path = [], xr = W - m.r, yb = H - m.b;
    fr.forEach(function (r, k) { var px = X(r.cost), py = Y(r.v[0]); if (k === 0) path.push([px, yb]); else path.push([px, Y(fr[k - 1].v[0])]); path.push([px, py]); });
    path.push([xr, Y(fr[fr.length - 1].v[0])]);
    var d = path.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    svg += '<path d="' + d + ' L' + xr + ' ' + yb + ' Z" fill="' + FC + '" fill-opacity=".07"/>';
    svg += '<path d="' + d + '" fill="none" stroke="' + FC + '" stroke-width="3" stroke-linejoin="round"/>';
    // labels: greedy placement avoiding icons, other labels and the frontier line
    var boxes = [], P = pts.map(function (r) { return { r: r, px: X(r.cost), py: Y(r.v[0]), f: !!onF[r.name] }; });
    P.forEach(function (o) { boxes.push([o.px - 17, o.py - 17, o.px + 17, o.py + 17]); });
    for (var q = 1; q < path.length; q++) { var a1 = path[q - 1], a2 = path[q]; boxes.push([Math.min(a1[0], a2[0]) - 2, Math.min(a1[1], a2[1]) - 2, Math.max(a1[0], a2[0]) + 2, Math.max(a1[1], a2[1]) + 2]); }
    var ov = function (b) { var t = 0; boxes.forEach(function (c) { var dx = Math.min(b[2], c[2]) - Math.max(b[0], c[0]), dy = Math.min(b[3], c[3]) - Math.max(b[1], c[1]); if (dx > 0 && dy > 0) t += dx * dy; }); return t; };
    P.sort(function (a, b) { return (b.f - a.f) || (a.py - b.py); });
    var lbl = '';
    P.forEach(function (o) {
      var w = o.r.name.length * (o.f ? 9 : 8.2), h = 18, cands = o.f ?
        [[o.px - w / 2, o.py - 24 - h, 'middle'], [o.px - w / 2, o.py + 24, 'middle'], [o.px + 22, o.py - h / 2, 'start'], [o.px - 22 - w, o.py - h / 2, 'start']] :
        [[o.px + 22, o.py - h / 2, 'start'], [o.px - 22 - w, o.py - h / 2, 'start'], [o.px - w / 2, o.py + 21, 'middle'], [o.px - w / 2, o.py - 21 - h, 'middle'], [o.px + 22, o.py + 6, 'start'], [o.px + 22, o.py - 24, 'start'], [o.px - 22 - w, o.py + 6, 'start'], [o.px - 22 - w, o.py - 24, 'start']];
      if (!o.f) [[o.px + 22, o.py + 24], [o.px + 22, o.py - 42], [o.px - 22 - w, o.py + 24], [o.px - 22 - w, o.py - 42], [o.px - w / 2, o.py + 40], [o.px - w / 2, o.py - 58]].forEach(function (e) { cands.push([e[0], e[1], 'start']); });
      var pick = null, bestS = 1e18;
      for (var c = 0; c < cands.length; c++) {
        var b = [cands[c][0], cands[c][1], cands[c][0] + w, cands[c][1] + h];
        var sc = (b[0] < m.l || b[2] > W - 4 || b[1] < 4 || b[3] > H - m.b) ? 1e9 : ov(b) + c * 3;
        if (sc < bestS) { bestS = sc; pick = cands[c]; }
        if (sc < 1e-6 + c * 3 && ov(b) === 0) break;
      }
      boxes.push([pick[0], pick[1], pick[0] + w, pick[1] + h]);
      lbl += '<text class="pl' + (o.f ? ' pf' : '') + '" x="' + (pick[2] === 'middle' ? pick[0] + w / 2 : pick[0]).toFixed(1) + '" y="' + (pick[1] + 14).toFixed(1) + '" text-anchor="' + pick[2] + '">' + esc(o.r.name) + '</text>';
    });
    P.forEach(function (o) {
      var s2 = 30;
      svg += '<rect x="' + (o.px - s2 / 2) + '" y="' + (o.py - s2 / 2) + '" width="' + s2 + '" height="' + s2 + '" rx="7" fill="#fff" stroke="' + (o.f ? FC : '#d8d4cc') + '" stroke-width="' + (o.f ? 2.5 : 1) + '"/>';
      svg += '<image href="' + vlogo(o.r.name) + '" x="' + (o.px - 10) + '" y="' + (o.py - 10) + '" width="20" height="20"/>';
    });
    svg += lbl;
    svg += '</svg>';
    $('#scatter').innerHTML = svg;
    $('#bar-note').innerHTML = st === 'edit' ? '† Diffusion video editors edit pixels and are not ranked.' : '';
    $('#sc-note').innerHTML = '<b>Cost is the mean API spend per task in our runs.</b>';
  }
  renderCharts();

  /* ---------- bibtex ---------- */
  $('#copy-bib').onclick = function () {
    var txt = $('#bibtex').textContent, btn = this;
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); else { var ta = el('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  };

  /* ---------- reveal ---------- */
  var rv = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }); }, { threshold: 0.08 });
  document.querySelectorAll('.sec h2, .sec .lede, .figure, .card, .triptych, .editcase, .lb-wrap').forEach(function (n) { n.classList.add('reveal'); rv.observe(n); });
})();
