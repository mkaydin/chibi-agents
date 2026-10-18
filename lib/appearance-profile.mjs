export function resolvePreset(entries, parameters) {
  const values = new Map(parameters.map(p => [p.id, p.default ?? p.value]));
  const bounds = new Map(parameters.map(p => [p.id, p]));
  for (const entry of entries) {
    const p = bounds.get(entry.Id);
    if (!p) throw new Error(`Preset parameter is unavailable: ${entry.Id}`);
    if (!Number.isFinite(entry.Value)) throw new Error('Invalid preset value');
    const blend = entry.Blend || 'Add';
    if (!['Add', 'Multiply', 'Overwrite'].includes(blend)) throw new Error(`Unsupported preset blend: ${blend}`);
    const base = values.get(p.id);
    const value = blend === 'Add' ? base + entry.Value : blend === 'Multiply' ? base * entry.Value : entry.Value;
    values.set(p.id, Math.max(p.min, Math.min(p.max, value)));
  }
  return Object.fromEntries(entries.map(entry => [entry.Id, values.get(entry.Id)]));
}
export function validateAppearance(values, parameters) {
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length > 2048) throw new Error('Invalid appearance');
  const bounds = new Map(parameters.map(p => [p.id, p]));
  return Object.fromEntries(Object.entries(values).map(([id,value]) => {
    const p = bounds.get(id);
    if (!p || !Number.isFinite(value)) throw new Error(`Invalid appearance parameter: ${id}`);
    return [id,Math.max(p.min,Math.min(p.max,value))];
  }));
}
