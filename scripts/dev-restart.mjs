import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { platform } = process;

function pidsOnPort(port) {
  if (platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 5 || fields[0] !== 'TCP') continue;
      if (fields[3] !== 'LISTENING') continue;
      const local = fields[1].match(/:(\d+)$/);
      if (local && Number(local[1]) === port) pids.add(fields[4]);
    }
    return [...pids];
  }
  try {
    return execSync(`lsof -t -i :${port} -sTCP:LISTEN`, { encoding: 'utf8' }).split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function kill(pids) {
  for (const pid of [...new Set(pids)]) {
    if (!pid || pid === '0') continue;
    try {
      if (platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      else try { process.kill(Number(pid), 'SIGKILL'); } catch { /* already gone */ }
    } catch { /* already gone */ }
  }
}

console.log('Stopping anything already on :3000 / :4000...');
for (const port of [3000, 4000]) {
  const pids = pidsOnPort(port);
  if (pids.length) console.log(`  :${port} -> PIDs ${pids.join(', ')}`);
  kill(pids);
}

const webNext = join(root, 'apps', 'web', '.next');
rmSync(webNext, { recursive: true, force: true });
console.log('Cleared apps/web/.next (stale dev cache).');

console.log('Starting `pnpm dev` (single turbo stack)...');
const child = spawn(platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: platform === 'win32',
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));