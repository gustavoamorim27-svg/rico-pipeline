// Source-level rendering smoke tests, without launching or controlling a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from './core.mjs';
import {VaultStore,FirestoreTransport,readLegacyLocal} from './store.mjs';
import {RICO_LOGO_PATH,RICO_LOGO_VIEWBOX} from './logo.mjs';
test('all main views render from the source with separated client tiers and pipe priorities',()=>{
  const app={innerHTML:''},dialog={open:false},form={},body={classList:{add(){},remove(){}}};
  const document={querySelector:s=>s==='#app'?app:s==='#dialog'?dialog:s==='#unlockForm'?form:null,querySelectorAll:()=>[],addEventListener(){},activeElement:null,body};
  const source=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\nboot\(\);\s*$/,'');
  const context={...core,esc:core.escapeHTML,VaultStore,FirestoreTransport,readLegacyLocal,RICO_LOGO_PATH,RICO_LOGO_VIEWBOX,document,window:{addEventListener(){}},setTimeout,clearTimeout,setInterval,clearInterval,console,crypto};
  vm.createContext(context);vm.runInContext(source,context);
  vm.runInContext('state=demoData();demo=true;',context);
  for(const view of ['board','clients','goals','agenda','history','settings']){
    vm.runInContext(`screen='${view}';clientId=null;render();`,context);
    assert.ok(app.innerHTML.length>500,view+' must render');assert.ok(app.innerHTML.includes('Navegação principal'));
  }
  vm.runInContext("screen='clients';clientId=null;filter='D';render();",context);
  assert.ok(app.innerHTML.includes('Felipe Santos'));assert.ok(!app.innerHTML.includes('Ana Martins'));assert.ok(app.innerHTML.includes('Classe D'));
  vm.runInContext("clientId='demo-c0';render();",context);assert.ok(app.innerHTML.includes('Carteira consolidada'));assert.ok(app.innerHTML.includes('C6'));assert.ok(app.innerHTML.includes('Classe A'));
  vm.runInContext("detailTab='pipes';render();",context);assert.ok(app.innerHTML.includes('Transferência da carteira C6'));
  vm.runInContext("detailTab='notes';render();",context);assert.ok(app.innerHTML.includes('Cliente fictício'));
  vm.runInContext('renderWelcome();',context);assert.ok(app.innerHTML.includes('unlockForm'));
});
