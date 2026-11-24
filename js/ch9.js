/* Chapter 9: case-study replays with "what would you check next?" + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el;
  var NM = '/Users/you/.npm-global/lib/node_modules/@anthropic-ai';

  /* Transcript line helpers: "% cmd" = prompt, "! text" = error, "# text" = dim comment */
  function lines(arr) {
    return arr.map(function (s) {
      if (s.indexOf('% ') === 0) return { t: 'you@mac ~ ' + s, c: 't-prompt' };
      if (s.indexOf('! ') === 0) return { t: s.slice(2), c: 't-err' };
      if (s.indexOf('# ') === 0) return { t: s.slice(2), c: 't-dim' };
      return s;
    });
  }

  SH.replay = function (mount, data) {
    var i, answered;
    var head = el('p', { class: 'small muted' });
    var pre = el('pre', { class: 'out nowrap', role: 'log', tabindex: '0', 'aria-label': 'Terminal transcript' });
    var say = el('p', { role: 'status' });
    var qbox = el('div');
    var cont = SH.btn('Continue →', function () { go(i + 1); }, 'primary');
    var again = SH.btn('Replay from the start', function () { go(0); });

    function go(n) {
      i = n; answered = false;
      var done = i >= data.steps.length;
      var shown = [];
      data.steps.slice(0, done ? data.steps.length : i + 1).forEach(function (s, k) {
        if (k) shown.push('');
        shown = shown.concat(lines(s.show));
      });
      SH.renderLines(pre, shown);
      pre.scrollTop = pre.scrollHeight;
      SH.clear(qbox);
      if (done) {
        head.textContent = 'Solved';
        say.textContent = '';
        qbox.appendChild(el('div', { class: 'verdict ok' }, [
          el('div', {}, [el('strong', { text: 'Diagnosis: ' }), data.diagnosis]),
          el('div', {}, [el('strong', { text: 'Fix: ' }), data.fix]),
          el('div', {}, [el('strong', { text: 'Lesson: ' }), data.lesson])
        ]));
        cont.hidden = true; again.hidden = false;
        return;
      }
      var s = data.steps[i];
      head.textContent = 'Step ' + (i + 1) + ' of ' + data.steps.length;
      say.textContent = s.say;
      cont.hidden = false; again.hidden = i === 0;
      cont.textContent = i === data.steps.length - 1 ? 'Finish →' : 'Continue →';
      if (!s.ask) { cont.disabled = false; return; }
      cont.disabled = true;
      var why = el('div', { class: 'why', role: 'status' });
      var fs = el('fieldset', { class: 'quiz', style: 'margin-top:1rem' }, [el('legend', { text: s.ask.q })]);
      var btns = [];
      s.ask.options.forEach(function (o, k) {
        var b = el('button', { type: 'button', class: 'opt', text: o.t, onclick: function () {
          btns.forEach(function (x, xi) {
            x.disabled = true;
            if (s.ask.options[xi].ok) { x.classList.add('right'); x.textContent = '✓ ' + s.ask.options[xi].t; }
          });
          if (!o.ok) { b.classList.add('wrong'); b.textContent = '✗ ' + o.t; }
          why.textContent = (o.ok ? 'Yes. ' : 'Not the best next move. ') + o.why + (o.ok ? '' : ' Better: ' + s.ask.options.filter(function (x) { return x.ok; })[0].why);
          cont.disabled = false;
          cont.focus();
        } });
        btns.push(b);
        fs.appendChild(b);
      });
      fs.appendChild(why);
      qbox.appendChild(fs);
    }

    mount.appendChild(el('p', { class: 'small', text: data.intro }));
    mount.appendChild(head);
    mount.appendChild(pre);
    mount.appendChild(say);
    mount.appendChild(qbox);
    mount.appendChild(el('div', { class: 'btn-row' }, [cont, again]));
    go(0);
  };

  /* ---------------- Case A ---------------- */
  var A = {
    intro: 'Yesterday claude worked. This morning, in a new terminal window, it does not.',
    steps: [
      { show: ['% claude', '! zsh: command not found: claude'],
        say: 'From chapter 3: zsh looked for something runnable called claude and found nothing.',
        ask: { q: 'What would you check first?', options: [
          { t: 'Reinstall claude straight away', why: 'It might work, but you learn nothing, and if the real problem is PATH or a second install, you can make things worse by adding another copy.' },
          { t: 'which -a claude   and   type claude', ok: true, why: 'Ask zsh what it can see under that name: every alias, function and runnable file in PATH, from a fresh search.' },
          { t: 'sudo claude', why: 'sudo changes who you are, not how names are looked up. It will not find a command the shell cannot find.' },
          { t: 'Restart the Mac', why: 'Nothing here lives in memory that a restart would fix. The files and PATH will be the same afterwards.' }
        ] } },
      { show: ['% which -a claude', 'claude not found', '% type claude', 'claude not found'],
        say: 'No alias, no function, no runnable file in any PATH folder. Because which -a does a fresh search, a stale hash table is already ruled out.',
        ask: { q: 'The name is nowhere in PATH. What next?', options: [
          { t: 'Look in the folder where the command should be:  ls -la ~/.local/bin', ok: true, why: 'This tool was installed with the native installer, which puts a link in ~/.local/bin (chapter 7). Go and look at that exact spot.' },
          { t: 'rehash', why: 'Harmless, but which -a just searched every folder fresh and still found nothing. Memory is not the problem.' },
          { t: 'chmod +x claude', why: 'chmod needs a file to work on. You have not found any file yet.' },
          { t: 'Add an alias for claude to ~/.zshrc', why: 'An alias to what? You do not yet know where the program is or whether it still exists.' }
        ] } },
      { show: ['% ls -la ~/.local/bin', 'total 0', 'drwxr-xr-x  2 you  staff   64 Nov 24 02:13 .', 'drwxr-xr-x  5 you  staff  160 Nov 20 14:05 ..'],
        say: 'The folder exists and is empty. The link ~/.local/bin/claude is gone. Note the folder was last changed at 02:13, in the middle of the night.',
        ask: { q: 'The link is missing. What do you need to know before choosing a fix?', options: [
          { t: 'Whether the real program is still on disk, and whether PATH still lists ~/.local/bin', ok: true, why: 'A link has two partners: the target it points to and the PATH entry that makes it findable. Check both: ls -la ~/.local/share/claude/versions  and  echo $PATH.' },
          { t: 'Which version of macOS is installed', why: 'Not relevant to a missing file in your home directory.' },
          { t: 'Whether node is installed', why: 'The native install is a self-contained binary. It does not use node.' },
          { t: 'Nothing, just create an empty file called claude there', why: 'An empty, non-executable file named claude in PATH would turn "command not found" into "permission denied" and fix nothing.' }
        ] } },
      { show: ['% ls -la ~/.local/share/claude/versions', 'total 713768', 'drwxr-xr-x  4 you  staff        128 Nov 24 02:13 .', 'drwxr-xr-x  3 you  staff         96 Nov 20 14:05 ..', '-rwxr-xr-x  1 you  staff  182000000 Nov 20 14:05 2.1.0', '-rwxr-xr-x  1 you  staff  183500000 Nov 24 02:13 2.2.0', '% echo $PATH', '/Users/you/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'],
        say: 'Two versions are on disk, both executable. The newer one arrived at 02:13. PATH still starts with ~/.local/bin.',
        ask: { q: 'What is the diagnosis?', options: [
          { t: 'PATH is wrong', why: 'PATH lists ~/.local/bin first. That part is fine.' },
          { t: 'The program was deleted', why: 'Both version files are there, with x set.' },
          { t: 'An update at 02:13 downloaded 2.2.0, removed the old link, and stopped before creating the new one', ok: true, why: 'Binary present, PATH present, link absent, and the timestamps match: the background updater was interrupted at its dangerous moment (chapter 8).' },
          { t: 'A permissions problem', why: 'A permissions problem gives "permission denied", and the files show rwx.' }
        ] } },
      { show: ['# Fix: run the official installer again. It puts the link back.', '% curl -fsSL https://claude.ai/install.sh | bash', '# (the installer prints its progress and finishes)', '% rehash', '% claude --version', '2.2.0 (Claude Code)', '% ls -la ~/.local/bin', 'total 0', 'drwxr-xr-x  3 you  staff   96 Nov 24 09:31 .', 'drwxr-xr-x  5 you  staff  160 Nov 20 14:05 ..', 'lrwxr-xr-x  1 you  staff   45 Nov 24 09:31 claude -> /Users/you/.local/share/claude/versions/2.2.0'],
        say: 'Reinstalling is the safe fix: the installer knows the right layout. Creating the link by hand would also have worked:  ln -s ~/.local/share/claude/versions/2.2.0 ~/.local/bin/claude.  rehash afterwards costs nothing and removes any doubt about stale memory.' }
    ],
    diagnosis: 'The symlink ~/.local/bin/claude was missing. The binary and PATH were both fine. An interrupted self-update removed the link and never recreated it.',
    fix: 'Reinstall with the official installer (or recreate the link with ln -s), then rehash.',
    lesson: '"command not found" does not mean "not installed". Check the name in PATH, then the link, then the target.'
  };

  /* ---------------- Case B ---------------- */
  var B = {
    intro: 'which -a claude showed two installs: the native one and an old npm global one. You decide to remove the npm copy.',
    steps: [
      { show: ['% npm uninstall -g @anthropic-ai/claude-code', '! npm error code ENOTEMPTY', '! npm error syscall rename', '! npm error path ' + NM + '/claude-code', '! npm error dest ' + NM + '/.claude-code-2DTsDk1V', '! npm error errno -66', "! npm error ENOTEMPTY: directory not empty, rename '" + NM + "/claude-code' -> '" + NM + "/.claude-code-2DTsDk1V'"],
        say: 'A wall of red. Read it line by line: "syscall rename" is what npm was doing, "path" is what it tried to rename, "dest" is the new name it wanted.',
        ask: { q: 'What is this error saying?', options: [
          { t: 'The package is not installed', why: 'Then npm would say so, or do nothing. It found the package folder and tried to rename it.' },
          { t: 'npm tried to rename the package folder to a temporary name, and failed because a non-empty folder with that temporary name already exists', ok: true, why: 'ENOTEMPTY = "Error: NOT EMPTY". A rename cannot replace a folder that has things in it. The folder in the way is the "dest" path.' },
          { t: 'You need sudo', why: 'A permissions problem would be EACCES or EPERM. And running npm with sudo in your home folder creates files owned by root, which causes worse problems later.' },
          { t: 'The disk is full', why: 'That would be ENOSPC.' }
        ] } },
      { show: ['# npm removes a package by first renaming its folder to  .NAME-RANDOM  (chapter 8).'],
        say: 'The temporary name starts with a dot, so it is hidden.',
        ask: { q: 'How do you look at what is really in that folder?', options: [
          { t: 'ls ~/.npm-global/lib/node_modules/@anthropic-ai', why: 'Close, but plain ls hides names that start with a dot, and the folder you are hunting is exactly such a name. You would see only claude-code and conclude nothing is wrong.' },
          { t: 'ls -la ~/.npm-global/lib/node_modules/@anthropic-ai', ok: true, why: '-a shows hidden dot-names, -l shows dates and sizes. The folder to look in is the parent of the two paths in the error.' },
          { t: 'npm cache clean --force', why: 'The cache is a different folder (~/.npm). It has nothing to do with the leftover in node_modules.' },
          { t: 'Run the same npm command again', why: 'npm derives that temporary name from the package path, so it picks the same name every time and hits the same wall.' }
        ] } },
      { show: ['% ls -la ~/.npm-global/lib/node_modules/@anthropic-ai', 'total 0', 'drwxr-xr-x   4 you  staff  128 Nov 22 23:41 .', 'drwxr-xr-x   6 you  staff  192 Nov 12 08:15 ..', 'drwxr-xr-x   9 you  staff  288 Nov 22 23:41 .claude-code-2DTsDk1V', 'drwxr-xr-x  11 you  staff  352 Nov 12 08:15 claude-code'],
        say: 'There it is: .claude-code-2DTsDk1V, created Nov 22 at 23:41. Two days ago an npm operation (an update) renamed the old package out of the way and was interrupted before it could delete it. Now that leftover occupies the name npm wants to use.',
        ask: { q: 'What is the fix?', options: [
          { t: 'sudo npm uninstall -g …', why: 'The problem is a folder in the way, not a lack of rights. sudo would hit the same ENOTEMPTY, and may leave root-owned files in your npm folder.' },
          { t: 'Delete all of ~/.npm-global', why: 'That removes every global npm tool you have to fix one leftover folder.' },
          { t: 'Remove the leftover folders by hand with rm -rf, then let npm finish', ok: true, why: 'The leftover is temporary data npm meant to delete anyway. Once it is out of the way the rename can succeed.' },
          { t: 'Reinstall Node', why: 'Node is fine. This is one stray folder.' }
        ] } },
      { show: ['# rm -rf deletes a folder and everything in it, with no undo.', '# Paste the exact paths from the ls output. Never type them from memory.', '% rm -rf ~/.npm-global/lib/node_modules/@anthropic-ai/.claude-code-2DTsDk1V', '% rm -rf ~/.npm-global/lib/node_modules/@anthropic-ai/claude-code', '% ls -la ~/.npm-global/bin', 'total 0', 'drwxr-xr-x  3 you  staff   96 Nov 12 08:15 .', 'drwxr-xr-x  4 you  staff  128 Sep  2 11:40 ..', 'lrwxr-xr-x  1 you  staff   53 Nov 12 08:15 claude -> ../lib/node_modules/@anthropic-ai/claude-code/cli.js', '% rm ~/.npm-global/bin/claude', '% rehash', '% which -a claude', '/Users/you/.local/bin/claude'],
        say: 'Both package folders are removed. Deleting the package by hand left npm\'s command link behind, now dangling (it points into the folder you just removed), so that goes too. which -a now shows exactly one claude: the native one.' }
    ],
    diagnosis: 'An interrupted npm operation left a hidden temp folder, .claude-code-2DTsDk1V. Every later npm command for that package tried to reuse the same temp name and failed with ENOTEMPTY.',
    fix: 'ls -la to see the hidden leftover, rm -rf the leftover folders using the exact paths from the error, remove the dangling link in npm\'s bin, rehash.',
    lesson: 'Read the "path" and "dest" lines of an npm error; they are real folders you can go and look at. Use ls -la, because leftovers hide behind dot-names.'
  };

  /* ---------------- Case C ---------------- */
  var C = {
    intro: 'A terminal window that has been open for days. claude worked in it earlier.',
    steps: [
      { show: ['% claude', '! zsh: permission denied: claude'],
        say: 'Not "command not found" this time. From chapter 5: zsh met something named claude that exists and cannot be run.',
        ask: { q: 'What would you check first?', options: [
          { t: 'sudo claude', why: '"permission denied" here is about a missing execute bit, not about who you are. sudo does not add an x bit, and uses a different PATH.' },
          { t: 'chmod +x claude', why: 'That looks for a file called claude in the folder you are standing in. You do not know yet which file is the problem or where it is.' },
          { t: 'which -a claude', ok: true, why: 'Same first move as always: ask zsh what it can see under that name.' },
          { t: 'Open System Settings → Privacy & Security', why: 'This message comes from zsh and file permission bits, not from macOS privacy controls.' }
        ] } },
      { show: ['% which -a claude', 'claude not found'],
        say: 'Now two messages seem to disagree. Running it: "permission denied", so something is there. which -a: "not found", so nothing is there.',
        ask: { q: 'How can both be true?', options: [
          { t: 'which is broken', why: 'which is doing its job. It lists only things that can actually be run.' },
          { t: 'Something named claude exists in a PATH folder but is not runnable. which skips it; running bumps into it', ok: true, why: 'which -a only lists executables. The run attempt tries each PATH folder, and a non-runnable match turns the final error into "permission denied" (chapter 5).' },
          { t: 'claude has been completely deleted', why: 'Then the run attempt would say "command not found".' },
          { t: 'The terminal needs a password', why: 'Nothing here asks for one.' }
        ] } },
      { show: ['% hash | grep claude', 'claude=/Users/you/.local/bin/claude', '% ls -la ~/.local/bin/claude', '! ls: /Users/you/.local/bin/claude: No such file or directory', '% ls -la ~/.local/share/claude/versions', 'total 355472', 'drwxr-xr-x  3 you  staff         96 Nov 20 14:05 .', 'drwxr-xr-x  3 you  staff         96 Nov 20 14:05 ..', '-rwxr-xr-x  1 you  staff  182000000 Nov 20 14:05 2.1.0'],
        say: 'Three facts. This shell remembers claude at ~/.local/bin/claude (a stale hash entry). That link no longer exists. The real binary, versions/2.1.0, is fine and executable. So the usual route to claude is broken, exactly like case A.',
        ask: { q: 'A missing link alone would give "command not found". Where does "permission denied" come from?', options: [
          { t: 'From the stale hash entry itself', why: 'A remembered path that is now empty makes zsh fall back to searching PATH (chapter 4). On its own that ends in "command not found".' },
          { t: 'From the binary in versions/', why: 'It shows -rwxr-xr-x, and that folder is not in PATH, so zsh never tries it.' },
          { t: 'From some other PATH folder that holds a non-runnable claude. List the name in every PATH folder', ok: true, why: 'After the remembered spot failed, zsh walked the rest of PATH and bumped into a different claude. Find it with:  for d in $path; do ls -la $d/claude; done 2>/dev/null' },
          { t: 'From the terminal app', why: 'The terminal only displays text.' }
        ] } },
      { show: ['% for d in $path; do ls -la $d/claude; done 2>/dev/null', 'lrwxr-xr-x  1 you  staff  53 Nov 22 23:41 /Users/you/.npm-global/bin/claude -> ../lib/node_modules/@anthropic-ai/claude-code/cli.js', '% ls -laL ~/.npm-global/bin/claude', '-rw-r--r--  1 you  staff  11534 Nov 22 23:41 /Users/you/.npm-global/bin/claude'],
        say: 'Found it. A second, half-installed copy from npm: a link in ~/.npm-global/bin whose target cli.js has no x (rw-r--r--). An interrupted npm run never got as far as marking it executable. It was always shadowed by ~/.local/bin, so nobody noticed until the native link vanished.',
        ask: { q: 'What is the quickest correct fix?', options: [
          { t: 'ln -sf ~/.local/share/claude/versions/2.1.0 ~/.local/bin/claude   then   rehash', ok: true, why: 'Put the native link back, pointing at the binary you verified. ~/.local/bin is first in PATH, so zsh succeeds there and never reaches the broken npm copy. rehash clears the stale memory.' },
          { t: 'Only rehash', why: 'rehash clears the memory but the link is still missing, and the next search still ends at the non-runnable npm copy: same error.' },
          { t: 'chmod +x on the npm cli.js', why: 'That would make the old, half-installed npm copy run. You would be using the wrong install, and its files may be incomplete.' },
          { t: 'Remove ~/.npm-global/bin from PATH', why: 'That hides the broken copy and gives "command not found" instead. The native link is still missing.' }
        ] } },
      { show: ['% ln -sf ~/.local/share/claude/versions/2.1.0 ~/.local/bin/claude', '% rehash', '% which -a claude', '/Users/you/.local/bin/claude', '% claude --version', '2.1.0 (Claude Code)', '# Afterwards: remove the half-installed npm copy so it cannot surprise you again (case B).'],
        say: 'Fixed. -s makes a symlink; -f replaces anything already at that name, so the command is safe to repeat. which -a lists only the native copy because the npm one is still not executable; it is still on disk and should be cleaned up.' }
    ],
    diagnosis: 'Three things at once. The native link ~/.local/bin/claude was missing. The long-running shell had a stale hash entry pointing at it. And a half-installed npm copy later in PATH was not executable, which is what turned "command not found" into "permission denied".',
    fix: 'ln -sf the real binary to ~/.local/bin/claude, rehash, then clean up the leftover npm copy.',
    lesson: '"permission denied" together with "which -a: not found" means: something with that name is in PATH and is not runnable. List the name in every PATH folder to find it.'
  };

  [['w-case-a', A], ['w-case-b', B], ['w-case-c', C]].forEach(function (p) {
    var m = document.getElementById(p[0]);
    if (m) SH.replay(m, p[1]);
  });

  SH.quiz('ch9', [
    { q: 'In case A, which finding ruled out "the program was deleted"?',
      options: ['which -a said not found', 'ls -la ~/.local/share/claude/versions listed the version files with x set', 'echo $PATH showed ~/.local/bin', 'rehash printed nothing'], answer: 1,
      why: 'The real binaries were on disk and executable. Only the pointer in the PATH folder was missing.' },
    { q: 'In case B, why did running the same npm command again keep failing?',
      options: ['npm was rate-limited', 'npm reuses the same temporary folder name for that package, and the leftover folder with that name was still there', 'The network was down', 'The hash table was stale'], answer: 1,
      why: 'Nothing changes between attempts until the leftover is removed. The error names the exact folder in its "dest" line.' },
    { q: 'In case B, why was  ls -la  needed and not plain  ls ?',
      options: ['-l is required by npm', 'The leftover folder name starts with a dot, so plain ls hides it', 'Plain ls cannot list node_modules', 'It was not needed'], answer: 1,
      why: 'Temp names like .claude-code-2DTsDk1V are hidden from normal listings. -a shows them.' },
    { q: 'In case C, what does "permission denied" plus "which -a: not found" tell you?',
      options: ['The command is not installed at all', 'A file or link named claude is in a PATH folder but cannot be executed', 'zsh has crashed', 'You typed the name wrong'], answer: 1,
      why: 'which lists only runnable things. A run attempt that meets a non-runnable match reports permission denied.' },
    { q: 'In case C, why would  rehash  alone not have fixed it?',
      options: ['rehash is not a real command', 'rehash only clears the shell\'s memory. The link was still missing and the broken npm copy was still in PATH', 'rehash needs sudo', 'It would have fixed it'], answer: 1,
      why: 'rehash changes no files. The filesystem problem (missing link, non-runnable leftover) has to be repaired first.' }
  ]);
})();
