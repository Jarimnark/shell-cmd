/* Chapter 8: updater simulator + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el, H = SH.HOME;
  var LINK = H + '/.local/bin/claude', V = H + '/.local/share/claude/versions';
  var mount = document.getElementById('w-upd');
  if (mount) {
    var k = 0, dead = false, atomic = false;
    var SLOPPY = [
      { label: 'Download 2.2.0 to a temp name', does: 'curl … > versions/.2.2.0.tmp',
        apply: function (fs) { fs.file(V + '/.2.2.0.tmp', { mode: 0o644, size: 183500000, out: '' }); },
        mid: function (fs) { fs.file(V + '/.2.2.0.tmp', { mode: 0o644, size: 61200000, out: '' }); },
        broken: 'A temp file is left in versions/. If the download was cut short it is only part of the program. The link was never touched, so claude still runs the old version. Harmless, apart from wasted disk space. A good updater deletes stale temp files on its next run.' },
      { label: 'Verify, rename to its real name', does: 'mv versions/.2.2.0.tmp versions/2.2.0',
        apply: function (fs) { fs.mv(V + '/.2.2.0.tmp', V + '/2.2.0'); },
        broken: 'Version 2.2.0 is on disk under its real name, but look at its permissions: rw-r--r--, no x yet. The link still points at 2.1.0, so claude works and reports the old version. A trap is waiting: point the link at 2.2.0 by hand now and you would get "permission denied".' },
      { label: 'Make it executable', does: 'chmod +x versions/2.2.0',
        apply: function (fs) { fs.lstat(V + '/2.2.0').mode = 0o755; fs.lstat(V + '/2.2.0').out = '2.2.0 (Claude Code)'; },
        broken: 'Both versions are complete and runnable. The link still points at the old one. Nothing is broken; it just looks as if the update never happened. Running the updater again finishes the job.' },
      { label: 'Remove the old link', does: 'rm ~/.local/bin/claude',
        apply: function (fs) { fs.rm(LINK); },
        broken: 'The worst moment. The old link is gone and the new one was never made. Both binaries are safely on disk, but no name in PATH leads to either: "command not found". Fix: recreate the link with ln -s, or reinstall. This is case study A.' },
      { label: 'Create the new link', does: 'ln -s versions/2.2.0 ~/.local/bin/claude',
        apply: function (fs) { fs.link(LINK, V + '/2.2.0'); },
        broken: 'The update itself succeeded: claude runs 2.2.0. Only the clean-up is missing, so the old 2.1.0 file is still taking up disk space.' },
      { label: 'Clean up the old version', does: 'rm versions/2.1.0',
        apply: function (fs) { fs.rm(V + '/2.1.0'); },
        broken: 'Everything finished. There is nothing left to interrupt.' }
    ];
    var SWAP = { label: 'Swap the link in one atomic step', does: 'ln -s versions/2.2.0 ~/.local/bin/.claude.tmp && mv ~/.local/bin/.claude.tmp ~/.local/bin/claude',
      apply: function (fs) { fs.link(LINK, V + '/2.2.0'); },
      broken: 'The update itself succeeded: claude runs 2.2.0. Because the swap was a single rename, there was no moment without a link. Only the clean-up is missing.' };
    function steps() { return atomic ? SLOPPY.slice(0, 3).concat([SWAP, SLOPPY[5]]) : SLOPPY; }

    var list = el('ol', { class: 'edit-list' }), out = el('pre', { class: 'out nowrap', role: 'log', 'aria-live': 'polite', tabindex: '0', 'aria-label': 'Terminal output' });
    var verdict = el('p', { class: 'verdict', role: 'status' });
    var nextBtn = SH.btn('Run next step ▶', function () { k++; draw(); }, 'primary');
    var midBtn = SH.btn('⚡ Interrupt during the next step', function () { dead = 'mid'; draw(); }, 'danger');
    var killBtn = SH.btn('⚡ Interrupt now (between steps)', function () { dead = 'between'; draw(); }, 'danger');
    var againBtn = SH.btn('Run the updater again', function () { dead = false; k = steps().length; draw(true); });
    var atomicBox = el('input', { type: 'checkbox', id: 'upd-atomic' });
    atomicBox.addEventListener('change', function () { atomic = atomicBox.checked; k = 0; dead = false; draw(); });

    function draw(reran) {
      var S = steps(), shell = SH.world();
      for (var i = 0; i < k; i++) S[i].apply(shell.fs);
      var midDownload = dead === 'mid' && k === 0;
      if (midDownload) S[0].mid(shell.fs);

      SH.clear(list);
      S.forEach(function (s, i) {
        var mark = i < k ? '✓ done' : (dead && i === k ? (dead === 'mid' ? '💥 died here' : '✗ never ran') : dead ? '✗ never ran' : i === k ? '← next' : '');
        list.appendChild(el('li', {}, [
          el('span', {}, [el('b', { text: (i + 1) + '. ' + s.label }), el('br'), el('span', { class: 'muted', text: s.does })]),
          el('span', { class: i < k ? 'ok' : dead ? 'bad' : 'muted', text: mark })
        ]));
      });

      var lines = [];
      ['ls -la ~/.local/bin', 'ls -la ~/.local/share/claude/versions', 'claude --version'].forEach(function (c, i) {
        if (i) lines.push('');
        lines.push({ t: shell.prompt() + ' ' + c, c: 't-prompt' });
        lines = lines.concat(shell.exec(c).out.filter(function (l) { return !/ \.\.?$/.test(typeof l === 'string' ? l : ''); }));
      });
      SH.renderLines(out, lines);

      var works = shell.fs.tryExec(LINK).ok;
      if (dead) {
        verdict.className = 'verdict ' + (works ? 'warn' : 'bad');
        var why = k === 0 && dead === 'between' ? 'Interrupted before anything happened. Nothing changed.'
          : dead === 'mid' && k > 0 && k < S.length ? 'A single step like this either happens or does not; here it did not. The state is the same as an interruption just before it. ' + S[k - 1].broken
          : midDownload ? S[0].broken : S[k - 1].broken;
        verdict.textContent = '💥 The updater died. ' + why;
      } else if (k === S.length) {
        verdict.className = 'verdict ok';
        verdict.textContent = (reran ? 'The second run cleaned up the leftovers and completed every step. ' : '') + 'Update complete: one version on disk, the link points at it, no leftovers.';
      } else {
        verdict.className = 'verdict ' + (works ? 'ok' : 'bad');
        verdict.textContent = (k === 0 ? 'Before the update. ' : 'After step ' + k + '. ') + (works ? 'claude works right now.' : 'claude does NOT work right now: there is no link. The careful updater avoids this gap.') + ' Run the next step, or interrupt.';
      }
      nextBtn.disabled = midBtn.disabled = killBtn.disabled = !!dead || k === S.length;
      againBtn.hidden = !dead;
    }

    mount.appendChild(el('p', { class: 'small', text: 'Step through a normal update once. Then reset and interrupt it at different points to see what each broken state looks like.' }));
    mount.appendChild(el('div', {}, [atomicBox, el('label', { for: 'upd-atomic', text: ' Careful updater: swap the link with one atomic rename' })]));
    mount.appendChild(el('div', { class: 'btn-row' }, [nextBtn, killBtn, midBtn, againBtn, SH.btn('Reset', function () { k = 0; dead = false; draw(); })]));
    mount.appendChild(list);
    mount.appendChild(out);
    mount.appendChild(verdict);
    draw();
  }

  SH.quiz('ch8', [
    { q: 'Why does an updater download the new version under a temporary name first?',
      options: ['Temporary names download faster', 'So a half-finished download can never be mistaken for, or run as, the real program', 'macOS requires it', 'To hide it from you'], answer: 1,
      why: 'Until the file is complete and checked, nothing points at it. If the download dies, the old version is untouched.' },
    { q: 'At which moment does an interrupted (non-careful) update leave you with "command not found"?',
      options: ['During the download', 'After the old link was removed and before the new link was created', 'During clean-up of old versions', 'While checking the server for a new version'], answer: 1,
      why: 'In that gap there is no name in PATH at all. Both binaries are still on disk; only the pointer is missing.' },
    { q: 'An update was interrupted during clean-up, the last step. What do you notice?',
      options: ['command not found', 'permission denied', 'Nothing breaks; the new version runs and an old version file is left on disk', 'The old version runs'], answer: 2,
      why: 'The pointer was already swapped. Only leftover files remain, which cost disk space and nothing else.' },
    { q: 'What does it mean that a rename is "atomic"?',
      options: ['It is very fast', 'It either happens completely or not at all, with no visible in-between state', 'It needs admin rights', 'It cannot be undone'], answer: 1,
      why: 'That is why careful updaters build the new link under a temporary name and rename it over the old one: there is never a moment without a link.' }
  ]);
})();
