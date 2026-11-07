// Playwright webServer launcher for the Go API: serves the built dist binary
// on the LISTEN_ADDR given by the environment (the check pipeline builds it
// first; rebuilds here only when a standalone Playwright run has no bundle).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const name = process.platform === 'win32' ? 'server.exe' : 'server';
const binary = join(root, 'dist', name);

if (!existsSync(binary)) {
  console.log(`build: ${binary}`);
  const build = spawnSync('go', ['build', '-o', binary, './cmd/server'], {
    stdio: 'inherit',
    cwd: root,
  });
  if (build.status !== 0) {
    console.error('go build failed');
    process.exit(1);
  }
}

const address = process.env.LISTEN_ADDR ?? '127.0.0.1:8080';
const child = spawn(binary, [], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, LISTEN_ADDR: address },
});

const stop = () => {
  child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
  process.exit(process.exitCode);
});
