import {gatewayRequest} from '../lib/gateway.mjs';
import {ACTIVITIES} from '../lib/activity-director.mjs';
const action=process.argv[2],duration=Number(process.argv[3] || 2500);
let token;
try{
 if(!ACTIVITIES.includes(action)||!Number.isFinite(duration)||duration<200||duration>15000)throw new Error('Usage: node scripts/report-activity.mjs <thinking|reading|searching|editing|testing|running|done|error|blocked|idle> [duration-ms: 200–15000]');
 const pane=process.env.HERDR_PANE_ID,herdr=process.env.HERDR_SOCKET_PATH;if(!pane||!herdr)throw new Error('Run from the agent’s Herdr pane with HERDR_PANE_ID and HERDR_SOCKET_PATH.');
 token=(await gatewayRequest({method:'register',pane,herdr})).token;
 const result=await gatewayRequest({method:'call',token,tool:action==='idle'?'avatar_reset':'avatar_animate',arguments:action==='idle'?{}:{action,duration_ms:duration}});console.log(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(token)await gatewayRequest({method:'unregister',token}).catch(()=>{});}
