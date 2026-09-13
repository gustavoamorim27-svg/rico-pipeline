import {emptyState,validateState,applyOperations,vaultCredentials,seal,unseal} from './core.mjs';
const ROOT='https://firestore.googleapis.com/v1/projects/rico-hub/databases/(default)/documents/ricoPipeline/';
export class FirestoreTransport {
  async request(url,options={}){
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try{const r=await fetch(url,{...options,signal:controller.signal,headers:{'Content-Type':'application/json'}});const body=await r.json();
      if(r.status===404&&!options.method)return null;
      if(!r.ok){const e=Error(body.error?.message||'Não foi possível sincronizar.');e.status=r.status;throw e;}return body;
    }finally{clearTimeout(timer);}
  }
  async read(id){const d=await this.request(ROOT+encodeURIComponent(id));return d?{envelope:JSON.parse(d.fields.envelope.stringValue),stamp:d.updateTime}:null;}
  async write(id,envelope,stamp){
    const condition=stamp?'currentDocument.updateTime='+encodeURIComponent(stamp):'currentDocument.exists=false';
    const d=await this.request(ROOT+encodeURIComponent(id)+'?'+condition,{method:'PATCH',body:JSON.stringify({fields:{envelope:{stringValue:JSON.stringify(envelope)},format:{integerValue:'3'}}})});
    return {envelope,stamp:d.updateTime};
  }
  async legacy(code){
    if(!/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code))throw Error('Use o código antigo no formato XXXX-XXXX-XXXX.');
    const d=await this.request(ROOT+encodeURIComponent(code));if(!d)throw Error('Backup antigo não encontrado.');
    const data={};for(const [k,v] of Object.entries(d.fields?.data?.mapValue?.fields||{}))if(k.startsWith('ricoPipeline.'))data[k]=v.stringValue;
    return {data};
  }
}
export class VaultStore {
  constructor({transport=new FirestoreTransport(),storage=localStorage,onChange=()=>{},onStatus=()=>{}}={}){this.transport=transport;this.storage=storage;this.onChange=onChange;this.onStatus=onStatus;this.state=emptyState();this.pending=[];this.serial=Promise.resolve();this.closed=false;}
  async open(access,{create=false}={}){
    const {key,id}=await vaultCredentials(access);this.key=key;this.id=id;this.cacheKey=`ricoCRM.encrypted.${id}`;
    const local=this.storage.getItem(this.cacheKey);let cache=local?await unseal(JSON.parse(local),key):null;
    if(cache){validateState(cache.state);this.state=cache.state;this.pending=cache.pending||[];}
    try{
      let remote=await this.transport.read(id);
      if(!remote&&create)remote=await this.transport.write(id,await seal(emptyState(),key),null);
      if(!remote)throw Error('Base não encontrada. Confira a chave; para começar do zero, crie uma base.');
      this.state=applyOperations(validateState(await unseal(remote.envelope,key)),this.pending);
      this.stamp=remote.stamp;this.onStatus(this.pending.length?'pending':'synced');
    }catch(error){if(!cache||create||error.status===403||!/fetch|network|abort|offline|Failed/i.test(error.message))throw error;this.onStatus('offline');}
    await this.cache();this.onChange(this.state);this.timer=setInterval(()=>this.sync(),6000);this.sync();return this;
  }
  enqueue(fn){const result=this.serial.then(fn);this.serial=result.catch(()=>{});return result;}
  async cache(){this.storage.setItem(this.cacheKey,JSON.stringify(await seal({state:this.state,pending:this.pending},this.key)));}
  async commit(operations){
    if(this.closed)throw Error('Abra sua base novamente.');
    await this.enqueue(async()=>{
      const previous=this.state,oldPending=this.pending;
      this.state=applyOperations(this.state,operations);this.pending=[...this.pending,...operations];
      try{await this.cache();}catch(e){this.state=previous;this.pending=oldPending;throw e;}
      this.onChange(this.state);this.onStatus('pending');
    });this.sync();
  }
  async sync(){
    if(this.busy||this.closed)return;this.busy=true;
    try {await this.enqueue(async()=>{
      if(this.closed)return;
      for(let retry=0;retry<4;retry++){
        const remote=await this.transport.read(this.id);
        if(!remote)throw Error('Base remota indisponível. Exporte sua cópia local.');
        let next=validateState(await unseal(remote.envelope,this.key));
        if(!this.pending.length){if(this.stamp!==remote.stamp){this.state=next;this.stamp=remote.stamp;await this.cache();this.onChange(this.state);}this.onStatus('synced');return;}
        next=applyOperations(next,this.pending);next.revision=(next.revision||0)+1;
        try{const saved=await this.transport.write(this.id,await seal(next,this.key),remote.stamp);
          this.state=next;this.pending=[];this.stamp=saved.stamp;await this.cache();this.onChange(this.state);this.onStatus('synced');return;
        }catch(e){if([409,412,400].includes(e.status)&&retry<3)continue;throw e;}
      }
    });}catch(error){this.lastError=error;this.onStatus(error.status===403?'denied':'offline');}finally{this.busy=false;}
  }
  async close(){this.closed=true;clearInterval(this.timer);await this.serial;this.key=null;this.state=emptyState();this.pending=[];}
}
export async function readLegacyLocal(){
  const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('ricoPipeline.')&&k!=='ricoPipeline.cloudId')data[k]=localStorage.getItem(k);}
  // Open the old store read-only. Never initialize or replace its contents.
  await new Promise(resolve=>{
    const request=indexedDB.open('ricoPipelineDB');let finish=()=>resolve();
    request.onupgradeneeded=()=>{request.transaction.abort();};request.onerror=finish;
    request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('kv')){db.close();resolve();return;}
      const tx=db.transaction('kv','readonly');for(const [old,key] of [['pipes','ricoPipeline.v4'],['history','ricoPipeline.history.v1']]){
        if(data[key]!=null)continue;const req=tx.objectStore('kv').get(old);req.onsuccess=()=>{if(Array.isArray(req.result))data[key]=JSON.stringify(req.result);};
      }tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();resolve();};};
  });return {data};
}
