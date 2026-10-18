export function characterLayout(width,height,bounds,scale=1,embedded=false){
  const top=embedded?12:64,bottom=embedded?12:18;
  const factor=Math.min(width*.92/bounds.width,Math.max(40,height-top-bottom)*.94/bounds.height)*scale;
  return {factor,x:width/2-bounds.centerX*factor,y:(top+height-bottom)/2-bounds.centerY*factor};
}
export function titlePosition(bounds,width,height,titleHeight=28,titleWidth=0){
  const center=bounds.x+bounds.width/2;
  const margin=Math.max(8,Math.min(width/2,titleWidth/2+8));
  return {x:Math.max(margin,Math.min(Math.max(margin,width-margin),center)),y:Math.max(4,Math.min(height-titleHeight-4,bounds.y-titleHeight-8))};
}
