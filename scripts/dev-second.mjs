import { spawn } from 'node:child_process';

// Launch a second Talk+ instance that reuses the signaling server started
// by the primary `npm run dev` process. TALKPLUS_INSTANCE gives Electron a
// separate userData dir so both windows can run side by side.
const instanceId = process.argv[2] ?? process.env.TALKPLUS_INSTANCE ?? '2';
const env = { ...process.env, TALKPLUS_INSTANCE: instanceId };

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';
const child = spawn(cmd, ['electron-vite', 'dev'], {
  stdio: 'inherit',
  env,
  shell: false
});

child.on('exit', (code) => process.exit(code ?? 0));
