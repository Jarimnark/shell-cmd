/* Core helpers: DOM builder, storage, theme, navigation, glossary, quiz engine. */
(function () {
  'use strict';
  var SH = (window.SH = {});

  /* ----- DOM helper ----- */
  SH.el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'disabled' || k === 'checked') n[k] = !!v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  };
  SH.clear = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  SH.btn = function (label, onclick, cls) {
    return SH.el('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: onclick, text: label });
  };
  /* Render terminal-style lines into a <pre>. Each line: string or {t, c} */
  SH.renderLines = function (pre, lines) {
    SH.clear(pre);
    lines.forEach(function (l, i) {
      if (i) pre.appendChild(document.createTextNode('\n'));
      if (typeof l === 'string') pre.appendChild(document.createTextNode(l));
      else pre.appendChild(SH.el('span', { class: l.c || '', text: l.t }));
    });
    return pre;
  };
  SH.reducedMotion = function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  /* ----- Storage (never throws) ----- */
  SH.store = {
    get: function (k, d) {
      try { var v = window.localStorage.getItem('shellcmd.' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem('shellcmd.' + k, JSON.stringify(v)); } catch (e) { /* private mode etc. */ }
    }
  };

  /* ----- Glossary ----- */
  SH.glossary = [
    ['Terminal', 'The window app you type into (Terminal.app, iTerm2, the VS Code terminal). It only shows text and passes your keystrokes along. It does not understand commands.'],
    ['Shell', 'The program running inside the terminal that reads the line you typed, works out what you meant, and starts other programs. On a modern Mac the default shell is zsh.'],
    ['zsh', 'The "Z shell". One particular shell, the macOS default since 2019. bash is another shell.'],
    ['Program', 'A file containing instructions the computer can carry out. Sitting on disk, it does nothing.'],
    ['Process', 'A program that is currently running. One program file can be running as many processes at once.'],
    ['Command', 'What you type at the prompt. Its first word names the thing to run; the rest are arguments passed to it.'],
    ['File', 'A named piece of data stored on disk: text, a picture, or a program.'],
    ['Directory', 'A folder: a container that holds files and other directories. "Directory" and "folder" mean the same thing.'],
    ['Path', 'The address of a file or directory, written as folder names separated by slashes, e.g. /usr/bin/git.'],
    ['Absolute path', 'A path that starts at the very top of the disk with "/". It means the same place no matter where you are.'],
    ['Relative path', 'A path that does not start with "/". It is read starting from the folder you are currently in.'],
    ['Home directory', 'Your personal folder, /Users/yourname on a Mac. The shell lets you write it as ~.'],
    ['Working directory', 'The folder your shell is "standing in" right now. pwd prints it; cd changes it.'],
    ['Environment variable', 'A named setting (like PATH or HOME) that a process carries around and hands down to the programs it starts.'],
    ['PATH', 'An environment variable holding a list of folders, separated by colons. The shell searches these folders, in order, to find the program you named.'],
    ['Binary', 'A program file made of machine code, produced by a compiler (Go builds one). Not human-readable.'],
    ['Executable', 'Any file the system is allowed to run as a program: a binary, or a script with the execute permission switched on.'],
    ['Script', 'A text file of commands that another program (the interpreter, e.g. node or sh) reads and carries out. The first line, "#!…", names the interpreter.'],
    ['Permission bit', 'One on/off switch on a file saying whether somebody may read (r), write (w) or execute (x) it. There are nine: three for the owner, three for the group, three for everyone else.'],
    ['Symlink', 'Symbolic link. A tiny file whose only content is the path of another file. Opening the link takes you to that other file. Like a sticky note saying "the real thing is over there".'],
    ['Dangling link', 'A symlink whose target no longer exists. Also called a broken link.'],
    ['Inode', 'The disk’s internal record for one file: where the data is, its size, owner and permissions. A file name is just a label pointing at an inode.'],
    ['Alias', 'A nickname you define in the shell. The shell swaps it for the longer text before doing anything else.'],
    ['Shell function', 'A small named block of shell commands, defined in the shell itself (usually in ~/.zshrc).'],
    ['Builtin', 'A command that is part of the shell program itself (cd, echo, type). No separate file is involved.'],
    ['Hash table (command cache)', 'The shell’s memory of where it last found each program, so it need not search PATH again. rehash wipes that memory.'],
    ['Package manager', 'A tool that downloads, installs, updates and removes other software for you: Homebrew (brew), npm, apt.'],
    ['Exit code', 'A number a program hands back when it ends. 0 means success. The shell uses 127 for "command not found" and 126 for "found but cannot run".']
  ];
  function openGlossary() {
    var d = document.getElementById('glossary');
    if (!d) {
      var dl = SH.el('dl');
      SH.glossary.forEach(function (g) {
        dl.appendChild(SH.el('dt', { text: g[0] }));
        dl.appendChild(SH.el('dd', { text: g[1] }));
      });
      d = SH.el('dialog', { id: 'glossary', 'aria-labelledby': 'glossary-h' }, [
        SH.el('div', { class: 'dlg-head' }, [
          SH.el('h2', { id: 'glossary-h', text: 'Glossary' }),
          SH.btn('Close', function () { d.close(); })
        ]),
        dl
      ]);
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    }
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  /* ----- Quiz engine ----- */
  SH.quizTotals = {};
  SH.quiz = function (id, questions) {
    var mount = document.querySelector('[data-quiz="' + id + '"]');
    if (!mount) return;
    SH.quizTotals[id] = questions.map(function (q) { return q.answer; });
    function render() {
      SH.clear(mount);
      mount.appendChild(SH.el('h3', { text: 'Check yourself' }));
      var saved = SH.progress()[id] || {};
      questions.forEach(function (q, qi) {
        var why = SH.el('div', { class: 'why', role: 'status' });
        var buttons = [];
        function answer(choice, save) {
          buttons.forEach(function (b, bi) {
            b.disabled = true;
            if (bi === q.answer) { b.classList.add('right'); b.textContent = '✓ ' + q.options[bi]; }
            else if (bi === choice) { b.classList.add('wrong'); b.textContent = '✗ ' + q.options[bi]; }
          });
          why.textContent = (choice === q.answer ? 'Correct. ' : 'Not quite. ') + q.why;
          if (save) {
            var all = SH.progress();
            all[id] = all[id] || {};
            all[id][qi] = choice;
            SH.store.set('progress', all);
            SH.memProgress = all;
            SH.updateProgress();
          }
        }
        var fs = SH.el('fieldset', {}, [SH.el('legend', { text: (qi + 1) + '. ' + q.q })]);
        q.options.forEach(function (o, oi) {
          buttons.push(SH.el('button', { type: 'button', class: 'opt', 'data-i': oi, text: o, onclick: function () { answer(oi, true); } }));
        });
        /* Show the options in a random order so the right answer has no fixed position. */
        buttons.slice().sort(function () { return Math.random() - 0.5; }).forEach(function (b) { fs.appendChild(b); });
        fs.appendChild(why);
        mount.appendChild(fs);
        if (saved[qi] != null) answer(saved[qi], false);
      });
      mount.appendChild(SH.btn('Retry this quiz', function () {
        var all = SH.progress();
        delete all[id];
        SH.store.set('progress', all);
        SH.memProgress = all;
        render();
        SH.updateProgress();
      }, 'sm'));
    }
    SH.quizRenderers.push(render);
    render();
  };
  SH.quizRenderers = [];
  /* Progress lives in localStorage, with an in-memory copy so the page still works when storage is blocked. */
  SH.memProgress = null;
  SH.progress = function () {
    if (!SH.memProgress) SH.memProgress = SH.store.get('progress', {});
    return SH.memProgress;
  };
  SH.updateProgress = function () {
    var all = SH.progress(), totalQ = 0, totalRight = 0;
    Object.keys(SH.quizTotals).forEach(function (id) {
      var answers = SH.quizTotals[id], got = all[id] || {}, right = 0, done = 0;
      answers.forEach(function (a, i) { if (got[i] != null) { done++; if (got[i] === a) right++; } });
      totalQ += answers.length; totalRight += right;
      var badge = document.querySelector('#sidebar a[data-ch="' + id + '"] .badge');
      if (badge) {
        badge.textContent = done ? right + '/' + answers.length : answers.length + ' Q';
        badge.classList.toggle('done', done === answers.length && right === answers.length);
        badge.setAttribute('aria-label', done ? right + ' of ' + answers.length + ' quiz questions correct' : answers.length + ' quiz questions, not started');
      }
    });
    var bar = document.querySelector('.progress-bar > div'), txt = document.getElementById('progress-text');
    if (bar) bar.style.width = (totalQ ? (100 * totalRight / totalQ) : 0) + '%';
    if (txt) txt.textContent = totalRight + ' of ' + totalQ + ' quiz questions correct';
  };

  /* ----- Copy buttons on "try it" commands ----- */
  function addCopyButtons() {
    document.querySelectorAll('pre[data-copy]').forEach(function (pre) {
      var wrap = SH.el('div', { class: 'cmd-block' });
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      var b = SH.btn('Copy', function () {
        var text = pre.getAttribute('data-copy') || pre.textContent;
        try {
          navigator.clipboard.writeText(text).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select & copy'; });
        } catch (e) { b.textContent = 'Select & copy'; }
        setTimeout(function () { b.textContent = 'Copy'; }, 1500);
      }, 'sm copy');
      wrap.appendChild(b);
    });
  }

  /* ----- Theme ----- */
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function setThemeLabel(btn) { btn.textContent = currentTheme() === 'dark' ? '☀ Light' : '☾ Dark'; }

  /* ----- Init: build nav from chapters, wire the top bar ----- */
  SH.init = function () {
    var sidebar = document.getElementById('sidebar');
    var list = SH.el('ol');
    var links = {};
    document.querySelectorAll('section.chapter').forEach(function (sec) {
      var a = SH.el('a', { href: '#' + sec.id, 'data-ch': sec.id }, [
        SH.el('span', { text: sec.getAttribute('data-title') }),
        SH.el('span', { class: 'badge' })
      ]);
      a.addEventListener('click', function () { sidebar.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
      links[sec.id] = a;
      list.appendChild(SH.el('li', {}, [a]));
    });
    sidebar.appendChild(list);
    sidebar.appendChild(SH.el('div', { class: 'progress-box' }, [
      SH.el('div', { id: 'progress-text', role: 'status' }),
      SH.el('div', { class: 'progress-bar' }, [SH.el('div')]),
      SH.btn('Reset all quiz progress', function () {
        SH.store.set('progress', {});
        SH.memProgress = {};
        SH.quizRenderers.forEach(function (r) { r(); });
        SH.updateProgress();
      }, 'sm')
    ]));

    var menuBtn = document.getElementById('menu-btn');
    menuBtn.addEventListener('click', function () {
      var open = sidebar.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); }
    });
    document.getElementById('glossary-btn').addEventListener('click', openGlossary);
    document.querySelectorAll('[data-open-glossary]').forEach(function (b) { b.addEventListener('click', openGlossary); });

    var themeBtn = document.getElementById('theme-btn');
    setThemeLabel(themeBtn);
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      SH.store.set('theme', next);
      setThemeLabel(themeBtn);
    });

    /* Highlight the chapter you are reading in the sidebar. */
    var sections = Array.prototype.slice.call(document.querySelectorAll('section.chapter')), ticking = false;
    function spy() {
      ticking = false;
      var line = window.innerHeight * 0.3, cur = null;
      sections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s.id; });
      Object.keys(links).forEach(function (k) {
        if (k === cur) links[k].setAttribute('aria-current', 'true'); else links[k].removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(spy); } }, { passive: true });
    spy();
    addCopyButtons();
    SH.updateProgress();
  };
})();
