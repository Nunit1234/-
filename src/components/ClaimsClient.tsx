'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/storage';
import { fmtQty } from '@/lib/format';
import type { Role } from '@/lib/types';

type Claim = {
  id: string;
  driver_id: string;
  customer_id: string;
  note: string;
  photo_url: string;
  created_at: string;
  customers?: { name: string } | null;
  claim_items?: { name: string; unit: string; qty: number }[];
};

type StockRow = {
  product_id: string;
  qty: number;
  products: { name: string; unit: string; per_unit: number } | null;
};

export default function ClaimsClient({
  role,
  claims,
  profMap,
  customers,
  stock,
}: {
  role: Role;
  claims: Claim[];
  profMap: Record<string, string>;
  customers: { id: string; name: string }[];
  stock: StockRow[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const isDelivery = role === 'delivery';

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const itemsText = (c: Claim) =>
    (c.claim_items ?? [])
      .map((i) => `${i.name} (${i.unit}) ×${fmtQty(i.qty)}`)
      .join(', ');

  async function onPhoto(file: File) {
    setSaving(true);
    try {
      setPhoto(await uploadImage(file, 'claims'));
    } catch {
      /* ignore */
    }
    setSaving(false);
  }

  async function submit() {
    if (!customerId) {
      setErr('เลือกลูกค้าร้าน');
      return;
    }
    const items: {
      product_id: string;
      qty_pack: number;
      qty: number;
      name: string;
      unit: string;
    }[] = [];
    for (const s of stock) {
      const raw = Math.floor(Number(qtys[s.product_id] || 0));
      if (raw <= 0) continue;
      const per = s.products?.per_unit || 1;
      const unit = units[s.product_id] || s.products?.unit || 'หน่วย';
      let pack = unit === 'ฟอง' ? raw / per : raw;
      pack = Math.min(pack, s.qty);
      if (pack <= 0) continue;
      const qty = unit === 'ฟอง' ? Math.round(pack * per) : pack;
      items.push({
        product_id: s.product_id,
        qty_pack: pack,
        qty,
        name: s.products?.name || '',
        unit,
      });
    }
    if (!items.length) {
      setErr('ระบุจำนวนที่เคลมอย่างน้อย 1 รายการ');
      return;
    }
    setSaving(true);
    setErr('');
    const { error } = await supabase.rpc('create_claim', {
      p_customer: customerId,
      p_note: note,
      p_photo: photo,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setErr('บันทึกเคลมไม่สำเร็จ: ' + error.message);
      return;
    }
    setOpen(false);
    setQtys({});
    setUnits({});
    setNote('');
    setPhoto('');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-green-900">เคลมสินค้า</h1>
        {isDelivery && (
          <button
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            onClick={() => {
              setErr('');
              setOpen(true);
            }}
          >
            + แจ้งเคลม
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">วันที่</th>
              {!isDelivery && <th className="text-left p-3">คนส่ง</th>}
              <th className="text-left p-3">ลูกค้า</th>
              <th className="text-left p-3">รายการ</th>
              <th className="text-left p-3">หมายเหตุ</th>
              <th className="p-3">รูป</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{new Date(c.created_at).toLocaleString('th-TH')}</td>
                {!isDelivery && <td className="p-3">{profMap[c.driver_id] ?? '-'}</td>}
                <td className="p-3">{c.customers?.name ?? '-'}</td>
                <td className="p-3">{itemsText(c)}</td>
                <td className="p-3">{c.note || '-'}</td>
                <td className="p-3 text-center">
                  {c.photo_url ? (
                    <a href={c.photo_url} target="_blank" className="text-blue-600">
                      📸
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={isDelivery ? 5 : 6} className="p-8 text-center text-gray-400">
                  ยังไม่มีการเคลม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">แจ้งเคลมสินค้า</h2>

            <label className="block text-xs text-gray-500">เคลมให้ลูกค้าร้าน</label>
            <select
              className="w-full border rounded-lg px-2 py-2 mb-2"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="block text-xs text-gray-500">สินค้าที่เคลม (จากสต๊อกบนรถ)</label>
            <div className="max-h-[36vh] overflow-auto border rounded-lg mb-2">
              <table className="w-full text-sm">
                <tbody>
                  {stock.map((s) => {
                    const per = s.products?.per_unit || 1;
                    return (
                      <tr key={s.product_id} className="border-t">
                        <td className="p-2">
                          {s.products?.name}
                          <span className="block text-gray-400 text-xs">
                            มี {fmtQty(s.qty)} {s.products?.unit}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              min={0}
                              className="w-14 border rounded px-1 py-1 text-right"
                              value={qtys[s.product_id] ?? ''}
                              onChange={(e) =>
                                setQtys({ ...qtys, [s.product_id]: e.target.value })
                              }
                            />
                            {per > 1 ? (
                              <select
                                className="border rounded px-1 py-1"
                                value={units[s.product_id] ?? s.products?.unit}
                                onChange={(e) =>
                                  setUnits({ ...units, [s.product_id]: e.target.value })
                                }
                              >
                                <option value={s.products?.unit}>{s.products?.unit}</option>
                                <option value="ฟอง">ฟอง</option>
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400">{s.products?.unit}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {stock.length === 0 && (
                    <tr>
                      <td className="p-3 text-center text-gray-400">ไม่มีสต๊อกบนรถ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <label className="block text-xs text-gray-500">หมายเหตุ / สาเหตุ</label>
            <textarea
              className="w-full border rounded-lg px-2 py-2 mb-2"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ไข่แตกระหว่างขนส่ง"
            />

            <label className="block text-xs text-gray-500">📸 รูปหลักฐาน</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
            />
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="max-h-32 rounded mt-1" />
            )}

            {err && <p className="text-red-600 text-sm mt-1">{err}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={submit}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึกเคลม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
