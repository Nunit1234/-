'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from '@/components/ImageUpload';

type Settings = {
  id: number;
  commission_rate?: number;
  shop_name?: string;
  shop_phone?: string;
  shop_address?: string;
  receipt_note?: string;
  receipt_width?: string;
  receipt_logo_url?: string;
  bank_name?: string;
  account_name?: string;
  account_no?: string;
  qr_url?: string;
};

export default function SettingsClient({ initial }: { initial: Settings }) {
  const supabase = createClient();
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setMsg('');
    const { id, ...rest } = s;
    void id;
    const { error } = await supabase.from('settings').update(rest).eq('id', 1);
    setSaving(false);
    setMsg(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกแล้ว ✔');
    router.refresh();
  }

  function previewReceipt() {
    const pw = s.receipt_width || '80mm';
    const W = ({ '58mm': 200, '80mm': 300, A4: 480 } as Record<string, number>)[pw] || 300;
    const logo = s.receipt_logo_url || '';
    const items = [
      { name: 'ไข่เป็ด เบอร์ 00', unit: 'แผง', qty: 2, price: 150 },
      { name: 'ไข่ไก่ เบอร์ 0', unit: 'แผง', qty: 3, price: 116 },
    ];
    const rows = items
      .map(
        (i) =>
          `<tr><td>${i.name}<br><span style="color:#888;font-size:11px">${i.unit}</span></td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.price.toFixed(2)}</td><td style="text-align:right">${(i.price * i.qty).toFixed(2)}</td></tr>`
      )
      .join('');
    const total = items.reduce((a, i) => a + i.price * i.qty, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ตัวอย่างใบเสร็จ</title>
      <style>${pw !== 'A4' ? `@page{size:${pw} auto;margin:3mm}` : ''}
      *{font-family:Tahoma,sans-serif}body{max-width:${W}px;margin:auto;padding:10px;color:#000;font-size:13px}
      h2{text-align:center;margin:2px 0}.c{text-align:center}.muted{color:#555;font-size:12px}
      .logo{width:70px;height:70px;object-fit:contain;filter:grayscale(1);display:block;margin:0 auto 4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:4px 2px;border-bottom:1px dashed #bbb}
      th{text-align:left;border-bottom:1px solid #000}.tot{font-weight:bold;font-size:15px;border-top:2px solid #000}
      @media print{button{display:none}}</style></head><body>
      ${logo ? `<img class="logo" src="${logo}">` : ''}
      <h2>${s.shop_name || 'เจ้านายฟาร์มเป็ด'}</h2>
      ${s.shop_address ? `<div class="c muted">${s.shop_address}</div>` : ''}
      ${s.shop_phone ? `<div class="c muted">โทร. ${s.shop_phone}</div>` : ''}
      <div class="c muted">ใบเสร็จรับเงิน / บิลขายสินค้า</div>
      <div class="muted" style="margin-top:6px">เลขที่: (ตัวอย่าง)<br>ลูกค้า: ร้านตัวอย่าง</div>
      <table><thead><tr><th>รายการ</th><th class="c">จำนวน</th><th style="text-align:right">ราคา</th><th style="text-align:right">รวม</th></tr></thead><tbody>${rows}</tbody></table>
      <table><tr class="tot"><td>รวมทั้งสิ้น</td><td style="text-align:right">${total.toFixed(2)} บาท</td></tr></table>
      ${s.receipt_note ? `<div class="c muted" style="margin-top:12px">${s.receipt_note}</div>` : ''}
      <div class="c" style="margin-top:12px"><button onclick="window.print()" style="padding:8px 20px">🖨️ พิมพ์</button></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=380,height=640');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const input =
    'w-full border border-gray-300 rounded-lg px-3 py-2 mb-2';

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">ตั้งค่าร้าน</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">🧾 ข้อมูลร้าน / ใบเสร็จ</h3>
        <label className="text-xs text-gray-500">ชื่อร้าน</label>
        <input className={input} value={s.shop_name ?? ''} onChange={(e) => set('shop_name', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">เบอร์โทรร้าน</label>
            <input className={input} value={s.shop_phone ?? ''} onChange={(e) => set('shop_phone', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">ขนาดใบเสร็จ</label>
            <select
              className={input}
              value={s.receipt_width ?? '80mm'}
              onChange={(e) => set('receipt_width', e.target.value)}
            >
              <option value="80mm">ความร้อน 80mm</option>
              <option value="58mm">ความร้อน 58mm</option>
              <option value="A4">A4</option>
            </select>
          </div>
        </div>
        <label className="text-xs text-gray-500">ที่อยู่ร้าน</label>
        <input className={input} value={s.shop_address ?? ''} onChange={(e) => set('shop_address', e.target.value)} />
        <label className="text-xs text-gray-500">หมายเหตุท้ายบิล</label>
        <textarea className={input} rows={2} value={s.receipt_note ?? ''} onChange={(e) => set('receipt_note', e.target.value)} />
        <label className="text-xs text-gray-500 block mb-1">โลโก้ในใบเสร็จ</label>
        <ImageUpload
          value={s.receipt_logo_url}
          onChange={(url) => set('receipt_logo_url', url)}
          folder="settings"
          label="แนบโลโก้"
        />
        <button
          type="button"
          onClick={previewReceipt}
          className="mt-3 bg-green-100 text-green-800 hover:bg-green-200 px-4 py-2 rounded-lg text-sm font-medium"
        >
          👁️ ดูตัวอย่างใบเสร็จ
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">💳 ข้อมูลรับเงิน (แสดงตอนลูกค้าโอน)</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">ธนาคาร</label>
            <input className={input} value={s.bank_name ?? ''} onChange={(e) => set('bank_name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">ชื่อบัญชี</label>
            <input className={input} value={s.account_name ?? ''} onChange={(e) => set('account_name', e.target.value)} />
          </div>
        </div>
        <label className="text-xs text-gray-500">เลขที่บัญชี</label>
        <input className={input} value={s.account_no ?? ''} onChange={(e) => set('account_no', e.target.value)} />
        <label className="text-xs text-gray-500 block mb-1">รูป QR รับเงิน</label>
        <ImageUpload
          value={s.qr_url}
          onChange={(url) => set('qr_url', url)}
          folder="settings"
          size={120}
          label="แนบ QR"
        />
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">🧮 ค่าคอมมิชชั่นคนส่ง</h3>
        <label className="text-xs text-gray-500">อัตรา (บาท ต่อ 1 แผงที่ส่งสำเร็จ)</label>
        <input
          className={input + ' max-w-[200px]'}
          type="number"
          step="0.01"
          value={s.commission_rate ?? 0.3}
          onChange={(e) => set('commission_rate', Number(e.target.value))}
        />
      </div>

      {msg && <p className="text-green-700 text-sm mb-2">{msg}</p>}
      <button
        className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'กำลังบันทึก…' : '💾 บันทึกการตั้งค่า'}
      </button>
    </div>
  );
}
