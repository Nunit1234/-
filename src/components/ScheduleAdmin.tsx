'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';

type Sched = {
  id: string;
  date: string;
  customer_id: string;
  driver_id: string | null;
  order_id: string | null;
  customers?: { name: string; address: string } | null;
  orders?: { code: string; total_sell: number; status: string } | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
function fmtShort(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ScheduleAdmin({
  customers,
  drivers,
  schedule,
}: {
  customers: { id: string; name: string; address: string }[];
  drivers: { id: string; name: string }[];
  schedule: Sched[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(todayISO());
  const [addDriver, setAddDriver] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const dates = [...new Set(schedule.map((s) => s.date))];
  const entries = schedule.filter((s) => s.date === date);

  async function changeDriver(id: string, driverId: string) {
    await supabase.from('schedule').update({ driver_id: driverId || null }).eq('id', id);
    router.refresh();
  }
  async function del(id: string) {
    if (!confirm('ลบร้านนี้ออกจากคิว?')) return;
    await supabase.from('schedule').delete().eq('id', id);
    router.refresh();
  }
  async function addEntries() {
    const rows = customers
      .filter((c) => picked[c.id])
      .filter((c) => !schedule.some((s) => s.date === addDate && s.customer_id === c.id))
      .map((c) => ({ date: addDate, customer_id: c.id, driver_id: addDriver || null }));
    if (!rows.length) {
      setShowAdd(false);
      return;
    }
    setSaving(true);
    await supabase.from('schedule').insert(rows);
    setSaving(false);
    setShowAdd(false);
    setPicked({});
    setDate(addDate);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-1">ตารางจัดส่ง</h1>
      <p className="text-sm text-gray-500 mb-4">
        เลือกวันที่ → เพิ่มลูกค้าเข้าคิว → เลือกคนส่ง → คิวจะไปแสดงในเมนูของคนส่ง
      </p>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <label className="block text-xs text-gray-500">เลือกวันที่จัดคิว</label>
        <input
          type="date"
          className="border rounded-lg px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {dates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  d === date ? 'bg-green-700 text-white border-green-700' : 'bg-white'
                }`}
              >
                {fmtShort(d)} · {schedule.filter((s) => s.date === d).length}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-bold">
            {fmtDate(date)}
            {date === todayISO() && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                วันนี้
              </span>
            )}
          </h3>
          <button
            className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
            onClick={() => {
              setAddDate(date);
              setPicked({});
              setAddDriver('');
              setShowAdd(true);
            }}
          >
            + เพิ่มลูกค้า
          </button>
        </div>
        <div className="p-3">
          {entries.length === 0 && (
            <p className="text-center text-gray-400 py-6">
              ยังไม่มีคิวในวันนี้ — กด “+ เพิ่มลูกค้า”
            </p>
          )}
          {entries.map((s, idx) => (
            <div key={s.id} className="border rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start gap-2">
                <b>
                  {idx + 1}. {s.customers?.name ?? '-'}
                </b>
                <button className="text-red-500 text-sm" onClick={() => del(s.id)}>
                  ✕ ลบ
                </button>
              </div>
              {s.customers?.address && (
                <div className="text-gray-400 text-xs mt-1">📍 {s.customers.address}</div>
              )}
              <select
                className="w-full border rounded-lg px-2 py-2 mt-2 text-sm"
                value={s.driver_id ?? ''}
                onChange={(e) => changeDriver(s.id, e.target.value)}
              >
                <option value="">— เลือกคนส่ง —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    🚚 {d.name}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                {s.order_id && s.orders ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    ✔ บิล {s.orders.code} • {money(s.orders.total_sell)}
                  </span>
                ) : (
                  <Link
                    href={`/pos?customer=${s.customer_id}&sched=${s.id}`}
                    className="inline-block bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg"
                  >
                    🧾 เปิดบิล / ขายให้ร้านนี้
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setShowAdd(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">เพิ่มลูกค้าเข้าคิวส่ง</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500">วันที่</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-2 py-2"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">คนส่ง</label>
                <select
                  className="w-full border rounded-lg px-2 py-2"
                  value={addDriver}
                  onChange={(e) => setAddDriver(e.target.value)}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 mb-1">
              <label className="text-xs text-gray-500">เลือกลูกค้า (หลายร้านได้)</label>
              <button
                className="text-xs text-green-700"
                onClick={() => {
                  const all = customers.every((c) => picked[c.id]);
                  const next: Record<string, boolean> = {};
                  customers.forEach((c) => (next[c.id] = !all));
                  setPicked(next);
                }}
              >
                เลือก/ยกเลิกทั้งหมด
              </button>
            </div>
            <div className="max-h-[44vh] overflow-auto border rounded-lg">
              {customers.map((c) => (
                <label key={c.id} className="flex items-center gap-2 p-2.5 border-b">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={!!picked[c.id]}
                    onChange={(e) => setPicked({ ...picked, [c.id]: e.target.checked })}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {customers.length === 0 && (
                <div className="p-3 text-center text-gray-400">ยังไม่มีลูกค้า</div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setShowAdd(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={addEntries}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'เพิ่มเข้าคิว'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
