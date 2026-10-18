// The swatch represents each parameter's normalized range. It deliberately
// does not assume a rig's color values use 0–255 or imply literal atlas colors.
export function colorFromParameters(parameters, values) {
  return '#' + parameters.map(p => {
    const value=values[p.id] ?? p.default ?? p.value;
    return Math.round(Math.max(0,Math.min(1,(value-p.min)/(p.max-p.min)))*255).toString(16).padStart(2,'0');
  }).join('');
}
export function parametersFromColor(parameters, hex) {
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Invalid RGB color');
  return Object.fromEntries(parameters.map((p,i)=>[p.id,p.min+(p.max-p.min)*parseInt(hex.slice(1+i*2,3+i*2),16)/255]));
}
