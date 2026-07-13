'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';

type OrderRow = {
  created_at: string;
  total_sell: number;
  total_cost: number;
  pay_method: string;
  pay_status: string;
  order_items: { name: string; unit: string; qty: number }[];
};

const PERIODS: [string, string][] = [
  ['today', 'วันนี้'],
  ['7d', '7 วัน'],
  ['month', 'เดือนนี้'],
  ['all', 'ทั้งหมด'],
];

function rangeFor(mode: string): [string, string] {
  const t = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (mode === 'today') return [iso(t), iso(t)];
  if (mode === '7d') {
    const f = new Date();
    f.setDate(f.getDate() - 6);
    return [iso(f), iso(t)];
  }
  if (mode === 'month') return [iso(t).slice(0, 8) + '01', iso(t)];
  return ['0000-01-01', iso(t)];
}

export default function DashboardClient({
  name,
  lowStock,
}: {
  name: string;
  lowStock: { name: string; unit: string; stock: number }[];
}) {
  const supabase = createClient();
  const [mode, setMode] = useState('today');
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('created_at, total_sell, total_cost, pay_method, pay_status, order_items(name, unit, qty)')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1000);
    setOrders((data ?? []) as unknown as OrderRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const [from, to] = rangeFor(mode);
  const inR = orders.filter((o) => {
    const d = o.created_at.slice(0, 10);
    return d >= from && d <= to;
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
  const top = Object.entries(prodQty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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

      <div className="flex gap-2 flex-wrap mb-4">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Stat k="ยอดขาย" v={money(sales)} />
        <Stat k="ต้นทุน" v={money(cost)} c="text-gray-700" />
        <Stat k="กำไร" v={money(profit)} c="text-green-700" />
        <Stat k="จำนวนบิล" v={String(inR.length)} c="text-gray-700" />
        <Stat k="ค้างชำระ" v={money(credit)} c="text-red-600" />
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
        {top.length ? (
          top.map(([n, q]) => (
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
