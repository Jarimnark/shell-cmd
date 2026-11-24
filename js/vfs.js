/* A tiny fake filesystem and a tiny fake zsh. Pure logic, no DOM.
   The lookup rules were checked against real zsh 5.9 (the version macOS ships). */
(function () {
  'use strict';
  var SH = window.SH;

  /* ================= Filesystem ================= */
  function VFS() {
    this.n = new Map();
    this.n.set('/', { type: 'dir', mode: 0o755, owner: 'root' });
  }
  VFS.dirname = function (p) { var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); };
  VFS.basename = function (p) { return p.slice(p.lastIndexOf('/') + 1); };
  VFS.normalize = function (p) {
    var out = [];
    p.split('/').forEach(function (s) {
      if (!s || s === '.') return;
      if (s === '..') out.pop(); else out.push(s);
    });
    return '/' + out.join('/');
  };
  VFS.modeStr = function (nd) {
    var t = nd.type === 'dir' ? 'd' : nd.type === 'link' ? 'l' : '-';
    var s = '';
    for (var i = 8; i >= 0; i--) s += (nd.mode >> i) & 1 ? 'rwx'[(8 - i) % 3] : '-';
    return t + s;
  };
  VFS.prototype = {
    clone: function () {
      var v = new VFS();
      this.n.forEach(function (val, k) { v.n.set(k, Object.assign({}, val)); });
      return v;
    },
    mkdirp: function (p, owner) {
      if (this.n.has(p)) return;
      this.mkdirp(VFS.dirname(p), owner);
      this.n.set(p, { type: 'dir', mode: 0o755, owner: owner || 'you' });
    },
    file: function (p, o) {
      o = o || {};
      this.mkdirp(VFS.dirname(p), o.owner);
      this.n.set(p, Object.assign({ type: 'file', mode: 0o755, owner: 'you', size: 4096, out: '' }, o));
      return this;
    },
    link: function (p, target, owner) {
      this.mkdirp(VFS.dirname(p), owner);
      this.n.set(p, { type: 'link', mode: 0o755, owner: owner || 'you', target: target });
      return this;
    },
    lstat: function (p) { return this.n.get(p) || null; },
    /* Follow symlinks on the last path component. Returns the real path or null. */
    real: function (p, depth) {
      var nd = this.n.get(p);
      if (!nd) return null;
      if (nd.type !== 'link') return p;
      if ((depth || 0) > 8) return null;
      var t = nd.target.charAt(0) === '/' ? nd.target : VFS.dirname(p) + '/' + nd.target;
      return this.real(VFS.normalize(t), (depth || 0) + 1);
    },
    stat: function (p) { var r = this.real(p); return r ? this.n.get(r) : null; },
    children: function (d) {
      var pre = d === '/' ? '/' : d + '/', out = [];
      this.n.forEach(function (_, k) {
        if (k !== '/' && k.indexOf(pre) === 0 && k.indexOf('/', pre.length) === -1) out.push(k);
      });
      return out.sort();
    },
    rm: function (p) {
      var self = this, pre = p + '/';
      Array.from(this.n.keys()).forEach(function (k) { if (k === p || k.indexOf(pre) === 0) self.n.delete(k); });
    },
    mv: function (a, b) {
      var self = this, pre = a + '/';
      this.mkdirp(VFS.dirname(b));
      Array.from(this.n.keys()).forEach(function (k) {
        if (k === a || k.indexOf(pre) === 0) {
          var nd = self.n.get(k);
          self.n.delete(k);
          self.n.set(b + k.slice(a.length), nd);
        }
      });
    },
    /* What the operating system says when asked to run this path. */
    tryExec: function (p) {
      var nd = this.lstat(p);
      if (!nd) return { err: 'ENOENT' };
      var r = this.real(p);
      if (!r) return { err: 'ENOENT', dangling: true };
      var t = this.n.get(r);
      if (t.type === 'dir') return { err: 'EACCES', isDir: true };
      if (!(t.mode & 0o100)) return { err: 'EACCES', viaLink: nd.type === 'link' };
      return { ok: true, real: r, node: t, viaLink: nd.type === 'link' };
    },
    lsLine: function (p, name) {
      var nd = this.lstat(p);
      var size = nd.type === 'link' ? nd.target.length : nd.type === 'dir' ? 96 : nd.size;
      var owner = nd.owner || 'you';
      var s = VFS.modeStr(nd) + '  1 ' + (owner + '    ').slice(0, 4) + '  ' + (owner === 'root' ? 'wheel' : 'staff') +
        '  ' + String(size).padStart(9) + ' Nov 24 10:02 ' + name;
      if (nd.type === 'link') s += ' -> ' + nd.target;
      return s;
    }
  };
  SH.VFS = VFS;

  /* ================= Shell ================= */
  var BUILTINS = ['echo', 'cd', 'pwd', 'which', 'type', 'whence', 'hash', 'rehash', 'alias', 'unalias', 'export', 'source', 'exit'];

  function Shell(o) {
    this.fs = o.fs;
    this.home = o.home || '/Users/you';
    this.cwd = o.cwd || this.home;
    this.path = (o.path || []).slice();
    this.aliases = Object.assign({}, o.aliases);
    this.functions = Object.assign({}, o.functions);
    this.hash = {};
    this.useHash = o.useHash !== false;
    this.mode = o.mode || 'zsh';
    this.rc = 0;
  }
  Shell.BUILTINS = BUILTINS;
  var err = function (t) { return { t: t, c: 't-err' }; };
  var dim = function (t) { return { t: t, c: 't-dim' }; };

  Shell.prototype = {
    abs: function (p) {
      if (p === '~') p = this.home;
      else if (p.indexOf('~/') === 0) p = this.home + p.slice(1);
      else if (p.charAt(0) !== '/') p = this.cwd + '/' + p;
      return VFS.normalize(p);
    },
    tilde: function (p) {
      if (p === this.home) return '~';
      return p.indexOf(this.home + '/') === 0 ? '~' + p.slice(this.home.length) : p;
    },
    prompt: function () {
      var d = this.cwd === this.home ? '~' : VFS.basename(this.cwd) || '/';
      return this.mode === 'bash' ? 'mac:' + d + ' you$' : 'you@mac ' + d + ' %';
    },
    isBuiltin: function (n) { return BUILTINS.indexOf(n) !== -1; },

    /* Split a line into words. Handles quotes, $PATH / $HOME, and a leading ~ */
    tokenize: function (line) {
      var self = this, out = [], cur = '', has = false, q = null, single = false, i, c;
      function push() {
        if (!has) return;
        var v = cur;
        if (!single) {
          v = v.replace(/\$\{?(\w+|\?)\}?/g, function (_, name) {
            if (name === 'PATH') return self.path.join(':');
            if (name === 'HOME') return self.home;
            if (name === 'USER') return 'you';
            if (name === 'SHELL') return '/bin/zsh';
            if (name === 'PWD') return self.cwd;
            if (name === '?') return String(self.rc);
            return '';
          });
          if (v === '~' || v.indexOf('~/') === 0) v = self.home + v.slice(1);
          v = v.replace(/([=:])~(?=\/|:|$)/g, '$1' + self.home);
        }
        out.push(v);
        cur = ''; has = false; single = false;
      }
      for (i = 0; i < line.length; i++) {
        c = line.charAt(i);
        if (q) { if (c === q) q = null; else cur += c; }
        else if (c === '"' || c === "'") { q = c; has = true; if (c === "'") single = true; }
        else if (c === ' ' || c === '\t') push();
        else if (c === ';') { push(); out.push({ op: ';' }); }
        else if (c === '&' && line.charAt(i + 1) === '&') { push(); out.push({ op: '&&' }); i++; }
        else { cur += c; has = true; }
      }
      push();
      return out;
    },

    /* The heart of the site: how the shell decides what a command name means.
       Returns { steps: [...for the animation], res: what to do }. */
    lookup: function (name, skipAlias) {
      var fs = this.fs, sh = this.mode, steps = [], self = this, r, p;
      if (name.indexOf('/') !== -1) {
        p = this.abs(name);
        r = fs.tryExec(p);
        steps.push({ stage: 'direct', status: r.ok ? 'hit' : 'miss',
          note: '"' + name + '" contains a slash, so the shell treats it as a path to one exact file. No alias check, no PATH search.' });
        if (r.ok) return { steps: steps, res: { kind: 'exec', path: p, real: r.real, node: r.node } };
        return { steps: steps, res: { kind: 'error', rc: r.err === 'ENOENT' ? 127 : 126,
          msg: sh + ': ' + (r.err === 'ENOENT' ? 'no such file or directory' : 'permission denied') + ': ' + name } };
      }
      if (!skipAlias && this.aliases[name] != null) {
        steps.push({ stage: 'alias', status: 'hit', note: '"' + name + '" is an alias. The shell swaps it for: ' + this.aliases[name] });
        return { steps: steps, res: { kind: 'alias', text: this.aliases[name] } };
      }
      steps.push({ stage: 'alias', status: 'miss', note: skipAlias ? 'Alias already expanded once; not expanded again.' : 'No alias called "' + name + '".' });
      if (this.functions[name]) {
        steps.push({ stage: 'function', status: 'hit', note: '"' + name + '" is a shell function. zsh runs its body itself; no file is involved.' });
        return { steps: steps, res: { kind: 'function' } };
      }
      steps.push({ stage: 'function', status: 'miss', note: 'No shell function called "' + name + '".' });
      if (this.isBuiltin(name)) {
        steps.push({ stage: 'builtin', status: 'hit', note: '"' + name + '" is built into the shell. It runs right inside zsh; no file on disk is needed.' });
        return { steps: steps, res: { kind: 'builtin' } };
      }
      steps.push({ stage: 'builtin', status: 'miss', note: '"' + name + '" is not a builtin. So it must be a program file somewhere.' });

      var denied = false;
      if (this.useHash) {
        var h = this.hash[name];
        if (h) {
          r = fs.tryExec(h);
          if (r.ok) {
            steps.push({ stage: 'hash', status: 'hit', note: 'The shell remembers finding it at ' + this.tilde(h) + ' and runs that straight away. PATH is not searched.' });
            return { steps: steps, res: { kind: 'exec', path: h, real: r.real, node: r.node, fromHash: true } };
          }
          if (sh === 'bash') {
            steps.push({ stage: 'hash', status: 'stale', note: 'bash remembers ' + this.tilde(h) + ' but nothing runnable is there any more. bash gives up here; it does not search PATH again.' });
            return { steps: steps, res: { kind: 'error', rc: 127, msg: 'bash: ' + h + ': No such file or directory' } };
          }
          if (r.err === 'EACCES') denied = true;
          steps.push({ stage: 'hash', status: 'stale', note: 'The shell remembers ' + this.tilde(h) + ', but that spot ' +
            (r.err === 'EACCES' ? 'cannot be executed' : 'is empty now') + '. The memory is stale. zsh falls back to a full PATH search.' });
        } else {
          steps.push({ stage: 'hash', status: 'miss', note: 'Nothing remembered for "' + name + '" yet.' });
        }
      }
      for (var i = 0; i < this.path.length; i++) {
        var dir = this.path[i];
        p = dir.replace(/\/$/, '') + '/' + name;
        r = fs.tryExec(p);
        if (r.ok) {
          steps.push({ stage: 'path', index: i, status: 'hit', note: 'Found ' + this.tilde(p) +
            (r.viaLink ? ' (a symlink to ' + this.tilde(r.real) + ')' : '') + '. Search stops here; folders further right are never looked at.' });
          if (this.useHash && !this.hash[name]) this.hash[name] = p;
          return { steps: steps, res: { kind: 'exec', path: p, real: r.real, node: r.node } };
        }
        if (r.err === 'EACCES') {
          denied = true;
          steps.push({ stage: 'path', index: i, status: 'denied', note: 'Something called "' + name + '" is in ' + this.tilde(dir) + ', but it ' +
            (r.isDir ? 'is a folder, not a program' : 'has no execute permission') + '. The shell remembers this failure and keeps looking.' });
        } else if (r.dangling) {
          steps.push({ stage: 'path', index: i, status: 'dangling', note: 'There is a symlink called "' + name + '" in ' + this.tilde(dir) + ', but its target is missing (a dangling link). Counts as not found; keep looking.' });
        } else {
          steps.push({ stage: 'path', index: i, status: 'miss', note: (fs.lstat(dir.replace(/\/$/, '') || '/') ? 'No "' + name + '" in ' : 'Folder does not exist: ') + this.tilde(dir) + '.' });
        }
      }
      var msg;
      if (sh === 'bash') msg = 'bash: ' + name + (denied ? ': Permission denied' : ': command not found');
      else msg = 'zsh: ' + (denied ? 'permission denied: ' : 'command not found: ') + name;
      steps.push({ stage: 'end', status: denied ? 'denied' : 'miss', note: denied
        ? 'Reached the end of PATH. Nothing could be run, but something un-runnable with that name was seen on the way, so the error is "permission denied".'
        : 'Reached the end of PATH with no match anywhere: "command not found".' });
      return { steps: steps, res: { kind: 'error', rc: denied ? 126 : 127, msg: msg } };
    },

    /* Run a full line. Returns { out: [lines], trace: [steps] or null, clear: bool } */
    exec: function (line) {
      var tokens = this.tokenize(line), cmds = [[]], ops = [], out = [], trace = null, clear = false, self = this;
      tokens.forEach(function (t) {
        if (typeof t === 'object') { ops.push(t.op); cmds.push([]); } else cmds[cmds.length - 1].push(t);
      });
      for (var i = 0; i < cmds.length; i++) {
        if (!cmds[i].length) continue;
        if (i > 0 && ops[i - 1] === '&&' && this.rc !== 0) continue;
        var r = this.runSimple(cmds[i], 0, false);
        out = out.concat(r.out);
        if (r.trace) trace = trace ? trace.concat([{ stage: 'again', note: 'Next command on the line: ' + cmds[i][0] }], r.trace) : r.trace;
        if (r.clear) clear = true;
      }
      return { out: out, trace: trace, clear: clear };
    },

    runSimple: function (tokens, depth, skipAlias) {
      var name = tokens[0], args = tokens.slice(1), m;
      this.rc = 0;
      if ((m = /^([A-Za-z_]\w*)=(.*)$/.exec(name))) return { out: this.assign(m[1], m[2]), trace: null };
      if (name === 'help') return { out: this.help(), trace: null };
      var lk = this.lookup(name, skipAlias), res = lk.res, out;
      switch (res.kind) {
        case 'alias': {
          var sub = this.tokenize(res.text).filter(function (t) { return typeof t === 'string'; }).concat(args);
          var r = this.runSimple(sub, depth + 1, sub[0] === name || depth >= 4);
          return { out: r.out, clear: r.clear, trace: lk.steps.concat([{ stage: 'again', note: 'The line is now "' + sub.join(' ') + '". Look up "' + sub[0] + '" from the top.' }], r.trace || []) };
        }
        case 'function': out = [this.functions[name].out || '(function ran)']; break;
        case 'builtin': out = this.builtin(name, args); break;
        case 'exec':
          if (res.node.prog && this.progs[res.node.prog]) out = this.progs[res.node.prog].call(this, args);
          else out = [dim('[ran ' + this.tilde(res.real) + ']')].concat(res.node.out ? [res.node.out] : []);
          if (out.clear) return { out: [], trace: lk.steps, clear: true };
          break;
        default: this.rc = res.rc; out = [err(res.msg)];
      }
      return { out: out, trace: lk.steps };
    },

    assign: function (name, value) {
      if (name !== 'PATH') return [dim('(simulator: only PATH can be set)')];
      this.path = value.split(':').filter(Boolean);
      this.hash = {}; /* real zsh also forgets its cache when PATH changes */
      return [];
    },
    help: function () {
      return [dim('Simulator commands:'),
        '  echo $PATH        which [-a] NAME    type NAME',
        '  hash              rehash             alias [NAME=TEXT]',
        '  ls [-la] [PATH]   cat FILE           cd DIR   pwd',
        '  chmod +x FILE     chmod 755 FILE     ln -s[f] TARGET LINK',
        '  mv FROM TO        rm [-r] PATH       mkdir DIR   touch FILE',
        '  PATH=/a:/b        clear',
        dim('Anything else is looked up like a real program name.')];
    },

    findInPath: function (name, all) {
      var found = [];
      for (var i = 0; i < this.path.length; i++) {
        var p = this.path[i].replace(/\/$/, '') + '/' + name;
        if (this.fs.tryExec(p).ok && found.indexOf(p) === -1) { found.push(p); if (!all) break; }
      }
      return found;
    },
    describe: function (name, all, style) {
      var lines = [], self = this;
      function add(kind, extra) {
        if (style === 'type') lines.push(name + ' is ' + (kind === 'alias' ? 'an alias for ' + extra : kind === 'function' ? 'a shell function' : kind === 'builtin' ? 'a shell builtin' : extra));
        else lines.push(kind === 'alias' ? name + ': aliased to ' + extra : kind === 'function' ? name + ' () {\n\t' + extra + '\n}' : kind === 'builtin' ? name + ': shell built-in command' : extra);
      }
      if (this.aliases[name] != null) { add('alias', this.aliases[name]); if (!all) return lines; }
      if (this.functions[name]) { add('function', this.functions[name].body); if (!all) return lines; }
      if (this.isBuiltin(name)) { add('builtin'); if (!all) return lines; }
      var h = this.hash[name], paths;
      if (!all && this.useHash && h && this.fs.tryExec(h).ok) paths = [h];
      else paths = this.findInPath(name, all);
      paths.forEach(function (p) { add('path', p); });
      if (!lines.length) { this.rc = 1; lines.push(name + ' not found'); }
      return lines;
    },

    builtin: function (name, args) {
      var self = this, fs = this.fs, out = [];
      switch (name) {
        case 'echo': return [args.join(' ')];
        case 'pwd': return [this.cwd];
        case 'cd': {
          var p = this.abs(args[0] || '~'), st = fs.stat(p);
          if (!st) { this.rc = 1; return [err('cd: no such file or directory: ' + args[0])]; }
          if (st.type !== 'dir') { this.rc = 1; return [err('cd: not a directory: ' + args[0])]; }
          this.cwd = fs.real(p);
          return [];
        }
        case 'which': case 'whence': case 'type': {
          var all = false, names = [];
          args.forEach(function (a) { if (a.charAt(0) === '-') { if (a.indexOf('a') !== -1) all = true; } else names.push(a); });
          if (!names.length) return [dim('usage: ' + name + ' [-a] NAME')];
          names.forEach(function (n) { out = out.concat(self.describe(n, all, name === 'type' ? 'type' : 'which')); });
          return out;
        }
        case 'rehash': this.hash = {}; return [];
        case 'hash':
          if (args[0] === '-r') { this.hash = {}; return []; }
          return Object.keys(this.hash).sort().map(function (k) { return k + '=' + self.hash[k]; });
        case 'alias':
          if (!args.length) return Object.keys(this.aliases).sort().map(function (k) { return k + "='" + self.aliases[k] + "'"; });
          args.forEach(function (a) {
            var i = a.indexOf('=');
            if (i > 0) self.aliases[a.slice(0, i)] = a.slice(i + 1);
            else if (self.aliases[a] != null) out.push(a + "='" + self.aliases[a] + "'");
          });
          return out;
        case 'unalias':
          args.forEach(function (a) {
            if (self.aliases[a] == null) { self.rc = 1; out.push(err('unalias: no such hash table element: ' + a)); } else delete self.aliases[a];
          });
          return out;
        case 'export':
          args.forEach(function (a) { var m = /^(\w+)=(.*)$/.exec(a); if (m) out = out.concat(self.assign(m[1], m[2])); });
          return out;
        default: return [dim('(simulator: "' + name + '" is a real zsh builtin, but it is not simulated here)')];
      }
    },

    /* Programs that live in the fake /bin and /usr/bin. `this` is the shell. */
    progs: {
      clear: function () { var o = []; o.clear = true; return o; },
      ls: function (args) {
        var self = this, fs = this.fs, long = false, all = false, targets = [], out = [];
        args.forEach(function (a) {
          if (a.charAt(0) === '-') { if (a.indexOf('l') !== -1) long = true; if (a.indexOf('a') !== -1) all = true; } else targets.push(a);
        });
        if (!targets.length) targets = ['.'];
        targets.forEach(function (t) {
          var p = self.abs(t), nd = fs.lstat(p);
          if (!nd) { self.rc = 1; out.push(err('ls: ' + t + ': No such file or directory')); return; }
          var st = fs.stat(p);
          var isDir = nd.type === 'dir' || (nd.type === 'link' && !long && st && st.type === 'dir');
          if (!isDir) { out.push(long ? fs.lsLine(p, t) : t); return; }
          var d = fs.real(p);
          var kids = fs.children(d).filter(function (k) { return all || VFS.basename(k).charAt(0) !== '.'; });
          if (targets.length > 1) out.push(t + ':');
          if (long) {
            out.push('total ' + kids.length * 8);
            if (all) { out.push(fs.lsLine(d, '.')); out.push(fs.lsLine(VFS.dirname(d), '..')); }
            kids.forEach(function (k) { out.push(fs.lsLine(k, VFS.basename(k))); });
          } else if (kids.length) out.push(kids.map(VFS.basename).join('    '));
        });
        return out;
      },
      cat: function (args) {
        var self = this, out = [];
        args.forEach(function (a) {
          var st = self.fs.stat(self.abs(a));
          if (!st) { self.rc = 1; out.push(err('cat: ' + a + ': No such file or directory')); }
          else if (st.type === 'dir') { self.rc = 1; out.push(err('cat: ' + a + ': Is a directory')); }
          else out.push(st.text || dim('(binary data, not readable text)'));
        });
        return out;
      },
      chmod: function (args) {
        var self = this, spec = args[0], out = [];
        if (args.length < 2) return [dim('usage: chmod MODE FILE')];
        args.slice(1).forEach(function (a) {
          var st = self.fs.stat(self.abs(a));
          if (!st) { self.rc = 1; out.push(err('chmod: ' + a + ': No such file or directory')); return; }
          var m = SH.applyMode(st.mode, spec);
          if (m == null) { self.rc = 1; out.push(err('chmod: Invalid file mode: ' + spec)); } else st.mode = m;
        });
        return out;
      },
      ln: function (args) {
        var fs = this.fs, flags = '', rest = [];
        args.forEach(function (a) { if (a.charAt(0) === '-') flags += a.slice(1); else rest.push(a); });
        if (flags.indexOf('s') === -1) return [dim('(simulator: only "ln -s TARGET LINK" is supported)')];
        if (rest.length < 2) return [dim('usage: ln -s TARGET LINK')];
        var link = this.abs(rest[1]), ex = fs.lstat(link);
        if (ex && ex.type === 'dir') { link = link + '/' + VFS.basename(rest[0]); ex = fs.lstat(link); }
        if (!fs.lstat(VFS.dirname(link))) { this.rc = 1; return [err('ln: ' + rest[1] + ': No such file or directory')]; }
        if (ex) {
          if (flags.indexOf('f') === -1) { this.rc = 1; return [err('ln: ' + rest[1] + ': File exists')]; }
          fs.rm(link);
        }
        fs.link(link, rest[0]);
        return [];
      },
      mv: function (args) {
        var fs = this.fs;
        if (args.length < 2) return [dim('usage: mv FROM TO')];
        var a = this.abs(args[0]), b = this.abs(args[1]);
        if (!fs.lstat(a)) { this.rc = 1; return [err('mv: ' + args[0] + ': No such file or directory')]; }
        var bs = fs.stat(b);
        if (bs && bs.type === 'dir') b = b + '/' + VFS.basename(a);
        if (!fs.lstat(VFS.dirname(b))) { this.rc = 1; return [err('mv: rename ' + args[0] + ' to ' + args[1] + ': No such file or directory')]; }
        if (a !== b) { fs.rm(b); fs.mv(a, b); }
        return [];
      },
      rm: function (args) {
        var self = this, fs = this.fs, flags = '', out = [];
        args.forEach(function (a) {
          if (a.charAt(0) === '-') { flags += a.slice(1).toLowerCase(); return; }
          var p = self.abs(a), nd = fs.lstat(p);
          if (!nd) { if (flags.indexOf('f') === -1) { self.rc = 1; out.push(err('rm: ' + a + ': No such file or directory')); } return; }
          if (nd.type === 'dir' && flags.indexOf('r') === -1) { self.rc = 1; out.push(err('rm: ' + a + ': is a directory')); return; }
          if (p === '/') { out.push(dim('(simulator: nice try)')); return; }
          fs.rm(p);
        });
        return out;
      },
      mkdir: function (args) {
        var self = this, out = [];
        args.forEach(function (a) {
          if (a.charAt(0) === '-') return;
          var p = self.abs(a);
          if (self.fs.lstat(p)) { self.rc = 1; out.push(err('mkdir: ' + a + ': File exists')); } else self.fs.mkdirp(p);
        });
        return out;
      },
      touch: function (args) {
        var self = this;
        args.forEach(function (a) { var p = self.abs(a); if (!self.fs.lstat(p)) self.fs.file(p, { mode: 0o644, size: 0 }); });
        return [];
      }
    }
  };
  SH.Shell = Shell;

  /* chmod mode parsing: "755", "+x", "u+x", "go-w", "a=rx" */
  SH.applyMode = function (mode, spec) {
    if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8) & 0o777;
    var m = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(spec);
    if (!m) return null;
    var who = m[1] || 'a', bits = 0, mask = 0;
    if (who.indexOf('a') !== -1) who = 'ugo';
    who.split('').forEach(function (w) {
      var shift = w === 'u' ? 6 : w === 'g' ? 3 : 0;
      mask |= 7 << shift;
      m[3].split('').forEach(function (c) { bits |= (c === 'r' ? 4 : c === 'w' ? 2 : 1) << shift; });
    });
    if (m[2] === '+') return mode | bits;
    if (m[2] === '-') return mode & ~bits;
    return (mode & ~mask) | bits;
  };

  /* A small, Mac-like starting world shared by the widgets. */
  SH.HOME = '/Users/you';
  SH.world = function (o) {
    o = o || {};
    var fs = new VFS(), H = SH.HOME, R = { owner: 'root' };
    ['ls', 'cat', 'chmod', 'ln', 'mv', 'rm', 'mkdir'].forEach(function (n) { fs.file('/bin/' + n, { owner: 'root', prog: n, size: 150000 }); });
    fs.file('/bin/zsh', { owner: 'root', size: 1300000, out: '(a new zsh would start here)' });
    fs.file('/usr/bin/touch', { owner: 'root', prog: 'touch', size: 120000 });
    fs.file('/usr/bin/clear', { owner: 'root', prog: 'clear', size: 120000 });
    fs.file('/usr/bin/git', { owner: 'root', size: 170000, out: 'git version 2.39.5 (Apple Git-154)' });
    fs.file('/usr/bin/python3', { owner: 'root', size: 170000, out: 'Python 3.9.6' });
    fs.mkdirp('/usr/sbin', 'root'); fs.mkdirp('/sbin', 'root'); fs.mkdirp('/usr/local/bin', 'root');
    fs.file('/opt/homebrew/Cellar/node/22.11.0/bin/node', { out: 'v22.11.0', size: 98000000 });
    fs.link('/opt/homebrew/bin/node', '../Cellar/node/22.11.0/bin/node');
    fs.file('/opt/homebrew/bin/brew', { out: 'Homebrew 4.4.6', size: 8000 });
    fs.mkdirp(H);
    if (o.claude !== false) {
      fs.file(H + '/.local/share/claude/versions/2.1.0', { out: '2.1.0 (Claude Code)', size: 182000000 });
      fs.link(H + '/.local/bin/claude', H + '/.local/share/claude/versions/2.1.0');
    } else fs.mkdirp(H + '/.local/bin');
    fs.file(H + '/.zshrc', { mode: 0o644, size: 212, text: 'export PATH="$HOME/.local/bin:$PATH"\nalias ll=\'ls -l\'' });
    void R;
    return new Shell({
      fs: fs, home: H,
      path: o.path || [H + '/.local/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'],
      aliases: o.aliases || { ll: 'ls -l', gs: 'git status' },
      functions: o.functions || { greet: { body: 'echo "hello from a shell function"', out: 'hello from a shell function' } },
      useHash: o.useHash, mode: o.mode
    });
  };
})();
