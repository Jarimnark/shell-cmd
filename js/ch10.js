/* Chapter 10: guided checklist (decision tree), print button, quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el;

  var T = {
    start: { step: 1, title: 'What does zsh see?', cmd: 'which -a NAME; type NAME', q: 'What did it print?', opts: [
      ['"aliased to…" or a block of shell code', 'alias'],
      ['Exactly one path', 'ls'],
      ['Two or more paths', 'dupes'],
      ['NAME not found', 'expected']] },
    alias: { end: 'ok', title: 'An alias or shell function is answering', text: 'That alias or function runs before any file is considered (chapter 4). If that is not what you want: unalias NAME for this window, and find the line that defines it in ~/.zshrc to remove it for good.' },
    dupes: { step: 1, title: 'Duplicate installs', cmd: 'which -a NAME', text: 'The top line is the copy that runs. The others are shadowed (chapter 7). Decide which install you want and remove the others with the tool that installed them (npm uninstall -g, brew uninstall). For now, continue with the top path.', q: 'Continue with the first path:', opts: [['Check that path', 'ls']] },
    expected: { step: 2, title: 'Nothing runnable in PATH. Look where it should be', cmd: 'ls -la ~/.local/bin/NAME      (or the bin folder of whatever installed it)', q: 'What is there?', opts: [
      ['No such file or directory', 'nolink'],
      ['There IS an entry with that name', 'inpath'],
      ['I do not know where it should be', 'scan']] },
    scan: { step: 4, title: 'Search every PATH folder for the name', cmd: 'for d in $path; do ls -la $d/NAME; done 2>/dev/null', q: 'Any output?', opts: [
      ['Yes, it lists something', 'ls'],
      ['No output at all', 'notinstalled']] },
    notinstalled: { end: 'bad', title: 'Not in PATH anywhere', text: 'Either it is not installed, or it is installed in a folder PATH does not list. Common cases: a global npm tool installed under a different Node version (nvm, chapter 7), or an installer whose PATH line in ~/.zshrc has not been read yet (open a new terminal). Otherwise: install it.' },
    nolink: { step: 2, title: 'The name is missing from the PATH folder', cmd: 'ls -la ~/.local/share/NAME/versions      (wherever the real program is kept)', q: 'Is the real program still on disk?', opts: [
      ['Yes, the real file is there', 'relink'],
      ['No, or I cannot tell', 'reinstall']] },
    relink: { end: 'ok', title: 'Recreate the link', text: 'The program is fine; only its pointer is gone (case study A). Run:  ln -s REAL_FILE ~/.local/bin/NAME   then  rehash.  Reinstalling with the official installer does the same thing for you.' },
    inpath: { step: 4, title: 'It exists, yet which cannot see it', cmd: 'print -l $path', q: 'Is the folder that holds it listed?', opts: [
      ['No, the folder is not in PATH', 'addpath'],
      ['Yes, the folder is listed', 'ls']] },
    addpath: { end: 'ok', title: 'Add the folder to PATH', text: 'Put this line in ~/.zshrc:   export PATH="THE_FOLDER:$PATH"   Then open a new terminal window (or run  source ~/.zshrc). Check with  which -a NAME.' },
    ls: { step: 2, title: 'What is at that spot?', cmd: 'ls -la THE_PATH', q: 'What does the line start with?', opts: [
      ['-rwx…  a regular file with x', 'rehash'],
      ['-rw-…  a regular file without x', 'chmod'],
      ['l…  with an arrow ->  (a symlink)', 'target'],
      ['d…  it is a directory', 'isdir']] },
    chmod: { end: 'ok', title: 'Not executable', text: 'The file is there but its execute switch is off (chapter 5). Run:  chmod +x THE_PATH   If this file came from an installer, a missing x usually means the install was interrupted, and reinstalling is the safer fix.' },
    isdir: { end: 'bad', title: 'A folder has the command\'s name', text: 'A directory sits in a PATH folder under the name of the command. zsh cannot run a folder, so you get "permission denied". It is almost always a leftover. Look inside with ls -la before removing or renaming it.' },
    target: { step: 3, title: 'Is the link\'s target alive?', cmd: 'ls -laL THE_PATH', q: 'What did it print?', opts: [
      ['No such file or directory', 'dangling'],
      ['A file without x  (-rw-…)', 'chmodt'],
      ['A file with x  (-rwx…)', 'rehash']] },
    dangling: { end: 'ok', title: 'Dangling link', text: 'The link points at a file that is gone (chapter 6). If another good version exists on disk, repoint the link:  ln -sf REAL_FILE THE_PATH   Otherwise reinstall. Then rehash.' },
    chmodt: { end: 'ok', title: 'Target is not executable', text: 'The link is fine but the file it points to has no x. That is the mark of a half-finished install or update (chapter 8, case study C). Reinstall, or  chmod +x  the target if you trust that it is complete. Then rehash.' },
    rehash: { step: 5, title: 'Files look healthy. Clear the shell\'s memory', cmd: 'rehash', q: 'Run it and try the command again. Does it work now?', opts: [
      ['Yes', 'stale'],
      ['No', 'newterm']] },
    stale: { end: 'ok', title: 'It was a stale hash table', text: 'The shell was using an outdated remembered location (chapter 4). Nothing on disk was wrong.' },
    newterm: { step: 5, title: 'Try a brand-new terminal window', cmd: '(open a new window, run the command there)', text: 'A new shell re-reads ~/.zshrc, gets a fresh PATH and an empty hash table.', q: 'Does it work in the new window?', opts: [
      ['Yes', 'oldshell'],
      ['No', 'reinstall']] },
    oldshell: { end: 'ok', title: 'The old window had old settings', text: 'That shell started before PATH or the install changed. Close old windows after installing or updating tools.' },
    reinstall: { end: 'warn', title: 'Reinstall cleanly', text: 'Remove every other copy first (which -a NAME, uninstall each with its own tool). Run the official installer once. Then  rehash  and  which -a NAME  to confirm there is exactly one path. If the error mentions a scripting language ("env: node: No such file or directory"), the missing piece is the interpreter, not this tool: run the checklist on that name.' }
  };

  var mount = document.getElementById('w-check');
  if (mount) {
    var trail, name = 'claude';
    var nameIn = el('input', { type: 'text', class: 'mono', id: 'check-name', value: name, size: '12', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var crumbs = el('ol', { class: 'steps' });
    var body = el('div', { role: 'status' });
    nameIn.addEventListener('input', function () { name = nameIn.value.trim() || 'NAME'; draw(); });
    function sub(s) { return s.replace(/NAME/g, name); }
    function draw() {
      var id = trail[trail.length - 1], n = T[id];
      SH.clear(crumbs);
      trail.forEach(function (t, i) { crumbs.appendChild(el('li', { class: i === trail.length - 1 ? 'cur' : 'past', text: T[t].title })); });
      SH.clear(body);
      body.appendChild(el('h4', { text: (n.step ? 'Check ' + n.step + ' of 6: ' : n.end === 'ok' ? '✓ ' : '') + n.title }));
      if (n.cmd) body.appendChild(SH.renderLines(el('pre', { class: 'out' }), [{ t: '% ' + sub(n.cmd), c: 't-prompt' }]));
      if (n.text) body.appendChild(el('p', { class: n.end ? 'verdict ' + n.end : '', text: sub(n.text) }));
      if (n.q) {
        body.appendChild(el('p', { text: n.q, style: 'margin-top:.75rem;font-weight:650' }));
        n.opts.forEach(function (o) {
          body.appendChild(el('button', { type: 'button', class: 'opt', text: sub(o[0]), onclick: function () { trail.push(o[1]); draw(); } }));
        });
      }
      back.disabled = trail.length < 2;
    }
    var back = SH.btn('← Back one step', function () { trail.pop(); draw(); });
    var restart = SH.btn('Start over', function () { trail = ['start']; draw(); });
    mount.appendChild(el('div', { class: 'inline-form' }, [el('label', { for: 'check-name', text: 'Command that is failing' }), nameIn]));
    mount.appendChild(crumbs);
    mount.appendChild(body);
    mount.appendChild(el('div', { class: 'btn-row' }, [back, restart]));
    trail = ['start'];
    draw();
  }

  var pb = document.getElementById('print-checklist');
  if (pb) {
    pb.addEventListener('click', function () {
      document.body.classList.add('print-checklist');
      window.print();
      setTimeout(function () { document.body.classList.remove('print-checklist'); }, 500);
    });
  }

  SH.quiz('ch10', [
    { q: 'A command stops working. What is the first check?',
      options: ['Reinstall it', 'which -a NAME  (and type NAME)', 'Restart the Mac', 'chmod 777 on everything'], answer: 1,
      why: 'Start by asking zsh what it sees. The answer (alias, one path, several paths, nothing) decides every later step.' },
    { q: 'ls -la shows the entry starts with  l  and has an arrow. What do you check next?',
      options: ['PATH', 'Whether the arrow\'s target exists and is executable:  ls -laL', 'The hash table', 'Your npm prefix'], answer: 1,
      why: 'A symlink is only as good as its target. -L follows the link and reports on the real file, or fails if it is gone.' },
    { q: 'Why does "reinstall" come last on the checklist?',
      options: ['Reinstalling is slow', 'Reinstalling without understanding can add a second copy or hide the real cause, such as PATH order', 'Installers are unsafe', 'It never works'], answer: 1,
      why: 'The earlier checks take seconds and tell you what is wrong. Then a reinstall, if still needed, is done once and cleanly.' }
  ]);
})();
