export const CATEGORIES = [
  {id:'cap',name:'Captação',color:'#48d6a0',soft:'rgba(72,214,160,.16)',icon:'arrow'},
  {id:'ag',name:'Alocação',color:'#7199ff',soft:'rgba(113,153,255,.18)',icon:'pie'},
  {id:'seg',name:'Seguros',color:'#ffd075',soft:'rgba(255,208,117,.16)',icon:'shield'},
  {id:'con',name:'Consórcio',color:'#b29aff',soft:'rgba(178,154,255,.18)',icon:'home'}
];
export const CLASSES=['Renda Fixa','Previdência','Multimercados','Fundo Aberto','Renda Variável','Fundos Listados','Alternativos','Internacional','Não informado'];
export const classLabel=x=>x==='Fundos Listados'?'Fundos Imobiliários':x;
// Cores por classe iguais às do Construtor de Carteiras do Hub do Assessor.
export const CLASS_COLORS={'Renda Fixa':'#2BD9A6','Previdência':'#E8709B','Multimercados':'#7C8CFF','Fundo Aberto':'#5AC8A8','Renda Variável':'#F26522','Fundos Listados':'#FFB020','Fundos Imobiliários':'#FFB020','Alternativos':'#C77DFF','Internacional':'#36C5F0','Não informado':'#8d8aa6'};
export const COLORS=['#2BD9A6','#7C8CFF','#F26522','#FFB020','#C77DFF','#36C5F0','#E8709B','#5AC8A8','#8d8aa6'];
export const classColor=(name,i=0)=>CLASS_COLORS[name]||COLORS[i%COLORS.length];
const slug=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const estimateId=(clientId,institution,cls)=>`est-${clientId}-${slug(institution)}-${slug(cls)}`;
// Lê a posição estimada (sliders) de um cliente numa instituição: total e % por classe.
export function estimateOf(assets,clientId,institution){
  const norm=s=>String(s||'').trim().toLowerCase();
  const mine=assets.filter(a=>a.clientId===clientId&&a.estimated&&!a.deletedAt&&norm(a.institution)===norm(institution));
  const total=mine.reduce((n,a)=>n+(+a.value||0),0), pct={};
  for(const a of mine)pct[a.class]=(pct[a.class]||0)+(total?Math.round((+a.value||0)/total*100):0);
  return {total,pct,count:mine.length};
}
// Converte total + % por classe em operações sobre os registros de carteira (upsert por classe, remove o que zerou).
export function estimateOperations(assets,clientId,institution,total,pct,asOf){
  const ops=[], existing=new Map(assets.filter(a=>a.clientId===clientId&&a.estimated&&String(a.institution).trim().toLowerCase()===String(institution).trim().toLowerCase()).map(a=>[a.id,a]));
  const stamp=new Date().toISOString();
  for(const [cls,p] of Object.entries(pct)){
    const id=estimateId(clientId,institution,cls), value=Math.round(total*(+p||0)/100*100)/100;
    if(value>0)ops.push({type:'assets',id,patch:{id,clientId,institution,name:'Posição estimada',class:cls,value,asOf,estimated:true,pct:+p,deletedAt:null,updatedAt:stamp}});
    else if(existing.has(id)&&!existing.get(id).deletedAt)ops.push({type:'assets',id,patch:{deletedAt:stamp,updatedAt:stamp}});
    existing.delete(id);
  }
  for(const [id,a] of existing)if(!a.deletedAt)ops.push({type:'assets',id,patch:{deletedAt:stamp,updatedAt:stamp}});
  return ops;
}
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
// Casa um nome importado com um cliente já cadastrado: nome igual, ou nome curto do cadastro (2+ palavras) que é o começo do nome completo importado.
export function matchClientByName(existing,name){
  const n=normalize(name);if(!n)return null;
  const exact=existing.find(c=>normalize(c.name)===n);if(exact)return {client:exact,fuller:false};
  const prefix=existing.filter(c=>{const e=normalize(c.name);return e.split(' ').length>=2&&n.startsWith(e+' ');});
  return prefix.length===1?{client:prefix[0],fuller:true}:null;
}
const emptyValue=v=>v==null||v===''||v===false||(Array.isArray(v)&&!v.length)||v==='Não informado';
export function importBase(source,state){
  validateState(source);const ops=[];const existing=values(state,'clients');const remap={};let created=0,merged=0,renamed=0;
  for(const [id,value] of Object.entries(source.clients)){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Registro inválido no backup.');
    if(Object.hasOwn(state.clients,id)){ops.push({type:'clients',id,onlyIfAbsent:true,patch:value});continue;}
    const hit=matchClientByName(existing,value.name);
    if(!hit){ops.push({type:'clients',id,onlyIfAbsent:true,patch:value});existing.push(value);created++;continue;}
    const cur=hit.client;remap[id]=cur.id;merged++;
    const fill={};
    for(const [k,v] of Object.entries(value)){if(k==='id'||k==='createdAt')continue;if(k==='name'){if(hit.fuller){fill.name=v;renamed++;}continue;}
      if(k==='potentials'){const mine=cur.potentials||{};fill.potentials={...(v||{}),...Object.fromEntries(Object.entries(mine).filter(([,x])=>x&&x!=='A mapear'))};continue;}
      if(k==='notes'){if(v&&!(cur.notes||'').includes(v))fill.notes=cur.notes?cur.notes+'\n'+v:v;continue;}
      if(emptyValue(cur[k])&&!emptyValue(v))fill[k]=v;}
    if(Object.keys(fill).length)ops.push({type:'clients',id:cur.id,patch:{...fill,updatedAt:new Date().toISOString()}});
  }
  for(const type of ['pipes','assets','imports'])for(const [id,value] of Object.entries(source[type])){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Registro inválido no backup.');
    const patch=value.clientId&&remap[value.clientId]?{...value,clientId:remap[value.clientId]}:value;
    ops.push({type,id,onlyIfAbsent:true,patch});
  }
  const hasData=Object.keys(state.clients).length+Object.keys(state.pipes).length>0;
  for(const [id,value] of Object.entries(source.settings))if(value&&typeof value==='object'&&!Array.isArray(value))ops.push({type:'settings',id,patch:hasData?{...value,...state.settings[id]}:{...state.settings[id],...value}});
  ops.summary={created,merged,renamed};
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
  if(plain.length>620000){const e=Error('Sua base atingiu o limite desta versão. Exporte uma cópia antes de importar mais dados.');e.code='full';throw e;}
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  let binary='';for(let i=0;i<encrypted.length;i+=8192)binary+=String.fromCharCode(...encrypted.subarray(i,i+8192));
  return {v:1,iv:bytesTo64(iv),ciphertext:btoa(binary)};
}
export async function unseal(envelope,key){
  if(envelope?.v!==1)throw Error('Formato de base inválido.');
  try {const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},key,from64(envelope.ciphertext));return JSON.parse(new TextDecoder().decode(plain));}
  catch{throw Error('Não foi possível abrir a base com esta chave. Os dados locais foram preservados.');}
}

// ---- Vínculos automáticos entre pipes, carteira e potenciais ----------------------------------
// Pipe de captação ou alocação -> posição estimada do cliente (mesmo valor, na instituição de origem).
// Posição fora da Rico -> pipe de captação. Potencial mapeado -> pipe genérico da categoria.
export const isRico=inst=>String(inst||'').trim().toLowerCase()==='rico';
export const pipeAssetId=pipeId=>`pipe-asset-${pipeId}`;
export const assetPipeId=assetId=>`asset-pipe-${assetId}`;
export const potentialPipeId=(clientId,cat)=>`pot-pipe-${clientId}-${cat}`;
export const estimatePipeId=(clientId,institution)=>`est-pipe-${clientId}-${slug(institution)}`;
const classForPipe=p=>p.cat==='cap'?(p.subtype==='Previdência'?'Previdência':p.subtype==='STVM'?'Renda Variável':'Não informado'):({RF:'Renda Fixa',RV:'Renda Variável',Previdência:'Previdência',Fundos:'Fundo Aberto',COE:'Alternativos'})[(p.alloc||[])[0]]||'Não informado';
// Operações de carteira derivadas de um pipe salvo (novo ou editado).
export function pipeAssetOperations(pipe,state,asOf){
  if(!pipe||!['cap','ag'].includes(pipe.cat)||pipe.fromAsset)return [];
  const id=pipeAssetId(pipe.id),cur=state.assets[id],stamp=new Date().toISOString();
  const gone=pipe.deletedAt||pipe.outcome==='Perdido'||pipe.retired;
  if(!(pipe.value>0)||gone){return cur&&!cur.deletedAt?[{type:'assets',id,patch:{deletedAt:stamp,updatedAt:stamp}}]:[];}
  const institution=pipe.cat==='ag'||pipe.outcome==='Ganho'?'Rico':(pipe.origin||'Outra instituição');
  const patch={id,clientId:pipe.clientId,institution,name:(pipe.outcome==='Ganho'?'Captado · ':'Pipe · ')+(pipe.title||pipe.subtype||(pipe.cat==='ag'?'Alocação':'Captação')),class:classForPipe(pipe),value:pipe.value,asOf,notes:'Vinculado automaticamente ao pipe.',fromPipe:pipe.id,deletedAt:null,updatedAt:stamp};
  if(cur&&!cur.deletedAt&&cur.institution===institution&&cur.value===pipe.value&&cur.class===patch.class&&cur.name===patch.name)return [];
  return [{type:'assets',id,patch}];
}
// Pipe de captação derivado de uma posição informada fora da Rico.
export function assetPipeOperations(asset,state,date){
  if(!asset||asset.fromPipe||asset.estimated)return [];
  const id=assetPipeId(asset.id),cur=state.pipes[id],stamp=new Date().toISOString();
  if(isRico(asset.institution)||asset.deletedAt||!(asset.value>0)){return cur&&!cur.deletedAt&&!cur.outcome?[{type:'pipes',id,patch:{deletedAt:stamp,updatedAt:stamp}}]:[];}
  if(cur){return cur.deletedAt||cur.outcome||cur.value===asset.value?[]:[{type:'pipes',id,patch:{value:asset.value,origin:asset.institution,updatedAt:stamp}}];}
  const subtype=asset.class==='Previdência'?'Previdência':'TED';
  return [{type:'pipes',id,patch:{id,clientId:asset.clientId,client:state.clients[asset.clientId]?.name||'',title:`Trazer ${asset.name||'posição'} do ${asset.institution}`,cat:'cap',value:asset.value,stage:'Primeiro contato',date,subtype,origin:asset.institution,nota:5,next:'',notes:'Criado automaticamente a partir da carteira.',alloc:[],snoozeUntil:null,retired:false,fromAsset:asset.id,createdAt:stamp,updatedAt:stamp}}];
}
// Um pipe de captação por instituição estimada fora da Rico, com o total da estimativa.
export function estimatePipeOperations(clientId,institution,total,state,date){
  if(isRico(institution))return [];
  const id=estimatePipeId(clientId,institution),cur=state.pipes[id],stamp=new Date().toISOString();
  if(!(total>0))return cur&&!cur.deletedAt&&!cur.outcome?[{type:'pipes',id,patch:{deletedAt:stamp,updatedAt:stamp}}]:[];
  if(cur)return cur.deletedAt||cur.outcome||cur.value===total?[]:[{type:'pipes',id,patch:{value:total,updatedAt:stamp}}];
  return [{type:'pipes',id,patch:{id,clientId,client:state.clients[clientId]?.name||'',title:`Trazer a carteira do ${institution}`,cat:'cap',value:total,stage:'Primeiro contato',date,subtype:'TED',origin:institution,nota:5,next:'',notes:'Criado automaticamente a partir da posição estimada.',alloc:[],snoozeUntil:null,retired:false,fromEstimate:true,createdAt:stamp,updatedAt:stamp}}];
}
// Potencial recém-mapeado (Alto/Médio/Baixo) sem pipe ativo na categoria -> pipe genérico.
const LEVEL_NOTA={Alto:8,'Médio':5,Baixo:2};
export function potentialPipeOperations(client,previous,state,date){
  const ops=[],stamp=new Date().toISOString(),pot=client.potentials||{},before=previous?.potentials||{};
  for(const cat of CATEGORIES){
    const level=pot[cat.id];if(!LEVEL_NOTA[level]||before[cat.id]===level)continue;
    const hasActive=Object.values(state.pipes).some(p=>p.clientId===client.id&&p.cat===cat.id&&!p.deletedAt&&!p.outcome&&!p.retired);
    const id=potentialPipeId(client.id,cat.id);if(hasActive||state.pipes[id])continue;
    ops.push({type:'pipes',id,patch:{id,clientId:client.id,client:client.name,title:`Potencial ${level.toLowerCase()} em ${cat.name.toLowerCase()}`,cat:cat.id,value:0,stage:'Primeiro contato',date,subtype:'',origin:'',nota:LEVEL_NOTA[level],next:'Definir a oportunidade',notes:'Criado automaticamente a partir do mapa de potencial.',alloc:[],snoozeUntil:null,retired:false,fromPotential:true,createdAt:stamp,updatedAt:stamp}});
  }
  return ops;
}

// ---- Dias úteis: nada de pipe em sábado ou domingo ---------------------------------------------
const isoOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const isWeekend=iso=>{if(!iso)return false;const g=new Date(String(iso).slice(0,10)+'T12:00:00').getDay();return g===0||g===6;};
// Sábado ou domingo vão para a segunda seguinte (ou, com back=true, para a sexta anterior).
export function businessDay(iso,back=false){if(!iso)return iso;const d=new Date(String(iso).slice(0,10)+'T12:00:00');if(isNaN(d))return iso;while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+(back?-1:1));return isoOf(d);}
// Corrige pipes abertos que ficaram com data ou retorno em fim de semana.
export function weekendFixOperations(state){
  const ops=[],stamp=new Date().toISOString();
  for(const p of Object.values(state.pipes||{})){
    if(p.deletedAt||p.outcome||p.retired)continue;
    const patch={};if(isWeekend(p.date))patch.date=businessDay(p.date);if(isWeekend(p.snoozeUntil))patch.snoozeUntil=businessDay(p.snoozeUntil);
    if(Object.keys(patch).length)ops.push({type:'pipes',id:p.id,patch:{...patch,updatedAt:stamp}});
  }
  return ops;
}

// ---- Classificação do cliente (A–D) --------------------------------------------------------------
// A: muito próximo · B: próximo · C: já conversamos (teve pipe) · D: a conhecer. Nenhum cliente fica sem classe.
export const TIERS=[
  {id:'A',name:'Muito próximo',color:'#ffb547'},
  {id:'B',name:'Próximo',color:'#48d6a0'},
  {id:'C',name:'Já conversamos',color:'#7199ff'},
  {id:'D',name:'A conhecer',color:'#a79fc9'}
];
export const tierOf=id=>TIERS.find(t=>t.id===id)||null;
// Pipes que o próprio app cria (a partir de potencial, carteira ou estimativa) não significam que houve conversa.
export const isAutoPipe=p=>!!(p&&(p.fromPotential||p.fromAsset||p.fromEstimate));
export const hadConversation=(state,clientId)=>Object.values(state.pipes||{}).some(p=>p.clientId===clientId&&!isAutoPipe(p));
// Sem classe ou D com pipe no histórico -> C; sem classe e sem pipe -> D. A e B nunca são rebaixados.
export function tierFixOperations(state){
  const ops=[],stamp=new Date().toISOString(),talked=new Set(Object.values(state.pipes||{}).filter(p=>!isAutoPipe(p)).map(p=>p.clientId));
  for(const c of Object.values(state.clients||{})){
    if(c.deletedAt||['A','B','C'].includes(c.tier))continue;
    const next=talked.has(c.id)?'C':'D';
    if(c.tier!==next)ops.push({type:'clients',id:c.id,patch:{tier:next,updatedAt:stamp}});
  }
  return ops;
}
// Ao registrar um pipe, cliente D (ou sem classe) passa a C.
export const tierAfterPipe=tier=>['A','B','C'].includes(tier)?tier:'C';
export function tierStats(state){
  const counts={A:0,B:0,C:0,D:0};let total=0;
  for(const c of Object.values(state.clients||{})){if(c.deletedAt)continue;total++;counts[['A','B','C'].includes(c.tier)?c.tier:'D']++;}
  return {total,counts,pct:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,total?v/total*100:0]))};
}
// Desempenho dos pipes: conversão = ganhos ÷ (ganhos + perdidos).
export function pipeStats(state,todayIso){
  const s={won:0,lost:0,open:0,overdue:0,snoozed:0,trash:0,wonValue:0,lostValue:0,openValue:0,overdueValue:0};
  for(const p of Object.values(state.pipes||{})){
    const v=Number(p.value)||0;
    if(p.outcome==='Ganho'){s.won++;s.wonValue+=v;continue;}
    if(p.outcome==='Perdido'){s.lost++;s.lostValue+=v;continue;}
    if(p.deletedAt){s.trash++;continue;}
    if(p.retired)continue;
    if(p.snoozeUntil&&p.snoozeUntil>todayIso){s.snoozed++;continue;}
    s.open++;s.openValue+=v;
    if(p.date&&p.date<todayIso){s.overdue++;s.overdueValue+=v;}
  }
  const decided=s.won+s.lost,decidedValue=s.wonValue+s.lostValue;
  s.conversion=decided?s.won/decided*100:null;s.valueConversion=decidedValue?s.wonValue/decidedValue*100:null;
  return s;
}

// ---- Patrimônio XP do Hub do Assessor ---------------------------------------------------------
// Arquivo {kind:'rico-custody', asOf, rows:[{name,value}]}: só nome e patrimônio na Rico.
// Casa por nome (sem acento, ignorando o sufixo " · conta N"), atualiza a custódia na Rico e acrescenta quem falta.
// Nunca apaga nem funde clientes; contas da mesma pessoa somam no total dela.
const nameKey=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s*·\s*conta\b.*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
const PARTICLES=new Set(['de','da','do','dos','das','e','di','del','della','y','van','von']);
export const titleName=s=>String(s||'').trim().toLowerCase().split(/\s+/).map((w,i)=>i&&PARTICLES.has(w)?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const cents=n=>Math.round((Number(n)||0)*100)/100;
export function custodyOperations(source,state,stamp=new Date().toISOString()){
  if(source?.kind!=='rico-custody'||!Array.isArray(source.rows))throw Error('Arquivo de custódia inválido.');
  const asOf=source.asOf||stamp.slice(0,10),clients=values(state,'clients'),assets=values(state,'assets');
  const groups=new Map();
  for(const r of source.rows){const k=nameKey(r?.name),v=cents(r?.value);if(!k||!(v>=0))continue;if(!groups.has(k))groups.set(k,{name:String(r.name),values:[]});groups.get(k).values.push(v);}
  const hubKeys=[...groups.keys()],exactKeys=new Set(clients.map(c=>nameKey(c.name)).filter(k=>groups.has(k)));
  const ops=[],touched=new Set();let created=0,renamed=0;
  const ricoOf=id=>assets.filter(a=>a.clientId===id&&isRico(a.institution));
  const note='Patrimônio XP (Hub do Assessor)';
  const setCustody=(client,value)=>{
    const rico=ricoOf(client.id),main=rico.find(a=>a.name==='Custódia na Rico');
    const rest=cents(Math.max(0,value-rico.filter(a=>a!==main).reduce((n,a)=>n+(+a.value||0),0)));
    if(main){if(cents(main.value)!==rest||main.asOf!==asOf){ops.push({type:'assets',id:main.id,patch:{value:rest,asOf,notes:note,updatedAt:stamp}});touched.add(client.id);}return;}
    if(rest>0){const id=`hub-net-${client.id}`;ops.push({type:'assets',id,onlyIfAbsent:true,patch:{id,clientId:client.id,institution:'Rico',name:'Custódia na Rico',class:'Não informado',value:rest,asOf,notes:note,createdAt:stamp}});touched.add(client.id);}
  };
  for(const [k,g] of groups){
    const sum=cents(g.values.reduce((a,b)=>a+b,0));
    let cands=clients.filter(c=>nameKey(c.name)===k),fuller=false;
    if(!cands.length){
      const pre=clients.filter(c=>{const e=nameKey(c.name);return e.split(' ').length>=2&&!exactKeys.has(e)&&k.startsWith(e+' ')&&hubKeys.filter(h=>h.startsWith(e+' ')).length===1;});
      if(pre.length===1){cands=pre;fuller=true;}
    }
    if(!cands.length){
      const id=`hub-${stable(k)}`;if(Object.hasOwn(state.clients,id))continue;
      const client={id,name:titleName(g.name),phone:'',email:'',profile:'Não informado',tier:'D',notes:'',likes:[],potentials:{},createdAt:stamp};
      ops.push({type:'clients',id,onlyIfAbsent:true,patch:client});clients.push(client);created++;setCustody(client,sum);continue;
    }
    if(fuller){ops.push({type:'clients',id:cands[0].id,patch:{name:titleName(g.name),updatedAt:stamp}});renamed++;}
    if(cands.length===1){setCustody(cands[0],sum);continue;}
    // Mesma pessoa cadastrada mais de uma vez (uma por conta): cada conta do Hub vai para o cadastro de custódia mais próxima.
    const held=c=>ricoOf(c.id).reduce((n,a)=>n+(+a.value||0),0),pairs=[];
    for(const c of cands)g.values.forEach((v,i)=>pairs.push({c,i,d:Math.abs(held(c)-v)}));
    pairs.sort((a,b)=>a.d-b.d);const usedV=new Set(),assign=new Map();
    for(const p of pairs){if(assign.has(p.c.id)||usedV.has(p.i))continue;assign.set(p.c.id,g.values[p.i]);usedV.add(p.i);}
    const left=g.values.filter((v,i)=>!usedV.has(i)).reduce((a,b)=>a+b,0);let first=true;
    for(const c of cands)if(assign.has(c.id)){setCustody(c,assign.get(c.id)+(first?left:0));first=false;}
  }
  // Distribuição da carteira do Hub (D-3): só percentuais agregados por classe, para o painel da lista.
  if(Array.isArray(source.mix)&&source.mix.length){const items=source.mix.filter(m=>m&&m.name&&Number(m.pct)>0).map(m=>({name:String(m.name),pct:Number(m.pct),color:/^#[0-9a-f]{6}$/i.test(m.color||'')?m.color:''}));
    if(items.length)ops.push({type:'settings',id:'hubMix',patch:{asOf:source.mixAsOf||asOf,label:source.mixLabel||'D-3',items,total:cents(source.rows.reduce((n,r)=>n+(Number(r?.value)||0),0))}});}
  ops.summary={people:groups.size,created,renamed,updated:[...touched].filter(id=>!id.startsWith('hub-')||Object.hasOwn(state.clients,id)).length,total:cents([...groups.values()].reduce((n,g)=>n+g.values.reduce((a,b)=>a+b,0),0))};
  return ops;
}
