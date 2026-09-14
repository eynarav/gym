/* Offline shell, scope-specific caches; program data stays in localStorage. */
'use strict';
const ROOT = new URL('./', self.registration.scope).href;
const PREFIX = 'gymlog:' + new URL(ROOT).pathname + ':';
const CACHE = PREFIX + 'v5.1-20260914-upload';
const FILES = ['', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'].map(p=>new URL(p,ROOT).href);
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function shell(request){
  const cache=await caches.open(CACHE);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(request,{signal:controller.signal,cache:'no-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    await cache.put(new URL('index.html',ROOT).href,response.clone());
    await cache.put(ROOT,response.clone());
    return response;
  }catch(err){
    const stored=await cache.match(new URL('index.html',ROOT).href);
    return stored||new Response('Открой приложение с интернетом для первого запуска.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }finally{clearTimeout(timer);}
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(ROOT))return;
  const html=r.mode==='navigate'||u.pathname===new URL(ROOT).pathname||u.pathname===new URL('index.html',ROOT).pathname;
  if(html){e.respondWith(shell(r));return;}
  if(!FILES.includes(u.origin+u.pathname))return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const stored=await c.match(r,{ignoreSearch:true});if(stored)return stored;
    const resp=await fetch(r);if(resp.ok)await c.put(r,resp.clone());return resp;
  }));
});
