import { createClient } from '@/lib/supabase/server';
import ScheduleAdmin from '@/components/ScheduleAdmin';
import Link from 'next/link';
import type { Role } from '@/lib/types';

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

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const role = (profile?.role ?? 'delivery') as Role;

  if (role === 'admin') {
    const [{ data: customers }, { data: drivers }, { data: sched }] = await Promise.all([
      supabase.from('customers').select('id, name, address').eq('active', true).order('name'),
      supabase.from('profiles').select('id, name').eq('role', 'delivery').eq('active', true),
      supabase
        .from('schedule')
        .select('*, customers(name, address), orders(code, total_sell, status)')
        .gte('date', todayISO())
        .order('date')
        .order('created_at'),
    ]);
    return (
      <ScheduleAdmin
        customers={customers ?? []}
        drivers={drivers ?? []}
        schedule={
          (sched ?? []) as unknown as Parameters<typeof ScheduleAdmin>[0]['schedule']
        }
      />
    );
  }

  // ----- Delivery view -----
  const { data: sched } = await supabase
    .from('schedule')
    .select('*, customers(name, phone, address, location_url), orders(code, status)')
    .eq('driver_id', user!.id)
    .gte('date', todayISO())
    .order('date')
    .order('created_at');

  type Row = {
    id: string;
    date: string;
    customer_id: string;
    order_id: string | null;
    customers?: {
      name: string;
      phone: string;
      address: string;
      location_url: string;
    } | null;
    orders?: { code: string; status: string } | null;
  };
  const rows = (sched ?? []) as unknown as Row[];
  const dates = [...new Set(rows.map((r) => r.date))];

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-green-900 mb-4">ตารางงานของฉัน</h1>
      {dates.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          ยังไม่มีคิวส่งที่จัดให้คุณ
        </div>
      )}
      {dates.map((d) => (
        <div key={d} className="bg-white rounded-xl shadow mb-4">
          <div className="p-3 border-b font-bold">
            {fmtDate(d)}
            {d === todayISO() && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                วันนี้
              </span>
            )}
          </div>
          <div className="p-2">
            {rows
              .filter((r) => r.date === d)
              .map((r, idx) => (
                <div key={r.id} className="border rounded-lg p-3 mb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <b>
                        {idx + 1}. {r.customers?.name ?? '-'}
                      </b>
                      <div className="text-gray-500 text-xs">
                        📞 {r.customers?.phone || '-'}
                        <br />📍 {r.customers?.address || '-'}
                      </div>
                    </div>
                    {r.customers?.location_url && (
                      <a
                        href={r.customers.location_url}
                        target="_blank"
                        className="bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      >
                        🧭 นำทาง
                      </a>
                    )}
                  </div>
                  <div className="mt-2">
                    {r.order_id && r.orders ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        ✔ มีบิล {r.orders.code}
                      </span>
                    ) : (
                      <Link
                        href={`/pos?customer=${r.customer_id}&sched=${r.id}`}
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
      ))}
    </div>
  );
}
