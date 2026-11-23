"""
Checks the engine against files shaped like real ERP exports.
Run from server/:  .venv/Scripts/python -m unittest -v
"""
import json
import time
import unittest

from tarazban import pipeline
from tarazban.store import connect
from tarazban.text import norm_text, parse_amount, read_csv

PO_HEAD = 'po_id,supplier_id,supplier_name,item_code,unit,warehouse_code,quantity,unit_price,line_amount,po_date,approved_by,approval_limit_rials'
INV_HEAD = 'invoice_id,invoice_number,po_id,supplier_id,supplier_name,invoice_date,total_amount,warehouse_code'


def pad(n: int) -> str:
    return f'{n:02d}'


class Engine(unittest.TestCase):
    def setUp(self):
        self.conn = connect(':memory:')

    def tearDown(self):
        self.conn.close()

    def send(self, name: str, text: str | list[str], encoding='utf-8'):
        if isinstance(text, list):
            text = '\n'.join(text)
        return pipeline.receive(self.conn, name, text.encode(encoding))

    def alerts(self, rule: str | None = None):
        return [a for a in pipeline.state(self.conn)['alerts'] if rule is None or a['rule_id'] == rule]

    # ── reading ──

    def test_amounts_as_iranian_files_write_them(self):
        self.assertEqual(parse_amount('385,000,000'), 385_000_000)
        self.assertEqual(parse_amount('۲۷۵٬۰۰۰٬۰۰۰'), 275_000_000)
        self.assertEqual(parse_amount('155000000/00'), 155_000_000)
        self.assertEqual(parse_amount('1250/5'), 1250.5)
        self.assertEqual(parse_amount('(1,000)'), -1000)
        self.assertIsNone(parse_amount('ندارد'))
        self.assertIsNone(parse_amount(''))

    def test_quoted_fields_keep_their_commas_and_rows_keep_their_line(self):
        rows = read_csv('a,b,c\r\n1,"x, y","3,000"\n\n2,"two\nlines",5\n3,z,6\n')
        self.assertEqual(rows[1], (2, ['1', 'x, y', '3,000']))
        self.assertEqual([line for line, _ in rows], [1, 2, 4, 6])

    def test_windows_1256_export_is_read(self):
        # Windows-1256 has no Persian ی, so such files carry the Arabic ي
        self.send('old-excel.csv', [INV_HEAD, 'A,F-1,PO-1,S1,شرکت ايران,1404/01/01,100,W'], encoding='cp1256')
        rec = pipeline.load_records(self.conn)[0]
        self.assertEqual(norm_text(rec['supplier_name']), 'شرکت ایران')

    # ── the four checks ──

    def test_a_normal_year_of_orders_raises_no_split_or_price_alert(self):
        rows, k = [PO_HEAD], 0
        for s in range(40):
            for w in range(48):
                k += 1
                qty = 10 + (s * 7 + w) % 20
                price = 2_000_000 + ((s * 13 + w * 17) % 500) * 1000
                rows.append(f'PO-{k},SUP-{s},تامین {s},ITM-{500 + s},عدد,WH-1,{qty},{price},{qty * price},'
                            f'1404/{pad(1 + w // 4)}/{pad(1 + (w % 4) * 7)},USR-{s % 8},150000000')
        self.send('normal.csv', rows)
        self.assertEqual(self.alerts('P0_SPLIT_PO'), [])
        self.assertEqual(self.alerts('P0_PRICE_DEVIATION'), [])

    def test_orders_split_under_the_limit_within_days_are_caught(self):
        self.send('split.csv', [
            PO_HEAD,
            'PO-A,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14200000,142000000,1404/11/12,USR-1,150000000',
            'PO-B,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14500000,145000000,1404/11/13,USR-1,150000000',
            'PO-C,SUP-9,تامین ۹,ITM-900,کیسه,WH-1,10,14500000,145000000,1404/12/20,USR-1,150000000',
        ])
        split = self.alerts('P0_SPLIT_PO')
        self.assertEqual(len(split), 1)
        self.assertEqual(split[0]['evidence']['po_ids'], ['PO-A', 'PO-B'])

    def test_a_price_jump_is_measured_against_the_items_own_history(self):
        rows = [PO_HEAD]
        for i, p in enumerate([2_000_000, 2_050_000, 2_100_000, 2_150_000, 2_200_000, 4_100_000]):
            rows.append(f'PO-{i},SUP-7,تامین ۷,ITM-777,عدد,WH-1,10,{p},{p * 10},1404/0{i + 1}/10,USR-{i},900000000')
        for m in range(1, 13):  # steady 3% monthly inflation on another item must stay quiet
            p = round(1_000_000 * 1.03 ** m)
            rows.append(f'PO-X{m},SUP-8,تامین ۸,ITM-888,عدد,WH-1,5,{p},{p * 5},1404/{pad(m)}/15,USR-9,900000000')
        self.send('price.csv', rows)
        price = self.alerts('P0_PRICE_DEVIATION')
        self.assertEqual(len(price), 1)
        self.assertEqual(price[0]['primary_entity_id'], 'PO-5')

    def test_invoices_in_erp_export_shape(self):
        self.send('erp.csv', [
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
        ])
        dup = self.alerts('P0_DUPLICATE_INVOICE')
        self.assertEqual(sorted(a['evidence']['match'] for a in dup), ['same', 'same', 'suffix', 'swap'])
        self.assertEqual(sorted(a['financial_exposure'] for a in self.alerts('P0_3WAY_MATCH')), [155_000_000, 275_000_000])
        suffix = next(a for a in dup if a['evidence']['match'] == 'suffix')
        self.assertEqual(suffix['supplier_name'], 'شرکت الف, سهامی خاص')
        self.assertEqual([s['source_row_id'] for s in suffix['p2p_chain']], [2, 3])

    def test_20000_invoices_fast_and_different_numbers_with_the_same_amount_are_not_duplicates(self):
        rows = [INV_HEAD] + [
            f'INV-{i},F-{100000 + i},PO-{i},SUP-{i % 300},تامین,1404/{pad(1 + i // 1700)}/{pad(1 + i % 29)},{(1 + i % 400) * 1_000_000},WH-1'
            for i in range(20000)
        ]
        t = time.perf_counter()
        result = self.send('big.csv', rows)
        seconds = time.perf_counter() - t
        self.assertEqual(result['alerts_added'], 0)
        self.assertLess(seconds, 10, f'took {seconds:.1f} s')

    def test_alert_ids_are_unique_and_bad_cells_are_counted(self):
        self.send('mixed.csv', [INV_HEAD, 'A,1,,S,s,1404/01/01,۱۰۰,W', 'B,2,,S,s,نامعلوم,abc,W', 'C,3,,S,s,1404/01/02,200,W'])
        ids = [a['alert_id'] for a in self.alerts()]
        self.assertEqual(len(set(ids)), len(ids))
        q = pipeline.state(self.conn)['quality_reports'][0]
        self.assertEqual(q['columns']['total_amount']['invalid_count'], 1)
        self.assertEqual(q['columns']['invoice_date']['invalid_count'], 1)
        self.assertLess(q['required_coverage_pct'], 100)

    # ── mapping ──

    def test_an_unknown_export_is_mapped_once_then_recognised(self):
        head = 'شماره سند,شمارهٔ فاکتور,كد طرف حساب,نام طرف حساب,تاریخ,مبلغ کل,شماره سفارش'
        first = self.send('sepidar-1.csv', [head, '۱۰,F-77,S1,شرکت الف,1404/03/01,"50,000,000",'])
        self.assertEqual(first['status'], 'needs_mapping')
        self.assertEqual(first['kind'], 'invoice')
        suggested = first['suggestions']['invoice']
        self.assertEqual(suggested['invoice_number'], 'شمارهٔ فاکتور')
        self.assertEqual(suggested['supplier_id'], 'كد طرف حساب')
        self.assertEqual(suggested['total_amount'], 'مبلغ کل')
        self.assertEqual(suggested['invoice_id'], 'شماره سند')

        done = pipeline.ingest(self.conn, first['upload_id'], 'invoice', suggested, True)
        self.assertEqual(done['alerts_added'], 1)  # no purchase order

        second = self.send('sepidar-2.csv', [head, '۱۱,F-77-B,S1,شرکت الف,1404/03/04,"50,000,000",PO-3'])
        self.assertEqual(second['status'], 'done')
        self.assertEqual(len(self.alerts('P0_DUPLICATE_INVOICE')), 1)

    def test_a_mapping_without_a_needed_field_is_refused(self):
        first = self.send('odd.csv', ['ستون یک,ستون دو', 'a,1'])
        self.assertEqual(first['status'], 'needs_mapping')
        with self.assertRaises(pipeline.BadFile):
            pipeline.ingest(self.conn, first['upload_id'], 'invoice', {'invoice_number': 'ستون یک'}, True)

    # ── history across files ──

    def test_the_same_export_twice_adds_nothing_but_identical_rows_in_one_file_stay_two(self):
        rows = [INV_HEAD, 'A,F-1,PO-1,S,s,1404/01/01,100,W', 'A,F-1,PO-1,S,s,1404/01/01,100,W']
        first = self.send('jan.csv', rows)
        self.assertEqual(first['new_rows'], 2)
        self.assertEqual(first['alerts_added'], 1)
        again = self.send('jan-again.csv', rows)
        self.assertEqual((again['new_rows'], again['alerts_added']), (0, 0))
        self.assertEqual(len(self.alerts()), 1)

    def test_a_re_entry_next_month_is_caught_against_last_month(self):
        self.send('farvardin.csv', [INV_HEAD, 'INV-1,F-500,PO-1,S1,شرکت الف,1404/01/28,90000000,W'])
        self.send('ordibehesht.csv', [INV_HEAD, 'INV-2,F-500-A,PO-1,S1,شرکت الف,1404/02/02,90000000,W'])
        dup = self.alerts('P0_DUPLICATE_INVOICE')
        self.assertEqual(len(dup), 1)
        self.assertEqual([s['source_file'] for s in dup[0]['p2p_chain']], ['farvardin.csv', 'ordibehesht.csv'])

    def test_a_split_that_grows_keeps_its_alert_and_decision(self):
        self.send('day1.csv', [
            PO_HEAD,
            'PO-A,SUP-9,تامین,ITM-1,عدد,W,1,140000000,140000000,1404/05/01,USR-1,150000000',
            'PO-B,SUP-9,تامین,ITM-1,عدد,W,1,140000000,140000000,1404/05/02,USR-1,150000000',
        ])
        (alert,) = self.alerts('P0_SPLIT_PO')
        pipeline.decide(self.conn, alert['alert_id'], 'IN_REVIEW', 'حسابرس ارشد - م. رضایی', 'در حال استعلام')
        self.send('day2.csv', [PO_HEAD, 'PO-C,SUP-9,تامین,ITM-1,عدد,W,1,140000000,140000000,1404/05/03,USR-1,150000000'])
        (grown,) = self.alerts('P0_SPLIT_PO')
        self.assertEqual(grown['alert_id'], alert['alert_id'])
        self.assertEqual(grown['evidence']['po_ids'], ['PO-A', 'PO-B', 'PO-C'])
        self.assertEqual(grown['status'], 'IN_REVIEW')

    # ── decision log ──

    def test_a_decision_keeps_the_alerts_features_and_detector_version(self):
        self.send('one.csv', [INV_HEAD, 'A,F-9,,S,s,1404/01/01,7000000,W'])
        (alert,) = self.alerts()
        log = pipeline.decide(self.conn, alert['alert_id'], 'FALSE_POSITIVE', 'کنترلر مالی - ن. فرهادی', 'سفارش تلفنی بود')
        self.assertEqual((log['actor_id'], log['actor_role_fa'], log['new_status']), ('ن. فرهادی', 'کنترلر مالی', 'FALSE_POSITIVE'))
        row = self.conn.execute('SELECT detector, version, features, note FROM decisions').fetchone()
        self.assertEqual(row['detector'], 'P0_3WAY_MATCH')
        self.assertEqual(row['version'], '1.2.0')
        self.assertEqual(json.loads(row['features']), {'amount': 7000000})
        self.assertEqual(pipeline.state(self.conn)['alerts'][0]['status'], 'FALSE_POSITIVE')


if __name__ == '__main__':
    unittest.main()
