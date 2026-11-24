/* Chapter 5: permission toggler + quiz. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el;
  var mount = document.getElementById('w-perm');
  if (mount) {
    var mode = 0o644, who = 'u', kind = 'script';
    var WHO = [['u', 'Owner (u)'], ['g', 'Group (g)'], ['o', 'Others (o)']];
    var ACT = [['r', 'Read', 4], ['w', 'Write', 2], ['x', 'Execute', 1]];
    var boxes = {};
    var table = el('table', {}, [el('tr', {}, [el('th')].concat(ACT.map(function (a) { return el('th', { text: a[1] + ' (' + a[0] + '=' + a[2] + ')' }); })).concat([el('th', { text: 'Digit' })]))]);
    var digitCells = {};
    WHO.forEach(function (w, wi) {
      var tr = el('tr', {}, [el('th', { text: w[1] })]);
      ACT.forEach(function (a) {
        var bit = a[2] << (6 - 3 * wi), id = 'perm-' + w[0] + a[0];
        var cb = el('input', { type: 'checkbox', id: id });
        cb.addEventListener('change', function () { mode = cb.checked ? mode | bit : mode & ~bit; update(); });
        boxes[bit] = cb;
        tr.appendChild(el('td', {}, [cb, el('label', { for: id, text: ' ' + a[0], 'aria-label': w[1] + ' ' + a[1] })]));
      });
      digitCells[w[0]] = el('td', { class: 'mono' });
      tr.appendChild(digitCells[w[0]]);
      table.appendChild(tr);
    });

    var lsOut = el('pre', { class: 'out nowrap' });
    var octal = el('input', { type: 'text', class: 'mono', id: 'perm-octal', maxlength: '3', size: '4', inputmode: 'numeric', autocomplete: 'off' });
    octal.addEventListener('input', function () {
      if (/^[0-7]{3}$/.test(octal.value)) { mode = parseInt(octal.value, 8); update(true); }
    });
    var runOut = el('pre', { class: 'out' });
    var verdict = el('p', { class: 'verdict', role: 'status' });
    var presets = el('div', { class: 'chips' });
    [['755', 'programs'], ['644', 'normal files'], ['700', 'private program'], ['600', 'private file'], ['711', 'run but not read'], ['000', 'nothing']].forEach(function (p) {
      presets.appendChild(el('button', { type: 'button', class: 'chip', text: p[0] + ' · ' + p[1], onclick: function () { mode = parseInt(p[0], 8); update(); } }));
    });
    function radios(name, opts, get, set) {
      var fs = el('fieldset', { class: 'inline-form', style: 'border:0;padding:0;margin:.5rem 0' }, [el('legend', { class: 'small', text: name })]);
      opts.forEach(function (o) {
        var id = 'perm-' + o[0];
        var r = el('input', { type: 'radio', name: 'perm-' + name, id: id, checked: get() === o[0] });
        r.addEventListener('change', function () { set(o[0]); update(); });
        fs.appendChild(el('span', {}, [r, el('label', { for: id, text: ' ' + o[1] })]));
      });
      return fs;
    }

    function update(fromOctal) {
      Object.keys(boxes).forEach(function (bit) { boxes[bit].checked = !!(mode & bit); });
      var str = SH.VFS.modeStr({ type: 'file', mode: mode });
      var oct = ('00' + mode.toString(8)).slice(-3);
      WHO.forEach(function (w, wi) {
        var d = (mode >> (6 - 3 * wi)) & 7, parts = [];
        ACT.forEach(function (a) { if (d & a[2]) parts.push(a[2]); });
        digitCells[w[0]].textContent = d + (parts.length > 1 ? ' = ' + parts.join('+') : '');
      });
      if (!fromOctal) octal.value = oct;
      lsOut.textContent = '% ls -l deploy.sh\n' + str + '  1 you  staff  312 Nov 24 10:02 deploy.sh\n\nSame thing as:  chmod ' + oct + ' deploy.sh';
      var shift = who === 'u' ? 6 : who === 'g' ? 3 : 0, mine = (mode >> shift) & 7;
      var whoName = who === 'u' ? 'the owner' : who === 'g' ? 'a member of the group' : 'somebody else';
      var x = mine & 1, r = mine & 4;
      if (!x) {
        SH.renderLines(runOut, [{ t: '% ./deploy.sh', c: 't-prompt' }, { t: 'zsh: permission denied: ./deploy.sh', c: 't-err' }]);
        verdict.className = 'verdict bad';
        verdict.textContent = 'Refused. You are ' + whoName + ', and the execute switch for that audience is off.' +
          (who === 'u' && (mode & 0o011) ? ' Others may have x, but the owner is judged by the owner switches only.' : '');
      } else if (kind === 'script' && !r) {
        SH.renderLines(runOut, [{ t: '% ./deploy.sh', c: 't-prompt' }, { t: '/bin/sh: ./deploy.sh: Permission denied', c: 't-err' }]);
        verdict.className = 'verdict bad';
        verdict.textContent = 'Starts, then fails. The kernel launched the interpreter (/bin/sh), but the interpreter is not allowed to read the script. Scripts need r and x.';
      } else {
        SH.renderLines(runOut, [{ t: '% ./deploy.sh', c: 't-prompt' }, 'deploying…']);
        verdict.className = 'verdict ok';
        verdict.textContent = 'Runs. You are ' + whoName + ' and have ' + (kind === 'script' ? 'read and execute.' : 'execute. A binary does not even need read.');
      }
    }

    mount.appendChild(el('div', { class: 'table-wrap' }, [table]));
    mount.appendChild(el('div', { class: 'inline-form' }, [el('label', { for: 'perm-octal', text: 'Octal (type three digits 0–7)' }), octal]));
    mount.appendChild(presets);
    mount.appendChild(lsOut);
    mount.appendChild(radios('Who is trying to run it?', [['u', 'the owner (you)'], ['g', 'someone in the group'], ['o', 'anyone else']], function () { return who; }, function (v) { who = v; }));
    mount.appendChild(radios('What kind of file is deploy.sh?', [['script', 'a script (text)'], ['binary', 'a compiled binary']], function () { return kind; }, function (v) { kind = v; }));
    mount.appendChild(runOut);
    mount.appendChild(verdict);
    update();
  }

  SH.quiz('ch5', [
    { q: 'ls -l shows  -rw-r--r--  for build.sh, which you own. What happens when you run ./build.sh ?',
      options: ['It runs', 'zsh: command not found: ./build.sh', 'zsh: permission denied: ./build.sh', 'zsh asks for your password'], answer: 2,
      why: 'There is no x anywhere in rw-r--r--. The file exists, so it is not "not found"; the kernel refuses to run it. chmod +x build.sh fixes it.' },
    { q: 'What does  chmod 755 tool  set?',
      options: ['rwxrwxrwx', 'rwxr-xr-x', 'rw-r--r--', 'r-xr-xrwx'], answer: 1,
      why: '7 = 4+2+1 = rwx for the owner. 5 = 4+1 = r-x for the group and for others.' },
    { q: 'In  drwxr-xr-x  what does the first character tell you?',
      options: ['The file is deleted', 'It is a directory', 'It is a device', 'It is dangerous'], answer: 1,
      why: 'The first character is the kind: d for directory, - for a regular file, l for a symlink.' },
    { q: 'cli.js has permissions rw-r--r-- (no x). Why does  node cli.js  still work?',
      options: ['node ignores permissions', 'The program being run is node, which is executable; cli.js only needs to be readable', 'JavaScript files are always executable', 'It does not work'], answer: 1,
      why: 'You asked the shell to run node. node then opens cli.js as data. Execute permission on cli.js only matters when you run cli.js itself.' },
    { q: 'You type  claude  and get "zsh: permission denied: claude", but  which -a claude  prints "claude not found". What does that combination suggest?',
      options: ['claude is not anywhere in PATH', 'Something named claude exists in a PATH folder but cannot be executed', 'Your password expired', 'zsh is broken'], answer: 1,
      why: 'which only lists runnable files, so it sees nothing. But zsh met a non-runnable "claude" (no x bit, or a folder) during its search, so it reports permission denied.' }
  ]);
})();
