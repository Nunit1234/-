'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from '@/components/ImageUpload';
import { type Customer, type Product, type Role } from '@/lib/types';
import { money, fmtQty, unitInfo } from '@/lib/format';

type SettingsLite = {
  bank_name?: string;
  account_name?: string;
  account_no?: string;
  qr_url?: string;
};

const PAY: Record<string, string> = {
  CASH: 'เงินสด',
  TRANSFER: 'โอนจ่ายทันที',
  CREDIT: 'โอนเครดิต (เชื่อ)',
};

export default function PosClient({
  role,
  products,
  customers,
  drivers,
  driverStock,
  settings,
  initialCustomerId,
  schedId,
}: {
  role: Role;
  products: Product[];
  customers: Customer[];
  drivers: { id: string; name: string }[];
  driverStock: Record<string, number>;
  settings: SettingsLite;
  initialCustomerId?: string;
  schedId?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const isAdmin = role === 'admin';

  const [customerId, setCustomerId] = useState(
    initialCustomerId || customers[0]?.id || ''
  );
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payMethod, setPayMethod] = useState('CASH');
  const [deliveryId, setDeliveryId] = useState('');
  const [slipUrl, setSlipUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [doneCode, setDoneCode] = useState('');

  // add-customer
  const [showAdd, setShowAdd] = useState(false);
  const [nc, setNc] = useState({ name: '', phone: '', address: '', location_url: '' });

  const loadPrices = useCallback(
    async (cid: string) => {
      if (!cid) return setPrices({});
      const { data } = await supabase
        .from('customer_prices')
        .select('product_id, price')
        .eq('customer_id', cid);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: { product_id: string; price: number }) => {
        map[r.product_id] = r.price;
      });
      setPrices(map);
    },
    [supabase]
  );

  useEffect(() => {
    loadPrices(customerId);
  }, [customerId, loadPrices]);

  const priceFor = (p: Product) => prices[p.id] ?? p.default_price;
  const stockOf = (p: Product) => (isAdmin ? p.stock : driverStock[p.id] ?? 0);
  const visible = isAdmin
    ? products
    : products.filter((p) => stockOf(p) > 0 || (cart[p.id] ?? 0) > 0);

  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const total = lines.reduce((s, [pid, q]) => {
    const p = products.find((x) => x.id === pid);
    return s + (p ? priceFor(p) : 0) * q;
  }, 0);
  const totalCost = lines.reduce((s, [pid, q]) => {
    const p = products.find((x) => x.id === pid);
    return s + (p ? Number(p.cost) : 0) * q;
  }, 0);

  function setQty(pid: string, q: number) {
    setCart((c) => ({ ...c, [pid]: Math.max(0, q) }));
  }

  async function submit() {
    if (!customerId) {
      setErr('เลือกลูกค้าก่อน หรือกด + ลูกค้าใหม่');
      return;
    }
    const items = lines.map(([pid, q]) => {
      const p = products.find((x) => x.id === pid)!;
      return {
        product_id: pid,
        qty: q,
        sell_price: priceFor(p),
        cost: p.cost,
        name: p.name,
        unit: p.unit,
      };
    });
    if (!items.length) return;
    if (payMethod === 'TRANSFER' && !slipUrl) {
      setErr('แนบสลิปโอนก่อนบันทึก');
      return;
    }
    setSaving(true);
    setErr('');
    const { data, error } = await supabase.rpc('create_order', {
      p_customer: customerId,
      p_delivery: isAdmin ? deliveryId || null : null,
      p_pay_method: payMethod,
      p_slip: slipUrl,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setErr('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    setDoneCode(data?.code ?? 'สำเร็จ');
    // ผูกออเดอร์กลับเข้าคิวจัดส่ง (ถ้าเปิดบิลจากคิว)
    if (schedId && data?.id) {
      await supabase.from('schedule').update({ order_id: data.id }).eq('id', schedId);
    }
    setCart({});
    setSlipUrl('');
    setPayMethod('CASH');
    router.refresh();
  }

  async function addCustomer() {
    if (!nc.name.trim()) {
      setErr('กรอกชื่อลูกค้า');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('customers')
      .insert(nc)
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      setErr('เพิ่มลูกค้าไม่สำเร็จ: ' + error.message);
      return;
    }
    setShowAdd(false);
    setNc({ name: '', phone: '', address: '', location_url: '' });
    setCustomerId(data.id);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">ขายสินค้า</h1>

      {doneCode && (
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-xl p-4 mb-4 flex items-center justify-between">
          <span>✔ บันทึกการขายแล้ว — เลขที่ {doneCode}</span>
          <button className="underline" onClick={() => setDoneCode('')}>
            ขายต่อ
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        {/* ซ้าย: ลูกค้า + สินค้า */}
        <div>
          <div className="bg-white rounded-xl shadow p-3 mb-3 flex items-center gap-2 flex-wrap">
            <span className="font-semibold">ลูกค้า</span>
            <select
              className="border rounded-lg px-2 py-2 flex-1 min-w-0"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.length === 0 && <option value="">— ยังไม่มีลูกค้า —</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm"
              onClick={() => {
                setErr('');
                setShowAdd(true);
              }}
            >
              + ลูกค้าใหม่
            </button>
          </div>

          <div className="bg-white rounded-xl shadow divide-y max-h-[60vh] overflow-auto">
            {visible.map((p) => {
              const q = cart[p.id] ?? 0;
              const st = stockOf(p);
              const custom = prices[p.id] !== undefined;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 ${
                    q > 0 ? 'bg-green-50' : ''
                  }`}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <span className="w-14 h-14 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 text-2xl">
                      🥚
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-400">
                      {unitInfo(p.unit, p.per_unit)}
                    </div>
                    <div className="text-sm font-semibold text-green-800 mt-0.5 flex flex-wrap gap-2 items-center">
                      {money(priceFor(p))}
                      {custom && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">
                          เฉพาะราย
                        </span>
                      )}
                      <span
                        className={`text-xs ${
                          st <= 0 ? 'text-red-600' : st <= 15 ? 'text-orange-600' : 'text-green-600'
                        }`}
                      >
                        • เหลือ {fmtQty(st)} {p.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="w-8 h-8 border rounded-lg"
                      onClick={() => setQty(p.id, q - 1)}
                    >
                      −
                    </button>
                    <input
                      className="w-12 text-center border rounded-lg py-1"
                      type="number"
                      value={q}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                    />
                    <button
                      className="w-8 h-8 border rounded-lg"
                      onClick={() => setQty(p.id, q + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                {isAdmin ? 'ยังไม่มีสินค้า' : 'คุณยังไม่มีสต๊อกบนรถ — ให้แอดมินจ่ายสต๊อกให้ก่อน'}
              </div>
            )}
          </div>
        </div>

        {/* ขวา: สรุป */}
        <div>
          <div className="bg-white rounded-xl shadow p-4 md:sticky md:top-4">
            <h3 className="font-bold mb-2">🧾 สรุปออเดอร์</h3>
            {lines.length === 0 ? (
              <p className="text-gray-400 text-sm py-2">ยังไม่ได้เลือกสินค้า</p>
            ) : (
              lines.map(([pid, q]) => {
                const p = products.find((x) => x.id === pid)!;
                return (
                  <div key={pid} className="flex justify-between text-sm py-1 border-b border-dashed">
                    <span>
                      {p.name}
                      <span className="text-gray-400"> × {q}</span>
                    </span>
                    <span>{money(priceFor(p) * q)}</span>
                  </div>
                );
              })
            )}
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>รวมทั้งสิ้น</span>
              <span>{money(total)}</span>
            </div>
            {isAdmin && (
              <>
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>ต้นทุน</span>
                  <span>{money(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-green-700">
                  <span>กำไร</span>
                  <span>{money(total - totalCost)}</span>
                </div>
              </>
            )}

            <label className="block text-xs text-gray-500 mt-3">วิธีชำระเงิน</label>
            <select
              className="w-full border rounded-lg px-2 py-2 mb-2"
              value={payMethod}
              onChange={(e) => {
                setPayMethod(e.target.value);
                if (e.target.value !== 'TRANSFER') setSlipUrl('');
              }}
            >
              {Object.entries(PAY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {payMethod === 'TRANSFER' && (
              <div className="bg-green-50 border rounded-lg p-3 mb-2 text-sm">
                <div className="font-semibold mb-1">โอนมาที่</div>
                {settings.qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.qr_url} alt="QR" className="w-32 mx-auto mb-1 rounded" />
                ) : null}
                <div className="text-gray-500 text-xs">
                  {settings.bank_name && <div>ธนาคาร: {settings.bank_name}</div>}
                  {settings.account_name && <div>ชื่อบัญชี: {settings.account_name}</div>}
                  {settings.account_no && <div>เลขบัญชี: {settings.account_no}</div>}
                </div>
                <label className="block text-xs text-gray-500 mt-2 mb-1">แนบสลิปโอน *</label>
                <ImageUpload
                  value={slipUrl}
                  onChange={setSlipUrl}
                  folder="slips"
                  label="แนบสลิป"
                />
              </div>
            )}

            {isAdmin ? (
              <>
                <label className="block text-xs text-gray-500">มอบหมายคนส่ง (ถ้ามี)</label>
                <select
                  className="w-full border rounded-lg px-2 py-2 mb-2"
                  value={deliveryId}
                  onChange={(e) => setDeliveryId(e.target.value)}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-gray-500 mb-2">
                ขายหน้างาน — ระบบบันทึกเป็น “ส่งสำเร็จ” โดยคุณเป็นผู้ส่ง
              </p>
            )}

            {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

            <button
              className="w-full bg-green-700 hover:bg-green-800 text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
              onClick={submit}
              disabled={saving || lines.length === 0}
            >
              {saving ? 'กำลังบันทึก…' : '✔ บันทึกการขาย'}
            </button>
            <button
              className="w-full mt-2 text-sm text-gray-500"
              onClick={() => setCart({})}
            >
              ล้างรายการ
            </button>
          </div>
        </div>
      </div>

      {/* Add customer modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setShowAdd(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-3">เพิ่มลูกค้าใหม่</h2>
            {(['name', 'phone', 'address', 'location_url'] as const).map((k) => (
              <input
                key={k}
                className="w-full border rounded-lg px-3 py-2 mb-2"
                placeholder={
                  {
                    name: 'ชื่อร้าน / ชื่อลูกค้า',
                    phone: 'เบอร์โทร',
                    address: 'ที่อยู่',
                    location_url: 'ลิงก์โลเคชัน (Google Maps)',
                  }[k]
                }
                value={nc[k]}
                onChange={(e) => setNc({ ...nc, [k]: e.target.value })}
              />
            ))}
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-4 py-2 rounded-lg bg-gray-100" onClick={() => setShowAdd(false)}>
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={addCustomer}
                disabled={saving}
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
