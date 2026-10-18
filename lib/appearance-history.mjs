const clone = value => structuredClone(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export class AppearanceHistory {
  constructor(value = { values:{}, preset:'' }, limit = 100) { this.limit=limit; this.reset(value); }
  reset(value) { this.current=clone(value);this.saved=clone(value);this.past=[];this.future=[];this.group=null; }
  commit(value,group=null) {
    if(same(value,this.current))return this.current;
    if(!group || group!==this.group) {this.past.push(clone(this.current));if(this.past.length>this.limit)this.past.shift();}
    this.current=clone(value);this.future=[];this.group=group;return this.current;
  }
  undo() { if(this.past.length){this.future.push(clone(this.current));this.current=this.past.pop();}this.group=null;return clone(this.current); }
  redo() { if(this.future.length){this.past.push(clone(this.current));this.current=this.future.pop();}this.group=null;return clone(this.current); }
  serialize() {return structuredClone({current:this.current,saved:this.saved,past:this.past,future:this.future,group:this.group});}
  restore(data) {Object.assign(this,structuredClone(data));}
  checkpoint() {this.saved=clone(this.current);this.group=null;}
  revert() {return this.commit(this.saved);}
  get status() {return {canUndo:!!this.past.length,canRedo:!!this.future.length,dirty:!same(this.current,this.saved)};}
}
