'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/storage';
import { EGG_TYPES, UNIT_PER, type Product } from '@/lib/types';
import { money, fmtQty, unitInfo } from '@/lib/format';

type FormState = {
  id?: string;
  name: string;
  type: string;
  size: string;
  unit: string;
  per_unit: number;
  cost: number;
  default_price: number;
  stock: number;
  image_url: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: '',
  type: 'DUCK',
  size: '-',
  unit: 'แผง',
  per_unit: 30,
  cost: 0,
  default_price: 0,
  stock: 0,
  image_url: '',
  active: true,
};

export default function ProductsClient({ initial }: { initial: Product[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<Product[]>(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function reload() {
    const { data } = await supabase.from('products').select('*').order('created_at');
    setItems((data ?? []) as Product[]);
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setErr('กรุณากรอกชื่อสินค้า');
      return;
    }
    setSaving(true);
    setErr('');
    const payload = {
      name: form.name.trim(),
      type: form.type,
      size: form.size.trim() || '-',
      unit: form.unit,
      per_unit: Number(form.per_unit) || 1,
      cost: Number(form.cost) || 0,
      default_price: Number(form.default_price) || 0,
      stock: Number(form.stock) || 0,
      image_url: form.image_url || '',
      active: !!form.active,
    };
    const { error } = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id)
      : await supabase.from('products').insert(payload);
    setSaving(false);
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setForm(null);
    await reload();
  }

  async function onImage(file: File) {
    setSaving(true);
    setErr('');
    try {
      const url = await uploadImage(file, 'products');
      setForm((f) => (f ? { ...f, image_url: url } : f));
    } catch (e) {
      setErr('อัปโหลดรูปไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-green-900">สินค้า &amp; สต๊อก</h1>
        <button
          onClick={() => {
            setErr('');
            setForm({ ...EMPTY });
          }}
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + เพิ่มสินค้า
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">สินค้า</th>
              <th className="text-left p-3">ประเภท</th>
              <th className="text-right p-3">ทุน</th>
              <th className="text-right p-3">ราคาขาย</th>
              <th className="text-right p-3">กำไร</th>
              <th className="text-right p-3">สต๊อก</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded bg-green-50 flex items-center justify-center flex-shrink-0">
                        🥚
                      </span>
                    )}
                    <div>
                      <div className="font-medium">
                        {p.name}
                        {!p.active && (
                          <span className="ml-1 text-xs bg-gray-200 text-gray-500 px-1.5 rounded">
                            ปิด
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {unitInfo(p.unit, p.per_unit)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{EGG_TYPES[p.type] || p.type}</td>
                <td className="p-3 text-right">{money(p.cost)}</td>
                <td className="p-3 text-right">{money(p.default_price)}</td>
                <td className="p-3 text-right text-green-700">
                  {money(p.default_price - p.cost)}
                </td>
                <td className="p-3 text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      p.stock <= 15
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {fmtQty(p.stock)} {p.unit}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => {
                      setErr('');
                      setForm({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        size: p.size,
                        unit: p.unit,
                        per_unit: p.per_unit,
                        cost: p.cost,
                        default_price: p.default_price,
                        stock: p.stock,
                        image_url: p.image_url,
                        active: p.active,
                      });
                    }}
                    className="text-green-700 hover:underline"
                  >
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  ยังไม่มีสินค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {form && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setForm(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-3">
              {form.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
            </h2>

            <Field label="ชื่อสินค้า">
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="ประเภท">
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(EGG_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ไซส์ / เบอร์">
                <input
                  className="input"
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="เช่น 00, 1 หรือ -"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="หน่วยขาย">
                <select
                  className="input"
                  value={form.unit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unit: e.target.value,
                      per_unit: UNIT_PER[e.target.value] ?? form.per_unit,
                    })
                  }
                >
                  {Object.keys(UNIT_PER).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ฟองต่อหน่วย">
                <input
                  className="input"
                  type="number"
                  value={form.per_unit}
                  onChange={(e) =>
                    setForm({ ...form, per_unit: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="ทุน/หน่วย">
                <input
                  className="input"
                  type="number"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                />
              </Field>
              <Field label="ราคาขายตั้งต้น">
                <input
                  className="input"
                  type="number"
                  value={form.default_price}
                  onChange={(e) =>
                    setForm({ ...form, default_price: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="สต๊อก">
                <input
                  className="input"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="รูปสินค้า">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
              />
              {form.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image_url}
                  alt=""
                  className="w-20 h-20 object-cover rounded mt-2"
                />
              )}
            </Field>

            {form.id && (
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                เปิดใช้งานสินค้านี้
              </label>
            )}

            {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white disabled:opacity-60"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
