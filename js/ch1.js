/* Chapter 1: life of a command (stepper) + quiz. Also defines the reusable SH.stepper. */
(function () {
  'use strict';
  var SH = window.SH, el = SH.el;

  /* Generic stepper: Back / Next buttons, a row of step pills, and a body the caller renders. */
  SH.stepper = function (mount, labels, render) {
    var i = 0;
    var pills = el('ol', { class: 'steps' });
    var body = el('div', { role: 'status' });
    var back = SH.btn('← Back', function () { go(i - 1); });
    var next = SH.btn('Next →', function () { go(i + 1); }, 'primary');
    function go(n) {
      i = Math.max(0, Math.min(labels.length - 1, n));
      SH.clear(pills);
      labels.forEach(function (l, k) {
        pills.appendChild(el('li', { class: k === i ? 'cur' : k < i ? 'past' : '', text: (k + 1) + '. ' + l, 'aria-current': k === i ? 'step' : null }));
      });
      back.disabled = i === 0;
      next.disabled = i === labels.length - 1;
      SH.clear(body);
      render(i, body);
    }
    mount.appendChild(pills);
    mount.appendChild(body);
    mount.appendChild(el('div', { class: 'btn-row' }, [back, next, SH.btn('Start over', function () { go(0); })]));
    go(0);
    return { go: go };
  };

  var BOXES = ['You (keyboard)', 'Terminal app', 'zsh (the shell)', 'macOS kernel', 'claude (new process)'];
  var STEPS = [
    { label: 'Type', on: [0, 1], text: 'You type c-l-a-u-d-e. The terminal app passes each key to zsh, and zsh echoes the letters back so you can see them. Nothing has run yet.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }] },
    { label: 'Enter', on: [1, 2], text: 'You press Enter. That tells zsh: "the line is finished, go". zsh now has the text "claude" to deal with.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }] },
    { label: 'Split', on: [2], text: 'zsh cuts the line into words. There is one word here: "claude". The first word is the name of the thing to run. With "claude --version" there would be a second word, an argument.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }, { t: '  word 1 (what to run): claude', c: 't-dim' }] },
    { label: 'Find', on: [2], text: 'zsh works out what "claude" refers to. Is it a nickname? Something built into zsh? If not, it must be a program file, and zsh goes looking for a file with that name in a fixed list of folders. Chapters 3 and 4 cover this search. If the search fails you get "command not found" and the story ends here.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }, { t: '  found: /Users/you/.local/bin/claude', c: 't-dim' }] },
    { label: 'Start', on: [2, 3, 4], text: 'zsh asks the kernel to start that file as a new process. The kernel checks you are allowed to run it (chapter 5). If yes, a new process is born. If no, you get "permission denied".',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }] },
    { label: 'Run', on: [4, 1], text: 'The claude process runs. Whatever it prints goes to the terminal, which draws it. zsh is still there, but it waits quietly until claude finishes.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }, '(claude is running and printing here)'] },
    { label: 'Finish', on: [4, 2], text: 'claude ends and hands back an exit code (0 = fine). zsh wakes up, prints a fresh prompt, and waits for your next line.',
      screen: [{ t: 'you@mac ~ % claude', c: 't-prompt' }, '(claude is running and printing here)', { t: 'you@mac ~ % ▌', c: 't-prompt' }] }
  ];

  var mount = document.getElementById('w-life');
  if (mount) {
    SH.stepper(mount, STEPS.map(function (s) { return s.label; }), function (i, body) {
      var s = STEPS[i], flow = el('div', { class: 'flow', 'aria-hidden': 'true' });
      BOXES.forEach(function (b, k) {
        if (k) flow.appendChild(el('span', { class: 'arrow', text: '→' }));
        flow.appendChild(el('span', { class: 'box' + (s.on.indexOf(k) !== -1 ? ' on' : ''), text: b }));
      });
      body.appendChild(flow);
      body.appendChild(el('p', { text: s.text }));
      body.appendChild(SH.renderLines(el('pre', { class: 'out' }), s.screen));
    });
  }

  SH.quiz('ch1', [
    { q: 'You open Terminal.app and see a prompt ending in %. Which program printed that prompt?',
      options: ['The terminal app', 'The shell (zsh)', 'The macOS kernel', 'The last program you ran'], answer: 1,
      why: 'The terminal only draws text. The prompt is text that zsh, running inside the terminal, printed.' },
    { q: 'What is the difference between a program and a process?',
      options: ['They are two words for the same thing', 'A program is a file on disk; a process is a program that is currently running', 'A process is a file on disk; a program is running', 'Programs are written in Go, processes in zsh'], answer: 1,
      why: 'The file is the program. Each time it is started, the running copy is a process. One program can be many processes.' },
    { q: 'In the command  npm install -g typescript  which word does the shell try to find and run?',
      options: ['typescript', 'install', 'npm', 'All four words, one after another'], answer: 2,
      why: 'Only the first word names what to run. The other three words are arguments handed to npm; the shell does not look them up.' },
    { q: 'Who actually starts the new process?',
      options: ['The terminal app', 'zsh, entirely on its own', 'The kernel, when the shell asks it to', 'The program starts itself'], answer: 2,
      why: 'The shell finds the file and asks. The kernel checks permissions and creates the process.' }
  ]);
})();
