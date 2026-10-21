"use strict";(()=>{var b="openchamber.sdk";var ke="data-oc-scrolling",Xe=`
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${ke}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${ke}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${ke}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${ke}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;function je(e){let o=e.documentElement;if(o.hasAttribute("data-oc-scrollbar-activity"))return;o.setAttribute("data-oc-scrollbar-activity","");let r=new WeakMap;e.addEventListener("scroll",s=>{let a=s.target===e?o:s.target;if(!(a instanceof Element))return;a.hasAttribute("data-oc-scrolling")||a.setAttribute("data-oc-scrolling","");let i=r.get(a);i!==void 0&&clearTimeout(i),r.set(a,setTimeout(()=>{r.delete(a),a.removeAttribute("data-oc-scrolling")},1e3))},{capture:!0,passive:!0})}var qo=`(${je.toString()})(document);`;var Wt=/^[a-z][a-z0-9-]{0,39}$/;var Vt=e=>Object(e)===e&&!Array.isArray(e),Ve=(e,o)=>Object.keys(e).every(r=>o.includes(r)),zt=e=>String(e)===e&&e.length>=1&&e.length<=60,Kt=e=>String(e)===e&&e.length>=1&&e.length<=80,Jt=e=>{if(!Array.isArray(e)||e.length>4)return!1;let o=new Set;for(let r of e){if(!Vt(r)||!Wt.test(r.id)||!zt(r.label)||r.disabled!==void 0&&r.disabled!==!0&&r.disabled!==!1||o.has(r.id))return!1;if(o.add(r.id),r.kind==="button"){if(!Ve(r,["kind","id","label","disabled"]))return!1;continue}if(r.kind!=="select"||!Ve(r,["kind","id","label","value","options","disabled"])||!Kt(r.value)||!Array.isArray(r.options)||r.options.length<1||r.options.length>16)return!1;let s=new Set;for(let a of r.options){if(!Vt(a)||!Ve(a,["value","label"])||!Kt(a.value)||!zt(a.label)||s.has(a.value))return!1;s.add(a.value)}if(!s.has(r.value))return!1}return!0};var ze=e=>"bytes"in e?e.bytes.byteLength:e.content.length,Yt=(e,o)=>{if(e.path!==o.path||e.readOnly!==o.readOnly)return!1;if(e.encoding==="text"||o.encoding==="text")return e.encoding==="text"&&o.encoding==="text"&&e.content===o.content;if(e.bytes.byteLength!==o.bytes.byteLength)return!1;for(let r=0;r<e.bytes.byteLength;r+=1)if(e.bytes[r]!==o.bytes[r])return!1;return!0};var qt=/^[A-Za-z0-9_-]{1,80}$/;var Qt=["left","right","top","bottom"];var Zt=(e,o=0,r={remaining:16e3})=>{if(--r.remaining<0||o>=32)return!1;if(e===null)return!0;let s=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let a of s)if(!Zt(a,o+1,r))return!1;return!0},Ke=e=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every(o=>/^(0|[1-9]\d*)$/.test(o)&&Number(o)<e.length)&&e.every(Ke);if(Object(e)===e){let o=Object.getPrototypeOf(e);return(o===null||o===Object.prototype)&&Object.values(e).every(Ke)}return String(e)===e||Number.isFinite(e)},We=e=>{try{return String(e.id)!==e.id||!qt.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!Qt.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!Zt(e.data)||!Ke(e.data)?!1:JSON.stringify(e.data).length<=16e3}catch{return!1}};var to=["file","directory","other","missing"],Ye=e=>!!(e&&"sessionId"in e),qe=e=>!!(e&&"sent"in e&&!("sessionId"in e));var oo=/^[0-9a-f]{7,64}$/i,Qe=e=>oo.test(e),xe=500,ye=32e3,ro=16e3,no=128,so=200,io=2e3,ao=16e3,co=80,lo=200,po=16e3;var uo=2e3;var Ze=2e4,Ae=1024,ve=2e6;var we=64e3,Re=8e3,et=4e3;var tt=9e4;var fo=999,mo=1e4,fe=500,Eo=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],To=["stopped","starting","ready","failed"],Qo=new Set(Eo),go=e=>Qo.has(e),ho=e=>e&&go(e)?e:"HOST_REJECTED",ae=e=>e===void 0?!1:e===null||e===!0||e===!1||String(e)===e?!0:Number(e)===e?Number.isFinite(e):Array.isArray(e)?e.every(ae):Object(e)===e?Object.values(e).every(ae):!1,bo=e=>ae(e)&&JSON.stringify(e).length<=po,eo=e=>e?.trim().slice(0,lo)??"",ce=e=>{let o=e.id.trim().slice(0,no),r=e.title.trim().slice(0,so),s=e.url.trim().slice(0,io),a=e.text?.trim().slice(0,ao),i=e.author?.trim().slice(0,co),d=e.kind==="pull"?"pull":"issue",p={providerId:e.providerId.trim(),id:o,title:r||o,url:s,kind:d};if(a&&(p.text=a),i&&(p.author=i),d==="pull"){let c=eo(e.branches?.head),g=eo(e.branches?.base);c&&g&&(p.branches={head:c,base:g})}return bo(e.data)&&(p.data=e.data),p},ot=e=>{let o=ce(e);return e.projectId&&(o.projectId=e.projectId),e.navigation&&(o.navigation=e.navigation),e.worktree&&(o.worktree=e.worktree),o},rt=e=>{let o={text:e.text.trim().slice(0,ro)};return e.send&&(o.send=!0),o},nt=e=>e===null||!Number.isFinite(e)?null:Math.min(fo,Math.max(0,Math.round(e))),st=e=>Number.isFinite(e)?Math.min(mo,Math.max(0,Math.ceil(e))):0;var le=e=>e.length>0&&e.length<=Ae&&!e.includes("\0")&&!e.includes("\\");var Oe=e=>!e.startsWith("/")||e.includes("\0")||e.includes("\\")||e.includes("://")||e.length>uo?!1:!e.split("/").some(r=>r==="."||r===".."),Zo=new Set(To),it=e=>!!(e&&"status"in e&&Zo.has(String(e.status))&&!("body"in e)),Ce=e=>!!(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),at=e=>!!(e&&"content"in e&&String(e.content)===e.content),ct=e=>!!(e&&"written"in e&&e.written===!0),lt=e=>!!(e&&"entries"in e&&Array.isArray(e.entries)),er=new Set(to),dt=e=>!!(e&&"kind"in e&&"size"in e&&er.has(String(e.kind))&&Number.isFinite(e.size)),pt=e=>!!(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),tr=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","status-control-event","popover-closed","file-open","file-snapshot","file-saved"]),or=e=>Object(e)===e?e:null,Je=e=>String(e)===e&&e.length>0,rr=e=>{if(!Je(e.id))return null;if(e.ok===!0){let o={channel:b,v:1,type:"result",id:e.id,ok:!0};return Object(e.payload)===e.payload&&(o.payload=e.payload),o}return e.ok===!1&&Je(e.error)?{channel:b,v:1,type:"result",id:e.id,ok:!1,error:e.error,code:ho(Je(e.code)?e.code:void 0)}:null},ut=e=>{let o=or(e);return!o||o.channel!==b||o.v!==1?null:o.type==="result"?rr(o):!tr.has(String(o.type))||Object(o.payload)!==o.payload?null:o};var _o=e=>"key"in e&&"metaKey"in e&&"ctrlKey"in e,nr=e=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s",f=class extends Error{code;constructor(o,r){super(r),this.name="HostRequestError",this.code=o}},So=()=>Promise.reject(new f("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),Le=()=>Promise.reject(new f("BAD_PATH",`File path must be 1 to ${Ae} characters without NUL or backslash.`)),Ie=e=>{if(e!==void 0){if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new f("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0}},T=e=>(e.value+=1,`oc-${e.value}`),gt=(e={})=>{let o=e.target??("window"in globalThis?window:null);if(!o)throw new f("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let r=e.acceptSource??(t=>t===o.parent),s=e.requestTimeoutMs??Ze,a=new Set,i=new Set,d=new Set,p=new Set,c=new Set,g=new Set,A=new Set,U=new Set,S=new Set,j=null,P=null,H=new Set,D=new Set,F=null,J=null,Q=!1,$=new Map,te=new Map,Z=new Map,Y=!1,E={value:0},m=null,h=null,B=!1,ue=!1,Mt=null,Gt=t=>t?{sessionId:t.id,phase:t.busy?"started":"completed"}:null,K=t=>{o.parent.postMessage(t,"*")},L=(t,n)=>{for(let l of t)try{l(n)}catch(u){console.error(u)}},Pt=t=>{if(!(t instanceof MessageEvent)||!r(t.source))return;let n=ut(t.data);if(!n)return;if(n.type==="workspace"){let u=te.get(n.payload.subscriptionId);u&&L([u],n.payload.snapshot);return}if(n.type==="shells"){let u=Z.get(n.payload.subscriptionId);u&&L([u],n.payload.snapshot);return}if(n.type==="ready"){m=n.payload,h=Gt(n.payload.session),L(a,n.payload),L(i,n.payload.directory),L(d,n.payload.session),h&&L(p,h),L(c,n.payload.connection),L(g,n.payload.settings),L(A,n.payload.item);return}if(n.type==="directory"){m&&(m={...m,directory:n.payload.directory}),L(i,n.payload.directory);return}if(n.type==="session"){m&&(m={...m,session:n.payload.session}),n.payload.session?h?.sessionId!==n.payload.session.id&&(h=Gt(n.payload.session)):h=null,L(d,n.payload.session);return}if(n.type==="session-lifecycle"){h=n.payload,L(p,n.payload);return}if(n.type==="connection"){m&&(m={...m,connection:n.payload.connection}),L(c,n.payload.connection);return}if(n.type==="settings"){m&&(m={...m,settings:n.payload.settings}),L(g,n.payload.settings);return}if(n.type==="item"){m&&(m={...m,item:n.payload.item}),L(A,n.payload.item);return}if(n.type==="status-control-event"){L(U,n.payload);return}if(n.type==="popover-closed"){L(S,n.payload);return}if(n.type==="action"){let u=k=>{Y||K({channel:b,v:1,type:"action-result",id:n.id,payload:k})},x=P;if(!x){u({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>x(n.payload)).then(()=>u({ok:!0}),k=>{let O=(k instanceof Error?k.message:String(k)).trim();u({ok:!1,error:(O||"Action failed.").slice(0,fe)})});return}if(n.type==="file-open"){let u=n.payload;if(J&&Yt(J,u))return;J=u,L(H,n.payload);return}if(n.type==="file-saved"){L(D,n.payload.version);return}if(n.type==="file-snapshot"){let u=O=>{Y||K({channel:b,v:1,type:"file-snapshot-result",id:n.id,payload:O})},x=O=>u({error:(O.trim()||"Could not read the edited file.").slice(0,fe)}),k=F;if(!k){x("This extension does not edit files.");return}Promise.resolve().then(()=>k(n.payload.purpose)).then(O=>{if(ze(O)>2e7){x(`The file is over ${2e7} ${"bytes"in O?"bytes":"characters"}.`);return}if(O.version.length>256){x(`The snapshot version is over ${256} characters.`);return}u({snapshot:"bytes"in O?{bytes:O.bytes,version:O.version}:{content:O.content,version:O.version}})},O=>x(O instanceof Error?O.message:String(O)));return}if(n.type==="resolve"){let u=k=>{K({channel:b,v:1,type:"resolve-result",id:n.id,payload:k})},x=j;if(!x){u({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>x(n.payload)).then(k=>u({item:k?ce(k):null}),k=>{let O=(k instanceof Error?k.message:String(k)).trim();u({error:(O||"Command failed.").slice(0,fe)})});return}let l=$.get(n.id);if(l){if(clearTimeout(l.timer),$.delete(n.id),n.ok){l.resolve(n.payload);return}l.reject(new f(n.code,n.error))}};o.addEventListener("message",Pt),K({channel:b,v:1,type:"hello"});let N=(t,n=s)=>Y||o.parent===o?Promise.reject(new f("HOST_UNAVAILABLE","No host frame. This page is not in an iframe.")):new Promise((l,u)=>{let x=setTimeout(()=>{$.delete(t.id),u(new f("HOST_TIMEOUT","Host did not answer in time."))},n);$.set(t.id,{resolve:l,reject:u,timer:x}),K(t)}),w=t=>N(t).then(()=>{}),R={channel:b,v:1},Fe=t=>{!Y&&o.parent!==o&&K(t)},Nt=()=>Fe({...R,type:"file-save"}),Ht=t=>{!_o(t)||!nr(t)||(t.preventDefault(),Nt())},Dt=t=>{!_o(t)||t.key!=="Escape"||m?.surface!=="popover"||!m.popover||(t.preventDefault(),Xt(m.popover.id,"escape").catch(()=>{}))},be=()=>{let t=m?.surface==="popover"?m.popover:void 0;if(!t)return;let n=B||ue;Mt!==n&&(Mt=n,jt(t.id,n).catch(()=>{}))},_e=()=>{m?.surface!=="popover"||B||(B=!0,be())},Ft=t=>{m?.surface!=="popover"||t.relatedTarget!==null||!B||(B=!1,be())},$t=()=>{m?.surface!=="popover"||ue||(ue=!0,be())},Bt=()=>{m?.surface!=="popover"||!ue||(ue=!1,be())},q=(t,n=1024)=>{if(!t.trim()||t.length>n)throw new f("HOST_REJECTED",`Identity must contain 1 to ${n} characters.`)},$e=async t=>{t.kind!=="projects"&&q(t.projectId);let n=await N({...R,type:"workspace-read",id:T(E),payload:t});if(!n||!("kind"in n)||!("state"in n)||n.kind!==t.kind)throw new f("HOST_REJECTED","Host did not return workspace data.");return n},Be=async(t,n)=>{t.kind!=="projects"&&q(t.projectId);let l=T(E);te.set(l,n);try{await w({...R,type:"workspace-subscribe",id:T(E),payload:{subscriptionId:l,query:t}})}catch(u){throw te.delete(l),Y||K({...R,type:"workspace-unsubscribe",id:T(E),payload:{subscriptionId:l}}),u}return()=>{!te.delete(l)||Y||K({...R,type:"workspace-unsubscribe",id:T(E),payload:{subscriptionId:l}})}},Yo=async(t,n)=>{t.kind==="session"&&q(t.sessionId),t.kind==="project"&&q(t.projectId);let l=T(E);Z.set(l,n);try{await w({...R,type:"shells-subscribe",id:T(E),payload:{subscriptionId:l,scope:t}})}catch(u){throw Z.delete(l),Y||K({...R,type:"shells-unsubscribe",id:T(E),payload:{subscriptionId:l}}),u}return()=>{!Z.delete(l)||Y||K({...R,type:"shells-unsubscribe",id:T(E),payload:{subscriptionId:l}})}},Se=async t=>{if("key"in t&&(t.key.length===0||t.key.length>128))throw new f("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!ae(t.value))throw new f("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>65536)throw new f("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&m?.features?.deviceStorage!==!0)throw new f("UNSUPPORTED","This host does not support device storage.");let n=await N({...R,type:"storage",id:T(E),payload:t});if(!n||!("storage"in n)||n.op!==t.op)throw new f("HOST_REJECTED","Host did not return storage data.");return n},Xt=(t,n)=>m?.features?.popovers!==!0&&!(m?.surface==="popover"&&m.popover?.id===t)?Promise.reject(new f("UNSUPPORTED","This host does not support popovers.")):w({...R,type:"popover-close",id:T(E),payload:n?{id:t,reason:n}:{id:t}}),jt=(t,n)=>m?.features?.popovers!==!0&&!(m?.surface==="popover"&&m.popover?.id===t)?Promise.reject(new f("UNSUPPORTED","This host does not support popovers.")):w({...R,type:"popover-anchor",id:T(E),payload:{id:t,active:n}});return o.addEventListener("keydown",Dt,!0),o.addEventListener("pointerover",_e),o.addEventListener("pointermove",_e),o.addEventListener("pointerout",Ft),o.addEventListener("focus",$t),o.addEventListener("blur",Bt),{onAction:t=>(P=t,()=>{P===t&&(P=null)}),listProjects:async()=>{let t=await $e({kind:"projects"});if(t.kind!=="projects")throw new f("HOST_REJECTED","Expected projects.");return t},listWorktrees:async t=>{let n=await $e({kind:"worktrees",projectId:t});if(n.kind!=="worktrees")throw new f("HOST_REJECTED","Expected worktrees.");return n},listSessions:async t=>{let n=await $e({kind:"sessions",projectId:t});if(n.kind!=="sessions")throw new f("HOST_REJECTED","Expected sessions.");return n},onProjects:t=>Be({kind:"projects"},n=>{n.kind==="projects"&&t(n)}),onWorktrees:(t,n)=>Be({kind:"worktrees",projectId:t},l=>{l.kind==="worktrees"&&n(l)}),onSessions:(t,n)=>Be({kind:"sessions",projectId:t},l=>{l.kind==="sessions"&&n(l)}),onRunningShells:(t,n)=>Yo(t,n),readShellOutput:async(t,n)=>{q(t,128);let l=n?.cursor;if(l!==void 0&&(!Number.isInteger(l)||l<0))throw new f("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let u=n?.tailBytes;if(u!==void 0&&(!Number.isInteger(u)||u<1||u>65536))throw new f("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${65536}.`);let k=await N({...R,type:"shell-output",id:T(E),payload:{shellId:t,cursor:l,tailBytes:u}});if(!k||typeof k.output!="string"||!Number.isFinite(k.cursor))throw new f("HOST_REJECTED","Host did not return shell output.");return k},stopShell:async t=>{if(q(t,128),(await N({...R,type:"shell-stop",id:T(E),payload:{shellId:t}}))?.stopped!==!0)throw new f("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async t=>{q(t),await w({...R,type:"open-session",id:T(E),payload:{sessionId:t}})},storage:{get:async(t,n)=>{let l=Ie(n),u={op:"get",key:t};l&&(u.scope=l);let x=await Se(u);return x.op==="get"&&x.found?x.value:void 0},set:async(t,n,l)=>{let u=Ie(l),x={op:"set",key:t,value:n};u&&(x.scope=u),await Se(x)},delete:async(t,n)=>{let l=Ie(n),u={op:"delete",key:t};l&&(u.scope=l),await Se(u)},keys:async t=>{let n=Ie(t),l={op:"keys"};n&&(l.scope=n);let u=await Se(l);if(u.op!=="keys")throw new f("HOST_REJECTED","Expected storage keys.");return u.keys}},onReady:t=>(a.add(t),m&&t(m),()=>{a.delete(t)}),onDirectory:t=>(i.add(t),m&&t(m.directory),()=>{i.delete(t)}),onSession:t=>(d.add(t),m&&t(m.session),()=>{d.delete(t)}),onSessionLifecycle:t=>(p.add(t),h&&t(h),()=>{p.delete(t)}),onConnection:t=>(c.add(t),m&&t(m.connection),()=>{c.delete(t)}),onSettings:t=>(g.add(t),m&&t(m.settings),()=>{g.delete(t)}),onItem:t=>(A.add(t),m&&t(m.item),()=>{A.delete(t)}),onStatusControl:t=>(U.add(t),()=>{U.delete(t)}),onPopoverClosed:t=>(S.add(t),()=>{S.delete(t)}),setStatusControls:t=>m?.features?.statusControls!==!0?Promise.reject(new f("UNSUPPORTED","This host does not support status controls.")):Jt(t)?w({...R,type:"status-controls",id:T(E),payload:{controls:t}}):Promise.reject(new f("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options.")),openPopover:t=>m?.features?.popovers!==!0?Promise.reject(new f("UNSUPPORTED","This host does not support popovers.")):We(t)?w({...R,type:"popover-open",id:T(E),payload:t}):Promise.reject(new f("HOST_REJECTED","Popover requests need bounded geometry and JSON data.")),closePopover:Xt,setPopoverAnchorActive:jt,onResolve:t=>(j=t,()=>{j===t&&(j=null)}),toast:t=>{let n=t.message.trim();return!n||n.length>xe?Promise.reject(new f("HOST_REJECTED",`Toast message must contain 1 to ${xe} characters.`)):t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>ye)?Promise.reject(new f("HOST_REJECTED",`Toast copy text must contain 1 to ${ye} characters.`)):w({channel:b,v:1,type:"toast",id:T(E),payload:{...t,message:n}})},openUrl:t=>w({channel:b,v:1,type:"open-url",id:T(E),payload:{url:t}}),openCommit:t=>Qe(t)?w({channel:b,v:1,type:"open-commit",id:T(E),payload:{sha:t}}):Promise.reject(new f("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),openSurface:t=>w({channel:b,v:1,type:"open-surface",id:T(E),payload:{surfaceId:t}}),writeClipboard:t=>w({channel:b,v:1,type:"clipboard-write",id:T(E),payload:{text:t}}),compose:t=>w({channel:b,v:1,type:"compose",id:T(E),payload:t}),attach:t=>w({channel:b,v:1,type:"attach",id:T(E),payload:ce(t)}),startSession:async t=>{t.projectId!==void 0&&q(t.projectId);let n=t.worktree;n&&n!==!0&&(n.kind==="existing"?q(n.directory):(n.name!==void 0&&q(n.name,200),n.baseBranch!==void 0&&q(n.baseBranch,200)));let l=await N({channel:b,v:1,type:"start-session",id:T(E),payload:ot(t)},e.requestTimeoutMs??18e4);if(!Ye(l))throw new f("HOST_REJECTED","Host did not return a session.");return l},prompt:t=>N({channel:b,v:1,type:"prompt",id:T(E),payload:rt(t)}).then(n=>{if(!qe(n))throw new f("HOST_REJECTED","Host did not return a prompt result.");return n}),sessionLink:t=>w({channel:b,v:1,type:"session-link",id:T(E),payload:ce(t)}),close:()=>w({channel:b,v:1,type:"close",id:T(E)}),oauthStart:()=>w({channel:b,v:1,type:"oauth-start",id:T(E)}),oauthDisconnect:()=>w({channel:b,v:1,type:"oauth-disconnect",id:T(E)}),request:t=>(Oe(t.path)?N({channel:b,v:1,type:"request",id:T(E),payload:t}):So()).then(n=>{if(!Ce(n))throw new f("HOST_REJECTED","Host request result was empty.");return n}),serviceRequest:t=>(Oe(t.path)?N({channel:b,v:1,type:"service-request",id:T(E),payload:t}):So()).then(n=>{if(!Ce(n))throw new f("HOST_REJECTED","Host service request result was empty.");return n}),serviceStatus:()=>N({channel:b,v:1,type:"service-status",id:T(E)}).then(t=>{if(!it(t))throw new f("HOST_REJECTED","Host did not return service status.");return t}),readFile:t=>(le(t)?N({channel:b,v:1,type:"file-read",id:T(E),payload:{path:t}}):Le()).then(n=>{if(!at(n))throw new f("HOST_REJECTED","Host did not return file content.");return n}),writeFile:(t,n)=>le(t)?n.length>ve?Promise.reject(new f("FILE_TOO_LARGE",`Content is over ${ve} characters.`)):N({channel:b,v:1,type:"file-write",id:T(E),payload:{path:t,content:n}}).then(l=>{if(!ct(l))throw new f("HOST_REJECTED","Host did not confirm the write.");return l}):Le(),listDir:t=>(le(t)?N({channel:b,v:1,type:"file-list",id:T(E),payload:{path:t}}):Le()).then(n=>{if(!lt(n))throw new f("HOST_REJECTED","Host did not return directory entries.");return n}),stat:t=>(le(t)?N({channel:b,v:1,type:"file-stat",id:T(E),payload:{path:t}}):Le()).then(n=>{if(!dt(n))throw new f("HOST_REJECTED","Host did not return file status.");return n}),generate:t=>{let n=t.prompt.trim(),l=t.system?.trim();if(n.length===0||n.length>we)return Promise.reject(new f("HOST_REJECTED",`Prompt must be 1 to ${we} characters.`));if(l!==void 0&&(l.length===0||l.length>Re))return Promise.reject(new f("HOST_REJECTED",`System prompt must be 1 to ${Re} characters.`));let u=t.maxOutputTokens===void 0?void 0:Math.min(et,Math.max(1,Math.floor(t.maxOutputTokens)));if(u!==void 0&&!Number.isFinite(u))return Promise.reject(new f("HOST_REJECTED","maxOutputTokens must be a number."));let x={prompt:n};return l!==void 0&&(x.system=l),u!==void 0&&(x.maxOutputTokens=u),N({channel:b,v:1,type:"generate",id:T(E),payload:x},e.requestTimeoutMs??tt).then(k=>{if(!pt(k))throw new f("HOST_REJECTED","Host did not return generated text.");return k})},setBadge:t=>w({channel:b,v:1,type:"badge",id:T(E),payload:{count:nt(t)}}),setHeight:t=>w({channel:b,v:1,type:"resize",id:T(E),payload:{height:st(t)}}),onFileOpen:t=>(H.add(t),Q||(Q=!0,o.addEventListener("keydown",Ht,!0)),J&&t(J),()=>{H.delete(t)}),onFileSnapshot:t=>(F=t,()=>{F===t&&(F=null)}),onFileSaved:t=>(D.add(t),()=>{D.delete(t)}),reportFileChange:t=>Fe({...R,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:Nt,reportFileUnsupported:()=>Fe({...R,type:"file-unsupported"}),dispose:()=>{for(let t of te.keys())K({...R,type:"workspace-unsubscribe",id:T(E),payload:{subscriptionId:t}});te.clear();for(let t of Z.keys())K({...R,type:"shells-unsubscribe",id:T(E),payload:{subscriptionId:t}});Z.clear(),Y=!0,j=null,P=null,F=null,H.clear(),D.clear(),Q&&o.removeEventListener("keydown",Ht,!0),o.removeEventListener("message",Pt),o.removeEventListener("keydown",Dt,!0),o.removeEventListener("pointerover",_e),o.removeEventListener("pointermove",_e),o.removeEventListener("pointerout",Ft),o.removeEventListener("focus",$t),o.removeEventListener("blur",Bt);for(let t of $.values())clearTimeout(t.timer),t.reject(new f("HOST_UNAVAILABLE","Host client was disposed."));$.clear(),a.clear(),i.clear(),d.clear(),p.clear(),c.clear(),g.clear(),A.clear(),U.clear(),S.clear()}}};var yo=["browser.open","browser.snapshot","browser.click","browser.type","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize"];var hn=new Set(yo);var Ao=["none","agent","user"];var _n=new Set(Ao);var sr=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],ir=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],vo=(e,o)=>{o.style.colorScheme=e.mode;for(let[r,s]of sr)o.style.setProperty(r,e.tokens[s]);for(let[r,s,a]of ir){let i=e.tokens[a]??"";o.style.setProperty(r,i),o.style.setProperty(s,i)}o.style.setProperty("font-family",e.tokens.font),o.style.setProperty("font-size","0.875rem"),o.style.setProperty("line-height","1.45"),o.style.setProperty("color",e.tokens.foreground)},ht=(e,o)=>{vo(e.theme,o),o.dataset&&(o.dataset.ocSurface=e.surface,o.dataset.ocTheme=e.theme.mode)};var ar={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},y=(e,o)=>`var(--${e}, var(--oc-${ar[e]}, ${o}))`,se=y("surface-background","transparent"),Ue=y("surface-elevated","transparent"),me=y("surface-elevated-foreground","inherit"),re=y("surface-foreground","inherit"),v=y("surface-muted-foreground","gray"),cr=y("surface-muted","transparent"),W=y("interactive-border","currentColor"),V=y("interactive-hover","transparent"),ie=y("interactive-active","transparent"),bt=y("interactive-selection","transparent"),_t=y("interactive-selection-foreground","inherit"),Oo=y("interactive-focus-ring","currentColor"),oe=y("primary","currentColor"),St=y("primary-text","inherit"),kt=y("error-text","inherit"),lr=y("font-sans","inherit"),xt=y("font-mono","monospace"),Co=y("radius","9px"),yt=`calc(${Co} - 2px)`,wo=`calc(${Co} - 4px)`,I=(e,o,r="transparent")=>`color-mix(in srgb, ${e} ${o}%, ${r})`,Ro=`box-shadow: 0 0 0 2px ${Oo};`,Me=e=>{let o=y(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${o}; --oc-sdk-tone-text: ${y(`${e}-text`,"inherit")}; }`},dr=`
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 12px; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: 6px; height: 28px; padding: 0 10px; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: 4px; height: 24px; padding: 0 8px; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: 14px; height: 14px; }

.oc-sdk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: 32px; padding: 0 10px; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: 8px 10px; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: 34px; padding-right: 34px; }
.oc-sdk-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: 24px; height: 24px; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: 6px; width: 100%; min-width: 0; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: 2px; min-width: 160px; max-width: calc(100vw - 16px); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 4px; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: 2px 2px 4px; }
.oc-sdk-popup-search .oc-sdk-input { height: 28px; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: 14px; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: 8px; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-top: 3px; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: 36px; height: 20px; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: 2px; padding: 2px; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: 1px 6px; font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: 16px 8px; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 40px 16px; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: 12px; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: 16px; height: 16px; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: 12px; height: 12px; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: 8px; width: 100%; margin: 8px 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: 4px 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: 6px; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: 8px 0; }
`,Lo=`
.oc-sdk { color: ${re}; font-family: ${lr}; }
.oc-sdk :focus-visible { outline: none; ${Ro} }
.oc-sdk-mono { font-family: ${xt}; }
.oc-sdk-muted { color: ${v}; }
${Me("success")}${Me("warning")}${Me("error")}${Me("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${oe}; --oc-sdk-tone-text: ${St}; }

.oc-sdk-btn { border-radius: ${yt}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${wo}; }
.oc-sdk-btn[data-variant="default"] { color: ${St}; background: ${I(oe,10,se)}; border-color: ${I(oe,12)}; }
.oc-sdk-btn[data-variant="default"]:hover { background: ${I(oe,16,se)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${I(oe,22,se)}; }
.oc-sdk-btn[data-variant="secondary"] { background: ${cr}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${ie}, ${ie}); }
.oc-sdk-btn[data-variant="outline"] { background: ${Ue}; color: ${me}; border-color: ${W}; }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${ie}, ${ie}); }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${V}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${ie}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${y("status-error","red")}; color: ${kt}; background: ${I("var(--oc-sdk-tone)",7,se)}; border-color: ${I("var(--oc-sdk-tone)",12)}; }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${I("var(--oc-sdk-tone)",9,se)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${I("var(--oc-sdk-tone)",11,se)}; }

.oc-sdk-field-note { color: ${v}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${kt}; }
.oc-sdk-input { border-radius: ${yt}; background: ${Ue}; color: ${me}; box-shadow: inset 0 0 0 1px ${I(W,60)}; transition: background 150ms ease-out, box-shadow 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${v}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { box-shadow: inset 0 0 0 2px ${Oo}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input { box-shadow: inset 0 0 0 1px ${y("status-error","red")}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { box-shadow: inset 0 0 0 2px ${y("status-error","red")}; }
.oc-sdk-input[data-mono="true"] { font-family: ${xt}; }

.oc-sdk-search-icon { color: ${v}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${oe}; }
.oc-sdk-search-clear { border-radius: ${wo}; color: ${v}; }
.oc-sdk-search-clear:hover { background: ${V}; color: ${re}; }

.oc-sdk-trigger { border-color: ${W}; border-radius: ${yt}; background: ${Ue}; color: ${me}; transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${V}, ${V}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${ie}, ${ie}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${v}; }
.oc-sdk-trigger-chevron { color: ${v}; }
.oc-sdk-popup { --surface-foreground: ${me}; border-color: ${I(W,60)}; border-radius: 12px; background: ${Ue}; color: ${me}; box-shadow: 0 8px 24px ${I(re,12)}; }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${V}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${bt}; color: ${_t}; }
.oc-sdk-option-check { color: ${re}; }
.oc-sdk-option[data-destructive="true"] { color: ${kt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${I(y("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${v}; }
.oc-sdk-popup-empty { color: ${v}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${W}; border-radius: 4px; color: ${re}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${I(re,60,W)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${W}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${se}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${oe}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${Ro} }
.oc-sdk-check-desc { color: ${v}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${I(re,4)}; }
.oc-sdk-tab { border-radius: 8px; color: ${v}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${re}; }
.oc-sdk-tab[aria-selected="true"] { color: ${_t}; background: ${bt}; border-color: ${W}; }
.oc-sdk-tab-count { color: ${v}; }

.oc-sdk-badge { border-radius: 9999px; background: ${V}; color: ${v}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${I("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${V}; }
.oc-sdk-row[aria-selected="true"] { background: ${bt}; color: ${_t}; }
.oc-sdk-row-lead { font-family: ${xt}; color: ${v}; }
.oc-sdk-row-sub { color: ${v}; }
.oc-sdk-row-meta { color: ${v}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${v}; }

.oc-sdk-empty-body { color: ${v}; }

.oc-sdk-spinner { color: ${v}; }
.oc-sdk-spinner-ring { border-color: ${W}; border-top-color: ${oe}; border-radius: 9999px; }

.oc-sdk-banner { border-color: ${I("var(--oc-sdk-tone)",40)}; border-radius: 8px; background: ${I("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${v}; }

.oc-sdk-separator { color: ${v}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${I(W,40)}; }

.oc-sdk-progress-label { color: ${v}; }
.oc-sdk-progress-track { border-radius: 9999px; background: ${W}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${oe}); }

.oc-sdk-text a { color: ${St}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${I(W,60)}; }
`,M=`
${Xe}
${dr}
${Lo}`;var Io="oc-sdk-ui-style";var G=e=>{let o=document.getElementById(Io);if(o instanceof HTMLStyleElement){o.textContent!==e&&(o.textContent=e);return}je(document);let r=document.createElement("style");r.id=Io,r.textContent=e,document.head.appendChild(r)},C=(e,o)=>{let r=document.createElement(e);return o&&(r.className=o),r},ne=e=>{let o=C("button",e);return o.type="button",o},z=(e,o)=>{let r=o??"";e.textContent!==r&&(e.textContent=r)},de=(e,o,r)=>{r==null||r===""?e.removeAttribute(o):e.getAttribute(o)!==r&&e.setAttribute(o,r)};var pr=()=>{let e=document.createElement("span");return e.className="oc-sdk-spinner-ring",e.setAttribute("aria-hidden","true"),e},pe=(e,o)=>{G(M);let r=o,s=ne("oc-sdk oc-sdk-btn"),a=pr(),i=document.createElement("span");s.append(i),e.append(s);let d=()=>{s.dataset.variant=r.variant??"default",s.dataset.size=r.size??"default",s.disabled=!!r.disabled||!!r.loading,s.dataset.loading=r.loading?"true":"false",s.setAttribute("aria-busy",r.loading?"true":"false"),r.loading&&a.parentNode!==s?s.prepend(a):!r.loading&&a.parentNode===s&&a.remove(),z(i,r.label)},p=()=>{r.disabled||r.loading||r.onClick()};return s.addEventListener("click",p),d(),{update:c=>{r={...r,...c},d()},dispose:()=>{s.removeEventListener("click",p),s.remove()}}};var vt=(e,o)=>{de(e,"data-tone",o&&o!=="neutral"?o:null)},wt=(e,o)=>{G(M);let r=o,s=C("span","oc-sdk oc-sdk-badge");e.append(s);let a=()=>{z(s,r.label),vt(s,r.tone)};return a(),{update:i=>{r={...r,...i},a()},dispose:()=>{s.remove()}}};var Rt=(e,o={})=>{G(M);let r=o,s=C("span","oc-sdk oc-sdk-spinner");s.setAttribute("role","status");let a=C("span","oc-sdk-spinner-ring");a.setAttribute("aria-hidden","true");let i=C("span");s.append(a,i),e.append(s);let d=()=>{s.dataset.size=r.size??"default",z(i,r.label),i.hidden=!r.label,s.setAttribute("aria-label",r.label??"Loading")};return d(),{update:p=>{r={...r,...p},d()},dispose:()=>{s.remove()}}};var Er=["research","prototype","grilling","task"],Ee=["needs-triage","needs-info","ready-for-agent","ready-for-human","wontfix"],Tr=["bug","enhancement"],gr=new Set(["resolved","closed","done","wontfix","cancelled","canceled"]),hr=new Set(["claimed","in-progress","in_progress"]),Mo=["Blocked by","Status","Type","Labels","Assignees"],br=Mo.map(e=>e.replace(/\s+/g,"\\s+")).join("|"),_r=new RegExp(`^(\\s*)(\\*\\*)?(${br})(?=\\s|\\*|:)`,"i"),Sr=/^#\s+(.+?)\s*$/,Go=/^##\s+(.+?)\s*$/,kr=/^\s*(```|~~~)/,xr=e=>e.replace(/\\/g,"/").replace(/^\.\//,"").replace(/\/+/g,"/");var Po=e=>e.replace(/\.md$/i,""),yr=e=>{let o=Po(e).match(/^(\d{1,4})(?:[-_.\s]|$)/);if(!o)return{number:null,numberValue:null};let r=o[1]??"";return{number:r,numberValue:Number(r)}},Ar=e=>Po(e).replace(/^\d{1,4}[-_.\s]+/,""),vr=e=>{let o=xr(e),r=o.split("/"),s=r[r.length-1]??"",a=r.lastIndexOf(".scratch"),i=a>=0?r.slice(a+1):[],d=()=>a<0?r.length>1?r[r.length-2]??"":"":i.length>=2&&i[0]!=="issues"?i[0]??"":"",p=/^map\.md$/i.test(s),c=/^spec\.md$/i.test(s),g=i.length>=1&&(i[0]==="issues"||i[0]==="tickets"),{number:A,numberValue:U}=p||c?{number:null,numberValue:null}:yr(s);return{path:o,kind:p?"map":c?"spec":g||U!==null?"ticket":"spec",feature:d(),number:A,numberValue:U,slug:p?"map":c?"spec":Ar(s)}},wr=(e,o=0)=>{let r=_r.exec(e);if(!r)return null;let s=(r[3]??"").replace(/\s+/g," ").toLowerCase(),a=Mo.find(A=>A.toLowerCase()===s);if(!a)return null;let i=r[0].length,d=()=>{for(;i<e.length&&(e[i]===" "||e[i]==="	");)i+=1};if(d(),e.startsWith(":**",i))i+=3;else if(e.startsWith("**",i))if(i+=2,d(),e[i]===":")i+=1;else return null;else if(e[i]===":")i+=1;else return null;d();let p=e,c=i,g=e.length;for(;g>c&&(e[g-1]===" "||e[g-1]==="	");)g-=1;return{label:a,lineIndex:o,raw:p,value:e.slice(c,g),valueStart:c,valueEnd:g}},Rr=e=>{let o=e.trim();if(!o||/^(none|n\/a)\b/i.test(o)||/^[—–-]$/.test(o))return[];let r=[],s=new Set;for(let a of o.replace(/\s+and\s+/gi,",").split(/[,;]/)){let i=a.trim().match(/^#?\s*(\d{1,4})\b/);if(!i)continue;let d=i[1]??"",p=Number(d);!Number.isFinite(p)||s.has(p)||(s.add(p),r.push({number:d,value:p}))}return r},Or=e=>e.split(/[,;]/).map(o=>o.trim()).filter(Boolean),Cr=e=>{let o=[],r=0;for(;r<e.length;){let s=r;for(;s<e.length&&e[s]!==`
`&&e[s]!=="\r";)s+=1;let a=e.slice(r,s),i="";e[s]==="\r"&&e[s+1]===`
`?(i=`\r
`,s+=2):e[s]==="\r"?(i="\r",s+=1):e[s]===`
`&&(i=`
`,s+=1),o.push({text:a,eol:i}),r=s}return o},Lr=e=>e.includes(`\r
`)?`\r
`:`
`,Ir=e=>Cr(e).map(o=>o.text),Ur=(e,o)=>{let r=!1,s=o===1?Sr:Go;for(let a=0;a<e.length;a+=1){let i=e[a]??"";if(kr.test(i)){r=!r;continue}if(r)continue;let d=i.match(s);if(d)return{index:a,text:d[1]??""}}return null},Uo=(e,o)=>{let r=new RegExp(`^##\\s+${o}\\s*$`,"i"),s=[];for(let a=0;a<e.length;a+=1){if(!r.test(e[a]??""))continue;let i=a+1;for(;i<e.length&&!Go.test(e[i]??"");)i+=1;let d=e.slice(a+1,i).join(`
`).trim();d&&s.push(d),a=i-1}return s},Mr=(e,o)=>e.replace(/^\d{1,4}\s*[:.\-–—]\s*/,"").trim()||e.trim()||o,Gr=e=>{let o=e.replace(/[-_]+/g," ").trim();return o?o.charAt(0).toUpperCase()+o.slice(1):"Untitled ticket"},Te=e=>e!=null&&gr.has(e.trim().toLowerCase()),He=e=>e!=null&&hr.has(e.trim().toLowerCase()),Pr=e=>e!=null&&Ee.includes(e),Nr=(e,o,r={})=>{if(typeof o!="string")throw new Error("ticket content must be text");let s=vr(e),a=Ir(o),i={status:null,type:null,blockedBy:null},d=[],p=a.length;for(let h=0;h<a.length;h+=1){let B=a[h]??"";if(/^##\s+(Comments|Answer)\s*$/i.test(B)){p=h;break}}for(let h=0;h<p;h+=1){let B=wr(a[h]??"",h);B&&d.push(B)}let c=[],g=[],A=h=>d.filter(B=>B.label===h),U=A("Status"),S=A("Type"),j=A("Blocked by"),P=A("Labels");if(U.length>1){let h=new Set(U.map(B=>B.value.trim().toLowerCase()));h.size>1?g.push(`Conflicting Status lines: ${[...h].join(", ")}`):c.push(`Status is written ${U.length} times`)}j.length>1&&c.push(`Blocked by is written ${j.length} times`),S.length>1&&c.push(`Type is written ${S.length} times`),i.status=U[0]??null,i.type=S[0]??null,i.blockedBy=j[0]??null;let H=i.status?.value.trim()??"",D=H?H.toLowerCase():null,F=i.type?.value.trim()??"",J=F?F.toLowerCase():null;J&&!Er.includes(J)&&c.push(`Unknown Type "${F}"`);let Q=[...new Set(P.flatMap(h=>Or(h.value)))],$=Q.map(h=>h.toLowerCase()).find(h=>Tr.includes(h))??null,te=i.blockedBy?Rr(i.blockedBy.value):[];te.some(h=>s.numberValue!==null&&h.value===s.numberValue)&&c.push("Ticket lists itself in Blocked by");let Z=Ur(a,1);Z||c.push("No H1 title; using the file name");let Y=Mr(Z?.text??"",Gr(s.slug)),E=Uo(a,"Comments").join(`

`),m=Uo(a,"Answer").join(`

`);return D&&!Pr(D)&&!Te(D)&&!He(D)&&!Object.values(r).some(h=>h.trim().toLowerCase()===D)&&c.push(`Unrecognised Status "${H}"`),{path:s.path,kind:s.kind,feature:s.feature,number:s.number,numberValue:s.numberValue,slug:s.slug,title:Y,heading:Z?.text??null,status:D,type:J,labels:Q,blockedBy:te,category:$,content:o,lineEnding:Lr(o),fields:i,comments:E,answer:m,warnings:c,conflicts:g}},Ot=(e,o,r={})=>Nr(e,o,r);var X={"needs-triage":"needs-triage","needs-info":"needs-info","ready-for-agent":"ready-for-agent","ready-for-human":"ready-for-human",wontfix:"wontfix"},Ct=e=>e.trim().replace(/^`+/,"").replace(/`+$/,"").trim(),Hr=e=>e.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(o=>o.trim()),No=e=>{let o=Ct(e).toLowerCase();return Ee.includes(o)?o:null},Ho=e=>{if(typeof e!="string"||!e.trim())return null;let o=e.split(/\r?\n/),r=0,s=1,a=!1,i={};for(let d of o){if(!d.includes("|"))continue;let p=Hr(d);if(p.length<2)continue;if(!a&&/role|label|skill|tracker/i.test(d)){let A=p.findIndex(S=>/tracker|actual|label in our|our label/i.test(S)),U=p.findIndex(S=>/role|skill|canonical|mattpocock/i.test(S));A>=0&&U>=0&&(r=U,s=A,a=!0);continue}if(/^[-: ]+$/.test(p.join("")))continue;let c=No(p[r]??"");if(!c)continue;let g=Ct(p[s]??"");g&&g!=="\u2014"&&g!=="-"&&(i[c]=g)}if(Object.keys(i).length===0)for(let d of o){let p=d.match(/^\s*(?:[-*]\s*)?`?(needs-triage|needs-info|ready-for-agent|ready-for-human|wontfix)`?\s*[:=-]\s*(.+?)\s*$/i);if(!p)continue;let c=p[1]?.toLowerCase(),g=Ct(p[2]??"");c&&g&&Ee.includes(c)&&(i[c]=g)}return Object.keys(i).length===0?null:{...X,...i}},ge=(e,o=X)=>{if(!e)return null;let r=e.trim().toLowerCase(),s=No(r);if(s)return s;for(let a of Ee)if(o[a].toLowerCase()===r)return a;return null};var Dr=(e,o)=>{let r=e.numberValue,s=o.numberValue;return r!==null&&s!==null&&r!==s?r-s:r!==null&&s===null?-1:r===null&&s!==null?1:e.path.localeCompare(o.path)},Do=(e,o,r=X)=>{let s=o.filter(c=>c.feature===e.feature),a=new Map;for(let c of s)c.numberValue!==null&&(a.has(c.numberValue)||a.set(c.numberValue,c));let i=e.blockedBy.map(c=>{let g=a.get(c.value)??null,A=g!==null&&(Te(g.status)||ge(g.status,r)==="wontfix");return{ref:c,ticket:g,resolved:A}}),d=i.filter(c=>c.ticket!==null&&!c.resolved),p=i.filter(c=>c.ticket===null);return{blocked:d.length>0||p.length>0,blockers:i,open:d,missing:p,resolved:i.filter(c=>c.resolved)}},Fr=(e,o)=>{let r=ge(e,o);return r==="needs-info"?"needs-info":r==="ready-for-human"?"human":r==="ready-for-agent"||He(e)?"ready":"triage"},Lt=(e,o=[e],r=X)=>Te(e.status)||ge(e.status,r)==="wontfix"?"done":Do(e,o,r).blocked?"blocked":Fr(e.status,r),$r=(e,o=[e],r=X)=>Te(e.status)||He(e.status)||Lt(e,o,r)!=="ready"?!1:!Do(e,o,r).blocked,Fo=(e,o=X)=>e.filter(r=>$r(r,e,o)).sort(Dr);var It="*";var $o=(e,o,r,s=new Map,a=X)=>e.map(i=>{let d=Ot(i.path,i.content,a);return{ticket:d,projectId:o,projectDirectory:r,link:s.get(d.path)??null}}).filter(i=>i.ticket.kind==="ticket"),Bo=(e,o=X)=>e.map(r=>Ot(r.path,r.content,o)).filter(r=>r.kind!=="ticket");var Br=(e,o)=>o.filter(r=>r.projectId===e.projectId&&r.ticket.feature===e.ticket.feature).map(r=>r.ticket),Xo=(e,o,r=X)=>Lt(e.ticket,Br(e,o),r);var jo=(e,o=X)=>{let r=new Set,s=new Map;for(let a of e){let i=`${a.projectId}\0${a.ticket.feature}`,d=s.get(i)??[];d.push(a.ticket),s.set(i,d)}for(let a of s.values()){let i=Fo(a,o)[0];i&&r.add(i.path)}return r};var Xr="prefs",jr={projectId:"",feature:It,query:"",openTicketPath:null},De=(e,o)=>typeof e=="string"&&e.length<=o?e:null,Vr=e=>{if(!e||typeof e!="object"||Array.isArray(e))return{...jr};let o=e;return{projectId:De(o.projectId,512)??"",feature:De(o.feature,500)??It,query:De(o.query,200)??"",openTicketPath:De(o.openTicketPath,2048)}},Vo=async e=>Vr(await e.storage.get(Xr));var zr=e=>Array.isArray(e)?e.filter(o=>typeof o=="string"):[],Kr=e=>{try{let o=JSON.parse(e);return o&&typeof o=="object"&&!Array.isArray(o)?o:null}catch{return null}},Wr=e=>{if(!Array.isArray(e))return null;let o=[];for(let r of e){if(!r||typeof r!="object"||Array.isArray(r))return null;let s=r;if(typeof s.path!="string"||typeof s.content!="string")return null;o.push({path:s.path,content:s.content,mtimeMs:typeof s.mtimeMs=="number"?s.mtimeMs:0})}return o},Jr=e=>e instanceof Error&&e.message?e.message:String(e),zo=async(e,o)=>{try{let r=await e.serviceRequest({method:"GET",path:"/tickets",query:{directory:o}});if(r.status!==200)return{state:"unavailable",message:`Ticket service answered ${r.status}.`};let s=Kr(r.body);if(!s)return{state:"unavailable",message:"Ticket service returned an unreadable answer."};if(s.configured!==!0)return{state:"unconfigured",message:"This project has no .scratch directory yet."};let a=Wr(s.files);if(!a)return{state:"unavailable",message:"Ticket service returned malformed file data."};let i=typeof s.triageLabels=="string"?s.triageLabels:null;return{state:"ready",files:a,triageLabels:Ho(i)??X,triageLabelsSource:i,complete:s.complete===!0,warnings:zr(s.warnings)}}catch(r){return{state:"unavailable",message:`The local ticket service is not available \u2014 ${Jr(r)}`}}};var Ko=async(e,o)=>e.onProjects(r=>o({state:r.state,projects:r.projects}));var Yr=`
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--oc-bg);color:var(--oc-fg);font-family:var(--oc-font);font-size:14px;line-height:1.45}
#root{min-height:100%}
.kb-page{display:flex;flex-direction:column;gap:14px;padding:16px;min-height:100%}
.kb-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kb-toolbar .grow{flex:1;min-width:160px}
.kb-columns{display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:8px;flex:1}
.kb-column{flex:1 0 220px;min-width:220px;max-width:320px;display:flex;flex-direction:column;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:var(--oc-radius,10px);min-height:120px}
.kb-column.kb-dragover{outline:2px solid var(--oc-focus);outline-offset:-2px}
.kb-column.kb-dragover-blocked{outline:2px dashed var(--oc-danger, #c44);outline-offset:-2px;cursor:not-allowed}
.kb-column-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--oc-border)}
.kb-column-title{font-weight:600;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:var(--oc-muted)}
.kb-column-count{font:11px var(--oc-mono);color:var(--oc-muted)}
.kb-column-body{display:flex;flex-direction:column;gap:8px;padding:10px;overflow-y:auto;flex:1;min-height:40px}
.kb-column-empty{font-size:12px;color:var(--oc-muted);padding:8px 2px}
.kb-card{background:var(--oc-elevated);color:var(--oc-elevated-fg);border:1px solid var(--oc-border);border-radius:9px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:6px}
.kb-card:hover{border-color:var(--oc-hover)}
.kb-card.kb-dragging{opacity:.4}
.kb-card.kb-card-needs-attention{border-color:var(--oc-warning);border-left-width:3px}
.kb-card.kb-card-needs-attention:hover{border-color:var(--oc-warning)}
.kb-card-title{font-weight:550;font-size:13px;overflow-wrap:anywhere}
.kb-card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.kb-card-ref{font:11px var(--oc-mono);color:var(--oc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.kb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}
.kb-dialog{background:var(--oc-bg);color:var(--oc-fg);border:1px solid var(--oc-border);border-radius:12px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px}
.kb-dialog h2{margin:0;font-size:18px;letter-spacing:-.01em}
.kb-dialog-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.kb-dialog-grid .kb-span2{grid-column:1/-1}
.kb-section{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--oc-border);padding-top:12px}
.kb-section-title{font-size:12px;font-weight:600;color:var(--oc-muted);text-transform:uppercase;letter-spacing:.02em}
.kb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kb-row.between{justify-content:space-between}
.kb-muted{color:var(--oc-muted);font-size:12px}
.kb-mono{font:12px var(--oc-mono);color:var(--oc-muted)}
.kb-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 16px;color:var(--oc-muted);text-align:center}
.kb-radio-group{display:flex;flex-direction:column;gap:10px}
.kb-radio-option{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.kb-radio-option input{margin-top:3px;accent-color:var(--oc-primary)}
.kb-radio-title{font-weight:550;font-size:13px}
.kb-radio-desc{font-size:12px;color:var(--oc-muted);margin-top:2px}
.kb-banner{display:none}
.kb-banner[data-show]{display:block}
[hidden]{display:none!important}
.kb-dialog-wide{max-width:920px}
.kb-ticket-meta{align-items:center;gap:8px}
.kb-badge{font:11px var(--oc-mono);border:1px solid var(--oc-border);border-radius:999px;padding:1px 7px;color:var(--oc-muted);white-space:nowrap}
.kb-card-number{font:11px var(--oc-mono);color:var(--oc-muted);white-space:nowrap}
.kb-card-title-wrap{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.kb-next{font:10px var(--oc-mono);font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--oc-primary);border:1px solid var(--oc-primary);border-radius:999px;padding:1px 6px}
.kb-card-attention{font-size:11px;color:var(--oc-warning);margin:0}
.kb-card-conflict{font-size:11px;color:var(--oc-danger,var(--oc-warning));margin:0}
.kb-ticket-body{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:8px;padding:10px;margin:0;font:12px/1.5 var(--oc-mono);max-height:340px;overflow:auto}
.kb-ticket-comments{max-height:220px}
.kb-action-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.kb-action{display:flex;flex-direction:column;gap:4px;min-width:0}
.kb-action-reason{font-size:10px;color:var(--oc-muted);line-height:1.25}
.kb-diff{max-height:52vh;overflow:auto;border:1px solid var(--oc-border);border-radius:8px;background:var(--oc-code-bg,var(--oc-muted-surface));padding:8px;font:11px/1.45 var(--oc-mono)}
.kb-diff-line{white-space:pre-wrap;overflow-wrap:anywhere;padding:0 4px;border-radius:2px}
.kb-diff-add{background:color-mix(in srgb,var(--oc-success,#3fb950) 18%,transparent)}
.kb-diff-del{background:color-mix(in srgb,var(--oc-danger,#f85149) 18%,transparent)}
.kb-diff-hunk{color:var(--oc-muted);border-top:1px solid var(--oc-border);margin-top:4px;padding-top:4px}
.kb-commit-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:9px;padding:8px 10px;font-size:12px}
.kb-footer{font-size:12px}
.kb-panel .kb-panel-body{display:flex;flex-direction:column;gap:6px}
.kb-panel .kb-panel-body p{margin:0}
.kb-unlinked-row{border-top:1px solid var(--oc-border);padding-top:8px;margin-top:4px}
`,Wo=()=>{if(document.getElementById("kb-style"))return;let e=document.createElement("style");e.id="kb-style",e.textContent=Yr,document.head.append(e)};var ee=(e,o="",r="")=>{let s=document.createElement(e);return o&&(s.className=o),r&&(s.textContent=r),s};var he=gt(),Ut=document.querySelector("#root");if(!Ut)throw new Error("Missing #root");var Jo=!1;he.onReady(e=>{if(ht(e,document.documentElement),Jo)return;Jo=!0,Wo(),Ut.replaceChildren();let o=ee("div","kb-page kb-panel"),r=ee("div","kb-row between");r.append(ee("h2","","Ticket board"));let s=ee("span");r.append(s);let a=ee("div","kb-panel-body","Loading\u2026");o.append(r,a),o.append(ee("p","kb-muted","Open the full board from the Extension pages menu above the session list to read tickets, change fields, and start agents.")),Ut.append(o);let i=wt(s,{label:"\u2013",tone:"neutral"}),d=Rt(o,{label:"Reading tickets\u2026"}),p=[],c="",g=0,A=async()=>{if(!p.length){a.textContent="No OpenChamber project is available yet.",i.update({label:"\u2013"});return}let S=p.find($=>$.id===c)??p[0];c=S.id;let j=++g;d.update({label:"Reading tickets\u2026"});let P=await zo(he,S.directory);if(j!==g)return;if(P.state!=="ready"){a.textContent=P.state==="unconfigured"?`No .scratch ticket workflow in ${S.name}.`:"Local ticket service unavailable. Approve it in Settings \u2192 Extensions.",i.update({label:"\u2013",tone:"neutral"}),d.dispose();return}let H=$o(P.files,S.id,S.directory,new Map,P.triageLabels),D=Bo(P.files,P.triageLabels),F=H.filter($=>Xo($,H,P.triageLabels)!=="done").length,J=[...jo(H,P.triageLabels)][0],Q=H.find($=>$.ticket.path===J);a.replaceChildren(),a.append(ee("p","",`${S.name}: ${F} open ticket${F===1?"":"s"} of ${H.length}.`)),a.append(ee("p","kb-muted",Q?`Next: #${Q.ticket.number??"\u2013"} ${Q.ticket.title}`:"Nothing is ready for an agent.")),a.append(ee("p","kb-muted",`${D.length} spec/map file${D.length===1?"":"s"} in this project.`)),i.update({label:String(F),tone:F?"info":"neutral"}),d.dispose()},U=null;Vo(he).then(S=>{c=S.projectId}).catch(()=>{}),Ko(he,S=>{S.projects.length&&(p=S.projects,c=p.some(j=>j.id===c)?c:p[0].id,A())}).then(S=>{U=S},()=>{}),pe(o,{label:"Refresh counts",variant:"ghost",onClick:()=>{A()}}),A(),window.addEventListener("pagehide",()=>{U?.()},{once:!0})});window.addEventListener("pagehide",()=>he.dispose());})();
