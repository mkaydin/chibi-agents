import net from 'node:net';
import { mkdir, unlink, chmod, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
export const gatewayPath = () => process.env.COMPANION_SOCKET_PATH || join(tmpdir(), `ayla-companions-${process.getuid?.() || 'local'}`, 'commands.sock');

export class Bindings {
  constructor() { this.tokens = new Map(); }
  register(agent) { const token = randomUUID(); this.tokens.set(token, { id: agent.id, last: 0, count: 0 }); return token; }
  resolve(token, agents) {
    const binding = this.tokens.get(token); const agent = binding && agents.find(item => item.id === binding.id);
    if (!agent) { this.tokens.delete(token); throw new Error('Agent binding expired; reconnect from the current Herdr pane'); }
    const now = Date.now(); if (now - binding.last >= 1000) { binding.last = now; binding.count = 0; }
    if (++binding.count > 5) throw new Error('Animation request rate limit exceeded');
    return agent;
  }
  reconcile(agents) { const ids = new Set(agents.map(item => item.id)); for (const [token, binding] of this.tokens) if (!ids.has(binding.id)) this.tokens.delete(token); }
}

export async function startGateway(path, handle) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // The desktop single-instance lock owns this path; remove stale sockets only.
  try { if (!(await lstat(path)).isSocket()) throw new Error('Refusing to replace a non-socket gateway path'); await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const clients = new Set();
  const server = net.createServer(socket => {
    clients.add(socket); let buffer = '', used = false;
    socket.on('close', () => clients.delete(socket)); socket.on('error', () => {});
    socket.setTimeout(5000, () => socket.destroy());
    socket.on('data', async bytes => {
      if (used) return; buffer += bytes;
      if (buffer.length > 65536) { socket.destroy(); return; }
      const at = buffer.indexOf('\n'); if (at < 0) return; used = true;
      try { const value = await handle(JSON.parse(buffer.slice(0, at))); socket.end(JSON.stringify({ result: value }) + '\n'); }
      catch (error) { socket.end(JSON.stringify({ error: error.message }) + '\n'); }
    });
  });
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(path, ready); });
  await chmod(path, 0o600);
  return { close: async () => { for (const socket of clients) socket.destroy(); await new Promise(ready => server.close(ready)); try { await unlink(path); } catch {} } };
}

export function gatewayRequest(payload, path = gatewayPath()) {
  return new Promise((resolve, reject) => {
    let buffer = ''; const socket = net.createConnection(path);
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('Companion service timed out')); });
    socket.on('error', reject);
    socket.on('connect', () => socket.write(JSON.stringify(payload) + '\n'));
    socket.on('data', bytes => {
      buffer += bytes; if (buffer.length > 1024 * 1024) { socket.destroy(); reject(new Error('Reply too large')); return; }
      const at = buffer.indexOf('\n'); if (at < 0) return;
      socket.destroy(); try { const response = JSON.parse(buffer.slice(0, at)); response.error ? reject(new Error(response.error)) : resolve(response.result); } catch (error) { reject(error); }
    });
  });
}
