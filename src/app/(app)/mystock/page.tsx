import { createClient } from '@/lib/supabase/server';
import { fmtQty } from '@/lib/format';

type Row = { qty: number; products: { name: string; unit: string } | null };

export default async function MyStockPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('driver_stock')
    .select('qty, products(name, unit)')
    .eq('driver_id', user!.id)
    .gt('qty', 0);
  const rows = (data ?? []) as unknown as Row[];
  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-1">สต๊อกของฉัน</h1>
      <p className="text-sm text-gray-500 mb-4">
        สต๊อกบนรถ (แอดมินเป็นผู้จ่ายให้) — หน้าขายจะตัดจากสต๊อกนี้
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-gray-500 text-sm">รวมบนรถ</div>
          <div className="text-2xl font-bold text-green-800">{fmtQty(total)} หน่วย</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-gray-500 text-sm">ชนิดสินค้า</div>
          <div className="text-2xl font-bold text-green-800">{rows.length}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between p-3">
            <span>{r.products?.name ?? '-'}</span>
            <span className="font-bold text-green-800">
              {fmtQty(r.qty)} {r.products?.unit ?? ''}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            ยังไม่มีสต๊อก — ให้แอดมินจ่ายสต๊อกให้ก่อน
          </div>
        )}
      </div>
    </div>
  );
}
