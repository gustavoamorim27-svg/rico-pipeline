const CACHE='rico-clientes-shell-v4-login-20261020';
// Só arquivos públicos: a tela de login e o app criptografado (app.enc). Dados de clientes nunca entram aqui.
const SHELL=['./','./index.html','./app.enc','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
// Apaga os caches antigos, que guardavam o app sem senha.
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rico-clientes-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const scope=new URL('./',self.location.href).pathname;if(!SHELL.some(p=>new URL(p,self.location.href).pathname===url.pathname))return;
  event.respondWith(fetch(url.href,{cache:'no-cache',credentials:'same-origin'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(url.pathname===scope?scope:event.request,copy));}return response;}).catch(async()=>{const cached=await caches.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==='navigate')return caches.match(scope);throw Error('Arquivo não disponível offline');}));
});
