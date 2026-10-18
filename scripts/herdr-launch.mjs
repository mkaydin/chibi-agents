import { spawnSync } from 'node:child_process';
const result = spawnSync(process.env.HERDR_BIN_PATH || 'herdr', ['plugin', 'pane', 'open', '--plugin', 'ayla.companions', '--entrypoint', 'desktop'], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
