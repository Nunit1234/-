'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fmtQty, unitInfo } from '@/lib/format';
import type { Product } from '@/lib/types';

type StockRow = {
  driver_id: string;
  product_id: string;
  qty: number;
  products: { name: string; unit: string } | null;
};
type AllocItem = { product_id: string; qty: number; name: string; unit: string };

export default function VanStockClient({
  drivers,
  products,
  stocks,
  settings,
}: {
  drivers: { id: string; name: string }[];
  products: Product[];
  stocks: StockRow[];
  settings: { shop_name?: string; shop_phone?: string };
}) {
  const supabase = createClient();
  const router = useRouter();

  const [allocDriver, setAllocDriver] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function printSheet(driverName: string, items: AllocItem[]) {
    const rows = items
      .map(
        (i, idx) =>
          `<tr><td>${idx + 1}. ${i.name}</td><td style="text-align:center">${i.unit}</td><td style="text-align:right">${i.qty}</td></tr>`
      )
      .join('');
    const totalQ = items.reduce((s, i) => s + i.qty, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบคุมสินค้า</title>
      <style>*{font-family:Tahoma,sans-serif}body{max-width:420px;margin:auto;padding:14px;color:#000}
      h2{text-align:center;margin:2px 0}h3{text-align:center;margin:6px 0;font-size:15px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
      td,th{padding:5px 3px;border-bottom:1px dashed #bbb}th{text-align:left;border-bottom:1px solid #000}
      .big td{border-top:2px solid #000;font-weight:bold}
      .sign{display:flex;gap:16px;margin-top:44px}.sign div{flex:1;text-align:center}
      .ln{border-top:1px dotted #000;margin-top:30px;margin-bottom:4px}
      @media print{button{display:none}}</style></head><body>
      <h2>${settings.shop_name || 'เจ้านายฟาร์มเป็ด'}</h2>
      ${settings.shop_phone ? `<div style="text-align:center;color:#555;font-size:12px">โทร. ${settings.shop_phone}</div>` : ''}
      <h3>ใบคุมสินค้า / ใบจ่ายสต๊อกขึ้นรถ</h3>
      <div style="color:#555;font-size:12px">คนส่ง: <b>${driverName}</b><br>วันที่: ${new Date().toLocaleString('th-TH')}</div>
      <table><thead><tr><th>รายการ</th><th style="text-align:center">หน่วย</th><th style="text-align:right">จำนวน</th></tr></thead>
      <tbody>${rows}<tr class="big"><td colspan="2">รวม</td><td style="text-align:right">${totalQ}</td></tr></tbody></table>
      <div class="sign"><div><div class="ln"></div>ผู้จ่ายสินค้า</div><div><div class="ln"></div>ผู้รับ (คนส่ง)<br><span style="color:#555">( ${driverName} )</span></div></div>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 20px">🖨️ พิมพ์</button></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=430,height=680');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  async function allocate() {
    if (!allocDriver) return;
    const items: AllocItem[] = [];
    for (const p of products) {
      const q = Math.floor(Number(qtys[p.id] || 0));
      if (q > 0) items.push({ product_id: p.id, qty: q, name: p.name, unit: p.unit });
    }
    if (!items.length) {
      setErr('กรอกจำนวนอย่างน้อย 1 รายการ');
      return;
    }
    setSaving(true);
    setErr('');
    const { error } = await supabase.rpc('allocate_stock', {
      p_driver: allocDriver,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setErr('จ่ายสต๊อกไม่สำเร็จ: ' + error.message);
      return;
    }
    const dn = drivers.find((d) => d.id === allocDriver)?.name || '';
    setAllocDriver(null);
    setQtys({});
    printSheet(dn, items);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-2">สต๊อกคนส่ง</h1>
      <p className="text-sm text-gray-500 mb-4">
        จ่ายสต๊อกจากคลังหลักให้คนส่งแต่ละคน (สต๊อกบนรถ) — หน้าขายของคนส่งจะตัดจากสต๊อกนี้
      </p>

      {drivers.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          ยังไม่มีคนส่ง
        </div>
      )}

      {drivers.map((d) => {
        const rows = stocks.filter((s) => s.driver_id === d.id && s.qty > 0);
        return (
          <div key={d.id} className="bg-white rounded-xl shadow mb-4">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-bold">🚚 {d.name}</h3>
              <button
                className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
                onClick={() => {
                  setErr('');
                  setQtys({});
                  setAllocDriver(d.id);
                }}
              >
                + จ่ายสต๊อก
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map((s) => (
                  <tr key={s.product_id} className="border-t">
                    <td className="p-2">{s.products?.name ?? '-'}</td>
                    <td className="p-2 text-right">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                        {fmtQty(s.qty)} {s.products?.unit ?? ''}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-400">ยังไม่มีสต๊อก</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Allocate modal */}
      {allocDriver && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setAllocDriver(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">
              จ่ายสต๊อกให้ {drivers.find((d) => d.id === allocDriver)?.name}
            </h2>
            <p className="text-xs text-gray-500 mb-2">กรอกจำนวนที่จะจ่าย (ตัดจากคลังหลัก)</p>
            <div className="max-h-[50vh] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left p-2">สินค้า</th>
                    <th className="text-right p-2">คลัง</th>
                    <th className="text-right p-2">จ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">
                        {p.name}
                        <span className="block text-gray-400 text-xs">
                          {unitInfo(p.unit, p.per_unit)}
                        </span>
                      </td>
                      <td className="p-2 text-right">{fmtQty(p.stock)}</td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-16 border rounded px-2 py-1 text-right"
                          value={qtys[p.id] ?? ''}
                          onChange={(e) => setQtys({ ...qtys, [p.id]: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setAllocDriver(null)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={allocate}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'จ่ายสต๊อก & พิมพ์ใบคุม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
