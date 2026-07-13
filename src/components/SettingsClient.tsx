'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/storage';

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

  async function upload(k: 'qr_url' | 'receipt_logo_url', file: File) {
    setSaving(true);
    try {
      set(k, await uploadImage(file, 'settings'));
    } catch {
      /* ignore */
    }
    setSaving(false);
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
        <label className="text-xs text-gray-500">รูป QR รับเงิน</label>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload('qr_url', e.target.files[0])} />
        {s.qr_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.qr_url} alt="QR" className="w-32 rounded mt-2 border" />
        )}
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
