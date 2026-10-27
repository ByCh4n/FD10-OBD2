// Clio OBD service worker: uygulama önbellekten anında açılır (araçta internet olmasa da),
// arka planda ağdan güncellenir; index.html veya obd-core.js değiştiyse sayfaya haber verilir.
// GitHub Pages dosyaları max-age=600 ile sunar; ağ istekleri tarayıcı önbelleğini atlayıp
// sunucuya sorar (cache: 'no-cache' → ETag ile 304), yoksa güncelleme 10 dk boyunca görülmez.
const CACHE = 'clio-obd-v3', FONTS = 'clio-obd-fonts';
const SHELL = ['./', 'index.html', 'obd-core.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Değişiklik çoğu zaman sayfa açılırken fark edilir; o anda yeni sayfa mesaj alamayabilir.
// Bu yüzden kısa bir bekleyişten sonra haber verilir, sayfa da açılınca "check" ile ayrıca sorar.
let updateSeen = false;
async function notifyUpdated(){
  updateSeen = true;
  await new Promise(r => setTimeout(r, 1500));
  for (const c of await self.clients.matchAll({type: 'window'})) c.postMessage({type: 'updated'});
}
let lastError = null;
self.addEventListener('message', e => {
  if (e.data?.type === 'check') e.source?.postMessage(updateSeen ? {type: 'updated'} : {type: 'status', version: CACHE, lastError});
});

const fresh = req => fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'});

// Önbellekteki sürümü hemen döner, sunucudan yenisini alıp saklar.
// {response, update} döner: update, fetch olayında waitUntil'e eşzamanlı verilmeli (await'ten sonra verilemez).
function shell(req){
  const textual = /(\.html|\.js|\/)$/.test(new URL(req.url).pathname);
  const cacheP = caches.open(CACHE);
  // Yanıt gövdesi bir kez okunabilir: sayfaya giden ile karşılaştırılan ayrı kopyalar olmalı
  const cachedP = cacheP.then(c => c.match(req, {ignoreSearch: true})).then(r => r ? [r, r.clone()] : [null, null]);
  const update = Promise.all([cacheP, cachedP]).then(async ([cache, [, old]]) => {
    const res = await fresh(req);
    if (res.ok && res.type === 'basic'){
      const changed = textual && old && (await old.text()) !== (await res.clone().text());
      await cache.put(req, res.clone());
      if (changed) await notifyUpdated();
    }
    return res;
  }).catch(err => { lastError = String(err); return null; });
  const response = cachedP.then(([cached]) => cached || update.then(r => r || new Response('Çevrimdışı ve önbellekte yok', {status: 503})));
  return {response, update};
}

// Benzin fiyatı: önce ağ (4 sn), olmazsa son bilinen fiyat
async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fresh(req), new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 4000))]);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, {ignoreSearch: true})) || new Response('{}', {status: 503, headers: {'content-type': 'application/json'}});
  }
}

// Google Fonts: önbellekte varsa onu kullan
async function fonts(req){
  const cache = await caches.open(FONTS);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin){
    if (url.pathname.endsWith('/fuel.json')){ e.respondWith(networkFirst(req)); return; }
    const s = shell(req);
    e.respondWith(s.response);
    e.waitUntil(s.update);   // yanıt önbellekten dönse de güncelleme ve bildirim tamamlansın
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(fonts(req));
  }
});
