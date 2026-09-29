/* FotoCesta: funciona sin conexión guardando la app en el móvil */
const CACHE='fotocesta-v1';
const BASE=['./','index.html','manifest.webmanifest','firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js','iconos/icono-192.png','iconos/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // red primero (para tener siempre la última versión) y copia guardada si no hay conexión
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
