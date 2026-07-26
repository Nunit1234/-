'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { productImage, type Product } from '@/lib/types';
import { money, fmtQty } from '@/lib/format';

type IntakeItem = { name: string; unit: string; qty: number; cost: number; sell_price?: number };

type Intake = {
  id: string;
  source: string;
  date: string;
  supplier: string;
  note: string;
  total_cost: number;
  created_at: string;
  stock_intake_items?: IntakeItem[];
};

const SOURCE: Record<string, { label: string; cls: string; icon: string }> = {
  FARM: { label: 'ฟาร์มของเรา', cls: 'bg-green-100 text-green-700', icon: '🐣' },
  SUPPLIER: { label: 'ร้านค้าส่ง', cls: 'bg-blue-100 text-blue-700', icon: '🏪' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function IntakeClient({
  products,
  intakes,
}: {
  products: Product[];
  intakes: Intake[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [source, setSource] = useState('FARM');
  const [date, setDate] = useState(todayISO());
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  // ทุนและราคาขายของรอบนี้ ตั้งต้นจากค่าเดิมของสินค้า บันทึกแล้วจะกลายเป็นค่าล่าสุดของสินค้า
  const [cost, setCost] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [openId, setOpenId] = useState('');

  const visible = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products;

  const numOr = (raw: string | undefined, fallback: number) => {
    if (raw !== undefined && raw !== '') {
      const n = Number(raw);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return fallback;
  };
  const costOf = (p: Product) => numOr(cost[p.id], Number(p.cost));
  const priceOf = (p: Product) => numOr(price[p.id], Number(p.default_price));

  const lines = Object.entries(qty).filter(([, q]) => q > 0);
  const totalCost = lines.reduce((s, [pid, q]) => {
    const p = products.find((x) => x.id === pid);
    return s + (p ? costOf(p) : 0) * q;
  }, 0);
  // สินค้าที่ทุนหรือราคาขายรอบนี้ต่างจากที่ตั้งไว้ในหน้าสินค้า
  const changed = lines
    .map(([pid]) => products.find((x) => x.id === pid))
    .filter(
      (p): p is Product =>
        !!p && (costOf(p) !== Number(p.cost) || priceOf(p) !== Number(p.default_price))
    );

  async function save() {
    if (!lines.length) {
      setErr('ยังไม่ได้ใส่จำนวนไข่ที่รับเข้า');
      return;
    }
    setSaving(true);
    setErr('');
    const items = lines.map(([pid, q]) => {
      const p = products.find((x) => x.id === pid)!;
      return {
        product_id: pid,
        qty: q,
        name: p.name,
        unit: p.unit,
        cost: costOf(p),
        sell_price: priceOf(p),
      };
    });
    const { error } = await supabase.rpc('create_intake', {
      p_source: source,
      p_date: date,
      p_supplier: source === 'SUPPLIER' ? supplier : '',
      p_note: note,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setOkMsg(`รับไข่เข้าคลังแล้ว ${items.length} รายการ • ต้นทุนรวม ${money(totalCost)}`);
    setQty({});
    setCost({});
    setPrice({});
    setNote('');
    setSupplier('');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-1">รับไข่เข้าคลัง</h1>
      <p className="text-sm text-gray-500 mb-4">
        บันทึกไข่ที่เก็บได้จากฟาร์มของเรา หรือที่รับมาจากร้านค้าส่ง ระบบจะบวกเข้าสต๊อกกลางให้ทันที
      </p>

      {okMsg && (
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-2">
          <span>✔ {okMsg}</span>
          <button className="underline whitespace-nowrap" onClick={() => setOkMsg('')}>
            รับเข้าอีก
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        {/* ซ้าย: เลือกสินค้า */}
        <div>
          <div className="bg-white rounded-xl shadow p-3 mb-3">
            <div className="flex gap-2 mb-2">
              {Object.entries(SOURCE).map(([k, s]) => (
                <button
                  key={k}
                  className={`flex-1 border rounded-lg py-2 text-sm font-semibold ${
                    source === k ? 'bg-green-700 text-white border-green-700' : 'bg-white'
                  }`}
                  onClick={() => setSource(k)}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-500">วันที่รับเข้า</label>
                <input
                  type="date"
                  className="border rounded-lg px-2 py-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {source === 'SUPPLIER' && (
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-gray-500">ชื่อร้านค้าส่ง</label>
                  <input
                    className="w-full border rounded-lg px-2 py-2"
                    placeholder="เช่น ล้งไข่พี่หมู"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <input
            className="w-full border rounded-lg px-3 py-2 mb-2 bg-white"
            placeholder="🔍 ค้นหาสินค้า…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="bg-white rounded-xl shadow divide-y max-h-[60vh] overflow-auto">
            {visible.map((p) => {
              const q = qty[p.id] ?? 0;
              return (
                <div key={p.id} className={`flex items-center gap-3 p-3 ${q > 0 ? 'bg-green-50' : ''}`}>
                  {productImage(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImage(p)}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 text-xl">
                      🥚
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      ในคลังตอนนี้ {fmtQty(Number(p.stock))} {p.unit}
                    </div>
                    {q > 0 && (
                      <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">ทุน</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            className={`w-20 border rounded-lg px-2 py-1 text-sm ${
                              costOf(p) !== Number(p.cost) ? 'border-amber-400 bg-amber-50' : ''
                            }`}
                            value={cost[p.id] ?? String(Number(p.cost))}
                            onChange={(e) => setCost({ ...cost, [p.id]: e.target.value })}
                            onFocus={(e) => e.target.select()}
                          />
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">ราคาขาย</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            className={`w-20 border rounded-lg px-2 py-1 text-sm ${
                              priceOf(p) !== Number(p.default_price)
                                ? 'border-amber-400 bg-amber-50'
                                : ''
                            }`}
                            value={price[p.id] ?? String(Number(p.default_price))}
                            onChange={(e) => setPrice({ ...price, [p.id]: e.target.value })}
                            onFocus={(e) => e.target.select()}
                          />
                        </span>
                        <span className="text-xs text-gray-500">
                          ทุนรวม {money(costOf(p) * q)}
                        </span>
                        {priceOf(p) < costOf(p) ? (
                          <span className="text-xs text-red-600">⚠ ราคาขายต่ำกว่าทุน</span>
                        ) : (
                          <span className="text-xs text-green-700">
                            กำไร {money(priceOf(p) - costOf(p))}/{p.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="w-8 h-8 border rounded-lg"
                      onClick={() => setQty({ ...qty, [p.id]: Math.max(0, q - 1) })}
                    >
                      −
                    </button>
                    <input
                      className="w-14 text-center border rounded-lg py-1"
                      type="number"
                      value={q}
                      onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, Number(e.target.value)) })}
                    />
                    <button
                      className="w-8 h-8 border rounded-lg"
                      onClick={() => setQty({ ...qty, [p.id]: q + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="p-8 text-center text-gray-400">ไม่พบสินค้า</div>
            )}
          </div>
        </div>

        {/* ขวา: สรุป */}
        <div>
          <div className="bg-white rounded-xl shadow p-4 md:sticky md:top-4">
            <h3 className="font-bold mb-2">📥 สรุปการรับเข้า</h3>
            <div className="text-sm text-gray-500 mb-2">
              แหล่งที่มา{' '}
              <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE[source].cls}`}>
                {SOURCE[source].icon} {SOURCE[source].label}
              </span>
            </div>
            {lines.length === 0 ? (
              <p className="text-gray-400 text-sm py-2">ยังไม่ได้ใส่จำนวน</p>
            ) : (
              lines.map(([pid, q]) => {
                const p = products.find((x) => x.id === pid)!;
                return (
                  <div key={pid} className="flex justify-between text-sm py-1 border-b border-dashed">
                    <span>
                      {p.name}
                      <span className="text-gray-400">
                        {' '}
                        × {fmtQty(q)} {p.unit}
                      </span>
                    </span>
                    <span>{money(costOf(p) * q)}</span>
                  </div>
                );
              })
            )}
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>ต้นทุนรวม</span>
              <span className="text-green-800">{money(totalCost)}</span>
            </div>

            {changed.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 text-xs">
                <div className="font-semibold text-amber-800 mb-1">
                  จะอัปเดตทุน/ราคาขายของสินค้า {changed.length} รายการ
                </div>
                {changed.map((p) => (
                  <div key={p.id} className="text-gray-600">
                    • {p.name}
                    {costOf(p) !== Number(p.cost) && (
                      <> ทุน {money(Number(p.cost))} → {money(costOf(p))}</>
                    )}
                    {priceOf(p) !== Number(p.default_price) && (
                      <>
                        {' '}
                        ราคาขาย {money(Number(p.default_price))} → {money(priceOf(p))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="block text-xs text-gray-500 mt-3">หมายเหตุ (ถ้ามี)</label>
            <input
              className="w-full border rounded-lg px-2 py-2 mb-2"
              placeholder="เช่น เก็บรอบเช้า เล้า 2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

            <button
              className="w-full bg-green-700 hover:bg-green-800 text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
              onClick={save}
              disabled={saving || lines.length === 0}
            >
              {saving ? 'กำลังบันทึก…' : '✔ บันทึกเข้าสต๊อกกลาง'}
            </button>
            <button className="w-full mt-2 text-sm text-gray-500" onClick={() => setQty({})}>
              ล้างรายการ
            </button>
          </div>
        </div>
      </div>

      {/* ประวัติการรับเข้า */}
      <div className="bg-white rounded-xl shadow mt-4">
        <h3 className="font-bold p-3 border-b">📜 ประวัติการรับเข้า</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-2">วันที่</th>
              <th className="text-left p-2">แหล่งที่มา</th>
              <th className="text-left p-2">รายละเอียด</th>
              <th className="text-right p-2">ต้นทุนรวม</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {intakes.map((r) => {
              const s = SOURCE[r.source] ?? { label: r.source, cls: 'bg-gray-100', icon: '📦' };
              const items = r.stock_intake_items ?? [];
              const open = openId === r.id;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{r.date}</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
                      {s.icon} {s.label}
                    </span>
                    {r.supplier && <div className="text-xs text-gray-500 mt-0.5">{r.supplier}</div>}
                  </td>
                  <td className="p-2">
                    <div className="text-gray-500">
                      {items.length} รายการ
                      {r.note && ` • ${r.note}`}
                    </div>
                    {open && (
                      <div className="mt-1 bg-green-50 rounded-lg p-2">
                        {items.map((it, i) => (
                          <div key={i} className="flex justify-between gap-2 py-0.5">
                            <span>{it.name}</span>
                            <span className="whitespace-nowrap text-gray-600">
                              {fmtQty(Number(it.qty))} {it.unit} • ทุน {money(it.cost)}
                              {Number(it.sell_price) > 0 && <> • ขาย {money(it.sell_price)}</>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right font-semibold whitespace-nowrap">
                    {money(r.total_cost)}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      className="text-green-700 underline whitespace-nowrap"
                      onClick={() => setOpenId(open ? '' : r.id)}
                    >
                      {open ? 'ซ่อน' : 'ดูรายการ'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {intakes.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  ยังไม่มีประวัติการรับเข้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
