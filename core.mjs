export const CATEGORIES = [
  {id:'cap',name:'Captação',color:'#258777',soft:'#e5f3ee',icon:'arrow'},
  {id:'ag',name:'Alocação',color:'#4475c7',soft:'#eaf0fb',icon:'pie'},
  {id:'seg',name:'Seguros',color:'#b58b24',soft:'#fbf3db',icon:'shield'},
  {id:'con',name:'Consórcio',color:'#8c67b8',soft:'#f1eafb',icon:'home'}
];
export const CLASSES=['Renda Fixa','Previdência','Multimercados','Fundo Aberto','Renda Variável','Fundos Listados','Alternativos','Internacional','Não informado'];
export const classLabel=x=>x==='Fundos Listados'?'Fundos Imobiliários':x;
export const COLORS=['#438b7a','#5386cd','#8c74bd','#68ada9','#e89054','#bc9a42','#c87899','#506779','#c5cbc9'];
export const STAGES=['Primeiro contato','Em análise','Proposta enviada','Negociação','Aguardando decisão','Aceito falta push'];
export const SUBTYPES=['TED','STVM','Previdência','PJ','Consultoria','Originação','Outros'];
export const rank=n=>n>=8?'A':n>=5?'B':'C';
export const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2});
export const shortMoney=n=>Math.abs(n)>=1e6?'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi':Math.abs(n)>=1000?'R$ '+(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil':money(n);
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const uid=()=>crypto.randomUUID();
export const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const values=(state,type)=>Object.values(state[type]||{}).filter(x=>!x.deletedAt);
export function emptyState(){return {version:3,revision:0,clients:{},pipes:{},assets:{},imports:{},settings:{goals:{cap:800000,aloc:1700000,seg:12000,con:200000},manual:{},mereo:{},classes:{items:[...CLASSES]}}};}
export function applyOperations(input,operations){
  const state=structuredClone(input);
  for(const op of operations){
    if(!['clients','pipes','assets','imports','settings'].includes(op.type))throw Error('Tipo de registro inválido');
    if(['__proto__','constructor','prototype'].includes(op.id))throw Error('Identificador inválido');
    if(op.onlyIfAbsent && Object.hasOwn(state[op.type],op.id))continue;
    state[op.type][op.id]={...(state[op.type][op.id]||{}),...op.patch};
  }
  return state;
}
export function validateState(s){
  if(s?.version!==3||!['clients','pipes','assets','settings','imports'].every(k=>s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])))throw Error('Este arquivo não é uma base de clientes compatível.');
  return s;
}
export function importBase(source,state){
  validateState(source);const ops=[];
  for(const type of ['clients','pipes','assets','imports'])for(const [id,value] of Object.entries(source[type])){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Registro inválido no backup.');
    ops.push({type,id,onlyIfAbsent:true,patch:value});
  }
  const hasData=Object.keys(state.clients).length+Object.keys(state.pipes).length>0;
  for(const [id,value] of Object.entries(source.settings))if(value&&typeof value==='object'&&!Array.isArray(value))ops.push({type:'settings',id,patch:hasData?{...value,...state.settings[id]}:{...state.settings[id],...value}});
  return ops;
}
export const weight=p=>p.cat==='cap'&&['Previdência','STVM'].includes(p.subtype)?1.25:1;
export const weighted=p=>(Number(p.value)||0)*weight(p);
export const active=p=>!p.deletedAt&&!p.outcome&&!p.retired&&(!p.snoozeUntil||p.snoozeUntil<=today());
export function monthData(state,month){
  const key=`${month.slice(0,4)}-${Number(month.slice(5))-1}`;
  const manual=state.settings.manual?.[key]||{}, mm=state.settings.mereo?.[key]||{};
  const all=values(state,'pipes'), won=all.filter(p=>p.outcome==='Ganho'&&String(p.closedAt||'').slice(0,7)===month);
  const sum=(cats,fn=()=>true)=>won.filter(p=>cats.includes(p.cat)&&fn(p)).reduce((n,p)=>n+weighted(p),0);
  const realized={cap:sum(['cap'])+(+manual.cap||0),aloc:sum(['ag','rv'])+(+manual.aloc||0)+(+manual.rv||0),seg:sum(['seg'])+(+manual.seg||0),con:sum(['con'])+(+manual.con||0)};
  const inv=mm.ovAloc??(realized.aloc+sum(['cap'],p=>p.subtype==='Previdência'));
  const cap=mm.ovCap??realized.cap, seg=mm.ovSeg??realized.seg, con=mm.ovCon??realized.con;
  const points=(+mm.cards||0)+con/10000+seg/1000;
  const pct=(v,m)=>m>0?v/m*100:0;
  const score=(p,curve)=>{if(p<=curve[0])return 1;if(p>=curve[4])return 5;for(let i=0;i<4;i++)if(p<=curve[i+1])return i+1+(p-curve[i])/(curve[i+1]-curve[i]);return 1;};
  const components=[
    {name:'Captação',value:cap,goal:state.settings.goals.cap,weight:.4,curve:[20,60,100,140,180]},
    {name:'Cesta investimento',value:inv,goal:2200000,weight:.2,curve:[60,80,100,120,140]},
    {name:'Crossell',value:points,goal:25,weight:.1,curve:[60,80,100,120,140],unit:'pts'},
    {name:'Índice comercial',value:mm.ic??83,goal:83,weight:.1,curve:[80,90,100,110,120],unit:'%',assumed:mm.ic==null},
    {name:'NPS',value:mm.nps??41.3,goal:41.3,weight:.2,curve:[60,80,100,120,140],unit:'',assumed:mm.nps==null}
  ].map(c=>({...c,score:score(pct(c.value,c.goal),c.curve)}));
  const pipeline={};
  for(const cat of CATEGORIES){const group=all.filter(p=>active(p)&&p.cat===cat.id&&String(p.date).slice(0,7)===month);pipeline[cat.id]={a:0,b:0,c:0};for(const p of group)pipeline[cat.id][rank(p.nota).toLowerCase()]+=weighted(p);}
  return {realized,pipeline,components,score:components.reduce((s,c)=>s+c.score*c.weight,0),key,manual,mm};
}
const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
function stable(s){let a=2166136261,b=5381;for(const ch of String(s)){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}return (a>>>0).toString(36)+(b>>>0).toString(36);}
function parse(raw,fallback){try{return typeof raw==='string'?JSON.parse(raw):raw??fallback;}catch{return fallback;}}
export function legacyPayload(source){
  if(Array.isArray(source))return {pipes:source,history:[]};
  const raw=source?.data||source||{};
  if(Array.isArray(raw.pipes))return {pipes:raw.pipes,history:Array.isArray(raw.history)?raw.history:[],raw};
  const pick=keys=>{for(const k of keys){const p=parse(raw[k],null);if(Array.isArray(p))return p;}return [];};
  const pipeKeys=['ricoPipeline.v4','ricoPipeline.backup','ricoPipeline.v3','ricoPipeline.v2','ricoPipeline.v1'];
  const populated=pipeKeys.map(k=>parse(raw[k],null)).find(p=>Array.isArray(p)&&p.length);
  return {pipes:populated||pick(pipeKeys),history:pick(['ricoPipeline.history.v1','ricoPipeline.history.backup']),raw};
}
export function migrateLegacy(source,state=emptyState()){
  const {pipes,history,raw={}}=legacyPayload(source), operations=[], clients=new Map(values(state,'clients').map(c=>[normalize(c.name),c.id]));
  let addedClients=0,addedPipes=0,retired=0;
  const merged=new Map();
  [...pipes,...history.map(p=>({...p,outcome:p.outcome||'Ganho'}))].forEach(p=>{
    if(!p||typeof p!=='object')return;
    const id=String(p.id||`legacy-${stable(JSON.stringify(p))}`);merged.set(id,p);
  });
  for(const [oldId,p] of merged){
    const name=String(p.client||'Cliente sem nome').trim(), normalized=normalize(name);
    let clientId=clients.get(normalized);
    if(!clientId){clientId=`legacy-client-${stable(normalized)}`;clients.set(normalized,clientId);operations.push({type:'clients',id:clientId,onlyIfAbsent:true,patch:{id:clientId,name,profile:'Não informado',potentials:{},notes:'',createdAt:new Date().toISOString()}});addedClients++;}
    const id=`legacy-pipe-${oldId}`;
    if(Object.hasOwn(state.pipes,id))continue;
    const isRetired=p.cat==='rv'||!CATEGORIES.some(c=>c.id===p.cat);
    const closedStage=!p.outcome&&['Ganho','Perdido'].includes(p.stage)?{outcome:p.stage}:{};
    operations.push({type:'pipes',id,onlyIfAbsent:true,patch:{...p,...closedStage,id,legacyId:oldId,clientId,client:name,cat:p.cat||'rv',value:Number(p.value)||0,nota:Number(p.nota)||0,stage:p.stage||'Primeiro contato',retired:isRetired,legacyOriginal:p}});
    addedPipes++;if(isRetired)retired++;
  }
  const fingerprint=stable(JSON.stringify(source));
  if(!Object.hasOwn(state.imports,fingerprint)){
    operations.push({type:'imports',id:fingerprint,onlyIfAbsent:true,patch:{id:fingerprint,importedAt:new Date().toISOString(),pipeCount:merged.size,source}});
    const mapping=[['ricoPipeline.goals','goals'],['ricoPipeline.manualReal','manual'],['ricoPipeline.mereo','mereo']];
    for(const [old,key] of mapping){const data=parse(raw[old],null);if(data&&typeof data==='object'){
      const first=Object.keys(state.imports).length===0;
      const patch=first?{...state.settings[key],...data}:{...data,...state.settings[key]};
      operations.push({type:'settings',id:key,patch});
    }}
  }
  return {operations,addedClients,addedPipes,retired,total:merged.size};
}
const bytesTo64=b=>btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const from64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export const generateKey=()=>`RICO-${bytesTo64(crypto.getRandomValues(new Uint8Array(32)))}`;
export async function vaultCredentials(access){
  const text=String(access).trim();if(!/^RICO-[A-Za-z0-9_-]{43}$/.test(text))throw Error('Cole a chave completa, começando por RICO-.');
  const material=await crypto.subtle.importKey('raw',from64(text.slice(5)),'HKDF',false,['deriveKey','deriveBits']);
  const params={name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode('rico-clients-v3')};
  const key=await crypto.subtle.deriveKey({...params,info:new TextEncoder().encode('encryption')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const path=await crypto.subtle.deriveBits({...params,info:new TextEncoder().encode('document')},material,256);
  return {key,id:`v3-${bytesTo64(new Uint8Array(path))}`};
}
export async function seal(value,key){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plain=new TextEncoder().encode(JSON.stringify(value));
  if(plain.length>620000)throw Error('Sua base atingiu o limite desta versão. Exporte uma cópia antes de importar mais dados.');
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  let binary='';for(let i=0;i<encrypted.length;i+=8192)binary+=String.fromCharCode(...encrypted.subarray(i,i+8192));
  return {v:1,iv:bytesTo64(iv),ciphertext:btoa(binary)};
}
export async function unseal(envelope,key){
  if(envelope?.v!==1)throw Error('Formato de base inválido.');
  try {const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},key,from64(envelope.ciphertext));return JSON.parse(new TextDecoder().decode(plain));}
  catch{throw Error('Não foi possível abrir a base com esta chave. Os dados locais foram preservados.');}
}
