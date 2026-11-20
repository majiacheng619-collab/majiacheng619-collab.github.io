import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checker = fileURLToPath(new URL('../node_modules/vnu-jar/build/dist/vnu.jar', import.meta.url));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--built')) {
  run('python3', ['portfolio-source/prepare_release.py', '--preserve-game', '--keep-archive']);
} else {
  run('python3', ['validate_site.py', '_site', '--published', '--pdf', 'resume.pdf']);
  run('python3', ['portfolio-source/audit_release.py', '_site']);
}
run('java', ['-jar', checker, '--errors-only', '--skip-non-html', '_site']);
