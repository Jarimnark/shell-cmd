/* Chapter 6: symlink playground + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, H = SH.HOME;
  var LINK = H + '/.local/bin/claude', VDIR = H + '/.local/share/claude/versions';
  var mount = document.getElementById('w-sym');
  if (mount) {
    var shell, did;
    var diagram = el('div', { class: 'diagram' });
    var didLine = el('pre', { class: 'out' });
    var lsOut = el('pre', { class: 'out nowrap', role: 'log', 'aria-live': 'polite', tabindex: '0', 'aria-label': 'ls and run output' });
    var verdict = el('p', { class: 'verdict', role: 'status' });
    var row = el('div', { class: 'btn-row' });

    function make() {
      shell = SH.world();
      shell.fs.file(VDIR + '/2.2.0', { out: '2.2.0 (Claude Code)', size: 183500000 });
      did = null;
      draw();
    }
    function act(cmd) { return function () { did = cmd; shell.exec(cmd); shell.exec('rehash'); draw(); }; }

    function draw() {
      var fs = shell.fs, link = fs.lstat(LINK), isLink = link && link.type === 'link';
      var tgtPath = isLink ? link.target : null, tgt = tgtPath ? fs.lstat(tgtPath) : null;
      var short = function (p) { return shell.tilde(p); };

      SH.clear(diagram);
      diagram.appendChild(el('div', { class: 'node ' + (isLink ? (tgt ? 'good' : 'warnish') : 'gone') }, [
        el('b', { text: 'The link (in a PATH folder)' + (link ? '' : ': deleted') }), el('span', { text: short(LINK) })]));
      diagram.appendChild(el('span', { class: 'arrow' + (isLink && tgt ? '' : ' broken'), 'aria-hidden': 'true', text: isLink ? (tgt ? '⟶' : '⟶ ✗') : '   ' }));
      var shownTarget = tgtPath || VDIR + '/2.1.0', shownNode = fs.lstat(shownTarget);
      diagram.appendChild(el('div', { class: 'node ' + (shownNode ? (shownNode.mode & 0o100 ? 'good' : 'warnish') : 'gone') }, [
        el('b', { text: 'The target (the real program)' + (shownNode ? (shownNode.mode & 0o100 ? '' : ': not executable') : ': deleted') }), el('span', { text: short(shownTarget) })]));

      SH.renderLines(didLine, did ? [{ t: 'You ran:  ' + did.replace(new RegExp(H, 'g'), '~'), c: 't-hl' }] : [{ t: 'Starting state. Press a button below.', c: 't-dim' }]);

      var lines = [];
      ['ls -la ~/.local/bin', 'ls -l ~/.local/share/claude/versions', 'claude'].forEach(function (c, i) {
        if (i) lines.push('');
        lines.push({ t: shell.prompt() + ' ' + c, c: 't-prompt' });
        lines = lines.concat(shell.exec(c).out);
      });
      shell.exec('rehash');
      SH.renderLines(lsOut, lines);

      var r = fs.tryExec(LINK);
      if (r.ok) { verdict.className = 'verdict ok'; verdict.textContent = 'Healthy. The link exists, its target exists and is executable. zsh finds the link in PATH, the kernel follows it and runs ' + short(r.real) + '.'; }
      else if (!link) { verdict.className = 'verdict bad'; verdict.textContent = 'Link deleted. The real program is still on disk in versions/, but no name in PATH leads to it: "command not found". Recreate the link to fix it.'; }
      else if (r.dangling) { verdict.className = 'verdict bad'; verdict.textContent = 'Dangling link. ls still shows the link and its arrow with no warning, but the arrow points at a file that is gone. zsh treats that as "command not found".'; }
      else { verdict.className = 'verdict warn'; verdict.textContent = 'The link and target both exist, but the target has no execute permission. zsh sees something it cannot run: "permission denied". The link\'s own lrwxr-xr-x letters do not help; the target decides.'; }

      SH.clear(row);
      var t210 = fs.lstat(VDIR + '/2.1.0');
      [
        ['Delete the target', 'rm ' + (tgtPath || VDIR + '/2.1.0'), !(isLink && tgt)],
        ['Delete the link', 'rm ' + LINK, !link],
        ['Create link → 2.1.0', 'ln -s ' + VDIR + '/2.1.0 ' + LINK, !!link],
        ['Repoint link → 2.2.0 (ln -sf)', 'ln -sf ' + VDIR + '/2.2.0 ' + LINK, !fs.lstat(VDIR + '/2.2.0')],
        ['Repoint link → 2.1.0 (ln -sf)', 'ln -sf ' + VDIR + '/2.1.0 ' + LINK, false],
        [tgt && !(tgt.mode & 0o100) ? 'chmod +x the target' : 'chmod -x the target', 'chmod ' + (tgt && !(tgt.mode & 0o100) ? '+x ' : '-x ') + (tgtPath || ''), !tgt]
      ].forEach(function (b) {
        var btn = SH.btn(b[0], act(b[1]));
        btn.disabled = b[2];
        btn.title = b[1].replace(new RegExp(H, 'g'), '~');
        row.appendChild(btn);
      });
      if (!t210) row.appendChild(SH.btn('Put version 2.1.0 back', function () { did = '(reinstalled version 2.1.0)'; fs.file(VDIR + '/2.1.0', { out: '2.1.0 (Claude Code)', size: 182000000 }); draw(); }));
      row.appendChild(SH.btn('Reset', make));
    }

    mount.appendChild(el('p', { class: 'small', text: 'Break it in each of the three ways, and read what ls and zsh say each time. Try to get back to a healthy state without pressing Reset.' }));
    mount.appendChild(diagram);
    mount.appendChild(row);
    mount.appendChild(didLine);
    mount.appendChild(lsOut);
    mount.appendChild(verdict);
    make();
  }

  SH.quiz('ch6', [
    { q: 'ls -la shows:  claude -> /Users/you/.local/share/claude/versions/2.1.0   What is stored inside the file called claude?',
      options: ['A full copy of the 2.1.0 program', 'Only the text of that path', 'Nothing, it is empty', 'The permissions of 2.1.0'], answer: 1,
      why: 'A symlink holds a path and nothing else. That is why its size equals the length of the path text.' },
    { q: 'You delete the symlink ~/.local/bin/claude with rm. What happens to versions/2.1.0?',
      options: ['It is deleted too', 'Nothing. Only the pointer is removed', 'It becomes read-only', 'It moves to the Trash'], answer: 1,
      why: 'Removing the sticky note does not touch the thing it described. The program is still on disk, it just has no name in PATH any more.' },
    { q: 'The target of a symlink was deleted. What does  ls -la  on the link show?',
      options: ['An error: No such file or directory', 'The link, with its arrow, as if nothing were wrong', 'Nothing at all', 'A red warning'], answer: 1,
      why: 'ls -la describes the link itself and does not check the target. To test the target, list it directly or use ls -laL.' },
    { q: 'Which command creates a link named ~/bin/tool that points to /opt/tool/1.4/tool ?',
      options: ['ln -s ~/bin/tool /opt/tool/1.4/tool', 'ln -s /opt/tool/1.4/tool ~/bin/tool', 'ln ~/bin/tool -> /opt/tool/1.4/tool', 'link ~/bin/tool /opt/tool/1.4/tool'], answer: 1,
      why: 'Existing target first, new link name second. The first option would try to create a link inside /opt pointing back at ~/bin/tool.' },
    { q: 'A link at ~/.local/bin/claude already exists and points to an old version. Which command repoints it in one step?',
      options: ['ln -s NEW ~/.local/bin/claude', 'ln -sf NEW ~/.local/bin/claude', 'chmod +x ~/.local/bin/claude', 'rehash'], answer: 1,
      why: 'Without -f, ln refuses because the name is taken ("File exists"). -f replaces whatever is there.' }
  ]);
})();
