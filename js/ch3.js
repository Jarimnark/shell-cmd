/* Chapter 3: fake terminal, PATH search only + quiz. */
(function () {
  'use strict';
  var SH = window.SH;
  var mount = document.getElementById('w-term3');
  if (mount) {
    SH.terminal(mount, {
      stages: ['path'],
      make: function () { return SH.world({ aliases: {}, functions: {}, useHash: false }); },
      suggestions: ['echo $PATH', 'claude', 'git', 'node', 'nope', 'ls ~/.local/bin', 'PATH=/usr/bin:/bin', 'help'],
      intro: ['A pretend Mac. Nothing here touches your real computer.', 'Type "help" to see what this simulator understands.']
    });
  }

  SH.quiz('ch3', [
    { q: 'PATH is  /opt/homebrew/bin:/usr/bin:/bin  and both /opt/homebrew/bin and /usr/bin contain a file called git. Which one runs when you type git?',
      options: ['/usr/bin/git, because it came with macOS', '/opt/homebrew/bin/git, because that folder is earlier in PATH', 'The newer of the two', 'zsh asks you which one'], answer: 1,
      why: 'The search goes left to right and stops at the first match. Age, version and origin play no part.' },
    { q: 'What does "zsh: command not found: foo" tell you for certain?',
      options: ['foo is not installed anywhere on this Mac', 'No folder in PATH contains a runnable file called foo', 'foo is installed but broken', 'You lack permission to run foo'], answer: 1,
      why: 'It only reports the result of the search. foo may well exist in a folder that PATH does not list.' },
    { q: 'What does this line in ~/.zshrc do?   export PATH="$HOME/bin:$PATH"',
      options: ['Replaces PATH with just ~/bin', 'Adds ~/bin to the end of PATH', 'Adds ~/bin to the front of PATH, so it is searched first', 'Creates the folder ~/bin'], answer: 2,
      why: 'The new value is ~/bin, a colon, then the old PATH. In front means searched first.' },
    { q: 'You add a PATH line to ~/.zshrc, save, and the already-open terminal still says "command not found". Why?',
      options: ['~/.zshrc is only read when a shell starts; this shell started before your edit', 'You must restart the Mac', 'PATH changes need sudo', 'zsh ignores ~/.zshrc'], answer: 0,
      why: 'Open a new terminal window, or run  source ~/.zshrc  to make the current shell read the file again.' },
    { q: 'Why do you type  ./deploy.sh  and not just  deploy.sh  for a script in the current folder?',
      options: ['The ./ makes it run faster', 'The current folder is not in PATH; a name with a slash is used as a path directly', 'Scripts always need ./', 'It is only a convention'], answer: 1,
      why: 'A bare name triggers the PATH search, and the current folder is not on that list. A slash means "this exact file, do not search".' }
  ]);
})();
