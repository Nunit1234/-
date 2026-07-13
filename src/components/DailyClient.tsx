'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';
import type { Role } from '@/lib/types';

type OrderRow = {
  code: string;
  pay_method: string;
  total_sell: number;
  delivered_at: string | null;
  created_at: string;
  order_items: { unit: string; qty: number }[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyClient({
  role,
  myId,
  drivers,
  profMap,
  settings,
}: {
  role: Role;
  myId: string;
  drivers: { id: string; name: string }[];
  profMap: Record<string, string>;
  settings: { commission_rate?: number; shop_name?: string; shop_phone?: string };
}) {
  const supabase = createClient();
  const isAdmin = role === 'admin';
  const rate = settings.commission_rate ?? 0.3;

  const [driver, setDriver] = useState(isAdmin ? drivers[0]?.id ?? '' : myId);
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(async () => {
    if (!driver) {
      setOrders([]);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select('code, pay_method, total_sell, delivered_at, created_at, order_items(unit, qty)')
      .eq('delivery_id', driver)
      .neq('status', 'CANCELLED');
    const rows = ((data ?? []) as unknown as OrderRow[]).filter(
      (o) => (o.delivered_at || o.created_at).slice(0, 10) === date
    );
    setOrders(rows);
  }, [supabase, driver, date]);

  useEffect(() => {
    load();
  }, [load]);

  const sum = (m: string) =>
    orders.filter((o) => o.pay_method === m).reduce((s, o) => s + Number(o.total_sell), 0);
  const cash = sum('CASH');
  const transfer = sum('TRANSFER');
  const credit = sum('CREDIT');
  const total = cash + transfer + credit;
  const panels = orders.reduce(
    (s, o) =>
      s + (o.order_items ?? []).filter((i) => i.unit === 'แผง').reduce((a, i) => a + i.qty, 0),
    0
  );
  const comm = panels * rate;
  const netCash = cash - comm;
  const driverName = isAdmin ? profMap[driver] ?? '' : profMap[myId] ?? '';

  function print() {
    const bills = orders
      .map(
        (o) =>
          `<tr><td>${o.code}</td><td style="text-align:center">${o.pay_method}</td><td style="text-align:right">${Number(o.total_sell).toFixed(2)}</td></tr>`
      )
      .join('');
    const line = (k: string, v: number, b?: boolean) =>
      `<tr${b ? ' style="font-weight:bold;border-top:2px solid #000"' : ''}><td>${k}</td><td style="text-align:right">${v.toFixed(2)}</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ปิดยอด</title>
      <style>*{font-family:Tahoma,sans-serif}body{max-width:400px;margin:auto;padding:12px;color:#000;font-size:13px}
      h2{text-align:center;margin:2px 0}h3{text-align:center;margin:6px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-top:6px}td,th{padding:4px 3px;border-bottom:1px dashed #bbb}
      .sign{display:flex;gap:16px;margin-top:40px}.sign div{flex:1;text-align:center}.ln{border-top:1px dotted #000;margin-top:30px;margin-bottom:4px}
      @media print{button{display:none}}</style></head><body>
      <h2>${settings.shop_name || 'เจ้านายฟาร์มเป็ด'}</h2>
      ${settings.shop_phone ? `<div style="text-align:center;color:#555;font-size:12px">โทร. ${settings.shop_phone}</div>` : ''}
      <h3>ใบสรุปยอด / ปิดยอดประจำวัน</h3>
      <div style="color:#555;font-size:12px">คนส่ง: <b>${driverName}</b><br>วันที่: ${date} • ${orders.length} บิล • ${panels} แผง</div>
      <table><thead><tr><th style="text-align:left">เลขที่</th><th style="text-align:center">ชำระ</th><th style="text-align:right">ยอด</th></tr></thead><tbody>${bills || '<tr><td colspan=3 style="text-align:center;color:#999">ไม่มีบิล</td></tr>'}</tbody></table>
      <table style="margin-top:8px"><tbody>
        ${line('เงินสด', cash)}${line('โอนจ่ายทันที', transfer)}${line('เครดิต/ค้างชำระ', credit)}
        ${line('ยอดขายรวม', total, true)}${line('หัก ค่าคอมมิชชั่น (' + panels + ' แผง)', comm)}${line('เงินสดสุทธินำส่ง', netCash, true)}
      </tbody></table>
      <div class="sign"><div><div class="ln"></div>คนส่ง<br><span style="color:#555">( ${driverName} )</span></div><div><div class="ln"></div>ผู้รับเงิน</div></div>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 20px">🖨️ พิมพ์</button></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=430,height=680');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const Line = ({ k, v, neg, big }: { k: string; v: number; neg?: boolean; big?: boolean }) => (
    <div
      className={`flex justify-between py-2 ${big ? 'border-t-2 border-black font-bold text-lg' : 'border-b'}`}
    >
      <span>{k}</span>
      <span className={neg ? 'text-red-600' : big ? 'text-green-700' : ''}>
        {neg ? '−' : ''}
        {money(v)}
      </span>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">
        {isAdmin ? 'ปิดยอดรายวัน' : 'ปิดยอดวันนี้'}
      </h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4 flex gap-3 flex-wrap items-end">
        {isAdmin && (
          <div>
            <label className="block text-xs text-gray-500">คนส่ง</label>
            <select
              className="border rounded-lg px-2 py-2"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500">วันที่</label>
          <input
            type="date"
            className="border rounded-lg px-2 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          className="bg-green-700 text-white px-4 py-2 rounded-lg"
          onClick={print}
        >
          🖨️ พิมพ์ใบปิดยอด
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow p-3">
          <div className="text-gray-500 text-xs">ยอดขายรวม</div>
          <div className="text-lg font-bold text-green-800">{money(total)}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3">
          <div className="text-gray-500 text-xs">จำนวนบิล</div>
          <div className="text-lg font-bold">{orders.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3">
          <div className="text-gray-500 text-xs">จำนวนแผง</div>
          <div className="text-lg font-bold">{panels}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3">
          <div className="text-gray-500 text-xs">ค่าคอม</div>
          <div className="text-lg font-bold text-red-600">{money(comm)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-bold mb-2">สรุปตามการชำระเงิน</h3>
        <Line k="เงินสด" v={cash} />
        <Line k="โอนจ่ายทันที" v={transfer} />
        <Line k="เครดิต / ค้างชำระ" v={credit} neg />
        <Line k={`หัก ค่าคอมมิชชั่น (${panels} แผง × ${rate})`} v={comm} neg />
        <Line k="เงินสดสุทธิที่ต้องนำส่ง" v={netCash} big />
      </div>
    </div>
  );
}
