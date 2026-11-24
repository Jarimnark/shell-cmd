/* Chapter 4: full-lookup terminal, hash cache demo, quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, H = SH.HOME;

  var t4 = document.getElementById('w-term4');
  if (t4) {
    SH.terminal(t4, {
      make: function () { return SH.world(); },
      suggestions: ['type ll', 'll', 'greet', 'cd /', 'claude', 'hash', 'which -a claude', "alias claude='echo not the real claude'", 'unalias claude', 'rehash', 'type cd greet git nope'],
      intro: ['Full lookup: alias → function → builtin → hash cache → PATH.']
    });
  }

  /* ---------- Hash cache demo ---------- */
  var mount = document.getElementById('w-hash');
  if (mount) {
    var mode = 'zsh', shell, log;
    var OLD = '/usr/local/bin/tool', MOVED = '/usr/bin/tool', NEW = H + '/.local/bin/tool';
    var pre = el('pre', { class: 'out', 'aria-label': 'Terminal output', role: 'log', 'aria-live': 'polite', tabindex: '0' });
    var state = el('div', { class: 'panel' });
    var explain = el('p', { class: 'narration', role: 'status' });
    var modeSel = el('select', { id: 'hash-mode' }, [el('option', { value: 'zsh', text: 'zsh (macOS default)' }), el('option', { value: 'bash', text: 'bash' })]);
    var buttons = {};

    function make() {
      var fs = new SH.VFS();
      fs.file(OLD, { out: 'tool v1', owner: 'root' });
      fs.mkdirp(H + '/.local/bin'); fs.mkdirp('/usr/bin', 'root'); fs.mkdirp('/bin', 'root');
      shell = new SH.Shell({ fs: fs, path: [H + '/.local/bin', '/usr/local/bin', '/usr/bin', '/bin'], mode: mode });
      log = [];
      explain.textContent = 'Start by running "tool". Then change something on disk and run it again.';
      draw();
    }
    function run(cmd) {
      log.push({ t: shell.prompt() + ' ' + cmd, c: 't-prompt' });
      var r = shell.exec(cmd);
      log = log.concat(r.out);
      return r;
    }
    function draw() {
      SH.renderLines(pre, log.length ? log : [{ t: '(nothing run yet)', c: 't-dim' }]);
      pre.scrollTop = pre.scrollHeight;
      SH.clear(state);
      state.appendChild(el('h4', { text: 'What is really on disk' }));
      var ul = el('ul', { class: 'edit-list' });
      shell.path.forEach(function (d, i) {
        var f = shell.fs.lstat(d + '/tool');
        ul.appendChild(el('li', {}, [el('span', { text: 'PATH ' + (i + 1) + ': ' + shell.tilde(d) + '/' }), el('span', { class: f ? 'ok' : 'muted', text: f ? 'tool  (' + f.out + ')' : 'no tool here' })]));
      });
      state.appendChild(ul);
      state.appendChild(el('h4', { text: 'What ' + mode + ' remembers (hash table)' }));
      var h = shell.hash.tool;
      var stale = h && (!shell.fs.lstat(h) || shell.findInPath('tool')[0] !== h);
      state.appendChild(el('p', { class: 'mono ' + (h ? (stale ? 'warn' : 'ok') : 'muted'), text: h ? 'tool=' + h + (stale ? '   ← stale!' : '') : '(empty)' }));
      buttons.install.disabled = !!shell.fs.lstat(NEW);
      buttons.move.disabled = !shell.fs.lstat(OLD);
      buttons.whicha.disabled = mode === 'bash';
      buttons.which.textContent = mode === 'bash' ? 'type tool' : 'which tool';
      buttons.rehash.textContent = mode === 'bash' ? 'hash -r' : 'rehash';
    }

    buttons.run = SH.btn('Run: tool', function () {
      var before = shell.hash.tool, r = run('tool'), first = shell.findInPath('tool')[0];
      var stale = (r.trace || []).some(function (s) { return s.stage === 'hash' && s.status === 'stale'; });
      var fromHash = (r.trace || []).some(function (s) { return s.stage === 'hash' && s.status === 'hit'; });
      if (shell.rc && mode === 'bash' && before) explain.textContent = 'bash went straight to the remembered spot, found nothing, and stopped. It did not search PATH again, even though tool exists in another PATH folder. Press "hash -r".';
      else if (shell.rc) explain.textContent = 'Nothing called tool can be run from any PATH folder.';
      else if (stale) explain.textContent = 'zsh went to the remembered spot, found it empty, and quietly searched PATH again. It worked, so you saw no error. Notice the hash table still holds the old path.';
      else if (fromHash && first && first !== before) explain.textContent = 'Stale cache. A newer tool sits earlier in PATH, but the shell went straight to the spot it remembered and ran the old one. Compare "which tool" with "which -a tool", then press "rehash".';
      else if (fromHash) explain.textContent = 'Found in the hash table. PATH was not searched at all.';
      else explain.textContent = 'First run: the shell searched PATH, found tool, ran it, and wrote the location into the hash table.';
      draw();
    }, 'primary');
    buttons.which = SH.btn('which tool', function () {
      if (mode === 'bash') {
        var h = shell.hash.tool, f = shell.findInPath('tool')[0];
        log.push({ t: shell.prompt() + ' type tool', c: 't-prompt' });
        log.push(h ? 'tool is hashed (' + h + ')' : f ? 'tool is ' + f : { t: 'bash: type: tool: not found', c: 't-err' });
        explain.textContent = 'In bash, "type" tells you when the answer comes from memory: "is hashed".';
      } else {
        run('which tool');
        explain.textContent = '"which" without -a answers from the hash table when the remembered file is still runnable. So it shows what will run, which may be the stale one.';
      }
      draw();
    });
    buttons.whicha = SH.btn('which -a tool', function () {
      run('which -a tool');
      explain.textContent = '"which -a" ignores the hash table and searches every PATH folder fresh. The top line is what a new shell would run. If that differs from "which tool", the cache is stale.';
      draw();
    });
    buttons.hash = SH.btn('hash', function () {
      var r = run('hash');
      if (!r.out.length) log.push({ t: '(empty)', c: 't-dim' });
      explain.textContent = '"hash" prints everything this shell remembers.';
      draw();
    });
    buttons.rehash = SH.btn('rehash', function () {
      run(mode === 'bash' ? 'hash -r' : 'rehash');
      explain.textContent = 'Memory wiped. The next "tool" will do a fresh PATH search.';
      draw();
    });
    buttons.install = SH.btn('Disk: install tool v2 in ~/.local/bin', function () {
      shell.fs.file(NEW, { out: 'tool v2' });
      explain.textContent = 'An installer put a newer copy in ~/.local/bin, which is earlier in PATH. Nobody told the shell. Run tool again.';
      draw();
    });
    buttons.move = SH.btn('Disk: move tool to /usr/bin', function () {
      shell.fs.mv(OLD, MOVED);
      explain.textContent = 'The file moved from /usr/local/bin to /usr/bin. Both are in PATH. Nobody told the shell. Run tool again.';
      draw();
    });
    modeSel.addEventListener('change', function () { mode = modeSel.value; make(); });

    mount.appendChild(el('p', { class: 'small', html: '<strong>Scenario A (wrong version):</strong> Run → install v2 → Run → which / which -a → rehash → Run.<br><strong>Scenario B (moved file):</strong> Reset → Run → move → Run. Then switch the shell to bash, and do B again.' }));
    mount.appendChild(el('div', { class: 'inline-form' }, [el('label', { for: 'hash-mode', text: 'Shell' }), modeSel, SH.btn('Reset', make)]));
    mount.appendChild(el('div', { class: 'btn-row' }, [buttons.run, buttons.which, buttons.whicha, buttons.hash, buttons.rehash]));
    mount.appendChild(el('div', { class: 'btn-row' }, [buttons.install, buttons.move]));
    mount.appendChild(explain);
    mount.appendChild(el('div', { class: 'grid2' }, [pre, state]));
    make();
  }

  SH.quiz('ch4', [
    { q: 'You have  alias git="echo nope"  and a real /usr/bin/git. What happens when you type  git status ?',
      options: ['/usr/bin/git runs, real programs beat aliases', 'It prints: nope status', 'zsh reports a conflict', 'It depends on PATH order'], answer: 1,
      why: 'Aliases are checked first. zsh swaps git for "echo nope", keeps your other words, and runs echo. echo is a builtin, so in the end no file is involved at all.' },
    { q: 'Why does  which nvm  print a block of shell code and not a path?',
      options: ['nvm is broken', 'nvm is a shell function, and functions are found before PATH is searched', 'nvm is hidden', 'which cannot see into ~/.nvm'], answer: 1,
      why: 'nvm loads itself into your shell as a function. For a function, which prints its body. There is no nvm program file in PATH.' },
    { q: 'What is the main difference between  which claude  and  which -a claude ?',
      options: ['-a shows aliases only', '-a shows every match and does a fresh search of all PATH folders', '-a asks the internet', 'No difference'], answer: 1,
      why: 'Plain which shows the one thing that would run and may answer from the hash table. -a lists all candidates from a fresh search, so duplicates and stale memory become visible.' },
    { q: 'You installed a newer copy of a tool in a folder earlier in PATH. which -a lists the new one first, but the old version keeps running in this terminal. Most likely cause?',
      options: ['The new copy is corrupt', 'The shell is still using the location stored in its hash table', 'PATH is read right to left', 'You need sudo'], answer: 1,
      why: 'The shell remembered the old spot and it still works, so it never searches again. rehash, or a new terminal window, clears the memory.' },
    { q: 'What does  rehash  change on your disk?',
      options: ['It reinstalls the command', 'It rewrites ~/.zshrc', 'Nothing. It only empties this shell\'s memory of command locations', 'It deletes broken symlinks'], answer: 2,
      why: 'rehash touches no files. That is why it is always safe to try.' }
  ]);
})();
