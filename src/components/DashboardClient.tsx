'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';

type OrderRow = {
  code?: string;
  created_at: string;
  total_sell: number;
  total_cost: number;
  pay_method: string;
  pay_status: string;
  customers?: { name: string } | null;
  order_items: { name: string; unit: string; qty: number }[];
};

const PERIODS: [string, string][] = [
  ['today', 'วันนี้'],
  ['yesterday', 'เมื่อวาน'],
  ['7d', '7 วัน'],
  ['month', 'รายเดือน'],
  ['range', 'ช่วงวันที่'],
  ['all', 'ทั้งหมด'],
];

const PAY_SHORT: Record<string, string> = { CASH: 'สด', TRANSFER: 'โอน', CREDIT: 'เชื่อ' };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const arr: string[] = [];
  const d = new Date(a + 'T00:00:00');
  const end = new Date(b + 'T00:00:00');
  let g = 0;
  while (d <= end && g < 400) {
    arr.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
    g++;
  }
  return arr;
}
function shortDay(dISO: string) {
  const d = new Date(dISO + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function DashboardClient({
  name,
  lowStock,
  settings,
}: {
  name: string;
  lowStock: { name: string; unit: string; stock: number }[];
  settings: { shop_name?: string; shop_phone?: string };
}) {
  const supabase = createClient();
  const [mode, setMode] = useState('today');
  const [month, setMonth] = useState(iso(new Date()).slice(0, 7));
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date()));
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'code, created_at, total_sell, total_cost, pay_method, pay_status, customers(name), order_items(name, unit, qty)'
      )
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(2000);
    setOrders((data ?? []) as unknown as OrderRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- resolve ช่วงเวลา ----
  const t = iso(new Date());
  let rFrom = t;
  let rTo = t;
  let label = 'วันนี้';
  if (mode === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    rFrom = rTo = iso(d);
    label = 'เมื่อวาน';
  } else if (mode === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    rFrom = iso(d);
    rTo = t;
    label = '7 วันล่าสุด';
  } else if (mode === 'month') {
    rFrom = month + '-01';
    rTo = month + '-31';
    label = 'เดือน ' + month;
  } else if (mode === 'range') {
    rFrom = from <= to ? from : to;
    rTo = from <= to ? to : from;
    label = `${rFrom} – ${rTo}`;
  } else if (mode === 'all') {
    const ds = orders.map((o) => o.created_at.slice(0, 10)).sort();
    rFrom = ds[0] || t;
    rTo = t;
    label = 'ทั้งหมด';
  }

  const inR = orders.filter((o) => {
    const d = o.created_at.slice(0, 10);
    return d >= rFrom && d <= rTo;
  });
  const sales = inR.reduce((s, o) => s + Number(o.total_sell), 0);
  const cost = inR.reduce((s, o) => s + Number(o.total_cost), 0);
  const profit = sales - cost;
  const credit = inR
    .filter((o) => o.pay_status === 'UNPAID')
    .reduce((s, o) => s + Number(o.total_sell), 0);
  const payS = (m: string) =>
    inR.filter((o) => o.pay_method === m).reduce((s, o) => s + Number(o.total_sell), 0);

  const prodQty: Record<string, number> = {};
  inR.forEach((o) =>
    (o.order_items ?? []).forEach((i) => {
      const k = `${i.name} (${i.unit})`;
      prodQty[k] = (prodQty[k] || 0) + i.qty;
    })
  );
  const topP = Object.entries(prodQty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ---- กราฟ ----
  const days = daysBetween(rFrom, rTo);
  let bars: { k: string; v: number }[];
  if (days.length <= 31) {
    bars = days.map((d) => ({
      k: shortDay(d),
      v: inR
        .filter((o) => o.created_at.slice(0, 10) === d)
        .reduce((s, o) => s + Number(o.total_sell), 0),
    }));
  } else {
    const mo: Record<string, number> = {};
    inR.forEach((o) => {
      const m = o.created_at.slice(0, 7);
      mo[m] = (mo[m] || 0) + Number(o.total_sell);
    });
    bars = [...new Set(days.map((d) => d.slice(0, 7)))].map((m) => ({
      k: m.slice(2),
      v: mo[m] || 0,
    }));
  }
  const maxV = Math.max(1, ...bars.map((b) => b.v));

  function printReport() {
    const rows = inR
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(
        (o) =>
          `<tr><td>${o.code ?? '-'}</td><td>${o.created_at.slice(0, 10)}</td><td>${o.customers?.name ?? '-'}</td><td style="text-align:center">${PAY_SHORT[o.pay_method]}</td><td style="text-align:right">${Number(o.total_sell).toFixed(2)}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>รายงานยอดขาย</title>
      <style>*{font-family:Tahoma,sans-serif}body{max-width:640px;margin:auto;padding:16px;color:#000;font-size:13px}
      h2{text-align:center;margin:2px 0}h3{text-align:center;font-size:15px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px}td,th{padding:5px 4px;border-bottom:1px solid #ddd}
      th{text-align:left;background:#f0f0f0}.sum td{border:none;padding:3px 2px}.big{font-weight:bold;border-top:2px solid #000}
      @media print{button{display:none}}</style></head><body>
      <h2>${settings.shop_name || 'เจ้านายฟาร์มเป็ด'}</h2>
      ${settings.shop_phone ? `<div style="text-align:center;color:#555">โทร. ${settings.shop_phone}</div>` : ''}
      <h3>รายงานสรุปยอดขาย</h3>
      <div style="text-align:center;color:#555">ช่วง: ${label} (${rFrom} ถึง ${rTo}) • ${inR.length} บิล</div>
      <table class="sum" style="max-width:340px;margin:12px auto">
        <tr><td>ยอดขายรวม</td><td style="text-align:right">${sales.toFixed(2)}</td></tr>
        <tr><td>ต้นทุน</td><td style="text-align:right">${cost.toFixed(2)}</td></tr>
        <tr class="big"><td>กำไรขั้นต้น</td><td style="text-align:right">${profit.toFixed(2)}</td></tr>
        <tr><td>— เงินสด</td><td style="text-align:right">${payS('CASH').toFixed(2)}</td></tr>
        <tr><td>— โอน</td><td style="text-align:right">${payS('TRANSFER').toFixed(2)}</td></tr>
        <tr><td>— เครดิต</td><td style="text-align:right">${payS('CREDIT').toFixed(2)}</td></tr>
        <tr><td>ค้างชำระ</td><td style="text-align:right">${credit.toFixed(2)}</td></tr>
      </table>
      <h3 style="font-size:14px">รายการบิล</h3>
      <table><thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th style="text-align:center">ชำระ</th><th style="text-align:right">ยอด</th></tr></thead><tbody>${rows || '<tr><td colspan=5 style="text-align:center;color:#999">ไม่มีบิล</td></tr>'}</tbody></table>
      <div style="text-align:center;margin-top:14px"><button onclick="window.print()" style="padding:8px 20px">🖨️ พิมพ์</button></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=560,height=740');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const Stat = ({ k, v, c }: { k: string; v: string; c?: string }) => (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-gray-500 text-sm">{k}</div>
      <div className={`text-xl font-bold ${c ?? 'text-green-800'}`}>{v}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-1">แดชบอร์ด</h1>
      <p className="text-gray-500 mb-4">สวัสดี {name}</p>

      {/* ตัวเลือกช่วงเวลา */}
      <div className="bg-white rounded-xl shadow p-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`px-4 py-1.5 rounded-full text-sm border ${
                mode === k ? 'bg-green-700 text-white border-green-700' : 'bg-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {mode === 'month' && (
          <input
            type="month"
            className="border rounded-lg px-2 py-1.5 mt-3"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        )}
        {mode === 'range' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              type="date"
              className="border rounded-lg px-2 py-1.5"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>ถึง</span>
            <input
              type="date"
              className="border rounded-lg px-2 py-1.5"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="text-gray-500 text-sm">
            ช่วง: <b className="text-gray-800">{label}</b> • {inR.length} บิล
          </div>
          <button
            className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
            onClick={printReport}
          >
            🖨️ พิมพ์รายงาน
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Stat k="ยอดขาย" v={money(sales)} c="text-green-700" />
        <Stat k="ต้นทุน" v={money(cost)} c="text-gray-700" />
        <Stat k="กำไร" v={money(profit)} c="text-green-700" />
        <Stat k="จำนวนบิล" v={String(inR.length)} c="text-gray-700" />
        <Stat k="ค้างชำระ" v={money(credit)} c="text-red-600" />
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-3">ยอดขายตามช่วงเวลา</h3>
        <div className="flex items-end gap-1.5 h-40">
          {bars.map((b, i) => {
            const h = Math.round((b.v / maxV) * 100);
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              >
                <div className="text-[10px] text-gray-500">
                  {b.v ? Math.round((b.v / 1000) * 10) / 10 + 'k' : ''}
                </div>
                <div
                  className="w-full max-w-[34px] rounded-t bg-green-500"
                  style={{ height: `${b.v ? Math.max(4, h) : 2}%` }}
                />
                <div className="text-[10px] text-gray-400">{b.k}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">แยกตามการชำระเงิน</h3>
        <div className="flex justify-between py-1.5 border-b">
          <span>💵 เงินสด</span>
          <span>{money(payS('CASH'))}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b">
          <span>📲 โอนจ่ายทันที</span>
          <span>{money(payS('TRANSFER'))}</span>
        </div>
        <div className="flex justify-between py-1.5">
          <span>📝 เครดิต (เชื่อ)</span>
          <span>{money(payS('CREDIT'))}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">🏆 สินค้าขายดี (ในช่วง)</h3>
        {topP.length ? (
          topP.map(([n, q]) => (
            <div key={n} className="flex justify-between py-1.5 border-b text-sm">
              <span>{n}</span>
              <span className="font-semibold">{q}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm py-2">ไม่มีการขายในช่วงนี้</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-bold mb-2">⚠️ สต๊อกใกล้หมด (คลังหลัก ≤ 15)</h3>
        {lowStock.length ? (
          lowStock.map((p, i) => (
            <div key={i} className="flex justify-between py-1.5 border-b text-sm">
              <span>{p.name}</span>
              <span className="bg-red-100 text-red-600 px-2 rounded">
                {p.stock} {p.unit}
              </span>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm py-2">สต๊อกเพียงพอทุกรายการ 👍</p>
        )}
      </div>
    </div>
  );
}
