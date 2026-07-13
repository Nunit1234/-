'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/format';

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
};

const CAT: Record<string, string> = {
  WAGE: 'ค่าแรง',
  COMMISSION: 'ค่าคอมมิชชั่น',
  FUEL: 'ค่าน้ำมัน',
  OTHER: 'อื่นๆ',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesClient({
  revenue,
  cogs,
  commTotal,
  expenses,
}: {
  revenue: number;
  cogs: number;
  commTotal: number;
  expenses: Expense[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), category: 'WAGE', amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  const cat = { WAGE: 0, COMMISSION: commTotal, FUEL: 0, OTHER: 0 };
  for (const e of expenses) {
    if (e.category in cat) cat[e.category as keyof typeof cat] += Number(e.amount);
  }
  const gross = revenue - cogs;
  const totalExp = cat.WAGE + cat.COMMISSION + cat.FUEL + cat.OTHER;
  const net = gross - totalExp;

  async function add() {
    const amt = Number(form.amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    await supabase.from('expenses').insert({
      date: form.date,
      category: form.category,
      amount: amt,
      note: form.note,
    });
    setSaving(false);
    setOpen(false);
    setForm({ date: todayISO(), category: 'WAGE', amount: '', note: '' });
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm('ลบรายการค่าใช้จ่ายนี้?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    router.refresh();
  }

  const Row = ({ k, v, neg }: { k: string; v: number; neg?: boolean }) => (
    <div className="flex justify-between py-2 border-b">
      <span>{k}</span>
      <span className={neg ? 'text-red-600' : ''}>
        {neg ? '−' : ''}
        {money(v)}
      </span>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">
        บัญชี &amp; งบกำไรขาดทุน
      </h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">📊 งบกำไรขาดทุน (รวมทั้งหมด)</h3>
        <Row k="รายได้จากการขาย" v={revenue} />
        <Row k="หัก ต้นทุนสินค้า" v={cogs} neg />
        <div className="flex justify-between py-2 border-b font-semibold">
          <span>กำไรขั้นต้น</span>
          <span className="text-green-700">{money(gross)}</span>
        </div>
        <Row k="หัก ค่าแรง" v={cat.WAGE} neg />
        <Row k="หัก ค่าคอมมิชชั่น" v={cat.COMMISSION} neg />
        <Row k="หัก ค่าน้ำมัน" v={cat.FUEL} neg />
        <Row k="หัก อื่นๆ" v={cat.OTHER} neg />
        <div className="flex justify-between pt-3 mt-1 border-t-2 border-black font-bold text-lg">
          <span>กำไรสุทธิ</span>
          <span className={net >= 0 ? 'text-green-700' : 'text-red-600'}>{money(net)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-bold">รายการค่าใช้จ่าย</h3>
          <button
            className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
            onClick={() => setOpen(true)}
          >
            + เพิ่มค่าใช้จ่าย
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-2">วันที่</th>
              <th className="text-left p-2">ประเภท</th>
              <th className="text-left p-2">รายละเอียด</th>
              <th className="text-right p-2">จำนวน</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.date}</td>
                <td className="p-2">{CAT[e.category] ?? e.category}</td>
                <td className="p-2">{e.note || '-'}</td>
                <td className="p-2 text-right">{money(e.amount)}</td>
                <td className="p-2 text-right">
                  <button className="text-red-500" onClick={() => del(e.id)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  ยังไม่มีค่าใช้จ่าย
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
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">เพิ่มค่าใช้จ่าย</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">วันที่</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-2 py-2"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">ประเภท</label>
                <select
                  className="w-full border rounded-lg px-2 py-2"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="WAGE">ค่าแรง</option>
                  <option value="FUEL">ค่าน้ำมัน</option>
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>
            </div>
            <label className="text-xs text-gray-500">จำนวนเงิน</label>
            <input
              type="number"
              className="w-full border rounded-lg px-2 py-2 mb-2"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <label className="text-xs text-gray-500">รายละเอียด</label>
            <input
              className="w-full border rounded-lg px-2 py-2"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={add}
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
