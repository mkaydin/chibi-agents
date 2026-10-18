export function expressionFor(status, expressions, mappings = {}) {
  expressions = expressions.filter(item => item.kind !== 'appearance' && item.supported !== false);
  if (mappings[status] === '__none__') return null;
  if (mappings[status] && expressions.some(item => item.name === mappings[status])) return mappings[status];
  const preferred={
    thinking:['Idea','Thinking'],reading:['Focused'],searching:['EyeOO','Question','Confused'],editing:['Focused'],testing:['Loading'],running:['Focused'],
    working:['Loading','Thinking','Focused'],blocked:['Question','Confused','Surprised'],done:['Star','Happy','Joy','Idea'],error:['Sweating','Sigh','Sad','EyeTT1','Angry'],
    idle:['Relaxed'],disconnected:['Tired','Confused'],celebrate:['Star','Happy','Joy','Idea'],greet:['Blush','Smile','Happy'],sad:['Sigh','Sad','Tired']
  };
  for(const name of preferred[status] || []){const found=expressions.find(e=>e.name.toLowerCase()===name.toLowerCase());if(found)return found.name;}
  return null;
}

export class CommandLease {
  constructor(apply, timers = { setTimeout, clearTimeout }) { this.apply = apply; this.timers = timers; this.status = 'idle'; }
  state(status) { this.status = status; if (!this.timer) this.apply(status); }
  override(action, duration) {
    if (!Number.isFinite(duration) || duration < 200 || duration > 15000) throw new Error('Duration must be 200–15000 ms');
    this.clear(); this.apply(action,{override:true,duration});
    this.timer = this.timers.setTimeout(() => { this.timer = null; this.apply(this.status,{override:false}); }, duration);
  }
  clear() { this.timers.clearTimeout(this.timer); this.timer = null; }
  reset() { this.clear(); this.apply(this.status); }
}
