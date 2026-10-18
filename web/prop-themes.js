export const PROP_THEMES={original:null,lavender:[.68,.56,1],mint:[.35,.86,.72],amber:[1,.68,.32]};
export function propThemeValues(theme,parameters){
 const rgb=PROP_THEMES[theme];if(!rgb)return {};
 const bounds=new Map(parameters.map(p=>[p.id,p])),values={};
 for(const prefix of ['ParamKeyboardColor','C_Loading','C_Question'])for(const [index,suffix] of ['R','G','B'].entries()){
  const id=prefix+suffix,p=bounds.get(id);if(p)values[id]=p.min+(p.max-p.min)*rgb[index];
 }
 return values;
}
