"""
Checks the engine against files shaped like real ERP exports.
Run from server/:  .venv/Scripts/python -m unittest -v
"""
import io
import json
import math
import random
import time
import unittest
from datetime import datetime

from tarazban import demo, learning, mapping, pipeline
from tarazban.store import connect
from tarazban.text import day_number, norm_text, parse_amount, read_csv, weekday

PO_HEAD = 'po_id,supplier_id,supplier_name,item_code,unit,warehouse_code,quantity,unit_price,line_amount,po_date,approved_by,approval_limit_rials'
INV_HEAD = 'invoice_id,invoice_number,po_id,supplier_id,supplier_name,invoice_date,total_amount,warehouse_code'


def pad(n: int) -> str:
    return f'{n:02d}'


def from_mehr(days: int) -> str:
    """A Jalali date `days` after 1404/07/01 (Mehr); months 7 to 11 have 30 days."""
    return f'1404/{pad(7 + days // 30)}/{pad(1 + days % 30)}'


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
        self.send('big.csv', rows)
        seconds = time.perf_counter() - t
        self.assertEqual(self.alerts('P0_DUPLICATE_INVOICE'), [])
        # the model names at most 1 in 1,000 invoices, the rarest of this file
        self.assertLessEqual(len(self.alerts('P0_UNUSUAL_PATTERN')), 20)
        self.assertEqual(len(self.alerts()), len(self.alerts('P0_UNUSUAL_PATTERN')))
        self.assertLess(seconds, 10, f'took {seconds:.1f} s')

    def test_alert_ids_are_unique_and_bad_cells_are_counted(self):
        self.send('mixed.csv', [INV_HEAD, 'A,1,,S,s,1404/01/01,۱۰۰,W', 'B,2,,S,s,نامعلوم,abc,W', 'C,3,,S,s,1404/01/02,200,W'])
        ids = [a['alert_id'] for a in self.alerts()]
        self.assertEqual(len(set(ids)), len(ids))
        q = pipeline.state(self.conn)['quality_reports'][0]
        self.assertEqual(q['columns']['total_amount']['invalid_count'], 1)
        self.assertEqual(q['columns']['invoice_date']['invalid_count'], 1)
        self.assertLess(q['required_coverage_pct'], 100)

    # ── each supplier's learned normal ──

    def test_a_fee_billed_every_week_is_routine_but_the_same_week_twice_is_not(self):
        # 9 invoices a week to all its customers: numbers 4536 and 4563, or 4545 and 4554, are weeks apart
        rows = [INV_HEAD] + [
            f'INV-{w},{4500 + 9 * w},PO-{w},SUP-R,خدمات نظافت,{from_mehr(7 * w)},12000000,W' for w in range(20)
        ]
        self.send('weekly.csv', rows)
        self.assertEqual(self.alerts('P0_DUPLICATE_INVOICE'), [])

        # the last week's invoice, 4671, entered again a day later as 4761
        self.send('re-entry.csv', [INV_HEAD, f'INV-X,4761,PO-19,SUP-R,خدمات نظافت,{from_mehr(7 * 19 + 1)},12000000,W'])
        (dup,) = self.alerts('P0_DUPLICATE_INVOICE')
        self.assertEqual(dup['evidence']['invoice_numbers'], ['4671', '4761'])
        self.assertEqual((dup['evidence']['routine_invoices'], dup['evidence']['routine_gap_days']), (21, 7))
        self.assertIn('معمولاً با فاصلهٔ ۷ روز', dup['why_flagged_fa'][-1])

    def test_an_invoice_far_above_the_suppliers_own_normal_is_flagged(self):
        history = [INV_HEAD]
        steady = [44, 46, 48, 50, 52, 54, 56]
        wide = [5, 8, 12, 15, 20, 30, 40, 45, 60, 80, 90, 100, 120, 150, 180, 200, 220, 250, 280, 300]
        for i in range(20):
            day = from_mehr(i * 6)
            history.append(f'A-{i},A{i},PO-A{i},SUP-A,شرکت ثابت,{day},{steady[i % 7] * 1_000_000},W')
            history.append(f'B-{i},B{i},PO-B{i},SUP-B,شرکت پرنوسان,{day},{wide[i * 7 % 20] * 1_000_000},W')
            if i < 5:
                history.append(f'C-{i},C{i},PO-C{i},SUP-C,شرکت تازه,{day},10000000,W')
        for m in range(24):  # 3% a month for two years
            history.append(f'D-{m},D{m},PO-D{m},SUP-D,شرکت تورمی,{1403 + m // 12}/{pad(1 + m % 12)}/10,{round(100_000_000 * 1.03 ** m)},W')
        self.send('history.csv', history)
        self.assertEqual(self.alerts('P0_AMOUNT_OUTLIER'), [])

        self.send('bahman.csv', [
            INV_HEAD,
            f'A-X,A99,PO-A99,SUP-A,شرکت ثابت,{from_mehr(125)},400000000,W',
            f'B-X,B99,PO-B99,SUP-B,شرکت پرنوسان,{from_mehr(125)},350000000,W',
            f'C-X,C99,PO-C99,SUP-C,شرکت تازه,{from_mehr(125)},500000000,W',
        ])
        (out,) = self.alerts('P0_AMOUNT_OUTLIER')
        self.assertEqual(out['supplier_id'], 'SUP-A')
        self.assertEqual(out['evidence']['previous_invoices'], 20)
        self.assertEqual(out['evidence']['usual_median_rials'], 50_000_000)
        self.assertEqual(out['evidence']['times_usual'], 8)
        self.assertEqual(out['p2p_chain'][0]['source_file'], 'bahman.csv')
        self.assertIn('۸ برابر', out['summary_fa'])

    def test_cash_customer_and_no_name_are_not_parties_with_a_normal(self):
        rows = [INV_HEAD]
        for i in range(30):  # many unrelated buyers under one name, small and large
            rows.append(f'N-{i},{1000 + i},,10000,مشتري نقدي,{from_mehr(i)},{(5 + (i * 7) % 11) * 1_000_000},W')
            rows.append(f'D-{i},{2000 + i},,,-,{from_mehr(i)},{(5 + (i * 3) % 13) * 1_000_000},W')
        rows += [
            f'N-X,1100,,10000,مشتري نقدي,{from_mehr(31)},900000000,W',  # 100 times the others: one big buyer
            f'D-X,2100,,,-,{from_mehr(31)},700000000,W',
            f'N-Y,1013,,10000,مشتري نقدي,{from_mehr(13)},12000000,W',  # 1031 / 1013 swapped, same amount: two buyers
            f'N-Z,1031,,10000,مشتري نقدي,{from_mehr(14)},12000000,W',
        ]
        self.send('sales.csv', rows)
        self.assertEqual(self.alerts('P0_AMOUNT_OUTLIER'), [])
        self.assertEqual(self.alerts('P0_DUPLICATE_INVOICE'), [])

    def test_a_cancelled_or_returned_invoice_with_a_positive_amount_is_left_out(self):
        rows = ['شماره,شماره فاکتور,تاریخ,کد تأمین کننده,عنوان تأمین کننده,جمع خالص,وضعیت,موضوع صورتحساب']
        for i in range(20):
            rows.append(f'{i},F-{i},{from_mehr(i * 5)},S1,شرکت الف,{50_000_000 + i * 1_000_000},ثبت,اصلی')
        rows += [
            f'30,F-30,{from_mehr(101)},S1,شرکت الف,900000000,ابطال شده,اصلی',  # Sepidar: the cancelled one itself
            f'31,F-31,{from_mehr(102)},S1,شرکت الف,800000000,باطل شده,اصلی',  # the tax system's status
            f'32,F-32,{from_mehr(103)},S1,شرکت الف,850000000,تایید شده,برگشت از فروش',  # a return, positive
            f'33,F-3,{from_mehr(104)},S1,شرکت الف,53000000,تایید شده,ابطالی',  # cancels F-3 under its number
        ]
        first = pipeline.receive(self.conn, 'خرید.csv', '\n'.join(rows).encode())
        mapping = first['suggestions']['invoice']
        self.assertEqual((mapping['status'], mapping['doc_type']), ('وضعیت', 'موضوع صورتحساب'))
        pipeline.ingest(self.conn, first['upload_id'], 'invoice', mapping, True)
        self.assertEqual(self.alerts(), [])

    def test_a_swap_in_a_number_the_software_gave_is_not_a_typo(self):
        rows = [INV_HEAD]
        for n in range(1, 61):  # Sepidar's running numbers on sales, shared by six customers
            pair = n in (23, 32)  # one customer, the same price, numbers two digits apart
            amount, c = (57_340_000, 9) if pair else (40_000_000 + n * 1_000_000, n % 6)
            rows.append(f'{n},{n},,C{c},مشتری {c},{from_mehr(n // 2)},{amount},W')
        tax = ['K7QX2M9R4L00000000F903', 'K7QX2M9R4L00000000F930']  # tax IDs, two digits apart
        rows += [f'T{i},{t},,C1,مشتری 1,{from_mehr(40 + i)},33000000,W' for i, t in enumerate(tax)]
        self.send('sales.csv', rows)
        self.assertEqual(self.alerts('P0_DUPLICATE_INVOICE'), [])

        self.send('purchases.csv', [  # a supplier's own number typed twice with a slip is still caught
            INV_HEAD,
            f'P1,48213,,S9,شرکت ج,{from_mehr(50)},71000000,W',
            f'P2,48231,,S9,شرکت ج,{from_mehr(53)},71000000,W',
        ])
        (dup,) = self.alerts('P0_DUPLICATE_INVOICE')
        self.assertEqual(dup['supplier_id'], 'S9')

    def test_a_fixed_fee_does_not_make_the_suppliers_other_invoices_look_unusual(self):
        rows = [INV_HEAD]
        for w in range(20):  # a weekly 12M fee, and between fees ordinary invoices of 50 to 70M
            rows.append(f'FEE-{w},{5000 + w},PO-F{w},SUP-F,پشتیبانی شبکه,{from_mehr(w * 7)},12000000,W')
            if w < 15:
                rows.append(f'VAR-{w},{6000 + w},PO-V{w},SUP-F,پشتیبانی شبکه,{from_mehr(w * 7 + 3)},{(50 + w % 5 * 5) * 1_000_000},W')
        self.send('support.csv', rows)
        self.assertEqual(self.alerts('P0_AMOUNT_OUTLIER'), [])
        self.send('azar.csv', [INV_HEAD, f'BIG,7000,PO-B,SUP-F,پشتیبانی شبکه,{from_mehr(141)},600000000,W'])
        (out,) = self.alerts('P0_AMOUNT_OUTLIER')
        self.assertEqual(out['evidence']['usual_median_rials'], 60_000_000)

    def test_a_new_suppliers_big_round_first_invoice_is_found_by_the_model(self):
        rng = random.Random(7)
        rows = [INV_HEAD]
        for s in range(40):
            base = rng.uniform(20, 200) * 1_000_000
            for i in range(60):
                day = rng.randrange(150)
                if weekday(day_number(from_mehr(day))) == 6:  # nobody bills on Friday
                    day = day - 1 if day else 1
                amount = round(base * math.exp(rng.gauss(0, 0.2)), -3)
                rows.append(f'S{s}-{i},{s}-{1000 + i},PO-{s}-{i},SUP-{s},شرکت {s},{from_mehr(day)},{int(amount)},W')
        self.send('mehr-to-bahman.csv', rows)
        self.assertLessEqual(len(self.alerts('P0_UNUSUAL_PATTERN')), 2)  # at most 1 in 1,000 invoices

        self.send('bahman.csv', [INV_HEAD, f'NEW-1,1,PO-N1,SUP-NEW,بازرگانی نوپا,{from_mehr(140)},9000000000,W'])
        found = [a for a in self.alerts('P0_UNUSUAL_PATTERN') if a['supplier_id'] == 'SUP-NEW']
        self.assertEqual(len(found), 1)
        reasons = [r['feature'] for r in found[0]['evidence']['reasons']]
        self.assertIn('supplier_age', reasons)
        self.assertIn('تأمین‌کنندهٔ تازه', found[0]['summary_fa'])
        self.assertEqual(found[0]['confidence_score'], 50)
        self.assertEqual(found[0]['p2p_chain'][0]['source_file'], 'bahman.csv')

    # ── learning from decisions ──

    def test_alerts_the_auditor_rejected_for_a_supplier_sink_for_that_supplier(self):
        rows = [INV_HEAD]
        for i in range(20):
            for s in ('S', 'T'):
                rows.append(f'{s}-{i},{s}{i},PO-{s}{i},SUP-{s},شرکت {s},{from_mehr(i * 5)},{[46, 50, 54][i % 3] * 1_000_000},W')
        for k, amount in enumerate((400, 410, 420)):  # three large invoices from S, one from T
            rows.append(f'S-X{k},SX{k},PO-SX{k},SUP-S,شرکت S,{from_mehr(101 + k * 3)},{amount * 1_000_000},W')
        rows.append(f'T-X,TX,PO-TX,SUP-T,شرکت T,{from_mehr(101)},400000000,W')
        self.send('year.csv', rows)
        outliers = self.alerts('P0_AMOUNT_OUTLIER')
        self.assertEqual(len(outliers), 4)
        self.assertTrue(all(a['confidence_basis_fa'].startswith('از قدرت نشانه') for a in outliers))

        s_alerts = sorted((a for a in outliers if a['supplier_id'] == 'SUP-S'), key=lambda a: a['evidence']['invoice_number'])
        for a in s_alerts[:2]:
            pipeline.decide(self.conn, a['alert_id'], 'FALSE_POSITIVE', 'حسابرس ارشد - م. رضایی', 'قرارداد سالانه است')
        after = {a['alert_id']: a for a in self.alerts('P0_AMOUNT_OUTLIER')}
        third, other = after[s_alerts[2]['alert_id']], next(a for a in after.values() if a['supplier_id'] == 'SUP-T')
        self.assertLess(third['confidence_score'], other['confidence_score'])
        order = [a['alert_id'] for a in self.alerts()]
        self.assertLess(order.index(other['alert_id']), order.index(third['alert_id']))
        why = ' '.join(third['why_flagged_fa'])
        self.assertIn('از ۲ هشدار «مبلغ غیرعادی برای این تأمین‌کننده» که حسابرس‌ها بررسی کرده‌اند، هیچ‌کدام تأیید نشد.', why)
        self.assertIn('برای همین تأمین‌کننده، هر ۲ هشدار این نوع نادرست دانسته شده است.', why)
        self.assertEqual(third['confidence_basis_fa'], 'از ۲ تصمیم قبلی')

    def test_with_enough_decisions_a_model_learns_which_alerts_get_confirmed(self):
        rng = random.Random(3)
        rows = []
        for _ in range(40):  # the auditors confirm the large multiples and reject the small ones
            times = rng.uniform(3, 12)
            rows.append(({'times_usual': times, 'robust_z': rng.uniform(4.5, 9)}, int(times > 7)))
        model = learning._fit(rows)
        high, factors = model.probability({'times_usual': 11, 'robust_z': 6})
        low, _ = model.probability({'times_usual': 3.5, 'robust_z': 6})
        self.assertGreater(high, 0.8)
        self.assertLess(low, 0.2)
        self.assertEqual(factors[0], {'feature': 'times_usual', 'higher': True, 'raises': True})

    # ── the public demo ──

    def test_the_demo_ships_real_engine_alerts_of_each_kind(self):
        out = demo.build()
        rules = {a['rule_id'] for a in out['alerts']}
        self.assertTrue({'P0_DUPLICATE_INVOICE', 'P0_AMOUNT_OUTLIER', 'P0_UNUSUAL_PATTERN'} <= rules)
        self.assertTrue(all(a['source_fa'] == 'ساختهٔ موتور' for a in out['alerts']))
        learned = [a for a in out['alerts'] if a['status'] == 'NEW' and a['supplier_id'] == 'SUP-KIAN']
        self.assertEqual(len(learned), 1)
        self.assertIn('برای همین تأمین‌کننده، هر ۲ هشدار این نوع نادرست دانسته شده است.', learned[0]['why_flagged_fa'])
        self.assertEqual(len(out['audit_logs']), 2)

    # ── Excel and report-shaped exports ──

    @staticmethod
    def workbook(sheets: dict) -> bytes:
        from openpyxl import Workbook
        book = Workbook()
        book.remove(book.active)
        for title, rows in sheets.items():
            sheet = book.create_sheet(title)
            for r in rows:
                sheet.append(r)
        out = io.BytesIO()
        book.save(out)
        return out.getvalue()

    def test_an_excel_report_is_read_from_under_its_title_to_above_its_sum(self):
        head = ['ردیف', 'شماره فاکتور', 'تاریخ', 'کد طرف حساب', 'نام طرف حساب', 'شماره سفارش', 'مبلغ کل']
        data = self.workbook({
            'راهنما': [['این فایل خروجی نرم‌افزار حسابداری است'], ['نسخهٔ ۳']],
            'فاکتورها': [
                ['گزارش فاکتورهای خرید'],  # row 1
                ['از تاریخ', '1404/07/01', 'تا تاریخ', '1404/09/30'],  # 2
                [],  # 3
                head,  # 4
                ['گروه: تأمین‌کنندگان داخلی'],  # 5
                [1, 5001, '1404/07/05', 'S1', 'شرکت الف', 'PO-1', 155000000],  # 6
                [2, 'F-5002', datetime(2025, 10, 1), 'S1', 'شرکت الف', 'PO-2', '98,500,000/00'],  # 7, a real Excel date
                head,  # 8, the column names again on the next printed page
                [3, 5003, '1404/08/12', 'S2', 'شرکت ب', 'PO-3', 42000000.0],  # 9
                ['جمع کل', None, None, None, None, None, 295500000],  # 10
                ['تهیه‌کننده: واحد مالی'],  # 11
            ],
        })
        first = pipeline.receive(self.conn, 'خرید-پاییز.xlsx', data)
        self.assertEqual(first['status'], 'needs_mapping')
        self.assertEqual(first['file_name'], 'خرید-پاییز.xlsx، برگهٔ «فاکتورها»')
        self.assertEqual(first['headers'], head)
        done = pipeline.ingest(self.conn, first['upload_id'], 'invoice', first['suggestions']['invoice'], True)
        self.assertEqual(done['rows'], 3)
        recs = pipeline.load_records(self.conn, 'invoice')
        self.assertEqual([r['_row'] for r in recs], [6, 7, 9])  # the rows a person sees in Excel
        self.assertEqual(recs[0]['_file'], 'خرید-پاییز.xlsx، برگهٔ «فاکتورها»')
        self.assertEqual([r['invoice_number'] for r in recs], ['5001', 'F-5002', '5003'])
        self.assertEqual([parse_amount(r['total_amount']) for r in recs], [155000000, 98500000, 42000000])
        self.assertEqual(day_number(recs[1]['invoice_date']), day_number('1404/07/09'))  # 2025-10-01

    def test_a_csv_report_with_a_title_and_a_sum_row_is_read_the_same_way(self):
        self.send('report.csv', ['گزارش خرید پاییز', INV_HEAD, 'A,F-1,PO-1,S1,s,1404/07/01,100,W', 'جمع کل,,,,,,100,'])
        recs = pipeline.load_records(self.conn, 'invoice')
        self.assertEqual([(r['_row'], r['invoice_number']) for r in recs], [(3, 'F-1')])

    def test_old_excel_and_web_pages_saved_as_excel_get_a_clear_message(self):
        with self.assertRaises(pipeline.BadFile) as old:
            pipeline.receive(self.conn, 'old.xls', bytes.fromhex('d0cf11e0a1b11ae1') + bytes(100))
        self.assertIn('.xls', str(old.exception))
        with self.assertRaises(pipeline.BadFile) as web:
            pipeline.receive(self.conn, 'report.xls', '<html><body><table><tr><td>1</td></tr></table></body></html>'.encode())
        self.assertIn('صفحهٔ وب', str(web.exception))

    def test_sepidars_xls_is_excel_2003_xml_and_is_read(self):
        def row(*cells):
            out = []
            for c in cells:
                if isinstance(c, tuple):  # (column index, value): the cells before it are empty
                    out.append(f'<Cell ss:Index="{c[0]}"><Data ss:Type="String">{c[1]}</Data></Cell>')
                elif isinstance(c, float):
                    out.append(f'<Cell><Data ss:Type="Number">{c:.4f}</Data></Cell>')
                else:
                    out.append(f'<Cell><Data ss:Type="String">{c}</Data></Cell>')
            return '<Row>' + ''.join(out) + '</Row>'
        sheet = ''.join([
            row('شماره', 'شماره فاكتور', 'تاريخ', 'كد تأمين كننده', 'عنوان تأمين كننده', 'جمع خالص به ارز پايه'),
            row('1', '5108', '1403/04/11', '20017', 'شركت الف', 41570000003.0),
            row('2', (3, '1403/05/02'), '20031', 'شركت ب', 18946000004.0),  # no supplier number in column 2
        ])
        xml = ('﻿<?xml version="1.0" encoding="utf-8"?>'
               '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
               'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
               f'<Worksheet ss:Name="Sheet"><Table>{sheet}</Table></Worksheet></Workbook>')
        first = pipeline.receive(self.conn, 'فاكتور خريد.xls', xml.encode('utf-8'))
        self.assertEqual(first['headers'][5], 'جمع خالص به ارز پايه')
        done = pipeline.ingest(self.conn, first['upload_id'], 'invoice', {
            'invoice_id': 'شماره', 'invoice_number': 'شماره فاكتور', 'invoice_date': 'تاريخ',
            'supplier_id': 'كد تأمين كننده', 'total_amount': 'جمع خالص به ارز پايه'}, True)
        self.assertEqual(done['rows'], 2)
        recs = pipeline.load_records(self.conn, 'invoice')
        self.assertEqual([(r['invoice_number'], r['invoice_date'], r['total_amount']) for r in recs],
                         [('5108', '1403/04/11', '41570000003'), ('', '1403/05/02', '18946000004')])

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

    def test_sepidar_and_tax_system_columns_are_recognised(self):
        sepidar = mapping.suggest(['جمع كل به ارز پايه', 'جمع خالص به ارز پايه', 'شماره', 'شماره فاكتور', 'تاريخ',
                                   'كد تأمين كننده', 'عنوان تأمين كننده', 'جمع خالص'])['mappings']['invoice']
        self.assertEqual(sepidar, {  # «جمع کل» is before tax in Sepidar; the total with tax is «جمع خالص»
            'invoice_number': 'شماره فاكتور', 'total_amount': 'جمع خالص به ارز پايه', 'invoice_date': 'تاريخ',
            'supplier_id': 'كد تأمين كننده', 'supplier_name': 'عنوان تأمين كننده', 'invoice_id': 'شماره'})
        sales = mapping.suggest(['✓', 'شماره', 'تاريخ', 'كد مشتري', 'مشتري', 'كل', 'ماليات', 'خالص', 'وضعيت'])
        self.assertTrue(sales['complete'])
        self.assertEqual(sales['mappings']['invoice']['total_amount'], 'خالص')
        tax = mapping.suggest(['شماره مالیاتی صورت‌حساب', 'مجموع صورت‌حساب', 'تاریخ صدور صورت‌حساب',
                               'شناسه هویتی فروشنده/ عرضه کننده واسط کالا و خدمت/ حق‌العملکار',
                               'نام فروشنده/ عرضه کننده واسط کالا و خدمت/ حق‌العملکار', 'شماره مالیاتی صورت‌حساب مرجع'])
        self.assertEqual(tax['mappings']['invoice']['invoice_number'], 'شماره مالیاتی صورت‌حساب')
        self.assertEqual(len(tax['mappings']['invoice']), 5)

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
