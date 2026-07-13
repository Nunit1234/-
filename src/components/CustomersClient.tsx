'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type Customer, type Product } from '@/lib/types';
import { money, unitInfo } from '@/lib/format';

type CustForm = {
  id?: string;
  name: string;
  phone: string;
  address: string;
  location_url: string;
};

const EMPTY: CustForm = { name: '', phone: '', address: '', location_url: '' };

export default function CustomersClient({
  initialCustomers,
  products,
}: {
  initialCustomers: Customer[];
  products: Product[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Customer[]>(initialCustomers);
  const [form, setForm] = useState<CustForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // pricing modal
  const [priceCust, setPriceCust] = useState<Customer | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState(false);

  async function reload() {
    const { data } = await supabase.from('customers').select('*').order('created_at');
    setItems((data ?? []) as Customer[]);
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setErr('กรุณากรอกชื่อลูกค้า');
      return;
    }
    setSaving(true);
    setErr('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone,
      address: form.address,
      location_url: form.location_url,
    };
    const { error } = form.id
      ? await supabase.from('customers').update(payload).eq('id', form.id)
      : await supabase.from('customers').insert(payload);
    setSaving(false);
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setForm(null);
    await reload();
  }

  async function openPrices(c: Customer) {
    setPriceCust(c);
    setPrices({});
    const { data } = await supabase
      .from('customer_prices')
      .select('product_id, price')
      .eq('customer_id', c.id);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { product_id: string; price: number }) => {
      map[r.product_id] = String(r.price);
    });
    setPrices(map);
  }

  async function savePrices() {
    if (!priceCust) return;
    setPriceSaving(true);
    const upserts: { customer_id: string; product_id: string; price: number }[] = [];
    const deletes: string[] = [];
    for (const p of products) {
      const v = (prices[p.id] ?? '').trim();
      if (v === '') deletes.push(p.id);
      else upserts.push({ customer_id: priceCust.id, product_id: p.id, price: Number(v) });
    }
    if (upserts.length) {
      await supabase.from('customer_prices').upsert(upserts);
    }
    if (deletes.length) {
      await supabase
        .from('customer_prices')
        .delete()
        .eq('customer_id', priceCust.id)
        .in('product_id', deletes);
    }
    setPriceSaving(false);
    setPriceCust(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-green-900">ลูกค้า &amp; ราคา</h1>
        <button
          onClick={() => {
            setErr('');
            setForm({ ...EMPTY });
          }}
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + เพิ่มลูกค้า
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">ชื่อ</th>
              <th className="text-left p-3">เบอร์โทร</th>
              <th className="text-left p-3">ที่อยู่</th>
              <th className="p-3">แผนที่</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone || '-'}</td>
                <td className="p-3 max-w-xs">{c.address || '-'}</td>
                <td className="p-3 text-center">
                  {c.location_url ? (
                    <a
                      href={c.location_url}
                      target="_blank"
                      className="text-blue-600"
                    >
                      📍
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => openPrices(c)}
                    className="text-green-700 hover:underline mr-3"
                  >
                    💰 ตั้งราคา
                  </button>
                  <button
                    onClick={() => {
                      setErr('');
                      setForm({
                        id: c.id,
                        name: c.name,
                        phone: c.phone,
                        address: c.address,
                        location_url: c.location_url,
                      });
                    }}
                    className="text-gray-600 hover:underline"
                  >
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  ยังไม่มีลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit customer */}
      {form && (
        <Modal onClose={() => !saving && setForm(null)}>
          <h2 className="text-lg font-bold mb-3">
            {form.id ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}
          </h2>
          <input
            className="cinput"
            placeholder="ชื่อร้าน / ชื่อลูกค้า"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="cinput"
            placeholder="เบอร์โทร"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <textarea
            className="cinput"
            placeholder="ที่อยู่"
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            className="cinput"
            placeholder="ลิงก์โลเคชัน (Google Maps)"
            value={form.location_url}
            onChange={(e) => setForm({ ...form, location_url: e.target.value })}
          />
          {err && <p className="text-red-600 text-sm mt-1">{err}</p>}
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
        </Modal>
      )}

      {/* Pricing */}
      {priceCust && (
        <Modal onClose={() => !priceSaving && setPriceCust(null)}>
          <h2 className="text-lg font-bold mb-1">ตั้งราคาขาย — {priceCust.name}</h2>
          <p className="text-xs text-gray-500 mb-2">
            เว้นว่าง = ใช้ราคาตั้งต้น • ใส่ตัวเลข = ราคาเฉพาะลูกค้านี้
          </p>
          <div className="max-h-[55vh] overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left p-2">สินค้า</th>
                  <th className="text-right p-2">ตั้งต้น</th>
                  <th className="text-right p-2">ราคาลูกค้านี้</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">
                      {p.name}
                      <span className="text-gray-400 text-xs block">
                        {unitInfo(p.unit, p.per_unit)}
                      </span>
                    </td>
                    <td className="p-2 text-right text-gray-400">
                      {money(p.default_price)}
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        className="w-24 border rounded px-2 py-1 text-right"
                        placeholder={String(p.default_price)}
                        value={prices[p.id] ?? ''}
                        onChange={(e) =>
                          setPrices({ ...prices, [p.id]: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100"
              onClick={() => setPriceCust(null)}
              disabled={priceSaving}
            >
              ยกเลิก
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-green-700 text-white disabled:opacity-60"
              onClick={savePrices}
              disabled={priceSaving}
            >
              {priceSaving ? 'กำลังบันทึก…' : 'บันทึกราคา'}
            </button>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .cinput {
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

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
