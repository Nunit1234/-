'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/storage';
import { money } from '@/lib/format';

type OrderRow = {
  id: string;
  delivery_id: string;
  delivered_at: string | null;
  created_at: string;
  order_items: { unit: string; qty: number }[];
};
type Commission = {
  id: string;
  driver_id: string;
  date_key: string;
  panels: number;
  amount: number;
  paid_date: string;
  proof_url: string;
};
type Group = { driverId: string; dateKey: string; panels: number; orders: number };

export default function CommissionClient({
  rate,
  orders,
  profMap,
  commissions,
}: {
  rate: number;
  orders: OrderRow[];
  profMap: Record<string, string>;
  commissions: Commission[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [payGroup, setPayGroup] = useState<Group | null>(null);
  const [proof, setProof] = useState('');
  const [saving, setSaving] = useState(false);

  // group orders by driver + delivered date
  const groups: Record<string, Group> = {};
  for (const o of orders) {
    const dk = (o.delivered_at || o.created_at).slice(0, 10);
    const panels = (o.order_items ?? [])
      .filter((i) => i.unit === 'แผง')
      .reduce((s, i) => s + i.qty, 0);
    const key = o.delivery_id + '|' + dk;
    if (!groups[key])
      groups[key] = { driverId: o.delivery_id, dateKey: dk, panels: 0, orders: 0 };
    groups[key].panels += panels;
    groups[key].orders += 1;
  }
  const settled = new Set(commissions.map((c) => c.driver_id + '|' + c.date_key));
  const pending = Object.values(groups).filter(
    (g) => g.panels > 0 && !settled.has(g.driverId + '|' + g.dateKey)
  );
  const totalPending = pending.reduce((s, g) => s + g.panels * rate, 0);
  const paidTotal = commissions.reduce((s, c) => s + c.amount, 0);

  async function onProof(file: File) {
    setSaving(true);
    try {
      setProof(await uploadImage(file, 'commissions'));
    } catch {
      /* ignore */
    }
    setSaving(false);
  }

  async function pay() {
    if (!payGroup) return;
    setSaving(true);
    await supabase.from('commissions').insert({
      driver_id: payGroup.driverId,
      date_key: payGroup.dateKey,
      panels: payGroup.panels,
      rate,
      amount: payGroup.panels * rate,
      proof_url: proof,
    });
    setSaving(false);
    setPayGroup(null);
    setProof('');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-1">ค่าคอมมิชชั่นคนส่ง</h1>
      <p className="text-sm text-gray-500 mb-4">
        คิดจากจำนวนแผงที่ส่งสำเร็จ × {rate} บาท/แผง (ปรับอัตราได้ที่ตั้งค่าร้าน)
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-gray-500 text-sm">ค้างจ่ายค่าคอม</div>
          <div className="text-2xl font-bold text-red-600">{money(totalPending)}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-gray-500 text-sm">จ่ายแล้วสะสม</div>
          <div className="text-2xl font-bold text-green-800">{money(paidTotal)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow mb-4">
        <h3 className="font-bold p-3 border-b">⏳ รอยืนยันจ่าย ({pending.length})</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-2">คนส่ง</th>
              <th className="text-left p-2">วันที่</th>
              <th className="text-right p-2">แผง</th>
              <th className="text-right p-2">ค่าคอม</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((g) => (
              <tr key={g.driverId + g.dateKey} className="border-t">
                <td className="p-2">{profMap[g.driverId] ?? '-'}</td>
                <td className="p-2">{g.dateKey}</td>
                <td className="p-2 text-right">{g.panels}</td>
                <td className="p-2 text-right font-bold">{money(g.panels * rate)}</td>
                <td className="p-2 text-right">
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                    onClick={() => {
                      setProof('');
                      setPayGroup(g);
                    }}
                  >
                    ยืนยัน &amp; จ่าย
                  </button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  ไม่มีค่าคอมค้างจ่าย 👍
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow">
        <h3 className="font-bold p-3 border-b">ประวัติการจ่าย</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-2">คนส่ง</th>
              <th className="text-left p-2">วันที่ส่ง</th>
              <th className="text-right p-2">แผง</th>
              <th className="text-right p-2">จ่าย</th>
              <th className="text-left p-2">วันจ่าย</th>
              <th className="p-2">สลิป</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{profMap[c.driver_id] ?? '-'}</td>
                <td className="p-2">{c.date_key}</td>
                <td className="p-2 text-right">{c.panels}</td>
                <td className="p-2 text-right">{money(c.amount)}</td>
                <td className="p-2">{c.paid_date}</td>
                <td className="p-2 text-center">
                  {c.proof_url ? (
                    <a href={c.proof_url} target="_blank" className="text-blue-600">
                      📎
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  ยังไม่มีประวัติ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payGroup && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setPayGroup(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">
              จ่ายค่าคอม — {profMap[payGroup.driverId]}
            </h2>
            <p className="text-sm mb-2">
              วันที่ {payGroup.dateKey} • {payGroup.panels} แผง ×{rate} ={' '}
              <b className="text-green-700">{money(payGroup.panels * rate)}</b>
            </p>
            <label className="text-xs text-gray-500">แนบสลิปโอนให้คนส่ง</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onProof(e.target.files[0])}
            />
            {proof && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proof} alt="" className="max-h-32 rounded mt-1" />
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setPayGroup(null)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={pay}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันจ่าย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
