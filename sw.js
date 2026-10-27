// Clio OBD service worker: uygulama önbellekten anında açılır (araçta internet olmasa da),
// arka planda ağdan güncellenir; index.html veya obd-core.js değiştiyse sayfaya haber verilir.
const CACHE = 'clio-obd-v2', FONTS = 'clio-obd-fonts';
const SHELL = ['./', 'index.html', 'obd-core.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function notifyUpdated(){
  for (const c of await self.clients.matchAll()) c.postMessage({type: 'updated'});
}

// Önbellekteki sürümü hemen döner, ağdan yenisini alıp saklar
async function shell(req){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, {ignoreSearch: true});
  const textual = /(\.html|\.js|\/)$/.test(new URL(req.url).pathname);
  const fresh = fetch(req).then(async res => {
    if (res.ok && res.type === 'basic'){
      const changed = textual && cached && (await cached.clone().text()) !== (await res.clone().text());
      await cache.put(req, res.clone());
      if (changed) notifyUpdated();
    }
    return res;
  }).catch(() => null);
  return cached || (await fresh) || new Response('Çevrimdışı ve önbellekte yok', {status: 503});
}

// Benzin fiyatı: önce ağ (4 sn), olmazsa son bilinen fiyat
async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 4000))]);
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
    e.respondWith(url.pathname.endsWith('/fuel.json') ? networkFirst(req) : shell(req));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(fonts(req));
  }
});
