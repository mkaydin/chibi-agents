import {behaviorFromMessage} from './agent-behavior.mjs';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export function rpc(path, method, params = {}, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const id = randomUUID(); let buffer = '', settled = false;
    const socket = net.createConnection(path);
    const finish = (error, value) => { if (settled) return; settled = true; socket.destroy(); error ? reject(error) : resolve(value); };
    socket.setTimeout(timeout, () => finish(new Error('Herdr request timed out')));
    socket.on('connect', () => socket.write(JSON.stringify({ id, method, params }) + '\n'));
    socket.on('error', error => finish(error));
    socket.on('end', () => finish(new Error('Herdr closed the connection before replying')));
    socket.on('data', bytes => {
      buffer += bytes; if (buffer.length > 4 * 1024 * 1024) return finish(new Error('Herdr response too large'));
      const at = buffer.indexOf('\n'); if (at < 0) return;
      try { const response = JSON.parse(buffer.slice(0, at)); if (response.id !== id) return finish(new Error('Herdr response ID mismatch')); finish(response.error ? new Error(response.error.message || response.error.code) : null, response.result); } catch (error) { finish(error); }
    });
  });
}

export function normalizeAgents(snapshot, endpoint) {
  return (snapshot.agents || []).filter(item => item.agent && item.terminal_id && item.pane_id).map(item => ({
    id: JSON.stringify([endpoint, item.pane_id, item.terminal_id, item.agent, item.agent_session?.value || '']),
    project:item.tokens?.project || item.tokens?.repo || snapshot.workspaces?.find(w=>w.workspace_id===item.workspace_id)?.worktree?.repo_name || '',
    pane: item.pane_id, terminal: item.terminal_id, session: item.agent_session?.value || '',
    kind: item.agent, label: item.name || item.title || item.display_agent || item.agent,
    completionSeq:Number.isSafeInteger(item.completion_seq)?item.completion_seq:null,stateChangeSeq:item.state_change_seq || 0,
    stateLabels:Object.fromEntries(Object.entries(item.state_labels || {}).slice(0,32).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.slice(0,80)])),
    tokens:Object.fromEntries(Object.entries(item.tokens || {}).slice(0,32).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.slice(0,80)])),
    status: item.agent_status || 'unknown', cwd: item.foreground_cwd || item.cwd || '',
  }));
}

export class HerdrAdapter extends EventEmitter {
  constructor(path, request = rpc, {inferOutput=true}={}) { super(); this.inferOutput=inferOutput;this.outputTopology='';this.outputCooldown=new Map(); this.path = path; this.request = request; this.agents = []; this.stopped = true; this.reading = false; this.dirty = false; this.sockets = new Set(); this.topology = ''; }
  start() {
    this.stop(); this.stopped = false; this.topology = '';this.outputTopology='';
    this.watch(['pane.created', 'pane.updated', 'pane.closed', 'pane.exited', 'pane.agent_detected'].map(type => ({ type })));
    this.timer = setInterval(() => this.refresh(), 2000); this.timer.unref?.();
    void this.refresh();
  }
  stop() { this.stopped = true; clearInterval(this.timer);clearTimeout(this.eventTimer); for (const s of this.sockets) s.destroy(); this.sockets.clear(); this.statusSocket = null;this.outputSocket=null;this.outputCooldown.clear(); }
  watch(subscriptions, status = false) {
    const slot=status==='output'?'outputSocket':status?'statusSocket':null;
    const socket = net.createConnection(this.path); this.sockets.add(socket); let buffer = '';
    socket.on('connect', () => socket.write(JSON.stringify({ id: randomUUID(), method: 'events.subscribe', params: { subscriptions } }) + '\n'));
    socket.on('error', () => {});
    socket.on('close', () => { this.sockets.delete(socket); if(slot && this[slot]===socket){this[slot]=null;if(status==='output')this.outputTopology='';else this.topology='';} if (!this.stopped) { setTimeout(() => { if (!this.stopped) { if (!slot) this.watch(subscriptions); void this.refresh(); } }, 2000).unref?.(); } });
    socket.on('data', bytes => {
      buffer += bytes; if (buffer.length > 4 * 1024 * 1024) { socket.destroy(); return; }
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
        try { const value = JSON.parse(line); if (value.error) { socket.destroy(); return; } if(value.event==='pane.output_matched'){this.outputHint(value.data);continue;}clearTimeout(this.eventTimer);this.eventTimer=setTimeout(()=>void this.refresh(),60);this.eventTimer.unref?.(); } catch { socket.destroy(); return; }
      }
    });
    return socket;
  }
  outputHint(data){
    const agent=this.agents.find(a=>a.pane===data?.pane_id);if(!agent || agent.status!=='working' || typeof data.matched_line!=='string')return;
    const text=data.matched_line.slice(0,500),now=Date.now();if(now-(this.outputCooldown.get(agent.id) || 0)<5000)return;
    let activity=/tests? (?:passed)|test result:\s*ok/i.test(text)?'done':/testing|running tests/i.test(text)?'testing':/searching/i.test(text)?'searching':/reading/i.test(text)?'reading':/editing/i.test(text)?'editing':/building/i.test(text)?'running':behaviorFromMessage(text);
    if(!activity)return;this.outputCooldown.set(agent.id,now);this.emit('activity',{id:agent.id,activity,source:'terminal-inferred'});
  }
  async refresh() {
    if (this.stopped) return;
    if (this.reading) { this.dirty = true; return; }
    this.reading = true;
    try {
      const result = await this.request(this.path, 'session.snapshot');
      if (this.stopped) return;
      if (!result?.snapshot?.agents) throw new Error('Herdr returned an unsupported snapshot');
      this.agents = normalizeAgents(result.snapshot, this.path);
      const panes = this.agents.map(item => item.pane).sort(); const topology = JSON.stringify(panes);
      if (topology !== this.topology) {
        this.topology = topology; this.statusSocket?.destroy(); this.statusSocket = null;
        if (panes.length) this.statusSocket = this.watch(panes.map(pane_id => ({ type: 'pane.agent_status_changed', pane_id })), true);
      }
      if(this.inferOutput && topology!==this.outputTopology){
        this.outputTopology=topology;this.outputSocket?.destroy();this.outputSocket=null;
        const subscriptions=panes.map(pane_id=>({type:'pane.output_matched',pane_id,source:'recent',lines:3,strip_ansi:true,match:{type:'regex',value:String.raw`(?i)^\s*(?:[✓✔✗✘]\s*)?(?:running tests|testing|searching|reading|editing|building|test result:|tests? (?:passed|failed)|error:|permission required|waiting for (?:approval|input))(?:\s|$)`}}));
        if(subscriptions.length)this.outputSocket=this.watch(subscriptions,'output');
      }
      const ids=new Set(this.agents.map(a=>a.id));for(const id of this.outputCooldown.keys())if(!ids.has(id))this.outputCooldown.delete(id);
      this.emit('status', { connected: true, path: this.path, error: null }); this.emit('agents', this.agents);
    } catch (error) { if (!this.stopped) this.emit('status', { connected: false, path: this.path, error: error.message }); }
    finally { this.reading = false; if (this.dirty) { this.dirty = false; if (!this.stopped) void this.refresh(); } }
  }
}
