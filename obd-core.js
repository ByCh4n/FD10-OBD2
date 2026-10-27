/* Clio OBD — protokol çekirdeği: PID tabloları, ELM327 yanıt ayrıştırıcıları, arıza kodu sözlüğü, Mode 06.
   DOM'a dokunmaz; tarayıcıda window.OBD, Node'da module.exports olarak kullanılır. */
(function (root) {
"use strict";
const hex2 = n => n.toString(16).toUpperCase().padStart(2,'0');

/* ---------- PID tanımları (SAE J1979 Mode 01, sayısal olanların tamamı) ---------- */
const W = (a,b) => a*256+b, PCT = a => a*100/255, TRIM = a => (a-128)*100/128, S16 = v => v > 32767 ? v-65536 : v;
const PIDS = {
  '0C':{k:'rpm',     l:'Devir',               u:'dev/dk', n:2, f:(a,b)=>W(a,b)/4, d:0, fast:true, g:'motor'},
  '0D':{k:'speed',   l:'Hız',                 u:'km/sa',  n:1, f:a=>a, d:0, fast:true, g:'motor'},
  '04':{k:'load',    l:'Motor yükü',          u:'%',      n:1, f:PCT, d:0, fast:true, g:'motor'},
  '43':{k:'absLoad', l:'Mutlak yük',          u:'%',      n:2, f:(a,b)=>W(a,b)*100/255, d:0, g:'motor'},
  '11':{k:'throttle',l:'Gaz kelebeği',        u:'%',      n:1, f:PCT, d:0, fast:true, g:'motor'},
  '45':{k:'relThr',  l:'Göreli gaz kelebeği', u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '47':{k:'thrB',    l:'Gaz kelebeği B',      u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '48':{k:'thrC',    l:'Gaz kelebeği C',      u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '4C':{k:'thrCmd',  l:'İstenen gaz kelebeği',u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '49':{k:'pedD',    l:'Gaz pedalı D',        u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '4A':{k:'pedE',    l:'Gaz pedalı E',        u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '4B':{k:'pedF',    l:'Gaz pedalı F',        u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '5A':{k:'relPed',  l:'Göreli gaz pedalı',   u:'%',      n:1, f:PCT, d:0, g:'motor'},
  '0B':{k:'map',     l:'Manifold basıncı',    u:'kPa',    n:1, f:a=>a, d:0, fast:true, g:'motor'},
  '0E':{k:'timing',  l:'Ateşleme avansı',     u:'°',      n:1, f:a=>a/2-64, d:1, g:'motor'},
  '61':{k:'tqDem',   l:'İstenen tork',        u:'%',      n:1, f:a=>a-125, d:0, g:'motor'},
  '62':{k:'tqAct',   l:'Gerçek tork',         u:'%',      n:1, f:a=>a-125, d:0, g:'motor'},
  '63':{k:'tqRef',   l:'Referans tork',       u:'Nm',     n:2, f:W, d:0, g:'motor'},
  '8E':{k:'tqFric',  l:'Sürtünme torku',      u:'%',      n:1, f:a=>a-125, d:0, g:'motor'},
  '05':{k:'coolant', l:'Motor suyu',          u:'°C',     n:1, f:a=>a-40, d:0, g:'temp'},
  '5C':{k:'oil',     l:'Motor yağı',          u:'°C',     n:1, f:a=>a-40, d:0, g:'temp'},
  '0F':{k:'iat',     l:'Emme havası',         u:'°C',     n:1, f:a=>a-40, d:0, g:'temp'},
  '46':{k:'ambient', l:'Dış hava',            u:'°C',     n:1, f:a=>a-40, d:0, g:'temp'},
  '3C':{k:'catB1S1', l:'Katalizör B1S1',      u:'°C',     n:2, f:(a,b)=>W(a,b)/10-40, d:0, g:'temp'},
  '3D':{k:'catB2S1', l:'Katalizör B2S1',      u:'°C',     n:2, f:(a,b)=>W(a,b)/10-40, d:0, g:'temp'},
  '3E':{k:'catB1S2', l:'Katalizör B1S2',      u:'°C',     n:2, f:(a,b)=>W(a,b)/10-40, d:0, g:'temp'},
  '3F':{k:'catB2S2', l:'Katalizör B2S2',      u:'°C',     n:2, f:(a,b)=>W(a,b)/10-40, d:0, g:'temp'},
  '10':{k:'maf',     l:'Hava akışı (MAF)',    u:'g/s',    n:2, f:(a,b)=>W(a,b)/100, d:1, fast:true, g:'fuel'},
  '5E':{k:'fuelRate',l:'Yakıt debisi (ECU)',  u:'L/sa',   n:2, f:(a,b)=>W(a,b)/20, d:2, g:'fuel'},
  '06':{k:'stft',    l:'Kısa yakıt trimi',    u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '07':{k:'ltft',    l:'Uzun yakıt trimi',    u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '08':{k:'stft2',   l:'Kısa yakıt trimi B2', u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '09':{k:'ltft2',   l:'Uzun yakıt trimi B2', u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '55':{k:'st2B1',   l:'Arka O2 kısa trim B1',u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '56':{k:'lt2B1',   l:'Arka O2 uzun trim B1',u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '57':{k:'st2B2',   l:'Arka O2 kısa trim B2',u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '58':{k:'lt2B2',   l:'Arka O2 uzun trim B2',u:'%',      n:1, f:TRIM, d:1, g:'fuel'},
  '44':{k:'lambdaCmd',l:'İstenen lambda',     u:'λ',      n:2, f:(a,b)=>W(a,b)*2/65536, d:3, g:'fuel'},
  '2F':{k:'fuel',    l:'Yakıt seviyesi',      u:'%',      n:1, f:PCT, d:0, g:'fuel'},
  '0A':{k:'fuelP',   l:'Yakıt basıncı',       u:'kPa',    n:1, f:a=>a*3, d:0, g:'fuel'},
  '22':{k:'railVac', l:'Rampa basıncı (vakum)',u:'kPa',   n:2, f:(a,b)=>W(a,b)*0.079, d:1, g:'fuel'},
  '23':{k:'railP',   l:'Rampa basıncı',       u:'kPa',    n:2, f:(a,b)=>W(a,b)*10, d:0, g:'fuel'},
  '59':{k:'railAbs', l:'Rampa mutlak basıncı',u:'kPa',    n:2, f:(a,b)=>W(a,b)*10, d:0, g:'fuel'},
  '5D':{k:'injTime', l:'Enjeksiyon zamanlaması',u:'°',    n:2, f:(a,b)=>W(a,b)/128-210, d:1, g:'fuel'},
  '52':{k:'ethanol', l:'Etanol oranı',        u:'%',      n:1, f:PCT, d:0, g:'fuel'},
  '2C':{k:'egrCmd',  l:'İstenen EGR',         u:'%',      n:1, f:PCT, d:0, g:'emis'},
  '2D':{k:'egrErr',  l:'EGR hatası',          u:'%',      n:1, f:TRIM, d:1, g:'emis'},
  '2E':{k:'purge',   l:'Kanister boşaltma',   u:'%',      n:1, f:PCT, d:0, g:'emis'},
  '32':{k:'evapP',   l:'EVAP buhar basıncı',  u:'Pa',     n:2, f:(a,b)=>S16(W(a,b))/4, d:0, g:'emis'},
  '53':{k:'evapAbs', l:'EVAP mutlak basınç',  u:'kPa',    n:2, f:(a,b)=>W(a,b)/200, d:2, g:'emis'},
  '54':{k:'evapP2',  l:'EVAP buhar basıncı (geniş)',u:'Pa',n:2, f:(a,b)=>S16(W(a,b)), d:0, g:'emis'},
  '42':{k:'ecuv',    l:'ECU voltajı',         u:'V',      n:2, f:(a,b)=>W(a,b)/1000, d:1, g:'elec'},
  '5B':{k:'hybBatt', l:'Hibrit akü',          u:'%',      n:1, f:PCT, d:0, g:'elec'},
  '33':{k:'baro',    l:'Atmosfer basıncı',    u:'kPa',    n:1, f:a=>a, d:0, g:'count'},
  '1F':{k:'runtime', l:'Motor çalışma süresi',u:'sn',     n:2, f:W, d:0, g:'count'},
  '30':{k:'warmups', l:'Kod silmeden beri ısınma',u:'adet',n:1, f:a=>a, d:0, g:'count'},
  '31':{k:'distClr', l:'Kod silmeden beri',   u:'km',     n:2, f:W, d:0, g:'count'},
  '4E':{k:'timeClr', l:'Kod silmeden beri süre',u:'dk',   n:2, f:W, d:0, g:'count'},
  '21':{k:'distMil', l:'Lamba yanıkken yol',  u:'km',     n:2, f:W, d:0, g:'count'},
  '4D':{k:'timeMil', l:'Lamba yanıkken süre', u:'dk',     n:2, f:W, d:0, g:'count'},
  'A6':{k:'odo',     l:'Kilometre (ECU)',     u:'km',     n:4, f:(a,b,c,d)=>(a*16777216+b*65536+c*256+d)/10, d:1, g:'count'},
};
// O2 sensörleri: 14–1B dar bant (voltaj + trim), 24–2B ve 34–3B geniş bant. Sıra PID 13 düzenine göre B1S1…B2S4.
const O2POS = ['B1S1','B1S2','B1S3','B1S4','B2S1','B2S2','B2S3','B2S4'];
const O2SIDE = {B1S1:' (ön)', B1S2:' (arka)'};
O2POS.forEach((pos, i) => {
  const s = O2SIDE[pos] || '';
  PIDS[hex2(0x14+i)] = {k:'o2v'+pos, l:`O2 ${pos} voltajı${s}`, u:'V', n:1, f:a=>a/200, d:3, g:'sensor',
    x:[{k:'o2t'+pos, l:`O2 ${pos} trimi${s}`, u:'%', d:1, g:'sensor', f:(a,b)=> b == null || b === 255 ? null : TRIM(b)}]};
  PIDS[hex2(0x24+i)] = {k:'wlv'+pos, l:`Geniş bant ${pos} lambda`, u:'λ', n:4, f:(a,b)=>W(a,b)*2/65536, d:3, g:'sensor',
    x:[{k:'wvv'+pos, l:`Geniş bant ${pos} voltajı`, u:'V', d:3, g:'sensor', f:(a,b,c,d)=>W(c,d)*8/65536}]};
  PIDS[hex2(0x34+i)] = {k:'wlc'+pos, l:`Geniş bant ${pos} lambda`, u:'λ', n:4, f:(a,b)=>W(a,b)*2/65536, d:3, g:'sensor',
    x:[{k:'wcc'+pos, l:`Geniş bant ${pos} akımı`, u:'mA', d:2, g:'sensor', f:(a,b,c,d)=>W(c,d)/256-128}]};
});
// Metin döndüren PID'ler
const bitsList = (a, names) => names.filter((_, i) => a & (1<<i)).join(', ') || 'Yok';
const FSYS = {1:'Açık devre (motor soğuk)', 2:'Kapalı devre (O2 ile)', 4:'Açık devre (yük veya yakıt kesme)', 8:'Açık devre (arıza)', 16:'Kapalı devre (geri besleme arızalı)'};
const OBDSTD = {1:'OBD-II (CARB)', 2:'OBD (EPA)', 3:'OBD ve OBD-II', 4:'OBD-I', 5:'OBD uyumlu değil', 6:'EOBD (Avrupa)', 7:'EOBD ve OBD-II', 8:'EOBD ve OBD', 9:'EOBD, OBD ve OBD-II', 10:'JOBD', 11:'JOBD ve OBD-II', 12:'JOBD ve EOBD', 13:'JOBD, EOBD ve OBD-II'};
const FTYPE = {1:'Benzin', 2:'Metanol', 3:'Etanol', 4:'Dizel', 5:'LPG', 6:'CNG', 7:'Propan', 8:'Elektrik'};
const TXT = {
  '03':{l:'Yakıt sistemi', live:true, f:a => FSYS[a] || (a ? 'Kod ' + hex2(a) : 'Kullanılmıyor')},
  '12':{l:'İkincil hava', live:true, f:a => ({1:'Katalizör öncesi', 2:'Katalizör sonrası', 4:'Dış hava veya kapalı', 8:'Pompa açık (teşhis)'})[a] || (a ? 'Kod ' + hex2(a) : 'Kapalı')},
  '13':{l:'O2 sensörleri', f:a => bitsList(a, O2POS)},
  '1D':{l:'O2 sensörleri', f:a => bitsList(a, ['B1S1','B1S2','B2S1','B2S2','B3S1','B3S2','B4S1','B4S2'])},
  '1C':{l:'OBD standardı', f:a => OBDSTD[a] || 'Kod ' + a},
  '51':{l:'Yakıt tipi', f:a => FTYPE[a] || 'Kod ' + a},
};
const NOT_RAW = new Set(['00','20','40','60','80','A0','C0','E0','01','02']);
const DERIVED = {
  batt:{k:'batt', l:'Akü (adaptör)', u:'V',       d:1, g:'elec'},
  l100:{k:'l100', l:'Anlık tüketim', u:'L/100 km',d:1, g:'fuel'},
  lph: {k:'lph',  l:'Anlık tüketim', u:'L/sa',    d:2, g:'fuel'},
};
const GROUPS = [['motor','Motor'],['fuel','Yakıt'],['temp','Sıcaklık'],['sensor','O2 sensörleri'],['emis','Emisyon'],['elec','Elektrik'],['count','Sayaçlar']];
const META = {};
for (const p in PIDS){ META[PIDS[p].k] = PIDS[p]; for (const x of PIDS[p].x || []) META[x.k] = x; }
for (const k in DERIVED) META[k] = DERIVED[k];
const lines = r => r.toUpperCase().split(/[\r\n]+/).map(s=>s.replace(/\s+/g,'')).filter(s => s && !/^(SEARCHING|BUSINIT|OK$|TIMEOUT|>)/.test(s));
const bad = r => /NO ?DATA|UNABLE|STOPPED|CAN ?ERROR|BUS ?ERROR|BUFFER|TIMEOUT|^\s*\?/m.test(r.toUpperCase());
function pidBytes(r, mode, pid){
  const key = hex2(0x40+mode)+pid;
  for (const l of lines(r)){
    const s = l.replace(/^[0-9A-F]:/,''); const i = s.indexOf(key);
    if (i >= 0){ const h = s.slice(i+key.length); const b=[]; for (let j=0;j+1<h.length;j+=2) b.push(parseInt(h.substr(j,2),16)); return b.filter(x=>!isNaN(x)); }
  }
  return null;
}
const decodeDtc = h => { const a = parseInt(h.substr(0,2),16); return 'PCBU'[a>>6] + ((a>>4)&3) + h[1] + h.substr(2,2); };
function parseDtc(r, rb, isCAN){
  const ls = lines(r).filter(l => /^[0-9A-F:]+$/.test(l));
  const codes = new Set();
  const take = (data, hasCount) => {
    if (!data.startsWith(rb)) return;
    let body = data.slice(2);
    if (hasCount){ const n = parseInt(body.substr(0,2),16); body = body.slice(2, 2 + n*4); }
    for (let i=0;i+3<body.length;i+=4){ const h = body.substr(i,4); if (h !== '0000') codes.add(decodeDtc(h)); }
  };
  if (isCAN){
    const multi = ls.some(l => /^[0-9A-F]:/.test(l));
    if (multi) take(ls.filter(l => /^[0-9A-F]:/.test(l)).map(l => l.slice(2)).join(''), true);
    else ls.forEach(l => take(l, true));
  } else ls.forEach(l => take(l, false));
  return [...codes];
}
// Çok çerçeveli CAN yanıtını (ilk satır bayt sayısı, sonra "0:", "1:" …) tek hex dizisine çevirir; key'den itibaren döner
function frames(r, key){
  const ls = lines(r).filter(l => /^[0-9A-F:]+$/.test(l));
  if (!ls.some(l => /^[0-9A-F]:/.test(l))) return null;
  const lenLine = ls.find(l => /^[0-9A-F]{3}$/.test(l));
  let hex = ls.filter(l => /^[0-9A-F]:/.test(l)).map(l => l.slice(2)).join('');
  if (lenLine) hex = hex.slice(0, parseInt(lenLine,16)*2);
  const i = hex.indexOf(key); return i < 0 ? null : hex.slice(i);
}
// Mode 09: "49 PID adet veri…" — CAN'de tek parça, K-line'da sıra numaralı satırlar
function mode9(r, pid){
  const key = '49'+pid, f = frames(r, key);
  if (f) return f.slice(6);
  const parts = lines(r).filter(l => l.startsWith(key)).map(l => ({n:parseInt(l.substr(4,2),16), d:l.slice(6)})).sort((a,b) => a.n-b.n);
  return parts.length ? parts.map(p => p.d).join('') : null;
}
const hexAscii = hex => { let s = ''; for (let i=0;i+1<hex.length;i+=2){ const c = parseInt(hex.substr(i,2),16); if (c>=0x20 && c<0x7F) s += String.fromCharCode(c); } return s; };
function parseVin(r){
  const hex = mode9(r, '02'); if (!hex) return null;
  const s = hexAscii(hex).replace(/[^0-9A-Z]/g,'');
  return s.length >= 17 ? s.slice(-17) : null;
}
function parseCalid(r){
  const hex = mode9(r, '04'); if (!hex) return null;
  const ids = []; for (let i=0;i<hex.length;i+=32){ const s = hexAscii(hex.substr(i,32)).trim(); if (s) ids.push(s); }
  return ids.length ? ids.join(', ') : null;
}
function parseCvn(r){
  const hex = mode9(r, '06'); if (!hex) return null;
  const ids = hex.match(/.{8}/g) || []; return ids.length ? ids.join(', ') : null;
}
function parseEcuName(r){
  const hex = mode9(r, '0A'); if (!hex) return null;
  const s = hexAscii(hex).replace(/\s+/g,' ').trim(); return s || null;
}
const ECU_NAMES = {'7E8':'Motor','7E9':'Şanzıman','7EA':'Hibrit/ABS','10':'Motor','18':'Şanzıman'};
function addMask(set, b, base){ for (let i=0;i<32;i++) if (b[i>>3] & (0x80>>(i&7))) set.add(hex2(base+i+1)); }
const parseVolt = r => { const m = r.match(/(\d+(?:[.,]\d+)?)\s*V/i); return m ? parseFloat(m[1].replace(',','.')) : null; };
const DTC_TR = {
  // Değişken supap zamanlaması, krank/eksantrik uyumu
  P0010:'Eksantrik ayar aktüatörü A devresi (bank 1)', P0011:'Eksantrik A zamanlaması fazla avanslı (bank 1)', P0012:'Eksantrik A zamanlaması fazla geride (bank 1)',
  P0013:'Eksantrik ayar aktüatörü B devresi (bank 1)', P0014:'Eksantrik B zamanlaması fazla avanslı (bank 1)', P0016:'Krank ve eksantrik A sensörü uyumsuz (bank 1)', P0017:'Krank ve eksantrik B sensörü uyumsuz (bank 1)',
  // O2 ısıtıcıları
  P0030:'O2 ısıtıcı kontrol devresi (B1S1)', P0031:'O2 ısıtıcı devresi düşük (B1S1)', P0032:'O2 ısıtıcı devresi yüksek (B1S1)',
  P0036:'O2 ısıtıcı kontrol devresi (B1S2)', P0037:'O2 ısıtıcı devresi düşük (B1S2)', P0038:'O2 ısıtıcı devresi yüksek (B1S2)',
  P0068:'Manifold basıncı / hava akışı ile gaz kelebeği uyumsuz', P0069:'Manifold basıncı ile atmosfer basıncı uyumsuz',
  P0070:'Dış hava sıcaklık sensörü devresi', P0071:'Dış hava sıcaklık sensörü aralık/performans', P0072:'Dış hava sıcaklık sensörü düşük giriş', P0073:'Dış hava sıcaklık sensörü yüksek giriş',
  // Hava ve yakıt ölçümü
  P0100:'Hava akış (MAF) sensörü devresi', P0101:'MAF sensörü aralık/performans', P0102:'MAF sensörü düşük giriş', P0103:'MAF sensörü yüksek giriş', P0104:'MAF sensörü kesintili',
  P0105:'Manifold basınç (MAP) sensörü devresi', P0106:'MAP sensörü aralık/performans', P0107:'MAP sensörü düşük giriş', P0108:'MAP sensörü yüksek giriş', P0109:'MAP sensörü kesintili',
  P0110:'Emme havası sıcaklık sensörü devresi', P0111:'Emme havası sıcaklık sensörü aralık/performans', P0112:'Emme havası sıcaklık sensörü düşük giriş', P0113:'Emme havası sıcaklık sensörü yüksek giriş', P0114:'Emme havası sıcaklık sensörü kesintili',
  P0115:'Motor suyu sıcaklık sensörü devresi', P0116:'Su sıcaklık sensörü aralık/performans', P0117:'Su sıcaklık sensörü düşük giriş', P0118:'Su sıcaklık sensörü yüksek giriş', P0119:'Su sıcaklık sensörü kesintili',
  P0120:'Gaz kelebeği/pedal konum sensörü A devresi', P0121:'Gaz kelebeği sensörü A aralık/performans', P0122:'Gaz kelebeği sensörü A düşük giriş', P0123:'Gaz kelebeği sensörü A yüksek giriş', P0124:'Gaz kelebeği sensörü A kesintili',
  P0125:'Kapalı devre yakıt kontrolü için su sıcaklığı yetersiz', P0126:'Kararlı çalışma için su sıcaklığı yetersiz', P0127:'Emme havası sıcaklığı çok yüksek',
  P0128:'Su sıcaklığı termostat değerinin altında (termostat)',
  // O2 sensörleri
  P0130:'O2 sensörü devresi (B1S1)', P0131:'O2 sensörü düşük voltaj (B1S1)', P0132:'O2 sensörü yüksek voltaj (B1S1)', P0133:'O2 sensörü yavaş tepki (B1S1)', P0134:'O2 sensöründe aktivite yok (B1S1)', P0135:'O2 sensörü ısıtıcı devresi (B1S1)',
  P0136:'O2 sensörü devresi (B1S2)', P0137:'O2 sensörü düşük voltaj (B1S2)', P0138:'O2 sensörü yüksek voltaj (B1S2)', P0139:'O2 sensörü yavaş tepki (B1S2)', P0140:'O2 sensöründe aktivite yok (B1S2)', P0141:'O2 sensörü ısıtıcı devresi (B1S2)',
  P0170:'Yakıt trimi arızası (bank 1)', P0171:'Karışım çok fakir (bank 1)', P0172:'Karışım çok zengin (bank 1)',
  P0190:'Yakıt rampası basınç sensörü devresi', P0191:'Yakıt rampası basınç sensörü aralık/performans', P0192:'Yakıt rampası basınç sensörü düşük giriş', P0193:'Yakıt rampası basınç sensörü yüksek giriş',
  // Enjektörler ve yakıt pompası
  P0200:'Enjektör devresi', P0201:'Enjektör devresi, silindir 1', P0202:'Enjektör devresi, silindir 2', P0203:'Enjektör devresi, silindir 3', P0204:'Enjektör devresi, silindir 4',
  P0217:'Motor aşırı ısınma durumu', P0219:'Motor aşırı devir durumu',
  P0220:'Gaz kelebeği/pedal konum sensörü B devresi', P0221:'Gaz kelebeği sensörü B aralık/performans', P0222:'Gaz kelebeği sensörü B düşük giriş', P0223:'Gaz kelebeği sensörü B yüksek giriş',
  P0230:'Yakıt pompası birincil devresi', P0231:'Yakıt pompası ikincil devresi düşük', P0232:'Yakıt pompası ikincil devresi yüksek',
  P0261:'Enjektör 1 devresi düşük', P0262:'Enjektör 1 devresi yüksek', P0264:'Enjektör 2 devresi düşük', P0265:'Enjektör 2 devresi yüksek',
  P0267:'Enjektör 3 devresi düşük', P0268:'Enjektör 3 devresi yüksek', P0270:'Enjektör 4 devresi düşük', P0271:'Enjektör 4 devresi yüksek',
  // Ateşleme ve tekleme
  P0300:'Rastgele/çoklu silindir tekleme', P0301:'Silindir 1 tekleme', P0302:'Silindir 2 tekleme', P0303:'Silindir 3 tekleme', P0304:'Silindir 4 tekleme',
  P0313:'Düşük yakıt seviyesinde tekleme', P0315:'Krank konum sistemi sapması öğrenilmemiş',
  P0320:'Ateşleme/devir giriş devresi', P0321:'Ateşleme/devir giriş devresi aralık/performans', P0322:'Ateşleme/devir girişinde sinyal yok',
  P0325:'Vuruntu sensörü 1 devresi', P0326:'Vuruntu sensörü 1 aralık/performans', P0327:'Vuruntu sensörü 1 düşük giriş', P0328:'Vuruntu sensörü 1 yüksek giriş', P0329:'Vuruntu sensörü 1 kesintili',
  P0335:'Krank mili konum sensörü A devresi', P0336:'Krank mili konum sensörü aralık/performans', P0337:'Krank mili konum sensörü düşük giriş', P0338:'Krank mili konum sensörü yüksek giriş', P0339:'Krank mili konum sensörü kesintili',
  P0340:'Eksantrik mili konum sensörü A devresi', P0341:'Eksantrik mili konum sensörü aralık/performans', P0342:'Eksantrik mili konum sensörü düşük giriş', P0343:'Eksantrik mili konum sensörü yüksek giriş', P0344:'Eksantrik mili konum sensörü kesintili',
  P0350:'Ateşleme bobini birincil/ikincil devresi', P0351:'Ateşleme bobini A devresi', P0352:'Ateşleme bobini B devresi', P0353:'Ateşleme bobini C devresi', P0354:'Ateşleme bobini D devresi',
  // Emisyon kontrolü
  P0400:'EGR akış arızası', P0401:'EGR akışı yetersiz', P0402:'EGR akışı fazla', P0410:'İkincil hava enjeksiyon sistemi',
  P0420:'Katalizör verimi eşiğin altında (bank 1)', P0421:'Ön ısıtma katalizörü verimi eşiğin altında (bank 1)', P0422:'Ana katalizör verimi eşiğin altında (bank 1)',
  P0440:'Buharlaşma (EVAP) sistemi arızası', P0441:'EVAP boşaltma akışı hatalı', P0442:'EVAP sisteminde küçük kaçak', P0443:'EVAP kanister boşaltma valfi devresi',
  P0444:'EVAP boşaltma valfi devresi açık', P0445:'EVAP boşaltma valfi devresi kısa devre', P0446:'EVAP havalandırma kontrol devresi', P0455:'EVAP sisteminde büyük kaçak', P0456:'EVAP sisteminde çok küçük kaçak',
  P0460:'Yakıt seviye sensörü devresi', P0461:'Yakıt seviye sensörü aralık/performans', P0462:'Yakıt seviye sensörü düşük giriş', P0463:'Yakıt seviye sensörü yüksek giriş', P0464:'Yakıt seviye sensörü kesintili',
  P0480:'Soğutma fanı 1 kontrol devresi', P0481:'Soğutma fanı 2 kontrol devresi',
  // Hız ve rölanti
  P0500:'Araç hız sensörü', P0501:'Araç hız sensörü aralık/performans', P0502:'Araç hız sensörü düşük giriş', P0503:'Araç hız sensörü kesintili/düzensiz/yüksek',
  P0505:'Rölanti kontrol sistemi', P0506:'Rölanti beklenenden düşük', P0507:'Rölanti beklenenden yüksek', P0508:'Rölanti kontrol devresi düşük', P0509:'Rölanti kontrol devresi yüksek',
  P0510:'Kapalı gaz kelebeği konum anahtarı',
  P0530:'Klima gaz basınç sensörü devresi', P0532:'Klima gaz basınç sensörü düşük giriş', P0533:'Klima gaz basınç sensörü yüksek giriş',
  P0560:'Sistem voltajı', P0561:'Sistem voltajı kararsız', P0562:'Sistem voltajı düşük', P0563:'Sistem voltajı yüksek', P0571:'Fren anahtarı A devresi',
  // ECU ve çıkış devreleri
  P0600:'Seri iletişim hattı', P0601:'ECU hafıza kontrol toplamı hatası', P0602:'ECU programlama hatası', P0603:'ECU kalıcı hafıza (KAM) hatası',
  P0604:'ECU RAM hatası', P0605:'ECU ROM hatası', P0606:'ECU işlemci arızası', P0607:'ECU performansı',
  P0615:'Marş rölesi devresi', P0627:'Yakıt pompası kontrol devresi açık', P0630:'ECU\'da şasi no programlanmamış veya uyumsuz',
  P0638:'Gaz kelebeği aktüatörü aralık/performans (bank 1)', P0641:'Sensör referans voltajı A devresi', P0645:'Klima kompresör rölesi kontrol devresi',
  P0650:'Arıza lambası (MIL) kontrol devresi', P0651:'Sensör referans voltajı B devresi', P0685:'ECU güç rölesi kontrol devresi', P0688:'ECU güç rölesi algılama devresi',
  P0700:'Şanzıman kontrol sistemi arıza bildiriyor',
  // P2xxx
  P2096:'Katalizör sonrası yakıt trimi çok fakir (bank 1)', P2097:'Katalizör sonrası yakıt trimi çok zengin (bank 1)',
  P2100:'Gaz kelebeği motoru devresi açık', P2101:'Gaz kelebeği motoru aralık/performans', P2102:'Gaz kelebeği motoru devresi düşük', P2103:'Gaz kelebeği motoru devresi yüksek',
  P2106:'Gaz kelebeği sistemi, güç sınırlandı', P2108:'Gaz kelebeği kontrol modülü performansı', P2110:'Gaz kelebeği sistemi, devir sınırlandı',
  P2111:'Gaz kelebeği açık takılı', P2112:'Gaz kelebeği kapalı takılı', P2118:'Gaz kelebeği motoru akımı aralık/performans', P2119:'Gaz kelebeği gövdesi aralık/performans',
  P2122:'Gaz pedalı sensörü D düşük giriş', P2123:'Gaz pedalı sensörü D yüksek giriş', P2127:'Gaz pedalı sensörü E düşük giriş', P2128:'Gaz pedalı sensörü E yüksek giriş',
  P2135:'Gaz kelebeği sensörü A-B voltaj uyumsuzluğu', P2138:'Gaz pedalı sensörü D-E voltaj uyumsuzluğu', P2176:'Gaz kelebeği rölanti konumu öğrenilmemiş',
  P2177:'Rölanti dışında karışım çok fakir (bank 1)', P2178:'Rölanti dışında karışım çok zengin (bank 1)', P2187:'Rölantide karışım çok fakir (bank 1)', P2188:'Rölantide karışım çok zengin (bank 1)',
  P2195:'O2 sensörü fakirde takılı (B1S1)', P2196:'O2 sensörü zenginde takılı (B1S1)', P2270:'O2 sensörü fakirde takılı (B1S2)', P2271:'O2 sensörü zenginde takılı (B1S2)',
  P2300:'Ateşleme bobini A kontrol devresi düşük', P2301:'Ateşleme bobini A kontrol devresi yüksek', P2303:'Ateşleme bobini B kontrol devresi düşük', P2304:'Ateşleme bobini B kontrol devresi yüksek',
  P2306:'Ateşleme bobini C kontrol devresi düşük', P2307:'Ateşleme bobini C kontrol devresi yüksek', P2309:'Ateşleme bobini D kontrol devresi düşük', P2310:'Ateşleme bobini D kontrol devresi yüksek',
  P2A00:'O2 sensörü devresi aralık/performans (B1S1)',
  // Ağ
  U0001:'Yüksek hızlı CAN iletişim hattı', U0073:'Kontrol modülü iletişim hattı A kapalı', U0100:'Motor ECU ile iletişim kaybı', U0101:'Şanzıman ECU ile iletişim kaybı',
  U0121:'ABS modülü ile iletişim kaybı', U0140:'Gövde kontrol modülü (UCH) ile iletişim kaybı', U0151:'Hava yastığı modülü ile iletişim kaybı',
  U0155:'Gösterge paneli ile iletişim kaybı', U0164:'Klima kontrol modülü ile iletişim kaybı', U0167:'İmmobilizer ile iletişim kaybı',
  U0401:'Motor ECU\'dan geçersiz veri', U0415:'ABS modülünden geçersiz veri'
};
const SYS = {P:'Motor/şanzıman', C:'Şasi', B:'Gövde', U:'Ağ/iletişim'};
const RANGE_P = {'0':'Yakıt ve hava ölçümü','1':'Yakıt ve hava ölçümü','2':'Enjektör devresi','3':'Ateşleme sistemi veya tekleme','4':'Emisyon kontrolü','5':'Hız ve rölanti kontrolü','6':'ECU ve çıkış devreleri','7':'Şanzıman','8':'Şanzıman','9':'Şanzıman','A':'Hibrit sistem','B':'Hibrit sistem','C':'Hibrit sistem'};
const describe = code => DTC_TR[code] || (code[0]==='P' ? (RANGE_P[code[2]] || 'Motor') + ' arızası' : SYS[code[0]] + ' arızası');
const isOem = code => code[1]==='1' || code[1]==='3';

const READY_B = [[0,4,'Tekleme izleme'],[1,5,'Yakıt sistemi'],[2,6,'Bileşenler']];
const READY_SPARK = ['Katalizör','Isıtmalı katalizör','Buharlaşma (EVAP)','İkincil hava','Klima gazı','Oksijen sensörü','O2 sensör ısıtıcısı','EGR sistemi'];
// Birim ve ölçek (SAE J1979 UASID): [çarpan, birim, ofset]; 0x80 üstü aynı birimin işaretli hali
const UAS = {
  0x01:[1,''],0x02:[0.1,''],0x03:[0.01,''],0x04:[0.001,''],0x05:[0.0000305,''],0x06:[0.000305,''],
  0x07:[0.25,'dev/dk'],0x08:[0.01,'km/sa'],0x09:[1,'km/sa'],0x0A:[0.000122,'V'],0x0B:[0.001,'V'],0x0C:[0.01,'V'],
  0x0D:[0.00390625,'mA'],0x0E:[0.001,'A'],0x0F:[0.01,'A'],0x10:[1,'ms'],0x11:[100,'ms'],0x12:[1,'sn'],
  0x13:[1,'mΩ'],0x14:[1,'Ω'],0x15:[1,'kΩ'],0x16:[0.1,'°C',-40],0x17:[0.01,'kPa'],0x18:[0.0117,'kPa'],0x19:[0.079,'kPa'],
  0x1A:[1,'kPa'],0x1B:[10,'kPa'],0x1C:[0.01,'°'],0x1D:[0.5,'°'],0x1E:[0.0000305,'λ'],0x1F:[0.05,'hava/yakıt'],
  0x20:[0.0039062,'oran'],0x21:[1,'mHz'],0x22:[1,'Hz'],0x23:[1,'kHz'],0x24:[1,'adet'],0x25:[1,'km'],
  0x26:[0.1,'mV/ms'],0x27:[0.01,'g/s'],0x28:[1,'g/s'],0x29:[0.25,'Pa/s'],0x2A:[0.001,'kg/sa'],0x2B:[1,'geçiş'],
  0x2C:[0.01,'g/silindir'],0x2D:[0.01,'mg/strok'],0x2E:[1,'doğru/yanlış'],0x2F:[0.01,'%'],0x30:[0.001526,'%'],
  0x31:[0.001,'L'],0x32:[0.0000305,'inç'],0x33:[0.00024414,'oran'],0x34:[1,'dk'],0x35:[10,'ms'],0x36:[0.01,'g'],
  0x37:[0.1,'g'],0x38:[1,'g'],0x39:[0.01,'%',-327.68],0x3A:[0.001,'g'],0x3B:[0.0001,'g'],0x3C:[0.1,'µs'],
  0x3D:[0.01,'mA'],0x3F:[0.01,'L'],0x40:[1,'ppm'],0x41:[0.01,'µA'],
  0x96:[0.1,'°C'],0xFC:[0.01,'kPa'],0xFD:[0.001,'kPa'],0xFE:[0.25,'Pa'],
};
function uas(id, raw){
  const signed = id >= 0x80, s = UAS[id] || (signed ? UAS[id - 0x80] : null);
  const v = signed && raw > 32767 ? raw - 65536 : raw;
  if (!s) return {v:raw, u:`ham (${hex2(id)})`, d:0};
  const val = v * s[0] + ((UAS[id] && UAS[id][2]) || 0);
  return {v:val, u:s[1], d: s[0] >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(s[0])))};
}
const MID_NAMES = mid => {
  const n = parseInt(mid,16);
  if (n >= 0x01 && n <= 0x08) return `O2 sensörü ${O2POS[n-1]}`;
  if (n >= 0x21 && n <= 0x24) return `Katalizör bank ${n-0x20}`;
  if (n >= 0x31 && n <= 0x34) return `EGR / VVT bank ${n-0x30}`;
  if (n >= 0x35 && n <= 0x38) return `VVT bank ${n-0x34}`;
  if (n === 0x39) return 'EVAP (kapak açık / 0,150")'; if (n === 0x3A) return 'EVAP (0,090")'; if (n === 0x3B) return 'EVAP (0,040")'; if (n === 0x3C) return 'EVAP (0,020")'; if (n === 0x3D) return 'EVAP boşaltma akışı';
  if (n >= 0x41 && n <= 0x48) return `O2 ısıtıcısı ${O2POS[n-0x41]}`;
  if (n >= 0x61 && n <= 0x64) return `Isıtmalı katalizör bank ${n-0x60}`;
  if (n >= 0x71 && n <= 0x74) return `İkincil hava ${n-0x70}`;
  if (n >= 0x81 && n <= 0x84) return `Yakıt sistemi bank ${n-0x80}`;
  if (n === 0xA1) return 'Tekleme (genel)';
  if (n >= 0xA2 && n <= 0xAD) return `Tekleme silindir ${n-0xA1}`;
  return `Test grubu ${mid}`;
};
const O2_TID = {0x01:'Zenginden fakire eşik voltajı',0x02:'Fakirden zengine eşik voltajı',0x03:'Geçiş süresi için düşük voltaj',0x04:'Geçiş süresi için yüksek voltaj',
  0x05:'Zenginden fakire geçiş süresi',0x06:'Fakirden zengine geçiş süresi',0x07:'En düşük voltaj',0x08:'En yüksek voltaj',0x09:'Geçişler arası süre',0x0A:'Sensör periyodu'};
const TID_NAME = (mid, tid) => {
  const n = parseInt(mid,16);
  if (n <= 0x08 && O2_TID[tid]) return O2_TID[tid];
  if (n >= 0xA1 && n <= 0xAD && tid === 0x0B) return 'Tekleme sayısı (son 10 sürüş ort.)';
  if (n >= 0xA1 && n <= 0xAD && tid === 0x0C) return 'Tekleme sayısı (son/bu sürüş)';
  return tid >= 0x80 ? `Üretici testi ${hex2(tid)}` : `Test ${hex2(tid)}`;
};

// 0100 yanıtındaki başlıklardan ECU kimliklerini çıkarır (ATH1 açıkken)
function ecuIds(r){
  const found = new Set();
  for (const l of lines(r)){
    if (!/^[0-9A-F]+$/.test(l) || !/4100/.test(l)) continue;
    let id;
    if (/^7E[8-F]/.test(l)) id = l.slice(0,3);
    else if (/^18DAF1/.test(l)) id = l.slice(6,8);
    else if (l.length >= 6) id = l.slice(4,6);
    if (id) found.add(id);
  }
  return [...found].map(id => `${ECU_NAMES[id] || 'ECU'} (${id})`);
}
// Mode 06 yanıtı: 46 + [MID TID UASID değer min maks] × n
function parseM6(h, mid){
  const rows = [], body = h.slice(2);
  for (let i=0;i+18<=body.length;i+=18){
    const rec = body.substr(i,18); if (rec.slice(0,2) !== mid) break;
    const tid = parseInt(rec.substr(2,2),16), id = parseInt(rec.substr(4,2),16);
    const val = uas(id, parseInt(rec.substr(6,4),16)), mn = uas(id, parseInt(rec.substr(10,4),16)), mx = uas(id, parseInt(rec.substr(14,4),16));
    rows.push({name:`${MID_NAMES(mid)} · ${TID_NAME(mid, tid)}`, val, mn, mx, ok: val.v >= mn.v && val.v <= mx.v});
  }
  return rows;
}

const api = {hex2, W, PCT, TRIM, S16, PIDS, O2POS, TXT, NOT_RAW, DERIVED, GROUPS, META, lines, bad, pidBytes, decodeDtc, parseDtc, frames, mode9, hexAscii, parseVin, parseCalid, parseCvn, parseEcuName, ECU_NAMES, addMask, parseVolt, ecuIds, DTC_TR, SYS, describe, isOem, READY_B, READY_SPARK, UAS, uas, MID_NAMES, TID_NAME, parseM6};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.OBD = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
