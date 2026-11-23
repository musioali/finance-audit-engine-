/**
 * Checks the upload analyser against files shaped like real ERP exports.
 * Run: npm run check:engine
 */
import assert from 'node:assert/strict';
import { createEmptyEngineState } from '../src/engine/p2pEngine';
import { analyzeUploadedCsvContent, parseAmount, parseCsv } from '../src/engine/upload';

const run = (name: string, csv: string) => analyzeUploadedCsvContent(name, csv, createEmptyEngineState());
const byRule = (r: ReturnType<typeof run>, rule: string) => r.updatedState.alerts.filter((a) => a.rule_id === rule);
const PO_HEAD = 'po_id,supplier_id,supplier_name,item_code,unit,warehouse_code,quantity,unit_price,line_amount,po_date,approved_by,approval_limit_rials';
const INV_HEAD = 'invoice_id,invoice_number,po_id,supplier_id,supplier_name,invoice_date,total_amount,warehouse_code';
const pad = (n: number) => String(n).padStart(2, '0');
let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`ok  ${name}`);
};

check('amounts as Iranian files write them', () => {
  assert.equal(parseAmount('"385,000,000"'.replace(/"/g, '')), 385_000_000);
  assert.equal(parseAmount('۲۷۵٬۰۰۰٬۰۰۰'), 275_000_000);
  assert.equal(parseAmount('155000000/00'), 155_000_000);
  assert.equal(parseAmount('1250/5'), 1250.5);
  assert.equal(parseAmount('(1,000)'), -1000);
  assert.equal(parseAmount('ندارد'), null);
  assert.equal(parseAmount(''), null);
});

check('quoted fields keep their commas', () => {
  const t = parseCsv('a,b,c\r\n1,"x, y","3,000"\n');
  assert.deepEqual(t[1], ['1', 'x, y', '3,000']);
});

check('a normal year of orders raises no split alert', () => {
  const rows = [PO_HEAD];
  let k = 0;
  for (let s = 0; s < 40; s++)
    for (let w = 0; w < 48; w++) {
      const qty = 10 + ((s * 7 + w) % 20);
      const price = 2_000_000 + ((s * 13 + w * 17) % 500) * 1000;
      rows.push(`PO-${++k},SUP-${s},تامین ${s},ITM-${500 + s},عدد,WH-1,${qty},${price},${qty * price},1404/${pad(1 + Math.floor(w / 4))}/${pad(1 + (w % 4) * 7)},USR-${s % 8},150000000`);
    }
  const r = run('normal.csv', rows.join('\n'));
  assert.equal(byRule(r, 'P0_SPLIT_PO').length, 0);
  assert.equal(byRule(r, 'P0_PRICE_DEVIATION').length, 0);
});

check('orders split under the limit within days are caught', () => {
  const r = run('split.csv', [
    PO_HEAD,
    'PO-A,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14200000,142000000,1404/11/12,USR-1,150000000',
    'PO-B,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14500000,145000000,1404/11/13,USR-1,150000000',
    'PO-C,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14500000,145000000,1404/12/20,USR-1,150000000',
  ].join('\n'));
  const split = byRule(r, 'P0_SPLIT_PO');
  assert.equal(split.length, 1);
  assert.deepEqual(split[0].evidence.po_ids, ['PO-A', 'PO-B']);
});

check('a price jump is measured against the item’s own history', () => {
  const rows = [PO_HEAD];
  const prices = [2_000_000, 2_050_000, 2_100_000, 2_150_000, 2_200_000, 4_100_000];
  prices.forEach((p, i) => rows.push(`PO-${i},SUP-7,تامین ۷,ITM-777,عدد,WH-1,10,${p},${p * 10},1404/0${i + 1}/10,USR-${i},900000000`));
  // steady 3% monthly inflation on another item must stay quiet
  for (let m = 1; m <= 12; m++) {
    const p = Math.round(1_000_000 * 1.03 ** m);
    rows.push(`PO-X${m},SUP-8,تامین ۸,ITM-888,عدد,WH-1,5,${p},${p * 5},1404/${pad(m)}/15,USR-9,900000000`);
  }
  const price = byRule(run('price.csv', rows.join('\n')), 'P0_PRICE_DEVIATION');
  assert.equal(price.length, 1);
  assert.equal(price[0].primary_entity_id, 'PO-5');
});

check('invoices in ERP export shape', () => {
  const r = run('erp.csv', [
    INV_HEAD,
    'INV-1,F-100,PO-1,SUP-1,"شرکت الف, سهامی خاص",1404/02/01,"385,000,000",WH-1',
    'INV-2,F-100-A,PO-1,SUP-1,"شرکت الف, سهامی خاص",1404/02/03,"385,000,000",WH-1',
    'INV-3,۲۲۰۱,,SUP-2,شرکت ب,1404/02/05,۲۷۵۰۰۰۰۰۰,WH-1',
    'INV-4,3301,,SUP-3,شرکت ج,1404/02/06,155000000/00,WH-1',
    'INV-5,4401,PO-9,SUP-4,شرکت د,1404/02/07,120000000,WH-1',
    'INV-6,4401,PO-9,SUP-4,شرکت د,1404/02/09,120000500,WH-1',
    'INV-7,F-1404-01600,PO-7,SUP-5,شرکت ه,1404/02/10,216000000,WH-1',
    'INV-8,F۱۴۰۴۰۱۶۰۰,PO-7,SUP-5,شرکت ه,1404/02/11,216000000,WH-1',
    'INV-9,5512,PO-8,SUP-6,شرکت و,1404/02/12,90000000,WH-1',
    'INV-10,5521,PO-8,SUP-6,شرکت و,1404/02/13,90000000,WH-1',
  ].join('\n'));
  const dup = byRule(r, 'P0_DUPLICATE_INVOICE').map((a) => a.evidence.match).sort();
  assert.deepEqual(dup, ['same', 'same', 'suffix', 'swap']);
  const noPo = byRule(r, 'P0_3WAY_MATCH').map((a) => a.financial_exposure).sort();
  assert.deepEqual(noPo, [155_000_000, 275_000_000]);
  assert.equal(r.updatedState.alerts.find((a) => a.evidence.match === 'suffix')?.supplier_name, 'شرکت الف, سهامی خاص');
});

check('20,000 invoices: fast, and different numbers with the same amount are not duplicates', () => {
  const rows = [INV_HEAD];
  for (let i = 0; i < 20000; i++)
    rows.push(`INV-${i},F-${100000 + i},PO-${i},SUP-${i % 300},تامین,1404/${pad(1 + Math.floor(i / 1700))}/${pad(1 + (i % 29))},${(1 + (i % 400)) * 1_000_000},WH-1`);
  const t = performance.now();
  const r = run('big.csv', rows.join('\n'));
  const ms = performance.now() - t;
  assert.equal(r.addedAlertsCount, 0);
  assert.ok(ms < 3000, `took ${Math.round(ms)} ms`);
});

check('alert ids are unique and bad cells are counted', () => {
  const r = run('mixed.csv', [INV_HEAD, 'A,1,,S,s,1404/01/01,۱۰۰,W', 'B,2,,S,s,نامعلوم,abc,W', 'C,3,,S,s,1404/01/02,200,W'].join('\n'));
  const ids = r.updatedState.alerts.map((a) => a.alert_id);
  assert.equal(new Set(ids).size, ids.length);
  const q = r.updatedState.qualityReports[0];
  assert.equal(q.columns.total_amount.invalid_count, 1);
  assert.equal(q.columns.invoice_date.invalid_count, 1);
  assert.ok(q.required_coverage_pct < 100);
});

console.log(`\n${passed} checks passed`);
