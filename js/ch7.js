/* Chapter 7: "which install wins?" map + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, H = SH.HOME;
  var mount = document.getElementById('w-install');
  if (mount) {
    var INST = {
      native: { label: 'Native installer', ver: '2.1.0', dir: function () { return H + '/.local/bin'; }, update: 'claude update (the tool updates itself)' },
      npm: { label: 'npm global (prefix ~/.npm-global)', ver: '2.0.5', dir: function () { return H + '/.npm-global/bin'; }, update: 'npm update -g @anthropic-ai/claude-code' },
      brew: { label: 'Homebrew', ver: '2.0.9', dir: function () { return '/opt/homebrew/bin'; }, update: 'brew upgrade claude-code' },
      nvm: { label: 'npm global under nvm (installed while on Node 22)', ver: '1.9.8', dir: function () { return H + '/.nvm/versions/node/' + st.node + '/bin'; }, update: 'npm update -g … (with the right Node version active)' }
    };
    var st = { on: { native: true, npm: true, brew: false, nvm: false }, order: ['nvm', 'native', 'npm', 'brew'], node: 'v22.11.0' };
    var toggles = el('div'), pathList = el('ol', { class: 'edit-list' }), out = el('pre', { class: 'out nowrap', role: 'log', 'aria-live': 'polite', tabindex: '0', 'aria-label': 'Terminal output' });
    var verdict = el('p', { class: 'verdict', role: 'status' });
    var nodeSel = el('select', { id: 'inst-node' }, [el('option', { value: 'v22.11.0', text: 'nvm use 22  (v22.11.0)' }), el('option', { value: 'v20.18.0', text: 'nvm use 20  (v20.18.0)' })]);
    nodeSel.addEventListener('change', function () { st.node = nodeSel.value; draw(); });

    function build() {
      var fs = new SH.VFS(), NM = '/lib/node_modules/@anthropic-ai/claude-code/cli.js';
      fs.file('/usr/bin/git', { owner: 'root' });
      fs.file('/bin/ls', { owner: 'root', prog: 'ls' });
      ['v22.11.0', 'v20.18.0'].forEach(function (v) { fs.file(H + '/.nvm/versions/node/' + v + '/bin/node', { out: v }); });
      fs.mkdirp(H + '/.local/bin'); fs.mkdirp(H + '/.npm-global/bin'); fs.mkdirp('/opt/homebrew/bin');
      if (st.on.native) { fs.file(H + '/.local/share/claude/versions/2.1.0', { out: '2.1.0 (Claude Code)   ← native install' }); fs.link(H + '/.local/bin/claude', H + '/.local/share/claude/versions/2.1.0'); }
      if (st.on.npm) { fs.file(H + '/.npm-global' + NM, { out: '2.0.5 (Claude Code)   ← npm global install' }); fs.link(H + '/.npm-global/bin/claude', '..' + NM); }
      if (st.on.brew) { fs.file('/opt/homebrew/Caskroom/claude-code/2.0.9/claude', { out: '2.0.9 (Claude Code)   ← Homebrew install' }); fs.link('/opt/homebrew/bin/claude', '../Caskroom/claude-code/2.0.9/claude'); }
      if (st.on.nvm) { var b = H + '/.nvm/versions/node/v22.11.0'; fs.file(b + NM, { out: '1.9.8 (Claude Code)   ← npm global under nvm, Node 22' }); fs.link(b + '/bin/claude', '..' + NM); }
      var path = st.order.map(function (k) { return INST[k].dir(); }).concat(['/usr/bin', '/bin']);
      return new SH.Shell({ fs: fs, path: path });
    }

    function draw() {
      var shell = build();
      SH.clear(toggles);
      Object.keys(INST).forEach(function (k) {
        var id = 'inst-' + k, cb = el('input', { type: 'checkbox', id: id, checked: st.on[k] });
        cb.addEventListener('change', function () { st.on[k] = cb.checked; draw(); });
        toggles.appendChild(el('div', {}, [cb, el('label', { for: id, text: ' ' + INST[k].label + ', version ' + INST[k].ver })]));
      });
      SH.clear(pathList);
      st.order.forEach(function (k, i) {
        function move(d) { return function () { var j = i + d; var t = st.order[i]; st.order[i] = st.order[j]; st.order[j] = t; draw(); }; }
        var dir = INST[k].dir();
        pathList.appendChild(el('li', {}, [
          el('span', { text: (i + 1) + '. ' + shell.tilde(dir) }),
          el('span', { class: shell.fs.lstat(dir + '/claude') ? 'ok' : 'muted', text: shell.fs.lstat(dir + '/claude') ? 'has claude' : 'no claude' }),
          el('button', { type: 'button', class: 'btn sm', text: '↑', 'aria-label': 'Move ' + dir + ' earlier', disabled: i === 0, onclick: move(-1) }),
          el('button', { type: 'button', class: 'btn sm', text: '↓', 'aria-label': 'Move ' + dir + ' later', disabled: i === st.order.length - 1, onclick: move(1) })
        ]));
      });
      pathList.appendChild(el('li', {}, [el('span', { class: 'muted', text: '5. /usr/bin    6. /bin' })]));

      var lines = [], found = shell.findInPath('claude', true);
      ['which -a claude', 'claude --version'].forEach(function (c, i) {
        if (i) lines.push('');
        lines.push({ t: shell.prompt() + ' ' + c, c: 't-prompt' });
        lines = lines.concat(shell.exec(c).out);
      });
      if (found.length) { lines.push(''); lines.push({ t: shell.prompt() + ' ls -l ' + shell.tilde(found[0]), c: 't-prompt' }); lines = lines.concat(shell.exec('ls -l ' + found[0]).out); }
      SH.renderLines(out, lines);

      var winner = null;
      st.order.forEach(function (k) { if (!winner && found[0] === INST[k].dir() + '/claude') winner = k; });
      if (!found.length) {
        verdict.className = 'verdict bad';
        verdict.textContent = st.on.nvm && st.node !== 'v22.11.0' && !st.on.native && !st.on.npm && !st.on.brew
          ? 'command not found. claude is installed, but only inside Node 22\'s folder. With Node 20 active, PATH contains Node 20\'s bin folder, which has no claude.'
          : 'command not found. No PATH folder holds a claude. Tick an install above.';
      } else if (found.length === 1) {
        verdict.className = 'verdict ok';
        verdict.textContent = 'One install, no conflict. Runs: ' + INST[winner].label + ' ' + INST[winner].ver + '. Updated by: ' + INST[winner].update + '.' +
          (st.on.nvm && st.node !== 'v22.11.0' ? ' (The nvm copy exists on disk but is not in PATH while Node 20 is active.)' : '');
      } else {
        var losers = st.order.filter(function (k) { return k !== winner && found.indexOf(INST[k].dir() + '/claude') !== -1; });
        verdict.className = 'verdict warn';
        verdict.textContent = found.length + ' installs in PATH. The one that runs is ' + INST[winner].label + ' ' + INST[winner].ver + ', only because its folder comes first. Shadowed: ' +
          losers.map(function (k) { return INST[k].label + ' ' + INST[k].ver; }).join('; ') + '. If you run "' + INST[losers[0]].update + '" you update a copy you never run.';
      }
    }

    mount.appendChild(el('p', { class: 'small', text: 'Tick the ways claude is installed, then reorder PATH. Watch which copy answers.' }));
    mount.appendChild(el('div', { class: 'grid2' }, [
      el('div', { class: 'panel' }, [el('h4', { text: 'Installed via' }), toggles, el('div', { class: 'inline-form' }, [el('label', { for: 'inst-node', text: 'Active Node (nvm)' }), nodeSel])]),
      el('div', { class: 'panel' }, [el('h4', { text: 'PATH order' }), pathList])
    ]));
    mount.appendChild(out);
    mount.appendChild(verdict);
    draw();
  }

  SH.quiz('ch7', [
    { q: 'Stripped to its essentials, what does installing a command-line tool do?',
      options: ['Registers the tool with macOS', 'Puts files on disk and makes the tool\'s name appear in a PATH folder', 'Compiles the tool into zsh', 'Adds an alias to ~/.zshrc'], answer: 1,
      why: 'There is no registry. The shell finds programs purely by name in PATH folders, so an install is files plus a name in PATH.' },
    { q: 'which -a claude prints ~/.local/bin/claude and then ~/.npm-global/bin/claude. You run  npm update -g @anthropic-ai/claude-code  and it succeeds, but  claude --version  is unchanged. Why?',
      options: ['npm is broken', 'You updated the npm copy, but the copy that runs is the one in ~/.local/bin, which is earlier in PATH', 'You must reboot', 'The hash table is always to blame'], answer: 1,
      why: 'Each installer updates only its own copy. The first line of which -a is what actually runs.' },
    { q: 'With nvm, you ran  npm install -g some-tool  on Node 22. After  nvm use 20,  some-tool is "command not found". Why?',
      options: ['nvm uninstalled it', 'Global packages live inside each Node version\'s own folder, and PATH now points at Node 20\'s folder', 'Node 20 is too old', 'some-tool needs sudo'], answer: 1,
      why: 'nvm swaps which version folder is in PATH. The tool is still on disk under v22; it was never installed under v20.' },
    { q: 'You have the same tool from Homebrew and from npm and want only the Homebrew one. What is the clean way to remove the npm one?',
      options: ['Delete random files named like it', 'npm uninstall -g THE-PACKAGE, then rehash', 'brew uninstall it', 'Remove /opt/homebrew/bin from PATH'], answer: 1,
      why: 'Remove a copy with the tool that installed it, so it cleans up both the package files and the link in its bin folder.' }
  ]);
})();
