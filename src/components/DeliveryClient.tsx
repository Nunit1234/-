'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from '@/components/ImageUpload';
import { money, fmtQty } from '@/lib/format';

type DItem = {
  product_id: string | null;
  name: string;
  unit: string;
  qty: number;
  sell_price: number;
  cost: number;
};

type DOrder = {
  id: string;
  code: string;
  customer_id: string;
  status: string;
  pay_method: string;
  total_sell: number;
  proof_url: string;
  receiver?: string;
  customers?: {
    name: string;
    phone: string;
    address: string;
    location_url: string;
  } | null;
  order_items?: DItem[];
};

type LiteProduct = {
  id: string;
  name: string;
  unit: string;
  cost: number;
  default_price: number;
};

// แถวที่คนส่งกำลังคีย์ยอดจริง (qty/price เก็บเป็นข้อความ เพื่อให้ลบตัวเลขในช่องได้)
type EditRow = {
  product_id: string | null;
  name: string;
  unit: string;
  cost: number;
  qty: string;
  price: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: 'รอออกส่ง', cls: 'bg-gray-100 text-gray-600' },
  DELIVERING: { label: 'กำลังส่ง', cls: 'bg-orange-100 text-orange-700' },
  DELIVERED: { label: 'ส่งสำเร็จ', cls: 'bg-green-100 text-green-700' },
};

const num = (s: string) => {
  const n = Number(s);
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

function unitSummary(items: { unit: string; qty: number }[]) {
  const byUnit: Record<string, number> = {};
  for (const it of items) byUnit[it.unit] = (byUnit[it.unit] ?? 0) + Number(it.qty);
  return Object.entries(byUnit)
    .map(([u, q]) => `${fmtQty(q)} ${u}`)
    .join(' • ');
}

function Card({
  o,
  busy,
  onStart,
  onComplete,
  onRollback,
}: {
  o: DOrder;
  busy: string;
  onStart: (o: DOrder) => void;
  onComplete: (o: DOrder) => void;
  onRollback: (o: DOrder, status: string) => void;
}) {
  const c = o.customers;
  const items = o.order_items ?? [];
  const st = STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' };
  const working = busy === o.id;

  return (
    <div className="border rounded-xl p-4 mb-3">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div>
          <div className="font-bold">
            {c?.name ?? '-'} <span className="text-gray-400 text-sm">{o.code}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {c?.phone ? (
              <a href={`tel:${c.phone}`} className="text-gray-500 text-sm">
                📞 {c.phone}
              </a>
            ) : (
              <span className="text-gray-400 text-sm">📞 -</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-800">{money(o.total_sell)}</div>
          <div className="text-xs text-gray-500">
            {o.pay_method === 'CREDIT' ? 'เก็บเงินเชื่อ' : 'เก็บเงิน'}
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 mt-2 text-sm">
          <div className="text-xs text-gray-500 mb-1">
            {o.status === 'DELIVERED' ? '🥚 ส่งจริง' : '🥚 ของที่ต้องส่ง (ตามใบสั่ง)'}
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5">
              <span className="min-w-0">{it.name}</span>
              <span className="font-semibold whitespace-nowrap">
                {fmtQty(Number(it.qty))} {it.unit}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-green-200 mt-1 pt-1 text-xs text-gray-500">
            <span>รวม {items.length} รายการ</span>
            <span className="font-semibold">{unitSummary(items)}</span>
          </div>
        </div>
      )}

      <div className="text-gray-500 text-sm my-2">📍 {c?.address || '-'}</div>

      {o.status === 'DELIVERED' && o.receiver && (
        <div className="text-gray-500 text-sm mb-2">📝 ผู้รับ: {o.receiver}</div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {c?.location_url && (
          <a
            href={c.location_url}
            target="_blank"
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg"
          >
            🧭 นำทาง
          </a>
        )}

        {o.status === 'CONFIRMED' && (
          <button
            className="bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-60"
            onClick={() => onStart(o)}
            disabled={working}
          >
            🚚 เริ่มออกส่ง
          </button>
        )}

        {o.status === 'DELIVERING' && (
          <>
            <button
              className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-60"
              onClick={() => onComplete(o)}
              disabled={working}
            >
              ✔ ส่งสำเร็จ
            </button>
            <button
              className="border border-gray-300 text-gray-600 text-sm px-3 py-1.5 rounded-lg disabled:opacity-60"
              onClick={() => onRollback(o, 'CONFIRMED')}
              disabled={working}
            >
              ↩ ยังไม่ได้ออกส่ง
            </button>
          </>
        )}

        {o.status === 'DELIVERED' && (
          <>
            {o.proof_url && (
              <a href={o.proof_url} target="_blank" className="text-blue-600 text-sm underline">
                📸 ดูหลักฐาน
              </a>
            )}
            <button
              className="border border-orange-300 text-orange-700 text-sm px-3 py-1.5 rounded-lg disabled:opacity-60"
              onClick={() => onRollback(o, 'DELIVERING')}
              disabled={working}
            >
              ↩ กดผิด แก้เป็นกำลังส่ง
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DeliveryClient({
  orders,
  products,
  vanStock,
}: {
  orders: DOrder[];
  products: LiteProduct[];
  vanStock: Record<string, number>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [proofOrder, setProofOrder] = useState<DOrder | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [addId, setAddId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [receiver, setReceiver] = useState('');
  const [err, setErr] = useState('');

  const active = orders.filter((o) => o.status !== 'DELIVERED');
  const done = orders.filter((o) => o.status === 'DELIVERED');

  async function start(o: DOrder) {
    setBusy(o.id);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'DELIVERING' })
      .eq('id', o.id);
    setBusy('');
    if (error) setErr('เปลี่ยนสถานะไม่สำเร็จ: ' + error.message);
    else router.refresh();
  }

  // ย้อนสถานะกรณีกดผิด — ไม่แตะสถานะการชำระเงิน เพราะอาจรับเงินมาแล้วจริง
  async function rollback(o: DOrder, status: string) {
    const label = STATUS[status]?.label ?? status;
    const warn = o.status === 'DELIVERED' ? '\n\nระบบจะคืนของที่ตัดไปแล้วกลับเข้าสต๊อกบนรถให้' : '';
    if (!confirm(`แก้สถานะบิล ${o.code} กลับเป็น "${label}" ใช่ไหม${warn}`)) return;
    setBusy(o.id);
    // ผ่าน RPC เพื่อให้คืนของกลับเข้าสต๊อกด้วย ไม่งั้นกดส่งใหม่จะตัดซ้ำ
    const { error } = await supabase.rpc('reopen_delivery', {
      p_order: o.id,
      p_status: status,
    });
    setBusy('');
    if (error) setErr('แก้สถานะไม่สำเร็จ: ' + error.message);
    else {
      setErr('');
      router.refresh();
    }
  }

  // เปิดหน้าจอคีย์ยอดจริง โดยตั้งต้นจากใบสั่ง
  async function askComplete(o: DOrder) {
    setProofUrl('');
    setReceiver('');
    setAddId('');
    setErr('');
    setRows(
      (o.order_items ?? []).map((it) => ({
        product_id: it.product_id,
        name: it.name,
        unit: it.unit,
        cost: Number(it.cost),
        qty: String(Number(it.qty)),
        price: String(Number(it.sell_price)),
      }))
    );
    setProofOrder(o);
  }

  // ราคาประจำร้านของลูกค้ารายนี้ (ถ้าเคยตั้งไว้) ไม่งั้นใช้ราคากลาง
  async function addProduct(pid: string) {
    const p = products.find((x) => x.id === pid);
    if (!p || !proofOrder) return;
    if (rows.some((r) => r.product_id === pid)) {
      setErr('รายการนี้มีอยู่ในบิลแล้ว แก้จำนวนที่บรรทัดเดิมได้เลย');
      return;
    }
    const { data } = await supabase
      .from('customer_prices')
      .select('price')
      .eq('customer_id', proofOrder.customer_id)
      .eq('product_id', pid)
      .maybeSingle();
    setRows((rs) => [
      ...rs,
      {
        product_id: pid,
        name: p.name,
        unit: p.unit,
        cost: Number(p.cost),
        qty: '1',
        price: String(Number(data?.price ?? p.default_price)),
      },
    ]);
    setAddId('');
    setErr('');
  }

  const realTotal = rows.reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  const diff = proofOrder ? realTotal - Number(proofOrder.total_sell) : 0;

  async function complete() {
    if (!proofOrder || !proofUrl) return;
    const items = rows
      .filter((r) => num(r.qty) > 0)
      .map((r) => ({
        product_id: r.product_id,
        qty: num(r.qty),
        sell_price: num(r.price),
        cost: r.cost,
        name: r.name,
        unit: r.unit,
      }));
    if (!items.length) {
      setErr('ต้องมีอย่างน้อย 1 รายการที่ส่งจริง');
      return;
    }
    setBusy(proofOrder.id);
    const { error } = await supabase.rpc('complete_delivery', {
      p_order: proofOrder.id,
      p_items: items,
      p_proof: proofUrl,
      p_receiver: receiver,
    });
    setBusy('');
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setProofOrder(null);
    setRows([]);
    setProofUrl('');
    setReceiver('');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">งานส่งของฉัน</h1>

      {err && !proofOrder && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3 text-sm">
          {err}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">🚚 งานที่ต้องส่ง ({active.length})</h3>
        {active.length ? (
          active.map((o) => (
            <Card
              key={o.id}
              o={o}
              busy={busy}
              onStart={start}
              onComplete={askComplete}
              onRollback={rollback}
            />
          ))
        ) : (
          <p className="text-gray-400 text-center py-4">ไม่มีงานที่ต้องส่งตอนนี้ 👍</p>
        )}
      </div>

      {done.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-bold mb-2">✅ ส่งสำเร็จแล้ว ({done.length})</h3>
          <p className="text-xs text-gray-400 mb-2">
            กดผิดใช่ไหม แก้กลับเป็นกำลังส่งได้ที่ปุ่มในแต่ละบิล
          </p>
          {done.map((o) => (
            <Card
              key={o.id}
              o={o}
              busy={busy}
              onStart={start}
              onComplete={askComplete}
              onRollback={rollback}
            />
          ))}
        </div>
      )}

      {/* หน้าจอยืนยันยอดส่งจริง */}
      {proofOrder && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => busy === '' && setProofOrder(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">ยืนยันยอดส่งจริง</h2>
            <p className="text-sm text-gray-500 mb-2">
              {proofOrder.customers?.name} • {proofOrder.code}
            </p>
            <p className="text-xs text-gray-500 mb-2">
              แก้จำนวนตามที่ส่งจริงได้เลย ขายเพิ่มก็เพิ่มรายการได้ ระบบจะตัดสต๊อกตามยอดนี้เท่านั้น
            </p>

            <div className="border rounded-lg divide-y mb-2">
              {rows.map((r, i) => {
                const onVan = r.product_id ? vanStock[r.product_id] ?? 0 : 0;
                const over = num(r.qty) > onVan;
                return (
                  <div key={i} className="p-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className={`text-xs ${over ? 'text-orange-600' : 'text-gray-400'}`}>
                          บนรถมี {fmtQty(onVan)} {r.unit}
                          {over && ' • เกินของบนรถ จะหักจากคลังกลางให้'}
                        </div>
                      </div>
                      <button
                        className="text-red-500 text-xs whitespace-nowrap"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                      >
                        ลบ
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-20 border rounded-lg px-2 py-1 text-sm"
                        value={r.qty}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x))
                          )
                        }
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="text-xs text-gray-500">{r.unit} ×</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-20 border rounded-lg px-2 py-1 text-sm"
                        value={r.price}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x, idx) => (idx === i ? { ...x, price: e.target.value } : x))
                          )
                        }
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="text-xs text-gray-500">฿ =</span>
                      <span className="text-sm font-semibold ml-auto">
                        {money(num(r.qty) * num(r.price))}
                      </span>
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="p-3 text-center text-gray-400 text-sm">
                  ยังไม่มีรายการ เพิ่มด้านล่างได้
                </div>
              )}
            </div>

            <select
              className="w-full border rounded-lg px-2 py-2 mb-2 text-sm"
              value={addId}
              onChange={(e) => addProduct(e.target.value)}
            >
              <option value="">+ เพิ่มสินค้าที่ขายเพิ่มหน้างาน…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (บนรถ {fmtQty(vanStock[p.id] ?? 0)} {p.unit})
                </option>
              ))}
            </select>

            <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2 text-sm">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>ยอดตามใบสั่ง</span>
                <span>{money(proofOrder.total_sell)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>ยอดส่งจริง</span>
                <span className="text-green-800">{money(realTotal)}</span>
              </div>
              {diff !== 0 && (
                <div
                  className={`text-xs text-right ${diff > 0 ? 'text-green-700' : 'text-orange-600'}`}
                >
                  {diff > 0 ? `ขายเพิ่มได้ ${money(diff)}` : `น้อยกว่าใบสั่ง ${money(-diff)}`}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-1">📸 แนบรูปหลักฐานการส่ง</p>
            <ImageUpload
              value={proofUrl}
              onChange={setProofUrl}
              folder="proofs"
              label="แนบรูปหลักฐาน"
            />
            <input
              className="w-full border rounded-lg px-3 py-2 mt-2"
              placeholder="ผู้รับ / หมายเหตุ (ถ้ามี)"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />

            {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setProofOrder(null)}
                disabled={busy !== ''}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white disabled:opacity-60"
                onClick={complete}
                disabled={!proofUrl || busy !== ''}
              >
                {busy !== '' ? 'กำลังบันทึก…' : 'ยืนยันส่งสำเร็จ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
