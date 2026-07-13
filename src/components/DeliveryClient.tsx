'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/storage';
import { money } from '@/lib/format';

type DOrder = {
  id: string;
  code: string;
  status: string;
  pay_method: string;
  total_sell: number;
  proof_url: string;
  customers?: {
    name: string;
    phone: string;
    address: string;
    location_url: string;
  } | null;
};

export default function DeliveryClient({ orders }: { orders: DOrder[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [proofOrder, setProofOrder] = useState<DOrder | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [receiver, setReceiver] = useState('');

  const active = orders.filter((o) => o.status !== 'DELIVERED');
  const done = orders.filter((o) => o.status === 'DELIVERED');

  async function start(o: DOrder) {
    setBusy(o.id);
    await supabase.from('orders').update({ status: 'DELIVERING' }).eq('id', o.id);
    setBusy('');
    router.refresh();
  }

  async function onProof(file: File) {
    setBusy('upload');
    try {
      setProofUrl(await uploadImage(file, 'proofs'));
    } catch {
      /* ignore */
    }
    setBusy('');
  }

  async function complete() {
    if (!proofOrder) return;
    if (!proofUrl) return;
    setBusy(proofOrder.id);
    const update: Record<string, unknown> = {
      status: 'DELIVERED',
      proof_url: proofUrl,
      receiver,
      delivered_at: new Date().toISOString(),
    };
    if (proofOrder.pay_method !== 'CREDIT') update.pay_status = 'PAID';
    await supabase.from('orders').update(update).eq('id', proofOrder.id);
    setBusy('');
    setProofOrder(null);
    setProofUrl('');
    setReceiver('');
    router.refresh();
  }

  function Card({ o, isDone }: { o: DOrder; isDone: boolean }) {
    const c = o.customers;
    return (
      <div className="border rounded-xl p-4 mb-3">
        <div className="flex justify-between items-start gap-2 flex-wrap">
          <div>
            <div className="font-bold">
              {c?.name ?? '-'} <span className="text-gray-400 text-sm">{o.code}</span>
            </div>
            <div className="text-gray-500 text-sm">📞 {c?.phone || '-'}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-green-800">{money(o.total_sell)}</div>
            <div className="text-xs text-gray-500">
              {o.pay_method === 'CREDIT' ? 'เก็บเงินเชื่อ' : 'เก็บเงิน'}
            </div>
          </div>
        </div>
        <div className="text-gray-500 text-sm my-2">📍 {c?.address || '-'}</div>
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
          {!isDone &&
            (o.status === 'CONFIRMED' ? (
              <button
                className="bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg"
                onClick={() => start(o)}
                disabled={busy === o.id}
              >
                🚚 เริ่มออกส่ง
              </button>
            ) : (
              <button
                className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg"
                onClick={() => {
                  setProofUrl('');
                  setReceiver('');
                  setProofOrder(o);
                }}
              >
                ✔ ส่งสำเร็จ
              </button>
            ))}
          {isDone && o.proof_url && (
            <a href={o.proof_url} target="_blank" className="text-blue-600 text-sm underline">
              📸 ดูหลักฐาน
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">งานส่งของฉัน</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-bold mb-2">🚚 งานที่ต้องส่ง ({active.length})</h3>
        {active.length ? (
          active.map((o) => <Card key={o.id} o={o} isDone={false} />)
        ) : (
          <p className="text-gray-400 text-center py-4">ไม่มีงานที่ต้องส่งตอนนี้ 👍</p>
        )}
      </div>

      {done.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-bold mb-2">✅ ส่งสำเร็จแล้ว</h3>
          {done.map((o) => (
            <Card key={o.id} o={o} isDone={true} />
          ))}
        </div>
      )}

      {/* proof modal */}
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
            <p className="text-sm text-gray-500 mb-2">📸 แนบรูปหลักฐานการส่ง</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onProof(e.target.files[0])}
            />
            {proofUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofUrl} alt="" className="max-h-40 rounded mt-2" />
            )}
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
