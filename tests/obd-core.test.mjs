// ELM327 yanıt ayrıştırıcıları için birim testleri: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const OBD = createRequire(import.meta.url)('../obd-core.js');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const ascii = s => [...s].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('');

test('yanıt satırları: boşluk, SEARCHING ve istem karakteri temizlenir', () => {
  assert.deepEqual(OBD.lines('SEARCHING...\r41 0C 1A F8 \r\r>'), ['410C1AF8']);
  assert.deepEqual(OBD.lines('OK\r\r'), []);
});

test('hata yanıtları tanınır', () => {
  for (const r of ['NO DATA', 'UNABLE TO CONNECT', 'CAN ERROR', 'BUS ERROR', 'STOPPED', '?', 'BUFFER FULL', '41 0C\nTIMEOUT'])
    assert.ok(OBD.bad(r), r);
  assert.ok(!OBD.bad('410C1AF8'));
});

test('PID baytları: tek ECU, çok ECU ve çok çerçeveli yanıt', () => {
  assert.deepEqual(OBD.pidBytes('41 0C 1A F8', 1, '0C'), [0x1A, 0xF8]);
  assert.deepEqual(OBD.pidBytes('4100BE3EB813\r410098180001', 1, '00'), [0xBE, 0x3E, 0xB8, 0x13]);
  assert.deepEqual(OBD.pidBytes('42 05 00 7B', 2, '05'), [0x00, 0x7B]);
  assert.equal(OBD.pidBytes('NO DATA', 1, '0C'), null);
});

test('PID çözümleri', () => {
  const P = OBD.PIDS;
  assert.equal(P['0C'].f(0x1A, 0xF8), 1726);
  assert.equal(P['05'].f(0x7B), 83);
  near(P['06'].f(0x80), 0);
  near(P['0E'].f(0x90), 8);
  near(P['42'].f(0x37, 0x14), 14.1);
  near(P['14'].f(0xB4), 0.9);
  near(P['14'].x[0].f(0xB4, 0x80), 0);
  assert.equal(P['15'].x[0].f(0x84, 0xFF), null, 'FF = trim kullanılmıyor');
  near(P['44'].f(0x80, 0x00), 1);
  near(P['3C'].f(0x10, 0x68), 380);
  near(P['A6'].f(0x00, 0x1C, 0x3A, 0x90), 185000);
  assert.equal(P['32'].f(0xFF, 0xFC), -1);
  assert.equal(OBD.TXT['03'].f(2), 'Kapalı devre (O2 ile)');
  assert.equal(OBD.TXT['13'].f(0x03), 'B1S1, B1S2');
  assert.equal(OBD.TXT['1C'].f(6), 'EOBD (Avrupa)');
});

test('desteklenen PID maskesi', () => {
  const s = new Set();
  OBD.addMask(s, [0xBE, 0x1F, 0xA8, 0x13], 0);
  for (const p of ['01', '03', '04', '05', '06', '07', '0C', '0D', '0E', '0F', '10', '11', '13', '15', '1C', '1F', '20']) assert.ok(s.has(p), p);
  assert.ok(!s.has('02') && !s.has('0A'));
});

test('arıza kodu çözümü', () => {
  assert.equal(OBD.decodeDtc('0130'), 'P0130');
  assert.equal(OBD.decodeDtc('1234'), 'P1234');
  assert.equal(OBD.decodeDtc('4123'), 'C0123');
  assert.equal(OBD.decodeDtc('9001'), 'B1001');
  assert.equal(OBD.decodeDtc('C100'), 'U0100');
});

test('arıza kodları: CAN tek çerçeve, kodsuz ve çok çerçeve', () => {
  assert.deepEqual(OBD.parseDtc('43 02 01 30 04 20', '43', true), ['P0130', 'P0420']);
  assert.deepEqual(OBD.parseDtc('43 00', '43', true), []);
  assert.deepEqual(OBD.parseDtc('00A\r0: 43 04 01 30 04 20\r1: 03 01 03 02 00 00 00', '43', true), ['P0130', 'P0420', 'P0301', 'P0302']);
  assert.deepEqual(OBD.parseDtc('47 01 04 20', '47', true), ['P0420']);
  assert.deepEqual(OBD.parseDtc('4A 01 01 30', '4A', true), ['P0130']);
});

test('arıza kodları: K-line (adet baytı yok, 3 kod/satır)', () => {
  assert.deepEqual(OBD.parseDtc('43 01 30 04 20 00 00', '43', false), ['P0130', 'P0420']);
  assert.deepEqual(OBD.parseDtc('43 01 30 04 20 03 01\r43 03 02 00 00 00 00', '43', false), ['P0130', 'P0420', 'P0301', 'P0302']);
  assert.deepEqual(OBD.parseDtc('43 00 00 00 00 00 00', '43', false), []);
});

test('şasi no: CAN çok çerçeve ve K-line', () => {
  const vin = 'VF1BRDEMOECU00001', h = '490201' + ascii(vin);
  const can = `014\r0:${h.slice(0, 12)}\r1:${h.slice(12, 26)}\r2:${h.slice(26, 40)}`;
  assert.equal(OBD.parseVin(can), vin);
  const v = '000000' + ascii(vin), kl = [0, 1, 2, 3, 4].map(i => `49 02 0${i + 1} ${v.slice(i * 8, i * 8 + 8)}`).join('\r');
  assert.equal(OBD.parseVin(kl), vin);
  assert.equal(OBD.parseVin('NO DATA'), null);
});

test('CALID, CVN ve ECU adı', () => {
  const cal = '490401' + ascii('8200999999DEMO'.padEnd(16, '\0'));
  assert.equal(OBD.parseCalid(`013\r0:${cal.slice(0, 12)}\r1:${cal.slice(12, 26)}\r2:${cal.slice(26, 40).padEnd(14, '0')}`), '8200999999DEMO');
  assert.equal(OBD.parseCvn('49 06 01 A1 B2 C3 D4'), 'A1B2C3D4');
  const nm = '490A01' + ascii('ECM-EngineControl'.padEnd(20, '\0'));
  const fr = `017\r0:${nm.slice(0, 12)}` + [12, 26, 40].map((i, k) => `\r${k + 1}:${nm.slice(i, i + 14).padEnd(14, '0')}`).join('');
  assert.equal(OBD.parseEcuName(fr), 'ECM-EngineControl');
});

test('çok çerçeve: dolgu baytları bayt sayısına göre kesilir', () => {
  assert.equal(OBD.frames('009\r0:4601010B01C2\r1:019001F4AAAAAA', '46'), '4601010B01C2019001');
});

test('yanıt veren ECU kimlikleri', () => {
  assert.deepEqual(OBD.ecuIds('7E8 06 41 00 BE 3E B8 13\r7E9 06 41 00 98 18 00 01'), ['Motor (7E8)', 'Şanzıman (7E9)']);
  assert.deepEqual(OBD.ecuIds('18 DA F1 10 06 41 00 BE 3E B8 13'), ['Motor (10)']);
  assert.deepEqual(OBD.ecuIds('48 6B 10 41 00 BE 3E B8 13 C4'), ['Motor (10)']);
  assert.deepEqual(OBD.ecuIds('NO DATA'), []);
});

test('Mode 06: kayıt, birim ve limit kontrolü', () => {
  const rows = OBD.parseM6('46 01 01 0B 01C2 0190 01F4 01 05 10 003E 0000 0078'.replace(/ /g, ''), '01');
  assert.equal(rows.length, 2);
  near(rows[0].val.v, 0.45); near(rows[0].mn.v, 0.4); near(rows[0].mx.v, 0.5);
  assert.equal(rows[0].val.u, 'V'); assert.ok(rows[0].ok);
  assert.equal(rows[1].val.v, 62); assert.equal(rows[1].val.u, 'ms');
  const fail = OBD.parseM6('4621218001006E00000064', '21');
  assert.equal(fail[0].ok, false);
  near(OBD.uas(0x8B, 0xFFFF).v, -0.001);
  near(OBD.uas(0x16, 1400).v, 100);
  assert.equal(OBD.uas(0x7E, 5).u, 'ham (7E)');
});

test('voltaj ve kod açıklamaları', () => {
  assert.equal(OBD.parseVolt('12.6V'), 12.6);
  assert.equal(OBD.parseVolt('14,1V'), 14.1);
  assert.equal(OBD.parseVolt('?'), null);
  assert.equal(OBD.describe('P0301'), 'Silindir 1 tekleme');
  assert.equal(OBD.describe('P0399'), 'Ateşleme sistemi veya tekleme arızası');
  assert.equal(OBD.describe('B1001'), 'Gövde arızası');
  assert.ok(OBD.isOem('P1234') && !OBD.isOem('P0420'));
});
