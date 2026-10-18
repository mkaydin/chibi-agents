export function desktopSize(width,height,area={width:1920,height:1080}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid avatar size');
  const ratio=Math.min(1,Math.max(160,area.width)/width,Math.max(180,area.height)/height);
  return {width:Math.round(Math.max(160,Math.min(area.width,width*ratio))),height:Math.round(Math.max(180,Math.min(area.height,height*ratio)))};
}
