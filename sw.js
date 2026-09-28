const CACHE='rico-clientes-shell-v3-20260929-1';
const SHELL=['./','./index.html','./styles.css','./app.mjs','./core.mjs','./store.mjs','./logo.mjs','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rico-clientes-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only public application files enter this cache. Client data and cloud responses never do.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const scope=new URL('./',self.location.href).pathname;if(!SHELL.some(p=>new URL(p,self.location.href).pathname===url.pathname))return;
  // Sempre busca a versão mais nova no servidor (sem cache do navegador); o cache só serve offline.
  event.respondWith(fetch(url.href,{cache:'no-cache',credentials:'same-origin'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return caches.match(scope);throw Error('Arquivo não disponível offline');}));
});
