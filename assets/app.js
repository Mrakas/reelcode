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
      h += '<tr><td class="rk">' + rk + '</td><td class="l name"><span class="dot" style="background:' + vcol(r.name) + '"></span>' + esc(r.name) + (r.rank == null ? ' <small style="color:#999;font-weight:400">(diffusion)</small>' : '') + '</td>';
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
  $('#lb-stage').querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { $('#lb-stage').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); lb.stage = b.dataset.k; if (lb.stage === 'recon' && lb.group === 'Diffusion') { lb.group = 'all'; syncGroupBtns(); } renderLB(); renderCharts(); };
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
        '<div class="bname"><span>' + esc(r.name) + (diff ? ' †' : '') + '</span></div></div>';
    });
    h += '</div>';
    $('#bar-chart').innerHTML = h;

    // scatter
    $('#sc-title').innerHTML = lab + ' vs. API cost per task';
    var pts = rows.filter(function (r) { return r.cost; });
    var W = 1080, H = 470, m = { l: 56, r: 30, t: 20, b: 58 };
    var xs = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3], lx = function (x) { return Math.log10(x); };
    var x0 = lx(0.001), x1 = lx(3), X = function (x) { return m.l + (lx(x) - x0) / (x1 - x0) * (W - m.l - m.r); };
    var y0 = 10, y1 = Math.ceil((rows[0].v[0] + 6) / 10) * 10, Y = function (y) { return m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Score versus cost">';
    for (var g = y0; g <= y1; g += 10) svg += '<line class="g" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/><text class="ax" x="' + (m.l - 10) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + g + '</text>';
    xs.forEach(function (x) { svg += '<line class="g" x1="' + X(x) + '" x2="' + X(x) + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/><text class="ax" x="' + X(x) + '" y="' + (H - m.b + 22) + '" text-anchor="middle">$' + x + '</text>'; });
    svg += '<text class="axt" x="' + ((W + m.l) / 2) + '" y="' + (H - 10) + '" text-anchor="middle">API cost per task in US$, mean, log scale</text>';
    // labels: place right of the point, flip left near the right edge, nudge apart vertically
    var L = pts.map(function (r) { var px = X(r.cost), py = Y(r.v[0]), right = px < W - 210; return { r: r, px: px, py: py, right: right, ly: py + 5 }; });
    L.sort(function (a, b) { return a.py - b.py; });
    for (var k = 0; k < L.length; k++) for (var j = 0; j < k; j++) {
      var A = L[j], B = L[k];
      if (Math.abs(A.px - B.px) < 190 && A.right === B.right && Math.abs(A.ly - B.ly) < 17) B.ly = A.ly + 17;
    }
    L.forEach(function (o) {
      var c = vcol(o.r.name);
      svg += '<circle cx="' + o.px + '" cy="' + o.py + '" r="7" fill="' + c + '"/>';
      svg += '<text class="pl" x="' + (o.px + (o.right ? 12 : -12)) + '" y="' + o.ly + '" text-anchor="' + (o.right ? 'start' : 'end') + '" fill="' + c + '">' + esc(o.r.name) + '</text>';
    });
    svg += '</svg>';
    $('#scatter').innerHTML = svg;
    var miss = rows.filter(function (r) { return !r.cost; }).map(function (r) { return r.name; });
    $('#sc-note').innerHTML = 'Cost is the mean API spend per task in our runs. Not shown: ' + miss.join(', ') + ' (no API cost: run locally, not logged, or diffusion models).' +
      (st === 'edit' ? ' † Diffusion video editors edit pixels and are not ranked.' : '');
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
