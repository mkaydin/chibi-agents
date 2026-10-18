// Normalized offsets compose with the active expression before model physics.
export function reactionPose(action,t){
 const e=Math.sin(Math.PI*Math.max(0,Math.min(1,t))),wave=Math.sin(t*Math.PI*2);
 const pose={nod:0,tilt:0,turn:0,gazeX:0,gazeY:0,browL:0,browR:0,mouth:0,eyelid:1,browAngleL:0,browAngleR:0,browForm:0,mouthX:0};
 if(action==='thinking')Object.assign(pose,{tilt:-.045*e,gazeX:-.12*e,gazeY:.12*e,browL:.035*e});
 else if(action==='reading')Object.assign(pose,{nod:-.018*e,gazeX:Math.sin(t*Math.PI*6)*.1*e,gazeY:-.12*e});
 else if(action==='searching')Object.assign(pose,{turn:wave*.06*e,gazeX:wave*.3*e,tilt:wave*.025*e});
 else if(action==='editing')Object.assign(pose,{nod:-.025*e,browL:-.035*e,browR:-.035*e,gazeY:-.1*e});
 else if(action==='testing')Object.assign(pose,{tilt:.025*wave*e,browR:.065*e,gazeX:.14*wave*e});
 else if(action==='working')Object.assign(pose,{nod:.01*wave*e,gazeY:-.035*e});
 else if(action==='running')Object.assign(pose,{turn:.035*e,nod:.015*wave*e,gazeX:.12*e});
 else if(action==='done'||action==='celebrate')Object.assign(pose,{nod:wave*e*.07,mouth:.12*e,browL:.025*e,browR:.025*e});
 else if(action==='greet')Object.assign(pose,{tilt:.035*e,nod:wave*.04*e,mouth:.08*e});
 else if(action==='blocked')Object.assign(pose,{tilt:.075*e,browL:.07*e,browR:.035*e,gazeY:.08*e});
 else if(action==='error')Object.assign(pose,{nod:-.04*e,turn:-.035*e,browL:-.05*e,browR:.035*e,mouth:-.1*e});
 else if(action==='sad')Object.assign(pose,{nod:-.035*e,tilt:-.025*e,mouth:-.08*e,eyelid:1-.15*e});
 else if(action==='notice')Object.assign(pose,{nod:.065*e,tilt:.035*wave*e,browL:.1*e,browR:.1*e,mouth:.06*e});
 if(action==='thinking')Object.assign(pose,{browAngleL:.04*e,mouthX:-.035*e});
 else if(action==='blocked')Object.assign(pose,{browAngleL:.055*e,browAngleR:-.035*e,browForm:-.04*e});
 else if(action==='error')Object.assign(pose,{browAngleL:-.05*e,browAngleR:.05*e,browForm:-.06*e});
 else if(['done','celebrate','greet','notice'].includes(action))Object.assign(pose,{browForm:.05*e,browAngleL:.025*e,browAngleR:-.025*e});
 return pose;
}
