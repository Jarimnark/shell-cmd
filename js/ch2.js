/* Chapter 2: path resolver + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, VFS = SH.VFS, H = SH.HOME;

  var fs = new VFS();
  fs.file(H + '/.local/bin/claude');
  fs.file(H + '/.zshrc', { mode: 0o644 });
  fs.file(H + '/projects/site/index.html', { mode: 0o644 });
  fs.file(H + '/projects/site/main.go', { mode: 0o644 });
  fs.file(H + '/projects/notes.txt', { mode: 0o644 });
  fs.file('/usr/bin/git');
  fs.mkdirp('/usr/local/bin');
  fs.file('/bin/ls');
  fs.file('/opt/homebrew/bin/node');

  var mount = document.getElementById('w-paths');
  if (mount) {
    var cwds = [H, H + '/projects/site', H + '/.local/bin', '/usr/local/bin', '/'];
    var sel = el('select', { id: 'paths-cwd' });
    cwds.forEach(function (c) { sel.appendChild(el('option', { value: c, text: c })); });
    sel.value = H + '/projects/site';
    var inp = el('input', { type: 'text', class: 'mono', id: 'paths-in', value: '../notes.txt', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var steps = el('ol', { class: 'small' });
    var verdict = el('p', { class: 'verdict', role: 'status' });
    var tree = el('pre', { class: 'out nowrap', 'aria-label': 'Folder tree' });
    var chips = el('div', { class: 'chips' });
    ['main.go', './main.go', '..', '../notes.txt', '../../.zshrc', '~/.local/bin/claude', '/usr/bin/git', '~', '../../../..', 'nope/file.txt'].forEach(function (p) {
      chips.appendChild(el('button', { type: 'button', class: 'chip', text: p, onclick: function () { inp.value = p; update(); } }));
    });

    function update() {
      var cwd = sel.value, raw = inp.value.trim(), cur, parts, list = [];
      SH.clear(steps);
      function say(t) { steps.appendChild(el('li', { text: t })); }
      if (!raw) { verdict.className = 'verdict warn'; verdict.textContent = 'Type a path above.'; drawTree(cwd, null); return; }
      if (raw === '~' || raw.indexOf('~/') === 0) {
        say('Starts with ~, so the shell swaps it for your home directory: ' + H + '. It is now an absolute path.');
        cur = H; parts = raw.slice(1);
      } else if (raw.charAt(0) === '/') {
        say('Starts with /, so it is absolute. Begin at the root. Where you are standing does not matter.');
        cur = '/'; parts = raw;
      } else {
        say('Does not start with / or ~, so it is relative. Begin where you are standing: ' + cwd);
        cur = cwd; parts = raw;
      }
      parts.split('/').forEach(function (seg) {
        if (!seg) return;
        if (seg === '.') say('"."  means stay here: ' + cur);
        else if (seg === '..') {
          var up = VFS.dirname(cur);
          say('".." means go up one level: ' + (cur === '/' ? '/ (already at the top; the root is its own parent)' : up));
          cur = up;
        } else {
          cur = (cur === '/' ? '' : cur) + '/' + seg;
          say('"' + seg + '": step into it → ' + cur);
        }
      });
      var nd = fs.lstat(cur);
      verdict.className = 'verdict ' + (nd ? 'ok' : 'bad');
      verdict.textContent = 'Absolute path: ' + cur + (nd ? '   (exists: a ' + (nd.type === 'dir' ? 'directory' : 'file') + ')' : '   (nothing there: "No such file or directory")');
      drawTree(cwd, nd ? cur : null);
    }

    function drawTree(cwd, hit) {
      var lines = [];
      (function walk(p, depth) {
        var nd = fs.lstat(p), name = p === '/' ? '/' : VFS.basename(p) + (nd.type === 'dir' ? '/' : '');
        var text = new Array(depth + 1).join('   ') + name;
        var tags = (p === cwd ? '   ← you are here' : '') + (p === hit ? '   ★ the path points here' : '') + (p === H ? '   (this is ~)' : '');
        lines.push(p === hit ? { t: text + tags, c: 't-hl' } : p === cwd ? { t: text + tags, c: 't-prompt' } : tags ? { t: text + tags, c: 't-dim' } : text);
        if (nd.type === 'dir') fs.children(p).forEach(function (k) { walk(k, depth + 1); });
      })('/', 0);
      SH.renderLines(tree, lines);
    }

    sel.addEventListener('change', update);
    inp.addEventListener('input', update);
    mount.appendChild(el('div', { class: 'inline-form' }, [el('label', { for: 'paths-cwd', text: 'You are standing in' }), sel]));
    mount.appendChild(el('div', { class: 'inline-form' }, [el('label', { for: 'paths-in', text: 'Path' }), inp]));
    mount.appendChild(chips);
    mount.appendChild(el('div', { class: 'grid2' }, [el('div', {}, [steps, verdict]), tree]));
    update();
  }

  SH.quiz('ch2', [
    { q: 'Which of these is an absolute path?',
      options: ['bin/claude', './claude', '/usr/local/bin/claude', '../bin/claude'], answer: 2,
      why: 'Absolute paths start with /. The other three start from the working directory, so they are relative.' },
    { q: 'Your shell is standing in /Users/you/projects/site. Where does  ../..  point?',
      options: ['/Users/you/projects', '/Users/you', '/Users', '/'], answer: 1,
      why: 'Each .. goes up one level: site → projects → you. Two steps up from site lands in /Users/you.' },
    { q: 'What does zsh do with the ~ in  ls ~/Downloads ?',
      options: ['Passes the ~ character to ls, which understands it', 'Replaces it with your home directory before ls even starts', 'Treats it as the root directory', 'Ignores it'], answer: 1,
      why: 'The shell expands ~ itself. ls receives /Users/you/Downloads and never sees a tilde.' },
    { q: 'Why does plain  ls  not show the folder  ~/.local ?',
      options: ['It is protected by macOS', 'It does not really exist', 'Names starting with a dot are hidden unless you ask with ls -a', 'It is a symlink'], answer: 2,
      why: 'A leading dot only means "hide me from normal listings". ls -a shows everything.' }
  ]);
})();
