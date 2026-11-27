const C='checklist-campo-v9';
const FILES=['./','./index.html','./manifest.json','./logo192.png','./logo512.png','./painel.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
// Páginas: rede primeiro (pega atualizações), cache se estiver sem sinal. Demais arquivos: cache primeiro.
self.addEventListener('fetch',e=>{
  const q=e.request;if(q.method!=='GET'||new URL(q.url).origin!==location.origin)return;
  if(q.mode==='navigate'){e.respondWith(fetch(q).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(q,cp));return n}).catch(()=>caches.match(q,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));return}
  e.respondWith(caches.match(q).then(r=>r||fetch(q).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(q,cp));return n})));
});
