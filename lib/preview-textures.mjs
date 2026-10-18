export class PreviewTextures {
  constructor() {this.models=new Map();this.shared=new Map();this.sharedBytes=0;this.sharedLimit=128*1024*1024;}
  store(id, index, input, key) {
    const bytes = Buffer.from(input);
    if (!Number.isInteger(index) || index < 0 || index >= 16 || bytes.length > 32 * 1024 * 1024 || bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid preview texture');
    const textures = this.models.get(id) || new Map();
    let total = bytes.length;
    for (const [key, data] of textures) if (key !== index) total += data.length;
    if (total > 64 * 1024 * 1024) throw new Error('Preview texture memory limit exceeded');
    if(key && !this.shared.has(key)){this.shared.set(key,bytes);this.sharedBytes+=bytes.length;while(this.sharedBytes>this.sharedLimit && this.shared.size){const oldest=this.shared.keys().next().value;this.sharedBytes-=this.shared.get(oldest).length;this.shared.delete(oldest);}}
    textures.set(index, bytes); this.models.set(id, textures);
    return `preview/${index}.png`;
  }
  reuse(id,index,key){const bytes=this.shared.get(key);if(!bytes)return null;this.shared.delete(key);this.shared.set(key,bytes);return this.store(id,index,bytes);}
  get(id, path) {
    const match = /^preview\/(\d+)\.png$/.exec(path);
    return match ? this.models.get(id)?.get(Number(match[1])) : undefined;
  }
  clear(id) { this.models.delete(id); }
}
