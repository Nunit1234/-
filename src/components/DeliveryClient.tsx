'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from '@/components/ImageUpload';
import { money, fmtQty } from '@/lib/format';

type DItem = { name: string; unit: string; qty: number };

type DOrder = {
  id: string;
  code: string;
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

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: 'รอออกส่ง', cls: 'bg-gray-100 text-gray-600' },
  DELIVERING: { label: 'กำลังส่ง', cls: 'bg-orange-100 text-orange-700' },
  DELIVERED: { label: 'ส่งสำเร็จ', cls: 'bg-green-100 text-green-700' },
};

// สรุปจำนวนรวมแยกตามหน่วย เช่น "60 แผง • 12 ฟอง"
function unitSummary(items: DItem[]) {
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

      {/* รายการสินค้าที่ต้องส่งให้ลูกค้ารายนี้ */}
      {items.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 mt-2 text-sm">
          <div className="text-xs text-gray-500 mb-1">🥚 ของที่ต้องส่ง</div>
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

export default function DeliveryClient({ orders }: { orders: DOrder[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [proofOrder, setProofOrder] = useState<DOrder | null>(null);
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
    if (!confirm(`แก้สถานะบิล ${o.code} กลับเป็น "${label}" ใช่ไหม`)) return;
    setBusy(o.id);
    const { error } = await supabase
      .from('orders')
      .update({ status, delivered_at: null })
      .eq('id', o.id);
    setBusy('');
    if (error) setErr('แก้สถานะไม่สำเร็จ: ' + error.message);
    else {
      setErr('');
      router.refresh();
    }
  }

  function askComplete(o: DOrder) {
    setProofUrl('');
    setReceiver('');
    setErr('');
    setProofOrder(o);
  }

  async function complete() {
    if (!proofOrder || !proofUrl) return;
    setBusy(proofOrder.id);
    const update: Record<string, unknown> = {
      status: 'DELIVERED',
      proof_url: proofUrl,
      receiver,
      delivered_at: new Date().toISOString(),
    };
    if (proofOrder.pay_method !== 'CREDIT') update.pay_status = 'PAID';
    const { error } = await supabase.from('orders').update(update).eq('id', proofOrder.id);
    setBusy('');
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setProofOrder(null);
    setProofUrl('');
    setReceiver('');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">งานส่งของฉัน</h1>

      {err && (
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

      {/* หน้าต่างยืนยันส่งสำเร็จ */}
      {proofOrder && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => busy === '' && setProofOrder(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">ยืนยันการส่งสำเร็จ</h2>
            <p className="text-sm text-gray-500 mb-1">
              {proofOrder.customers?.name} • {proofOrder.code}
            </p>
            {(proofOrder.order_items ?? []).length > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2 text-sm">
                {(proofOrder.order_items ?? []).map((it, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{it.name}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {fmtQty(Number(it.qty))} {it.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-2">📸 แนบรูปหลักฐานการส่ง</p>
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
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setProofOrder(null)}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white disabled:opacity-60"
                onClick={complete}
                disabled={!proofUrl || busy !== ''}
              >
                ยืนยันส่งสำเร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
