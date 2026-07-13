'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';
import type { Role } from '@/lib/types';

type OrderRow = {
  id: string;
  code: string;
  customer_id: string;
  delivery_id: string | null;
  status: string;
  pay_method: string;
  pay_status: string;
  slip_url: string;
  total_sell: number;
  created_at: string;
  customers?: { name: string } | null;
};

type OrderItem = {
  name: string;
  unit: string;
  qty: number;
  sell_price: number;
};

const STATUS: Record<string, [string, string]> = {
  PENDING: ['รอยืนยัน', 'bg-orange-100 text-orange-700'],
  CONFIRMED: ['ยืนยันแล้ว', 'bg-blue-100 text-blue-700'],
  DELIVERING: ['กำลังส่ง', 'bg-blue-100 text-blue-700'],
  DELIVERED: ['ส่งแล้ว', 'bg-green-100 text-green-700'],
  CANCELLED: ['ยกเลิก', 'bg-red-100 text-red-700'],
};
const PAY: Record<string, string> = {
  CASH: 'เงินสด',
  TRANSFER: 'โอนทันที',
  CREDIT: 'เครดิต',
};

type ShopSettings = {
  shop_name?: string;
  shop_phone?: string;
  shop_address?: string;
  receipt_note?: string;
};

export default function OrdersClient({
  role,
  orders,
  profMap,
  drivers,
  settings,
}: {
  role: Role;
  orders: OrderRow[];
  profMap: Record<string, string>;
  drivers: { id: string; name: string }[];
  settings: ShopSettings;
}) {
  const supabase = createClient();
  const router = useRouter();
  const isAdmin = role === 'admin';

  function printReceipt(o: OrderRow, its: OrderItem[]) {
    const rows = its
      .map(
        (i) =>
          `<tr><td>${i.name}<br><span style="color:#888;font-size:11px">${i.unit}</span></td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.sell_price.toFixed(2)}</td><td style="text-align:right">${(i.sell_price * i.qty).toFixed(2)}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>บิล ${o.code}</title>
      <style>*{font-family:Tahoma,sans-serif}body{max-width:320px;margin:auto;padding:10px;color:#000;font-size:13px}
      h2{text-align:center;margin:2px 0}.c{text-align:center}.muted{color:#555;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:4px 2px;border-bottom:1px dashed #bbb}
      th{text-align:left;border-bottom:1px solid #000}.tot{font-weight:bold;font-size:15px;border-top:2px solid #000}
      @media print{button{display:none}}</style></head><body>
      <h2>${settings.shop_name || 'เจ้านายฟาร์มเป็ด'}</h2>
      ${settings.shop_address ? `<div class="c muted">${settings.shop_address}</div>` : ''}
      ${settings.shop_phone ? `<div class="c muted">โทร. ${settings.shop_phone}</div>` : ''}
      <div class="c muted">ใบเสร็จรับเงิน / บิลขายสินค้า</div>
      <div class="muted" style="margin-top:6px">เลขที่: ${o.code}<br>ลูกค้า: ${o.customers?.name ?? '-'}</div>
      <table><thead><tr><th>รายการ</th><th class="c">จำนวน</th><th style="text-align:right">ราคา</th><th style="text-align:right">รวม</th></tr></thead><tbody>${rows}</tbody></table>
      <table><tr class="tot"><td>รวมทั้งสิ้น</td><td style="text-align:right">${o.total_sell.toFixed(2)} บาท</td></tr>
      <tr><td class="muted">ชำระโดย</td><td style="text-align:right" class="muted">${PAY[o.pay_method]}</td></tr></table>
      ${settings.receipt_note ? `<div class="c muted" style="margin-top:12px">${settings.receipt_note}</div>` : ''}
      <div class="c" style="margin-top:12px"><button onclick="window.print()" style="padding:8px 20px">🖨️ พิมพ์</button></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=380,height=640');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const [open, setOpen] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [status, setStatus] = useState('');
  const [delivery, setDelivery] = useState('');
  const [saving, setSaving] = useState(false);

  async function openOrder(o: OrderRow) {
    setOpen(o);
    setStatus(o.status);
    setDelivery(o.delivery_id ?? '');
    setItems([]);
    const { data } = await supabase
      .from('order_items')
      .select('name, unit, qty, sell_price')
      .eq('order_id', o.id);
    setItems((data ?? []) as OrderItem[]);
  }

  async function saveOrder() {
    if (!open) return;
    setSaving(true);
    await supabase
      .from('orders')
      .update({ status, delivery_id: delivery || null })
      .eq('id', open.id);
    setSaving(false);
    setOpen(null);
    router.refresh();
  }

  async function markPaid() {
    if (!open) return;
    setSaving(true);
    await supabase.from('orders').update({ pay_status: 'PAID' }).eq('id', open.id);
    setSaving(false);
    setOpen(null);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">
        {isAdmin ? 'ออเดอร์' : 'ออเดอร์ของฉัน'}
      </h1>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">เลขที่</th>
              <th className="text-left p-3">ลูกค้า</th>
              <th className="text-right p-3">ยอด</th>
              <th className="p-3">ชำระ</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">
                  {o.code}
                  <div className="text-gray-400 text-xs">{PAY[o.pay_method]}</div>
                </td>
                <td className="p-3">{o.customers?.name ?? '-'}</td>
                <td className="p-3 text-right">{money(o.total_sell)}</td>
                <td className="p-3 text-center">
                  {o.pay_status === 'PAID' ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      ชำระแล้ว
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      ค้าง
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      STATUS[o.status]?.[1] ?? ''
                    }`}
                  >
                    {STATUS[o.status]?.[0] ?? o.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    className="text-green-700 hover:underline"
                    onClick={() => openOrder(o)}
                  >
                    จัดการ
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  ยังไม่มีออเดอร์
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setOpen(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">ออเดอร์ {open.code}</h2>
            <p className="text-sm text-gray-500 mb-3">
              {open.customers?.name} • {PAY[open.pay_method]}
              {open.delivery_id && ` • คนส่ง: ${profMap[open.delivery_id] ?? '-'}`}
            </p>

            <div className="border rounded-lg divide-y mb-3 text-sm">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between p-2">
                  <span>
                    {i.name} ({i.unit}) × {i.qty}
                  </span>
                  <span>{money(i.sell_price * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between p-2 font-bold">
                <span>รวม</span>
                <span>{money(open.total_sell)}</span>
              </div>
            </div>

            {open.slip_url && (
              <a
                href={open.slip_url}
                target="_blank"
                className="text-blue-600 text-sm underline block mb-3"
              >
                💸 ดูสลิปโอนจากลูกค้า
              </a>
            )}

            <label className="block text-xs text-gray-500">สถานะ</label>
            <select
              className="w-full border rounded-lg px-2 py-2 mb-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!isAdmin && role !== 'delivery'}
            >
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[0]}
                </option>
              ))}
            </select>

            {isAdmin && (
              <>
                <label className="block text-xs text-gray-500">คนส่ง</label>
                <select
                  className="w-full border rounded-lg px-2 py-2 mb-2"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                >
                  <option value="">— ไม่กำหนด —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {isAdmin && open.pay_status === 'UNPAID' && (
              <button
                className="w-full bg-green-600 text-white rounded-lg py-2 mb-2 text-sm"
                onClick={markPaid}
                disabled={saving}
              >
                💳 บันทึกรับชำระแล้ว
              </button>
            )}

            <button
              className="w-full bg-gray-100 rounded-lg py-2 mb-2 text-sm"
              onClick={() => printReceipt(open, items)}
            >
              🖨️ พิมพ์ใบเสร็จ / บิล
            </button>

            <div className="flex justify-end gap-2 mt-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setOpen(null)}
                disabled={saving}
              >
                ปิด
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={saveOrder}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
