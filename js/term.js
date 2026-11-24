/* Fake terminal widget: input line, output log, animated lookup lane, PATH + filesystem editors. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, VFS = SH.VFS;
  var STAGE_LABEL = { alias: 'Alias?', 'function': 'Function?', builtin: 'Builtin?', hash: 'Hash cache?' };
  var MARK = { hit: '✓ found', miss: '✗ no', denied: '⚠ cannot run', stale: '⚠ stale', dangling: '⚠ broken link' };
  var uid = 0;

  SH.terminal = function (mount, opts) {
    var stages = opts.stages || ['alias', 'function', 'builtin', 'hash', 'path'];
    var shell = opts.make();
    var id = 'term' + (++uid), runId = 0, history = [], hpos = 0;

    var lane = el('div', { class: 'lookup', 'aria-hidden': 'true' });
    var narr = el('p', { class: 'narration', role: 'status', text: 'Type a command below (or tap a suggestion) and watch the search.' });
    var out = el('div', { class: 'term-out', role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output', tabindex: '0' });
    var input = el('input', { type: 'text', id: id, autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Command line' });
    var promptLabel = el('label', { for: id, text: shell.prompt() });
    var form = el('form', { class: 'term-in' }, [promptLabel, input]);
    var animBox = el('input', { type: 'checkbox', id: id + '-anim', checked: !SH.reducedMotion() });
    var chips = el('div', { class: 'chips' });
    var editors = el('div', { class: 'grid2' });

    (opts.suggestions || []).forEach(function (s) {
      chips.appendChild(el('button', { type: 'button', class: 'chip', text: s, onclick: function () { run(s); } }));
    });

    function print(lines) {
      lines.forEach(function (l) {
        var span = typeof l === 'string' ? el('span', { text: l }) : el('span', { class: l.c, text: l.t });
        out.appendChild(span);
        out.appendChild(document.createTextNode('\n'));
      });
      out.scrollTop = out.scrollHeight;
    }

    function renderLane() {
      SH.clear(lane);
      var n = 0;
      stages.forEach(function (s) {
        if (s === 'path') return;
        var small = '';
        if (s === 'alias') small = Object.keys(shell.aliases).join(', ') || '(none)';
        if (s === 'function') small = Object.keys(shell.functions).join(', ') || '(none)';
        if (s === 'builtin') small = 'cd, echo, type, which…';
        if (s === 'hash') small = Object.keys(shell.hash).length + ' remembered';
        lane.appendChild(el('div', { class: 'lk', 'data-stage': s }, [
          el('b', { text: (++n) + '. ' + STAGE_LABEL[s] }), el('small', { text: small }), el('small', { class: 'res' })
        ]));
      });
      lane.appendChild(el('div', { class: 'lk-label', text: (n ? (n + 1) + '. ' : '') + 'PATH folders, searched top to bottom:' }));
      var ol = el('ol', { class: 'lk-path' });
      shell.path.forEach(function (d) {
        ol.appendChild(el('li', {}, [el('span', { text: shell.tilde(d) }), el('span', { class: 'res' })]));
      });
      if (!shell.path.length) ol.appendChild(el('li', {}, [el('span', { text: '(PATH is empty)' })]));
      lane.appendChild(ol);
    }
    function nodeFor(step) {
      if (step.stage === 'path') return lane.querySelectorAll('.lk-path li')[step.index];
      return lane.querySelector('[data-stage="' + step.stage + '"]');
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    async function animate(steps) {
      var my = ++runId, on = animBox.checked;
      for (var i = 0; i < steps.length; i++) {
        if (my !== runId) return;
        var s = steps[i];
        /* Chapter 3 shows only the PATH part: skip the "no alias / no builtin" misses there. */
        if (s.status === 'miss' && s.stage !== 'path' && s.stage !== 'end' && s.stage !== 'direct' && stages.indexOf(s.stage) === -1) continue;
        if (s.stage === 'again') renderLane();
        var node = nodeFor(s);
        if (node && on) { node.classList.add('s-checking'); if (node.scrollIntoView && s.stage === 'path') { /* keep lane static */ } }
        narr.textContent = s.note;
        if (on) await sleep(s.stage === 'path' ? 420 : 520);
        if (my !== runId) return;
        if (node) {
          node.classList.remove('s-checking');
          node.classList.add('s-' + s.status);
          var res = node.querySelector('.res');
          if (res) res.textContent = MARK[s.status] || '';
        }
      }
    }

    async function run(line) {
      line = line.trim();
      print([{ t: shell.prompt() + ' ' + line, c: 't-prompt' }]);
      if (!line) return;
      history.push(line); hpos = history.length;
      renderLane();
      var r = shell.exec(line);
      if (r.clear) SH.clear(out);
      input.disabled = true;
      if (r.trace) await animate(r.trace); else narr.textContent = 'No lookup needed for that line.';
      input.disabled = false;
      print(r.out);
      promptLabel.textContent = shell.prompt();
      refresh(true);
      if (document.activeElement === document.body || mount.contains(document.activeElement)) input.focus({ preventScroll: true });
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; run(v); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hpos > 0) { hpos--; input.value = history[hpos]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hpos = Math.min(history.length, hpos + 1); input.value = history[hpos] || ''; e.preventDefault(); }
    });

    /* ----- Editors ----- */
    function pathEditor() {
      var ul = el('ol', { class: 'edit-list' });
      shell.path.forEach(function (d, i) {
        function move(delta) {
          return function () {
            var j = i + delta;
            if (j < 0 || j >= shell.path.length) return;
            var t = shell.path[i]; shell.path[i] = shell.path[j]; shell.path[j] = t;
            shell.hash = {};
            refresh();
          };
        }
        ul.appendChild(el('li', {}, [
          el('span', { text: (i + 1) + '. ' + shell.tilde(d) }),
          el('button', { type: 'button', class: 'btn sm', 'aria-label': 'Move ' + d + ' earlier', text: '↑', disabled: i === 0, onclick: move(-1) }),
          el('button', { type: 'button', class: 'btn sm', 'aria-label': 'Move ' + d + ' later', text: '↓', disabled: i === shell.path.length - 1, onclick: move(1) }),
          el('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Remove ' + d + ' from PATH', text: '✕', onclick: function () { shell.path.splice(i, 1); shell.hash = {}; refresh(); } })
        ]));
      });
      var inp = el('input', { type: 'text', class: 'mono', placeholder: '~/bin', 'aria-label': 'Folder to add to PATH' });
      var f = el('form', { class: 'inline-form' }, [inp, el('button', { class: 'btn sm', text: 'Add to front' })]);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!inp.value.trim()) return;
        shell.path.unshift(shell.abs(inp.value.trim())); shell.hash = {};
        refresh();
      });
      return el('div', { class: 'panel' }, [
        el('h4', { text: 'PATH (edit me)' }), ul, f,
        shell.useHash ? el('p', { class: 'small muted', text: 'Changing PATH also clears the hash cache, as real zsh does.' }) : null
      ]);
    }

    function fsEditor() {
      var fs = shell.fs, ul = el('ul', { class: 'edit-list' }), sys = el('ul', { class: 'edit-list' });
      var dirs = {};
      fs.n.forEach(function (nd, k) { if (nd.type !== 'dir') (dirs[VFS.dirname(k)] = dirs[VFS.dirname(k)] || []).push(k); });
      shell.path.forEach(function (d) { if (fs.lstat(d) && !dirs[d]) dirs[d] = []; });
      Object.keys(dirs).sort().forEach(function (d) {
        var target = /^\/(bin|usr\/bin|sbin|usr\/sbin)$/.test(d) ? sys : ul;
        target.appendChild(el('li', { class: 'dirhead' }, [el('span', { text: shell.tilde(d) + '/' + (shell.path.indexOf(d) !== -1 ? '   (in PATH)' : '') })]));
        if (!dirs[d].length) target.appendChild(el('li', {}, [el('span', { class: 'muted', text: '  (empty)' })]));
        dirs[d].sort().forEach(function (k) {
          var nd = fs.lstat(k), name = VFS.basename(k);
          var label = '  ' + name + (nd.type === 'link' ? ' → ' + shell.tilde(nd.target) + (fs.real(k) ? '' : '  (broken)') : '');
          var x = nd.type === 'file' ? el('button', {
            type: 'button', class: 'btn sm', 'aria-pressed': nd.mode & 0o100 ? 'true' : 'false',
            'aria-label': name + ' executable: ' + (nd.mode & 0o100 ? 'yes' : 'no') + '. Toggle',
            text: nd.mode & 0o100 ? 'x on' : 'x off',
            onclick: function () { nd.mode = nd.mode & 0o100 ? nd.mode & ~0o111 : nd.mode | 0o111; refresh(); }
          }) : null;
          target.appendChild(el('li', {}, [
            el('span', { text: label }), x,
            el('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Delete ' + k, text: '✕', onclick: function () { fs.rm(k); refresh(); } })
          ]));
        });
      });
      var p = el('input', { type: 'text', class: 'mono', placeholder: '~/.local/bin/mytool', 'aria-label': 'Path of new item' });
      var kind = el('select', { 'aria-label': 'Kind of item' }, [
        el('option', { value: 'prog', text: 'program (executable)' }),
        el('option', { value: 'plain', text: 'file, not executable' }),
        el('option', { value: 'link', text: 'symlink to…' }),
        el('option', { value: 'dir', text: 'folder' })
      ]);
      var tgt = el('input', { type: 'text', class: 'mono', placeholder: 'symlink target path', 'aria-label': 'Symlink target', hidden: true });
      kind.addEventListener('change', function () { tgt.hidden = kind.value !== 'link'; });
      var f = el('form', { class: 'inline-form' }, [p, kind, tgt, el('button', { class: 'btn sm', text: 'Add' })]);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!p.value.trim()) return;
        var path = shell.abs(p.value.trim());
        if (kind.value === 'prog') fs.file(path, { out: 'hello from ' + shell.tilde(path) });
        else if (kind.value === 'plain') fs.file(path, { mode: 0o644, size: 12 });
        else if (kind.value === 'dir') fs.mkdirp(path);
        else if (tgt.value.trim()) fs.link(path, shell.abs(tgt.value.trim()));
        refresh();
      });
      return el('div', { class: 'panel' }, [
        el('h4', { text: 'Fake filesystem (edit me)' }), ul,
        el('details', {}, [el('summary', { text: 'System folders (/bin, /usr/bin…)' }), sys]),
        f,
        shell.useHash ? el('p', { class: 'small muted', text: 'Edits here do not tell the hash cache anything, just like on a real Mac.' }) : null
      ]);
    }

    function hashPanel() {
      var keys = Object.keys(shell.hash).sort(), ul = el('ul', { class: 'edit-list' });
      keys.forEach(function (k) { ul.appendChild(el('li', {}, [el('span', { text: k + ' → ' + shell.tilde(shell.hash[k]) })])); });
      if (!keys.length) ul.appendChild(el('li', {}, [el('span', { class: 'muted', text: '(empty: nothing remembered)' })]));
      return el('div', { class: 'panel' }, [el('h4', { text: 'Hash cache (what zsh remembers)' }), ul,
        SH.btn('rehash (forget everything)', function () { run('rehash'); }, 'sm')]);
    }

    function refresh(keepLane) {
      if (!keepLane) { runId++; renderLane(); input.disabled = false; }
      SH.clear(editors);
      if (opts.editors !== false) { editors.appendChild(pathEditor()); editors.appendChild(fsEditor()); }
      if (stages.indexOf('hash') !== -1) editors.appendChild(hashPanel());
      if (opts.onChange) opts.onChange(shell);
    }

    function reset() {
      shell = opts.make();
      SH.clear(out);
      if (opts.intro) print(opts.intro.map(function (t) { return { t: t, c: 't-dim' }; }));
      promptLabel.textContent = shell.prompt();
      narr.textContent = 'Type a command below (or tap a suggestion) and watch the search.';
      refresh();
    }

    mount.appendChild(el('div', {}, [
      lane, narr,
      el('div', { class: 'term' }, [out, form]),
      chips,
      el('div', { class: 'btn-row' }, [
        el('label', { for: id + '-anim' }, [animBox, ' Animate the search']),
        SH.btn('Reset this terminal', reset, 'sm')
      ]),
      editors
    ]));
    reset();
    return { run: run, shell: function () { return shell; }, reset: reset };
  };
})();
