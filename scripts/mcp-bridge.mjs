import { createInterface } from 'node:readline';
import { gatewayRequest } from '../lib/gateway.mjs';
import { mcpResponse } from '../lib/mcp.mjs';
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const pane = option('--pane') || process.env.HERDR_PANE_ID;
const herdr = option('--herdr-socket') || process.env.HERDR_SOCKET_PATH;
let token;
async function invoke(tool, arguments_) {
  if (!pane || !herdr) throw new Error('Run this bridge from a Herdr pane, forwarding HERDR_PANE_ID and HERDR_SOCKET_PATH, or configure explicit --pane/--herdr-socket pairing.');
  if (!token) token = (await gatewayRequest({ method: 'register', pane, herdr })).token;
  return gatewayRequest({ method: 'call', token, tool, arguments: arguments_ });
}
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let chain = Promise.resolve();
input.on('line', line => {
  chain = chain.then(async () => {
    if (line.length > 65536) throw new Error('MCP request too large');
    let request;
    try { request = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
    const response = await mcpResponse(request, invoke); if (response) process.stdout.write(JSON.stringify(response) + '\n');
  }).catch(error => process.stderr.write(error.message + '\n'));
});
