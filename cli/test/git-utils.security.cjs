const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

test('commit messages remain literal, including shell substitutions and newlines', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fuse-git-security-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.name', 'Security regression test');
    git('config', 'user.email', 'test@example.invalid');
    const source = readFileSync(path.join(__dirname, '../src/lib/git-utils.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      require: (name) => name === './constants' ? { PROJECT_ROOT: root } : require(name),
    });
    const message = 'Quote " and dollar $(touch injected-dollar) and `touch injected-backtick`\n\nOrdinary second paragraph';
    writeFileSync(path.join(root, 'file.txt'), 'legitimate change');
    git('add', 'file.txt');
    assert.equal(exports.gitCommit(message), 'Committed successfully');
    assert.equal(git('log', '-1', '--format=%B').trimEnd(), message);
    assert.equal(existsSync(path.join(root, 'injected-dollar')), false);
    assert.equal(existsSync(path.join(root, 'injected-backtick')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
