import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
  existsSync,
} from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const generated = ['api/generated', 'internal/api', 'frontend/src/api/generated'];
const baseline = 'eb550f5e947442bca1d1bd65288500e1f1ab74e2';

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
  return result.stdout?.toString() ?? '';
}

function local(pkg, args, binName = pkg.split('/').at(-1), options = {}) {
  const dir = join(root, 'node_modules', pkg);
  const info = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const bin = typeof info.bin === 'string' ? info.bin : info.bin[binName];
  if (!bin) throw new Error(`No ${binName} binary in ${pkg}`);
  return run(process.execPath, [join(dir, bin), ...args], options);
}

function git(args, options = {}) {
  return run('git', args, { stdio: ['pipe', 'pipe', 'inherit'], ...options }).trim();
}

function tree(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const name = join(dir, entry.name);
      return entry.isDirectory() ? tree(name) : [name];
    })
    .sort();
}

function generateAt(destination) {
  const specDir = join(destination, 'api/generated');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(join(destination, 'internal/api'), { recursive: true });
  local('@typespec/compiler', ['compile', 'api', '--output-dir', specDir], 'tsp');
  run('go', [
    'run',
    'github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2',
    '-config',
    'api/oapi-codegen.yaml',
    '-o',
    join(destination, 'internal/api/server.gen.go'),
    join(specDir, 'openapi.yaml'),
  ]);
  local('@hey-api/openapi-ts', ['--file', 'openapi-ts.config.ts'], 'openapi-ts', {
    env: {
      ...process.env,
      OPENAPI_INPUT: join(specDir, 'openapi.yaml'),
      SDK_OUTPUT: join(destination, 'frontend/src/api/generated'),
    },
  });
}

function generation(check) {
  const temp = mkdtempSync(join(root, '.generated-check-'));
  try {
    generateAt(temp);
    for (const dir of generated) {
      if (!check) {
        // Only these generator-owned directories are replaced; never the whole working tree.
        rmSync(join(root, dir), { recursive: true, force: true });
        cpSync(join(temp, dir), join(root, dir), { recursive: true });
        continue;
      }
      const expected = tree(join(temp, dir));
      const actual = tree(join(root, dir));
      const names = (files, base) => files.map((file) => relative(base, file));
      if (JSON.stringify(names(expected, temp)) !== JSON.stringify(names(actual, root))) {
        throw new Error(`Generated file set differs in ${dir}; run mise run generate`);
      }
      for (const file of expected) {
        const name = relative(temp, file);
        if (!readFileSync(file).equals(readFileSync(join(root, name)))) {
          throw new Error(`Generated content differs: ${name}; run mise run generate`);
        }
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function goFormat(files, write = false) {
  if (files.length === 0) return;
  if (write) run('gofmt', ['-w', ...files]);
  else {
    const output = run('gofmt', ['-l', ...files], { stdio: ['ignore', 'pipe', 'inherit'] });
    if (output.trim()) throw new Error(`Go formatting differs:\n${output}`);
  }
}

function lint() {
  run('go', ['vet', './...']);
  run('golangci-lint', ['run', './...']);
  local('oxlint', [
    '--deny-warnings',
    'frontend',
    'scripts',
    'playwright.config.ts',
    'tests/e2e',
    'openapi-ts.config.ts',
    'commitlint.config.mjs',
  ]);
}

function build() {
  mkdirSync('dist', { recursive: true });
  run('go', [
    'build',
    '-o',
    process.platform === 'win32' ? 'dist/server.exe' : 'dist/server',
    './cmd/server',
  ]);
  local('vite', ['build', '--config', 'frontend/vite.config.ts']);
}

// Shared by `test` and `check` so both run the same browser test suite.
function browserTests() {
  local('@playwright/test', ['test'], 'playwright');
}

function commitMessages() {
  const head = process.env.CHECK_COMMIT_HEAD || 'HEAD';
  if (head !== 'HEAD' && !/^[a-f0-9]{40}$/i.test(head)) throw new Error('Invalid commit HEAD');
  let base = baseline;
  const before = process.env.CHECK_COMMIT_BASE;
  if (before && /^[a-f0-9]{40}$/i.test(before) && !/^0+$/.test(before)) {
    const reachable = spawnSync('git', ['merge-base', '--is-ancestor', before, head]);
    if (reachable.status === 0) base = before;
  }
  // The fixed boundary excludes legacy course/template commits; never rewrite history.
  const commits = git(['rev-list', '--reverse', head, `^${base}`, `^${baseline}`])
    .split('\n')
    .filter(Boolean);
  for (const sha of commits) {
    const message = git(['show', '-s', '--format=%B', sha]);
    local('@commitlint/cli', [], 'commitlint', {
      input: message,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
}

const [task, ...files] = process.argv.slice(2);
try {
  switch (task) {
    case 'setup':
      {
        const npm = [
          join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
          resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
        ].find((file) => existsSync(file));
        if (!npm) throw new Error('Bundled npm CLI not found beside the pinned Node installation');
        run(process.execPath, [npm, 'ci']);
      }
      run('go', ['mod', 'download']);
      break;
    case 'setup:hooks':
      if (!process.env.SCAFFOLD_MISE_BIN || !existsSync(process.env.SCAFFOLD_MISE_BIN)) {
        throw new Error('Install hooks through mise run setup:hooks');
      }
      run('hk', ['validate']);
      run('hk', ['install', '--mise']);
      {
        // Store the launcher only in this clone so GUI Git does not need a shell activation.
        const launcher = `'${process.env.SCAFFOLD_MISE_BIN.replaceAll('\\', '/').replaceAll("'", "'\\''")}' x -- hk`;
        for (const hook of ['pre-commit', 'commit-msg', 'pre-push']) {
          const key = `hook.hk-${hook}.command`;
          const installed = git(['config', '--local', '--get', key]);
          if (!installed.includes('mise x -- hk'))
            throw new Error(`Unexpected hk launcher: ${key}`);
          git(['config', '--local', key, installed.replace('mise x -- hk', launcher)]);
        }
      }
      break;
    case 'setup:e2e': {
      // Only Chromium; CI Linux additionally needs system dependencies.
      const args = ['install', 'chromium'];
      if (process.platform === 'linux' && process.env.CI === 'true') {
        args.push('--with-deps');
      }
      local('@playwright/test', args, 'playwright');
      break;
    }
    case 'generate':
      generation(false);
      break;
    case 'check:generated':
      generation(true);
      break;
    case 'lint':
      lint();
      break;
    case 'typecheck':
      local('typescript', ['--noEmit'], 'tsc');
      break;
    case 'build':
      build();
      break;
    case 'test':
      build();
      run('go', ['test', '-count=1', '-timeout=120s', './...']);
      browserTests();
      break;
    case 'format':
      goFormat(
        tree('cmd')
          .concat(tree('internal'), tree('tests'))
          .filter((f) => f.endsWith('.go')),
        true,
      );
      local('oxfmt', ['--write', '.']);
      break;
    case 'hook-files': {
      const present = files.filter((file) => existsSync(file));
      goFormat(present.filter((file) => file.endsWith('.go')));
      const text = present.filter((file) =>
        /\.(?:[cm]?[jt]sx?|json|css|html|ya?ml|md)$/.test(file),
      );
      if (text.length) local('oxfmt', ['--check', ...text]);
      const js = text.filter(
        (file) => /\.[cm]?[jt]sx?$/.test(file) && !file.includes('/generated/'),
      );
      if (js.length) local('oxlint', ['--deny-warnings', ...js]);
      if (present.some((file) => file.endsWith('.go') && !file.endsWith('.gen.go')))
        run('golangci-lint', ['run', './...']);
      break;
    }
    case 'commit-msg':
      if (files.length !== 1) throw new Error('Expected one commit message file');
      local('@commitlint/cli', ['--edit', resolve(files[0])], 'commitlint');
      break;
    case 'check':
      generation(true);
      goFormat(
        tree('cmd')
          .concat(tree('internal'), tree('tests'))
          .filter((f) => f.endsWith('.go')),
      );
      local('oxfmt', ['--check', '.']);
      run('go', ['mod', 'tidy', '-diff']);
      run('go', ['mod', 'verify']);
      lint();
      local('typescript', ['--noEmit'], 'tsc');
      build();
      run('go', ['test', '-count=1', '-timeout=120s', './...']);
      browserTests();
      run('hk', ['validate']);
      commitMessages();
      break;
    default:
      throw new Error(`Unknown task: ${task}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
