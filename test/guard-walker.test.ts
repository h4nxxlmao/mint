import { strict as assert } from 'node:assert';
import { symlinkSync } from 'node:fs';
import { join, sep } from 'node:path';
import { test } from 'node:test';
import { IgnoreSet, compileIgnoreRule, parseIgnoreLines } from '../src/guard/gitignore.js';
import { DEFAULT_SKIP_DIRS, LOCKFILES, looksBinary, walkFiles } from '../src/guard/walker.js';
import { makeTempTree } from './guard-fixtures.js';

function ignoreSet(patterns: string[]): IgnoreSet {
  const set = new IgnoreSet();
  set.addIgnoreFile('', patterns);
  return set;
}

test('gitignore: comments, blanks and trailing spaces are ignored', () => {
  assert.equal(compileIgnoreRule('# comment'), undefined);
  assert.equal(compileIgnoreRule(''), undefined);
  assert.equal(compileIgnoreRule('   '), undefined);
  assert.notEqual(compileIgnoreRule('file.txt   '), undefined);
});

test('gitignore: wildcards, anchoring and negation', () => {
  const set = ignoreSet(['*.log', '/root.txt', 'sub/', 'docs/**', '!keep.log']);
  assert.equal(set.ignores('app.log', false), true);
  assert.equal(set.ignores('nested/app.log', false), true);
  assert.equal(set.ignores('root.txt', false), true);
  assert.equal(set.ignores('nested/root.txt', false), false);
  assert.equal(set.ignores('sub', true), true);
  assert.equal(set.ignores('sub', false), false);
  assert.equal(set.ignores('docs/guide.md', false), true);
  assert.equal(set.ignores('keep.log', false), false, 'negation must re-include');
});

test('gitignore: question marks and character classes', () => {
  const set = ignoreSet(['file?.txt', 'img[0-9].png']);
  assert.equal(set.ignores('file1.txt', false), true);
  assert.equal(set.ignores('file12.txt', false), false);
  assert.equal(set.ignores('img5.png', false), true);
  assert.equal(set.ignores('imgA.png', false), false);
});

test('gitignore: `**` matches across directories', () => {
  const set = ignoreSet(['src/**/generated.ts', 'logs/**']);
  assert.equal(set.ignores('src/generated.ts', false), true);
  assert.equal(set.ignores('src/a/b/generated.ts', false), true);
  assert.equal(set.ignores('logs/app.log', false), true);
  assert.equal(set.ignores('logs/nested/deep/app.log', false), true);
});

test('gitignore: nested ignore files are scoped to their directory', () => {
  const set = new IgnoreSet();
  set.addIgnoreFile('', ['*.tmp']);
  set.addIgnoreFile('sub', ['secret.txt']);
  assert.equal(set.ignores('a.tmp', false), true);
  assert.equal(set.ignores('sub/secret.txt', false), true);
  assert.equal(set.ignores('secret.txt', false), false);
  assert.equal(set.ignores('other/secret.txt', false), false);
});

test('gitignore: parseIgnoreLines splits CRLF and LF', () => {
  assert.deepEqual(parseIgnoreLines('a\r\nb\n'), ['a', 'b', '']);
});

test('binary detection uses a NUL byte in the first 8 KB', () => {
  assert.equal(looksBinary(Buffer.from('plain text\n', 'utf8')), false);
  assert.equal(looksBinary(Buffer.from([0x41, 0x00, 0x42])), true);
  assert.equal(looksBinary(Buffer.from('x'.repeat(9000), 'utf8')), false);
  assert.equal(looksBinary(Buffer.concat([Buffer.from('x'.repeat(9000)), Buffer.from([0])])), false);
});

test('default skip lists cover the usual suspects', () => {
  for (const dir of ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'vendor', 'target']) {
    assert.ok(DEFAULT_SKIP_DIRS.has(dir), `${dir} should be skipped by default`);
  }
  for (const file of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'go.sum']) {
    assert.ok(LOCKFILES.has(file), `${file} should be treated as a lockfile`);
  }
});

test('walkFiles applies gitignore, default skips, size caps and binary extensions', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());

  tree.write('.gitignore', ['ignored.log', 'nested/secret.txt'].join('\n'));
  tree.write('keep.txt', 'hello');
  tree.write('ignored.log', 'noise');
  tree.write('nested/secret.txt', 'noise');
  tree.write('nested/keep.ts', 'hello');
  tree.write('node_modules/pkg/index.js', 'module');
  tree.write('build/out.js', 'bundle');
  tree.write('package-lock.json', '{}');
  tree.write('image.png', 'not really a png');
  tree.write('big.txt', 'x'.repeat(4096));

  const ignore = new IgnoreSet();
  ignore.addIgnoreFile('', parseIgnoreLines('ignored.log\nnested/secret.txt\n'));

  const events = [...walkFiles({ root: tree.dir, maxFileSize: 1024, includeLockfiles: false, ignore })];
  const files = events.filter((event) => event.type === 'file').map((event) => event.path);
  const skips = new Map(
    events.filter((event) => event.type === 'skip').map((event) => [event.path, event.reason]),
  );

  assert.ok(files.includes('keep.txt'));
  assert.ok(files.includes('nested/keep.ts'));
  assert.ok(files.includes('.gitignore'));
  assert.ok(!files.includes('ignored.log'));
  assert.ok(!files.includes('nested/secret.txt'));
  assert.ok(!files.includes('node_modules/pkg/index.js'));
  assert.ok(!files.includes('build/out.js'));
  assert.ok(!files.includes('package-lock.json'));
  assert.ok(!files.includes('image.png'));
  assert.ok(!files.includes('big.txt'));

  assert.equal(skips.get('ignored.log'), 'ignored');
  assert.equal(skips.get('nested/secret.txt'), 'ignored');
  assert.equal(skips.get('node_modules'), 'default-dir');
  assert.equal(skips.get('build'), 'default-dir');
  assert.equal(skips.get('package-lock.json'), 'lockfile');
  assert.equal(skips.get('image.png'), 'binary-extension');
  assert.equal(skips.get('big.txt'), 'too-large');
});

test('walkFiles yields files in a deterministic order', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  for (const name of ['b.txt', 'a.txt', 'c/d.txt', 'c/a.txt']) tree.write(name, 'x');
  const paths = [...walkFiles({ root: tree.dir, maxFileSize: 1024, includeLockfiles: false, ignore: new IgnoreSet() })]
    .filter((event) => event.type === 'file')
    .map((event) => event.path);
  assert.deepEqual(paths, [...paths].sort());
});

test('walkFiles skips symlinks instead of following them', (context) => {
  const tree = makeTempTree();
  context.after(() => tree.cleanup());
  tree.write('real.txt', 'hello');
  try {
    symlinkSync(join(tree.dir, 'real.txt'), join(tree.dir, 'link.txt'));
  } catch {
    return; // Windows without developer mode cannot create symlinks
  }
  const events = [...walkFiles({ root: tree.dir, maxFileSize: 1024, includeLockfiles: false, ignore: new IgnoreSet() })];
  const files = events.filter((event) => event.type === 'file').map((event) => event.path);
  assert.ok(files.includes('real.txt'));
  assert.ok(!files.includes('link.txt'));
  const linkSkip = events.find((event) => event.type === 'skip' && event.path === 'link.txt');
  assert.equal(linkSkip?.type === 'skip' ? linkSkip.reason : undefined, 'symlink');
  assert.ok(!tree.dir.endsWith(sep));
});
