// Creates one disposable, encrypted test vault. No real client record is read.
import assert from 'node:assert/strict';
import {generateKey,vaultCredentials,emptyState,seal,unseal} from './core.mjs';
import {FirestoreTransport} from './store.mjs';
const transport=new FirestoreTransport(),{id,key}=await vaultCredentials(generateKey());
const state=emptyState();state.clients.fixture={id:'fixture',name:'TESTE AUTOMATIZADO SEM DADOS REAIS',tier:'D'};
let created=false;
try{
  assert.equal(await transport.read(id),null);
  const initial=await transport.write(id,await seal(state,key),null);created=true;
  const fromOtherDevice=await transport.read(id);assert.deepEqual(await unseal(fromOtherDevice.envelope,key),state);
  state.clients.fixture.tier='A';const changed=await transport.write(id,await seal(state,key),fromOtherDevice.stamp);
  assert.notEqual(initial.stamp,changed.stamp);
  await assert.rejects(transport.write(id,await seal(state,key),initial.stamp));
  console.log('PASS: encrypted cloud creation, read, update and stale-write rejection.');
}finally{
  if(created){const r=await fetch('https://firestore.googleapis.com/v1/projects/rico-hub/databases/(default)/documents/ricoPipeline/'+id,{method:'DELETE'});if(!r.ok)throw Error('Test vault cleanup failed');console.log('PASS: temporary test vault removed.');}
}
