import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,migrateLegacy,legacyPayload,applyOperations,values,active,weight,monthData,generateKey,vaultCredentials,seal,unseal,validateState,classLabel,importBase,pipeAssetOperations,assetPipeOperations,potentialPipeOperations,estimatePipeOperations,businessDay,weekendFixOperations,tierFixOperations,tierAfterPipe,tierStats,pipeStats,custodyOperations,similarClientGroups,mergeClientOperations,mergeKey,postSaleOperations,pipeStats as ps2,lastPostSaleByClient,daysBetween} from './core.mjs';
import {VaultStore} from './store.mjs';
import * as core from './core.mjs';
const original={id:'123',client:'Maria Exemplo',cat:'cap',value:200000,nota:8,stage:'Negociação',subtype:'STVM',date:'2026-09-20',next:'Telefonar',notes:'Saldo informado no C6.',alloc:['RF'],snoozeUntil:'2026-09-15',archivedAt:'2026-09-01T12:00:00Z',customLegacyField:'preservar'};
test('full backup imports preserve client tiers, assets, custom classes and goals',()=>{const source=emptyState();source.clients.x={id:'x',name:'Client',tier:'D'};source.assets.a={id:'a',clientId:'x',institution:'C6',class:'Renda Fixa',value:200000};source.settings.goals.cap=900000;source.settings.classes.items.push('Custom');const imported=applyOperations(emptyState(),importBase(source,emptyState()));assert.equal(imported.clients.x.tier,'D');assert.equal(imported.assets.a.value,200000);assert.equal(imported.settings.goals.cap,900000);assert.ok(imported.settings.classes.items.includes('Custom'));imported.settings.goals.cap=1100000;const again=applyOperations(imported,importBase(source,imported));assert.equal(again.settings.goals.cap,1100000);});
test('migration preserves every original pipe field, client relationship and original snapshot',()=>{
  const source={pipes:[original,{...original,id:'124',cat:'rv'}],history:[{...original,id:'125',outcome:'Ganho',closedAt:'2026-09-12T12:00:00Z'}]};const before=JSON.stringify(source);
  const m=migrateLegacy(source),s=applyOperations(emptyState(),m.operations);assert.equal(m.addedClients,1);assert.equal(m.addedPipes,3);assert.equal(m.retired,1);
  const p=s.pipes['legacy-pipe-123'];for(const key of Object.keys(original).filter(k=>k!=='id'))assert.deepEqual(p[key],original[key]);assert.deepEqual(p.legacyOriginal,original);assert.equal(s.clients[p.clientId].name,original.client);assert.equal(s.pipes['legacy-pipe-124'].retired,true);assert.equal(s.pipes['legacy-pipe-125'].outcome,'Ganho');assert.equal(JSON.stringify(source),before);
});
test('repeated migration is idempotent and cannot undo a new edit or deletion',()=>{const first=migrateLegacy({pipes:[original]});let s=applyOperations(emptyState(),first.operations);s=applyOperations(s,[{type:'pipes',id:'legacy-pipe-123',patch:{value:900000,deletedAt:'2026-09-13'}}]);const second=migrateLegacy({pipes:[original]},s);s=applyOperations(s,second.operations);assert.equal(second.addedPipes,0);assert.equal(s.pipes['legacy-pipe-123'].value,900000);assert.equal(s.pipes['legacy-pipe-123'].deletedAt,'2026-09-13');assert.equal(Object.keys(s.clients).length,1);});
test('cloud backup migration retains existing targets, manual results and MEREO overrides',()=>{
  const data={'ricoPipeline.v4':JSON.stringify([original]),'ricoPipeline.goals':JSON.stringify({cap:1500000,rv:500000}), 'ricoPipeline.manualReal':JSON.stringify({'2026-8':{aloc:123,rv:45}}),'ricoPipeline.mereo':JSON.stringify({'2026-8':{ovCap:999,nps:88,cards:3}})};
  const m=migrateLegacy({data}),s=applyOperations(emptyState(),m.operations);assert.equal(s.settings.goals.cap,1500000);assert.equal(s.settings.goals.rv,500000);assert.equal(s.settings.manual['2026-8'].rv,45);assert.equal(s.settings.mereo['2026-8'].ovCap,999);assert.equal(Object.values(s.imports)[0].source.data['ricoPipeline.v4'],data['ricoPipeline.v4']);
});
test('legacy source precedence matches the old application, including backup fallback',()=>{assert.equal(legacyPayload({data:{'ricoPipeline.v4':'[]','ricoPipeline.backup':JSON.stringify([original])}}).pipes.length,1);assert.equal(legacyPayload({data:{'ricoPipeline.v4':JSON.stringify([original]),'ricoPipeline.backup':JSON.stringify([{...original,value:1}])}}).pipes[0].value,200000);assert.equal(legacyPayload({data:{'ricoPipeline.history.v1':'[]','ricoPipeline.history.backup':JSON.stringify([original])}}).history.length,0);});
test('client classification stays manual and independent of pipe priority',()=>{const s=applyOperations(emptyState(),migrateLegacy({pipes:[original]}).operations),p=s.pipes['legacy-pipe-123'];assert.equal(s.clients[p.clientId].tier,undefined);const next=applyOperations(s,[{type:'clients',id:p.clientId,patch:{tier:'D'}}]);assert.equal(next.clients[p.clientId].tier,'D');assert.equal(next.pipes[p.id].nota,8);});
test('exact normalized client names reuse one record; different names remain distinct',()=>{const s=applyOperations(emptyState(),migrateLegacy({pipes:[original,{...original,id:'b',client:'  MARIA   EXEMPLO '},{...original,id:'c',client:'Maria Outra'}]}).operations);assert.equal(Object.keys(s.clients).length,2);});
test('unknown pipe categories are archived rather than discarded or silently reclassified',()=>{const s=applyOperations(emptyState(),migrateLegacy([{...original,cat:'custom'}]).operations);assert.equal(s.pipes['legacy-pipe-123'].cat,'custom');assert.equal(s.pipes['legacy-pipe-123'].retired,true);});
test('closed copy takes precedence when legacy active and history contain the same ID',()=>{const m=migrateLegacy({pipes:[original],history:[{...original,outcome:'Perdido'}]});assert.equal(m.addedPipes,1);assert.equal(applyOperations(emptyState(),m.operations).pipes['legacy-pipe-123'].outcome,'Perdido');});
test('soft deletion hides records and restoration recovers the same values',()=>{let s=emptyState();s.pipes.x={...original,id:'x'};const before=structuredClone(s.pipes.x);s=applyOperations(s,[{type:'pipes',id:'x',patch:{deletedAt:'2026-09-13'}}]);assert.equal(values(s,'pipes').length,0);s=applyOperations(s,[{type:'pipes',id:'x',patch:{deletedAt:null}}]);assert.equal(values(s,'pipes').length,1);assert.equal(s.pipes.x.value,before.value);});
test('closed, retired, deleted and future-snoozed pipes are not active',()=>{assert.equal(active({...original,snoozeUntil:null}),true);for(const patch of [{outcome:'Ganho'},{retired:true},{deletedAt:'now'},{snoozeUntil:'2999-01-01'}])assert.equal(active({...original,...patch}),false);});
test('goal calculations preserve 1.25 weighting, month boundaries and legacy RV results',()=>{const s=emptyState();s.pipes={a:{...original,id:'a',outcome:'Ganho',closedAt:'2026-09-12T12:00:00',subtype:'Previdência'},b:{...original,id:'b',cat:'rv',value:300000,retired:true,outcome:'Ganho',closedAt:'2026-09-10T12:00:00'},c:{...original,id:'c',outcome:'Ganho',closedAt:'2026-08-10T12:00:00'}};s.settings.manual={'2026-8':{aloc:10000,rv:1000,cap:5000}};const m=monthData(s,'2026-09');assert.equal(weight(original),1.25);assert.equal(m.realized.cap,255000);assert.equal(m.realized.aloc,311000);assert.equal(m.components.find(c=>c.name==='Cesta investimento').value,561000);});
test('MEREO scores 3 at target with original crossell points and weights',()=>{const s=emptyState();s.settings.mereo={'2026-8':{ovCap:800000,ovAloc:2200000,ovSeg:12000,ovCon:100000,cards:3,ic:83,nps:40}};const m=monthData(s,'2026-09');assert.equal(m.components.find(c=>c.name==='Crossell').value,25);assert.ok(Math.abs(m.score-3)<1e-10);});
test('HTML-shaped client data remains text in persisted model; unsafe record IDs rejected',()=>{const s=emptyState();assert.throws(()=>applyOperations(s,[{type:'clients',id:'__proto__',patch:{x:1}}]));assert.throws(()=>validateState({version:3}));assert.equal(classLabel('Fundos Listados'),'Fundos Imobiliários');});
test('vault encryption authenticates contents, uses random nonces and a separate document key',async()=>{const access=generateKey(),{id,key}=await vaultCredentials(access);assert.ok(!id.includes(access.slice(5)));const s=emptyState();s.clients.a={name:'Private Client',tier:'A'};const a=await seal(s,key),b=await seal(s,key);assert.notEqual(a.iv,b.iv);assert.ok(!JSON.stringify(a).includes('Private Client'));assert.deepEqual(await unseal(a,key),s);const other=await vaultCredentials(generateKey());await assert.rejects(unseal(a,other.key));a.ciphertext='X'+a.ciphertext.slice(1);await assert.rejects(unseal(a,key));});
class MemoryStorage{map=new Map();getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,v);}}
class MemoryTransport{docs=new Map();counter=0;offline=false;conflictOnce=false;async read(id){if(this.offline)throw Error('network offline');return structuredClone(this.docs.get(id)||null);}async write(id,envelope,stamp){if(this.offline)throw Error('network offline');const old=this.docs.get(id);if(this.conflictOnce){this.conflictOnce=false;throw Object.assign(Error('conflict'),{status:409});}if((old?.stamp||null)!==stamp)throw Object.assign(Error('conflict'),{status:409});const doc={envelope,stamp:String(++this.counter)};this.docs.set(id,doc);return structuredClone(doc);}}
async function settled(store){while(store.busy)await new Promise(r=>setTimeout(r,3));await store.serial;}
test('two devices merge edits to separate clients and fields without overwriting a base',async()=>{const transport=new MemoryTransport(),access=generateKey(),a=new VaultStore({transport,storage:new MemoryStorage()}),b=new VaultStore({transport,storage:new MemoryStorage()});try{await a.open(access,{create:true});await b.open(access);await settled(a);await settled(b);await a.commit([{type:'clients',id:'one',patch:{id:'one',name:'One',tier:'A'}}]);await settled(a);await b.commit([{type:'clients',id:'two',patch:{id:'two',name:'Two',tier:'D'}}]);await settled(b);await a.sync();await b.sync();assert.equal(Object.keys(a.state.clients).length,2);assert.deepEqual(a.state,b.state);transport.conflictOnce=true;await a.commit([{type:'clients',id:'one',patch:{tier:'B'}}]);await settled(a);await b.commit([{type:'clients',id:'one',patch:{notes:'Keep tier from other device'}}]);await settled(b);assert.equal(b.state.clients.one.tier,'B');assert.equal(b.state.clients.one.notes,'Keep tier from other device');}finally{await a.close();await b.close();}});
test('offline edits survive an encrypted cache reload and sync later',async()=>{const transport=new MemoryTransport(),storage=new MemoryStorage(),access=generateKey();let a=new VaultStore({transport,storage});try{await a.open(access,{create:true});await settled(a);transport.offline=true;await a.commit([{type:'clients',id:'one',patch:{id:'one',name:'Saved offline'}}]);await settled(a);const cache=storage.getItem(a.cacheKey);assert.ok(!cache.includes('Saved offline'));await a.close();a=new VaultStore({transport,storage});await a.open(access);await settled(a);assert.equal(a.state.clients.one.name,'Saved offline');assert.equal(a.pending.length,1);transport.offline=false;await a.sync();assert.equal(a.pending.length,0);const {key,id}=await vaultCredentials(access);assert.equal((await unseal((await transport.read(id)).envelope,key)).clients.one.name,'Saved offline');}finally{await a.close();}});
test('local storage failure rolls back the edit instead of reporting it saved',async()=>{const transport=new MemoryTransport(),storage=new MemoryStorage(),s=new VaultStore({transport,storage});try{await s.open(generateKey(),{create:true});await settled(s);storage.setItem=()=>{throw Error('quota');};await assert.rejects(s.commit([{type:'clients',id:'bad',patch:{name:'Not saved'}}]));assert.equal(s.state.clients.bad,undefined);assert.equal(s.pending.length,0);}finally{await s.close();}});
test('deleted data is not revived by a stale unrelated edit from another device',async()=>{const transport=new MemoryTransport(),key=generateKey(),a=new VaultStore({transport,storage:new MemoryStorage()}),b=new VaultStore({transport,storage:new MemoryStorage()});try{await a.open(key,{create:true});await a.commit([{type:'pipes',id:'x',patch:{...original,id:'x'}}]);await settled(a);await b.open(key);await settled(b);await a.commit([{type:'pipes',id:'x',patch:{deletedAt:'2026-09-13'}}]);await settled(a);await b.commit([{type:'pipes',id:'x',patch:{notes:'Edited concurrently'}}]);await settled(b);assert.equal(b.state.pipes.x.deletedAt,'2026-09-13');assert.equal(values(b.state,'pipes').length,0);}finally{await a.close();await b.close();}});
test('estimated position: sliders become one asset per class and zeroed classes are removed',()=>{
  const assets=[];
  const ops=core.estimateOperations(assets,'c1','Rico',500000,{'Renda Fixa':45,'Previdência':20,'Renda Variável':15,'Multimercados':0,'Não informado':20},'2026-09-14');
  assert.equal(ops.length,4);
  const state=core.applyOperations({...core.emptyState(),clients:{c1:{id:'c1',name:'X'}}},ops);
  const est=core.estimateOf(Object.values(state.assets),'c1','rico');
  assert.equal(est.total,500000);assert.deepEqual(est.pct,{'Renda Fixa':45,'Previdência':20,'Renda Variável':15,'Não informado':20});
  const ops2=core.estimateOperations(Object.values(state.assets),'c1','Rico',400000,{'Renda Fixa':100,'Previdência':0,'Renda Variável':0,'Não informado':0},'2026-09-15');
  const state2=core.applyOperations(state,ops2);
  const live=Object.values(state2.assets).filter(a=>!a.deletedAt);
  assert.equal(live.length,1);assert.equal(live[0].class,'Renda Fixa');assert.equal(live[0].value,400000);
});
test('importing a client list completes short names and merges by name instead of duplicating',()=>{
  const state=core.applyOperations(core.emptyState(),[{type:'clients',id:'c1',patch:{id:'c1',name:'Mauricio Rocha',profile:'Moderado',potentials:{cap:'Alto'},notes:'antigo'}},{type:'clients',id:'c2',patch:{id:'c2',name:'Edu',potentials:{}}}]);
  const source=core.emptyState();
  source.clients['xl-1']={id:'xl-1',name:'Mauricio Rocha de Magalhaes Sampaio',tier:'A',profile:'Não informado',potentials:{con:'Alto'},notes:'Conta 689938'};
  source.clients['xl-2']={id:'xl-2',name:'Eduardo Aparecido de Moraes',tier:'B',potentials:{}};
  source.assets['xl-a1']={id:'xl-a1',clientId:'xl-1',institution:'Rico',class:'Não informado',value:100};
  const ops=core.importBase(source,state);
  assert.deepEqual(ops.summary,{created:1,merged:1,renamed:1});
  const next=core.applyOperations(state,ops);
  assert.equal(Object.keys(next.clients).length,3);
  assert.equal(next.clients.c1.name,'Mauricio Rocha de Magalhaes Sampaio');assert.equal(next.clients.c1.tier,'A');assert.equal(next.clients.c1.profile,'Moderado');
  assert.deepEqual(next.clients.c1.potentials,{con:'Alto',cap:'Alto'});assert.equal(next.clients.c1.notes,'antigo\nConta 689938');
  assert.equal(next.assets['xl-a1'].clientId,'c1');
  assert.equal(next.clients.c2.name,'Edu');assert.ok(next.clients['xl-2']);
});

test('a captação pipe creates a linked position at the origin institution and follows the pipe', () => {
  const state=emptyState();state.clients.c1={id:'c1',name:'Ana'};
  const pipe={id:'p1',clientId:'c1',cat:'cap',subtype:'Previdência',origin:'Itaú',value:200000};
  let ops=pipeAssetOperations(pipe,state,'2026-09-22');
  assert.equal(ops.length,1);assert.equal(ops[0].type,'assets');assert.equal(ops[0].patch.institution,'Itaú');assert.equal(ops[0].patch.class,'Previdência');assert.equal(ops[0].patch.value,200000);assert.equal(ops[0].patch.fromPipe,'p1');
  const next=applyOperations(state,ops);
  assert.deepEqual(pipeAssetOperations(pipe,next,'2026-09-22'),[]);
  const won=pipeAssetOperations({...pipe,outcome:'Ganho'},next,'2026-09-22');assert.equal(won[0].patch.institution,'Rico');
  const trashed=pipeAssetOperations({...pipe,deletedAt:'x'},next,'2026-09-22');assert.ok(trashed[0].patch.deletedAt);
  assert.deepEqual(pipeAssetOperations({id:'p2',clientId:'c1',cat:'seg',value:5000},state,'2026-09-22'),[]);
  assert.deepEqual(assetPipeOperations(next.assets[ops[0].id],next,'2026-09-22'),[]);
});
test('a position outside Rico creates a captação pipe; a Rico position does not', () => {
  const state=emptyState();state.clients.c1={id:'c1',name:'Ana'};
  const asset={id:'a1',clientId:'c1',institution:'Safra',name:'CDB',class:'Renda Fixa',value:150000};
  const ops=assetPipeOperations(asset,state,'2026-09-22');
  assert.equal(ops.length,1);assert.equal(ops[0].patch.cat,'cap');assert.equal(ops[0].patch.origin,'Safra');assert.equal(ops[0].patch.value,150000);assert.equal(ops[0].patch.subtype,'TED');
  const next=applyOperations(state,ops);
  assert.deepEqual(assetPipeOperations(asset,next,'2026-09-22'),[]);
  assert.equal(assetPipeOperations({...asset,value:180000},next,'2026-09-22')[0].patch.value,180000);
  assert.ok(assetPipeOperations({...asset,deletedAt:'x'},next,'2026-09-22')[0].patch.deletedAt);
  assert.deepEqual(assetPipeOperations({...asset,id:'a2',institution:'Rico'},state,'2026-09-22'),[]);
  assert.deepEqual(pipeAssetOperations(next.pipes[ops[0].id],next,'2026-09-22'),[]);
});
test('a newly mapped potential creates one generic pipe unless the client already has an active pipe there', () => {
  const state=emptyState();state.clients.c1={id:'c1',name:'Ana',potentials:{}};
  state.pipes.x={id:'x',clientId:'c1',cat:'cap',value:1};
  const ops=potentialPipeOperations({id:'c1',name:'Ana',potentials:{cap:'Alto',seg:'Médio',con:'Sem potencial'}},state.clients.c1,state,'2026-09-22');
  assert.equal(ops.length,1);assert.equal(ops[0].patch.cat,'seg');assert.equal(ops[0].patch.nota,5);assert.equal(ops[0].patch.value,0);
  const next=applyOperations(state,ops);
  assert.deepEqual(potentialPipeOperations({id:'c1',name:'Ana',potentials:{cap:'Alto',seg:'Médio'}},{potentials:{cap:'Alto',seg:'Médio'}},next,'2026-09-22'),[]);
});
test('an estimated portfolio outside Rico keeps one captação pipe per institution in sync', () => {
  const state=emptyState();state.clients.c1={id:'c1',name:'Ana'};
  const ops=estimatePipeOperations('c1','BTG',500000,state,'2026-09-22');assert.equal(ops[0].patch.value,500000);
  const next=applyOperations(state,ops);
  assert.equal(estimatePipeOperations('c1','BTG',600000,next,'2026-09-22')[0].patch.value,600000);
  assert.deepEqual(estimatePipeOperations('c1','Rico',600000,next,'2026-09-22'),[]);
});

test('weekend dates roll to the next Monday and open pipes on weekends are fixed', () => {
  assert.equal(businessDay('2026-09-26'),'2026-09-28');
  assert.equal(businessDay('2026-09-27'),'2026-09-28');
  assert.equal(businessDay('2026-09-25'),'2026-09-25');
  assert.equal(businessDay('2026-10-31',true),'2026-10-30');
  const state=emptyState();
  state.pipes.a={id:'a',cat:'cap',date:'2026-09-26',value:1};
  state.pipes.b={id:'b',cat:'cap',date:'2026-09-25',snoozeUntil:'2026-09-27',value:1};
  state.pipes.c={id:'c',cat:'cap',date:'2026-09-26',outcome:'Ganho',value:1};
  const ops=weekendFixOperations(state);
  assert.equal(ops.length,2);
  const next=applyOperations(state,ops);
  assert.equal(next.pipes.a.date,'2026-09-28');assert.equal(next.pipes.b.snoozeUntil,'2026-09-28');assert.equal(next.pipes.b.date,'2026-09-25');assert.equal(next.pipes.c.date,'2026-09-26');
});

test('clients who had a pipe become C, the rest D, and nobody stays without a class', () => {
  const state=emptyState();
  state.clients.a={id:'a',name:'A',tier:'A'};state.clients.b={id:'b',name:'B',tier:'D'};state.clients.c={id:'c',name:'C',tier:''};state.clients.d={id:'d',name:'D'};state.clients.e={id:'e',name:'E',tier:'D'};
  state.pipes.p1={id:'p1',clientId:'a',cat:'cap'};state.pipes.p2={id:'p2',clientId:'b',cat:'cap',outcome:'Perdido'};state.pipes.p3={id:'p3',clientId:'c',cat:'seg',deletedAt:'x'};
  state.pipes.p4={id:'p4',clientId:'e',cat:'seg',fromPotential:true};
  const next=applyOperations(state,tierFixOperations(state));
  assert.deepEqual(Object.fromEntries(Object.values(next.clients).map(c=>[c.id,c.tier])),{a:'A',b:'C',c:'C',d:'D',e:'D'});
  assert.deepEqual(tierFixOperations(next),[]);
  assert.equal(tierAfterPipe('D'),'C');assert.equal(tierAfterPipe(''),'C');assert.equal(tierAfterPipe('A'),'A');
  const t=tierStats(next);assert.equal(t.total,5);assert.deepEqual(t.counts,{A:1,B:0,C:2,D:2});
});
test('a won pipe makes the client B; A is never touched and nobody is downgraded', () => {
  const state=emptyState();
  for(const [id,tier] of [['a','A'],['c','C'],['d','D'],['n',''],['b','B'],['x','D']])state.clients[id]={id,name:id,tier};
  state.pipes.w1={id:'w1',clientId:'a',cat:'cap',outcome:'Ganho'};state.pipes.w2={id:'w2',clientId:'c',cat:'seg',outcome:'Ganho'};
  state.pipes.w3={id:'w3',clientId:'d',cat:'cap',outcome:'Ganho',retired:true};state.pipes.o={id:'o',clientId:'n',cat:'cap'};
  state.pipes.gone={id:'gone',clientId:'x',cat:'cap',outcome:'Ganho',deletedAt:'x'};
  const next=applyOperations(state,tierFixOperations(state));
  assert.deepEqual(Object.fromEntries(Object.values(next.clients).map(c=>[c.id,c.tier])),{a:'A',c:'B',d:'B',n:'C',b:'B',x:'C'});
});
test('the vault is compressed before encryption and old envelopes still open', async () => {
  const {key}=await vaultCredentials(generateKey());const s=emptyState();
  for(let i=0;i<3000;i++)s.clients['c'+i]={id:'c'+i,name:'Cliente Número '+i,profile:'Não informado',tier:'D',notes:'Conta Rico · Reunião não informada',potentials:{}};
  const env=await seal(s,key);assert.equal(env.v,2);assert.ok(env.ciphertext.length<JSON.stringify(s).length/4);
  assert.deepEqual(await unseal(env,key),s);
  const iv=crypto.getRandomValues(new Uint8Array(12)),raw=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(s))));
  const v1={v:1,iv:Buffer.from(iv).toString('base64'),ciphertext:Buffer.from(raw).toString('base64')};
  assert.deepEqual(await unseal(v1,key),s);
});
test('pipe stats count conversion, losses, overdue and snoozed pipes', () => {
  const state=emptyState();
  state.pipes.w={id:'w',value:300,outcome:'Ganho'};state.pipes.l={id:'l',value:100,outcome:'Perdido'};state.pipes.l2={id:'l2',value:100,outcome:'Perdido'};
  state.pipes.o={id:'o',value:50,date:'2026-09-20'};state.pipes.o2={id:'o2',value:70,date:'2026-10-02'};state.pipes.s={id:'s',value:1,snoozeUntil:'2026-10-05'};state.pipes.t={id:'t',value:1,deletedAt:'x'};
  const s=pipeStats(state,'2026-09-28');
  assert.equal(s.won,1);assert.equal(s.lost,2);assert.equal(Math.round(s.conversion),33);assert.equal(s.valueConversion,60);
  assert.equal(s.open,2);assert.equal(s.overdue,1);assert.equal(s.overdueValue,50);assert.equal(s.snoozed,1);assert.equal(s.trash,1);
  assert.equal(pipeStats(emptyState(),'2026-09-28').conversion,null);
});

test('Hub custody updates Rico custody by name, keeps duplicates and adds missing clients', () => {
  const state=emptyState();
  state.clients.a={id:'a',name:'João Silva',tier:'B'};
  state.assets.an={id:'an',clientId:'a',institution:'Rico',name:'Custódia na Rico',value:100,asOf:'2026-01-01'};
  state.clients.m1={id:'m1',name:'Mirza Cunha · conta 1',tier:'D'};state.clients.m2={id:'m2',name:'Mirza Cunha · conta 2',tier:'D'};
  state.assets.m1n={id:'m1n',clientId:'m1',institution:'Rico',name:'Custódia na Rico',value:1000};state.assets.m2n={id:'m2n',clientId:'m2',institution:'Rico',name:'Custódia na Rico',value:10};
  state.clients.s={id:'s',name:'Ana Paula',tier:'C'};
  state.clients.d={id:'d',name:'Pedro Lima',tier:'D'};state.assets.dd={id:'dd',clientId:'d',institution:'Rico',name:'CDB Rico',value:30};
  const src={kind:'rico-custody',asOf:'2026-09-28',rows:[{name:'JOAO SILVA',value:250.5},{name:'JOAO SILVA',value:0},{name:'MIRZA CUNHA',value:12},{name:'MIRZA CUNHA',value:1100},{name:'ANA PAULA SOUZA DOS SANTOS',value:70},{name:'PEDRO LIMA',value:100},{name:'NOVA PESSOA DE TAL',value:5}]};
  const ops=custodyOperations(src,state,'2026-09-28T12:00:00Z');
  const next=applyOperations(state,ops);
  assert.equal(next.assets.an.value,250.5);assert.equal(next.assets.an.asOf,'2026-09-28');
  assert.equal(next.assets.m1n.value,1100);assert.equal(next.assets.m2n.value,12);
  assert.equal(next.clients.s.name,'Ana Paula Souza dos Santos');assert.equal(next.assets['hub-net-s'].value,70);
  assert.equal(next.assets.dd.value,30);assert.equal(next.assets['hub-net-d'].value,70);
  const added=Object.values(next.clients).filter(c=>c.id.startsWith('hub-'));
  assert.equal(added.length,1);assert.equal(added[0].name,'Nova Pessoa de Tal');assert.equal(added[0].tier,'D');
  assert.equal(Object.keys(next.clients).length,6);
  assert.deepEqual({...ops.summary},{people:5,created:1,renamed:1,updated:5,total:1537.5});
  const again=custodyOperations(src,next,'2026-09-28T13:00:00Z');
  assert.equal(again.filter(o=>o.type==='clients').length,0);assert.equal(again.summary.created,0);
  assert.equal(applyOperations(next,again).assets.an.value,250.5);
  const withMix=custodyOperations({...src,mix:[{name:'Ações',pct:60,color:'#f6c000'},{name:'Renda Fixa',pct:40,color:'bad'},{name:'Zero',pct:0}]},state,'2026-09-28T12:00:00Z');
  const mix=applyOperations(state,withMix).settings.hubMix;
  assert.equal(mix.items.length,2);assert.equal(mix.items[1].color,'');assert.equal(mix.total,1537.5);assert.equal(mix.label,'D-3');
});

test('very similar names are grouped, ambiguous or per-account names are not', () => {
  const state=emptyState();const add=(id,name,extra={})=>state.clients[id]={id,name,...extra};
  add('s','Alberto Willy',{tier:'B',createdAt:'2026-01-01'});add('s2','alberto  willy');add('l','ALBERTO WILLY BERNARDI'.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()),{tier:'D'});
  add('c1','Carlos Oliveira');add('c2','Carlos Henrique de Oliveira');add('c3','Carlos Roberto de Oliveira');
  add('m1','Mirza Cunha · conta 1');add('m2','Mirza Cunha · conta 2');
  add('j1','João Pedro');add('j2','Joao Pedro Mayrink de Jesus');
  add('x','Maria Silva');add('y','Maria da Penha Silveira');add('one','Ana');add('one2','Ana Clara');
  const g=similarClientGroups(state);
  assert.deepEqual(g.map(x=>[x.keep,[...x.drop].sort()]),[['l',['s','s2']],['j2',['j1']]]);
  state.settings.mergeIgnore={[g[1].key]:true};
  assert.equal(similarClientGroups(state).length,1);
});
test('merging moves pipes and wallet, keeps the best class and only the newest Rico custody', () => {
  const state=emptyState();
  state.clients.s={id:'s',name:'João Willy',tier:'B',phone:'119',potentials:{seg:'Alto'},notes:'antigo'};
  state.clients.l={id:'l',name:'Joao Willy Bernardi',tier:'D',potentials:{seg:'A mapear',con:'Médio'}};
  state.pipes.p1={id:'p1',clientId:'s',client:'João Willy',cat:'cap',value:10};
  state.pipes.p2={id:'p2',clientId:'s',cat:'seg',fromPotential:true};state.pipes.p3={id:'p3',clientId:'l',cat:'seg',value:5};
  state.pipes['est-pipe-s-xp']={id:'est-pipe-s-xp',clientId:'s',cat:'cap',fromEstimate:true,origin:'XP',value:50};
  state.assets.old={id:'old',clientId:'s',institution:'Rico',name:'Custódia na Rico',value:100,asOf:'2026-09-17'};
  state.assets.hub={id:'hub',clientId:'l',institution:'Rico',name:'Custódia na Rico',value:120,asOf:'2026-09-28'};
  state.assets.bb={id:'bb',clientId:'s',institution:'Banco do Brasil',name:'CDB',value:30};
  const next=applyOperations(state,mergeClientOperations(state,'l',['s'],'2026-09-28T12:00:00Z'));
  assert.equal(next.clients.s.deletedAt,'2026-09-28T12:00:00Z');assert.equal(next.clients.s.mergedInto,'l');
  const l=next.clients.l;assert.equal(l.name,'João Willy Bernardi');assert.equal(l.tier,'B');assert.equal(l.phone,'119');assert.equal(l.notes,'antigo');
  assert.deepEqual(l.potentials,{seg:'Alto',con:'Médio'});
  assert.equal(next.pipes.p1.clientId,'l');assert.equal(next.pipes.p1.client,'João Willy Bernardi');
  assert.ok(next.pipes.p2.deletedAt);assert.equal(next.pipes.p3.client,'João Willy Bernardi');
  assert.ok(next.pipes['est-pipe-s-xp'].deletedAt);assert.equal(next.pipes['est-pipe-l-xp'].clientId,'l');assert.equal(next.pipes['est-pipe-l-xp'].value,50);
  assert.ok(next.assets.old.deletedAt);assert.equal(next.assets.hub.deletedAt,undefined);assert.equal(next.assets.bb.clientId,'l');
  const live=values(next,'clients');assert.equal(live.length,1);
  assert.deepEqual(similarClientGroups(next),[]);
});

test('every won pipe gets a post-sale pipe on the first business day of the next month', () => {
  const state=emptyState();state.clients.a={id:'a',name:'Ana',tier:'B'};
  state.pipes.sep={id:'sep',clientId:'a',client:'Ana',title:'Previdência',cat:'cap',value:100000,outcome:'Ganho',closedAt:'2026-09-15T12:00:00'};
  state.pipes.oct={id:'oct',clientId:'a',cat:'seg',value:5000,outcome:'Ganho',closedAt:'2026-10-20T12:00:00'};
  state.pipes.old={id:'old',clientId:'a',cat:'rv',value:10,outcome:'Ganho',closedAt:'2026-06-10T12:00:00',retired:true};
  state.pipes.lost={id:'lost',clientId:'a',cat:'cap',value:1,outcome:'Perdido'};state.pipes.open={id:'open',clientId:'a',cat:'con',value:1};
  const ops=postSaleOperations(state,'2026-09-28','2026-09-28T12:00:00Z');let next=applyOperations(state,ops);
  assert.equal(ops.length,3);
  assert.equal(next.pipes['pv-sep'].date,'2026-10-01');assert.equal(next.pipes['pv-sep'].cat,'pv');assert.equal(next.pipes['pv-sep'].soldValue,100000);assert.equal(next.pipes['pv-sep'].title,'Pós-venda · Previdência');
  assert.equal(next.pipes['pv-oct'].date,'2026-11-02');assert.equal(next.pipes['pv-old'].date,'2026-09-28');
  assert.equal(next.pipes['pv-sep'].snoozeUntil,'2026-10-01');assert.equal(next.pipes['pv-old'].snoozeUntil,null);
  const shown=applyOperations(next,[{type:'pipes',id:'pv-sep',patch:{snoozeUntil:null,autoSnoozed:false}}]);
  const hide=postSaleOperations(shown,'2026-09-30','h');assert.equal(hide.length,1);assert.equal(hide[0].patch.snoozeUntil,'2026-10-01');
  assert.deepEqual(postSaleOperations(shown,'2026-10-01'),[]);
  assert.deepEqual(postSaleOperations(next,'2026-09-28'),[]);
  next=applyOperations(next,[{type:'pipes',id:'sep',patch:{outcome:null}}]);
  next=applyOperations(next,postSaleOperations(next,'2026-09-28','x'));assert.equal(next.pipes['pv-sep'].deletedAt,'x');
  next=applyOperations(next,[{type:'pipes',id:'sep',patch:{outcome:'Ganho'}}]);
  next=applyOperations(next,postSaleOperations(next,'2026-09-28','y'));assert.equal(next.pipes['pv-sep'].deletedAt,null);
  next=applyOperations(next,[{type:'pipes',id:'pv-oct',patch:{deletedAt:'z'}}]);assert.deepEqual(postSaleOperations(next,'2026-09-28'),[]);
  next=applyOperations(next,[{type:'pipes',id:'pv-old',patch:{outcome:'Ganho'}}]);assert.equal(ps2(next,'2026-09-28').won,3);
});

test('a post-sale marked done schedules the next one exactly two months later', () => {
  const state=emptyState();state.clients.a={id:'a',name:'Ana',tier:'B'};
  state.pipes.w={id:'w',clientId:'a',client:'Ana',title:'Previdência',cat:'cap',value:100000,outcome:'Ganho',closedAt:'2026-09-15T12:00:00'};
  let s=applyOperations(state,postSaleOperations(state,'2026-09-28','t0'));
  assert.deepEqual(lastPostSaleByClient(s),{});
  s=applyOperations(s,[{type:'pipes',id:'pv-w',patch:{outcome:'Ganho',closedAt:'2026-10-01T12:00:00'}}]);
  s=applyOperations(s,postSaleOperations(s,'2026-10-01','t1'));
  const n=s.pipes['pv-w-2m'];assert.equal(n.date,'2026-12-01');assert.equal(n.snoozeUntil,'2026-12-01');assert.equal(active(n),false);assert.equal(n.cat,'pv');assert.equal(n.lastPvAt,'2026-10-01');assert.equal(n.soldAt,'2026-09-15');assert.equal(n.title,'Pós-venda · Previdência');
  assert.deepEqual(lastPostSaleByClient(s),{a:'2026-10-01'});assert.equal(daysBetween('2026-10-01','2026-10-31'),30);
  assert.deepEqual(postSaleOperations(s,'2026-10-01'),[]);
  const legacy=applyOperations(s,[{type:'pipes',id:'pv-w-2m',patch:{snoozeUntil:null,autoSnoozed:false}}]);
  const fix=postSaleOperations(legacy,'2026-10-02','t9');assert.equal(fix.length,1);assert.equal(fix[0].patch.snoozeUntil,'2026-12-01');
  assert.deepEqual(postSaleOperations(applyOperations(legacy,fix),'2026-10-02'),[]);
  s=applyOperations(s,[{type:'pipes',id:'pv-w-2m',patch:{outcome:'Ganho',closedAt:'2026-11-29T12:00:00'}}]);
  s=applyOperations(s,postSaleOperations(s,'2026-11-29','t2'));assert.equal(s.pipes['pv-w-2m-2m'].date,'2027-01-29');
  s=applyOperations(s,[{type:'pipes',id:'pv-w-2m',patch:{outcome:null}}]);s=applyOperations(s,postSaleOperations(s,'2026-11-29','t3'));
  assert.equal(s.pipes['pv-w-2m-2m'].deletedAt,'t3');
  s=applyOperations(s,[{type:'pipes',id:'pv-w-2m',patch:{outcome:'Perdido'}}]);assert.deepEqual(postSaleOperations(s,'2026-11-29'),[]);
});

test('MEREO 2S2026: NPS meta mensal e mínimo de seguros no crossell',()=>{const s=emptyState();
  s.settings.mereo={'2026-9':{ovCap:800000,ovAloc:2200000,ovSeg:2000,ovCon:0,cards:30,ic:83}};
  const m=monthData(s,'2026-10');const nps=m.components.find(c=>c.name==='NPS'),cr=m.components.find(c=>c.name==='Crossell');
  assert.equal(nps.goal,42.5);assert.equal(nps.value,42.5);assert.equal(cr.value,2+15);
  s.settings.mereo['2026-9'].ovSeg=10000;assert.equal(monthData(s,'2026-10').components.find(c=>c.name==='Crossell').value,40);});
