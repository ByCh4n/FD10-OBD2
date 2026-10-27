// Bursa / Osmangazi kurşunsuz benzin fiyatını alır ve fuel.json'a yazar.
// Önce Opet, olmazsa Petrol Ofisi denenir. İkisi de olmazsa eski fuel.json korunur.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../fuel.json', import.meta.url);
const PROVINCE = 'Bursa', DISTRICT = 'Osmangazi', PLATE = 16;
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };
const norm = s => String(s ?? '').replace(/[İı]/g, 'I').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plausible = p => Number.isFinite(p) && p > 20 && p < 500;

export function pickOpet(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('Opet: boş yanıt');
  const item = data.find(d => Object.values(d).some(v => typeof v === 'string' && norm(v).includes('OSMANGAZI')));
  if (!item) throw new Error('Opet: Osmangazi bulunamadı');
  const benz = (item.prices || []).filter(p => {
    const n = norm(p.productName);
    return n.includes('BENZIN') && !/MOTORIN|DIZEL|DIESEL|LPG|OTOGAZ/.test(n) && plausible(Number(p.amount));
  });
  if (!benz.length) throw new Error('Opet: benzin ürünü yok');
  const by = a => [...a].sort((x, y) => x.amount - y.amount)[0];
  const pick = by(benz.filter(p => /95/.test(p.productName))) || by(benz);
  return { product: pick.productName, price: Number(pick.amount), source: 'Opet' };
}

export function pickPo(html) {
  const i = html.search(/OSMANGAZ[Iİ]/i);
  if (i < 0) throw new Error('PO: Osmangazi bulunamadı');
  const text = html.slice(i, i + 3000).replace(/<[^>]+>/g, ' ');
  const m = text.match(/(\d{2,3}[.,]\d{2})/);
  const price = m ? parseFloat(m[1].replace(',', '.')) : NaN;
  if (!plausible(price)) throw new Error('PO: fiyat okunamadı');
  return { product: 'Kurşunsuz Benzin 95', price, source: 'Petrol Ofisi' };
}

async function fromOpet() {
  const r = await fetch(`https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=${PLATE}&IncludeAllProducts=true`, { headers: { ...UA, accept: 'application/json' } });
  if (!r.ok) throw new Error('Opet: HTTP ' + r.status);
  return pickOpet(await r.json());
}
async function fromPo() {
  const r = await fetch('https://www.petrolofisi.com.tr/akaryakit-fiyatlari/bursa-akaryakit-fiyatlari', { headers: UA });
  if (!r.ok) throw new Error('PO: HTTP ' + r.status);
  return pickPo(await r.text());
}

async function main() {
  let old = {};
  try { old = JSON.parse(await readFile(FILE, 'utf8')); } catch {}
  for (const src of [fromOpet, fromPo]) {
    try {
      const got = await src();
      const out = { province: PROVINCE, district: DISTRICT, product: got.product, price: Math.round(got.price * 100) / 100, currency: 'TRY', source: got.source, updatedAt: new Date().toISOString() };
      await writeFile(FILE, JSON.stringify(out, null, 2) + '\n');
      console.log(`${out.source}: ${out.product} ${out.price} TL/L`);
      return;
    } catch (e) { console.warn(e.message); }
  }
  console.warn('Fiyat alınamadı, eski değer korunuyor:', old.price ?? 'yok');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
