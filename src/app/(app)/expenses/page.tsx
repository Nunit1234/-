import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExpensesClient from '@/components/ExpensesClient';

type OrderRow = {
  total_sell: number;
  total_cost: number;
  delivery_id: string | null;
  delivered_at: string | null;
  created_at: string;
  order_items: { unit: string; qty: number }[];
};

type CommissionRow = { driver_id: string; date_key: string; amount: number };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  if (profile?.role !== 'admin') redirect('/');

  const [{ data: orders }, { data: expenses }, { data: commissions }, { data: settings }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('total_sell, total_cost, delivery_id, delivered_at, created_at, order_items(unit, qty)')
        .neq('status', 'CANCELLED'),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('commissions').select('driver_id, date_key, amount'),
      supabase.from('settings').select('commission_rate').eq('id', 1).maybeSingle(),
    ]);

  const rows = (orders ?? []) as unknown as OrderRow[];
  const paid = (commissions ?? []) as CommissionRow[];
  const rate = Number(settings?.commission_rate ?? 0.3);

  const revenue = rows.reduce((s, o) => s + Number(o.total_sell), 0);
  const cogs = rows.reduce((s, o) => s + Number(o.total_cost), 0);

  // ค่าคอมที่จ่ายให้คนส่งไปแล้ว (มีบันทึกในตาราง commissions)
  const commPaid = paid.reduce((s, c) => s + Number(c.amount), 0);

  // ค่าคอมค้างจ่าย: จับกลุ่มบิลตามคนส่ง + วันที่ส่ง แล้วตัดกลุ่มที่จ่ายไปแล้วออก
  // (ใช้ตรรกะเดียวกับหน้าค่าคอมมิชชั่น เพื่อให้ตัวเลขสองหน้าตรงกัน)
  const settled = new Set(paid.map((c) => c.driver_id + '|' + c.date_key));
  const panelsByGroup: Record<string, number> = {};
  for (const o of rows) {
    if (!o.delivery_id) continue;
    const key = o.delivery_id + '|' + (o.delivered_at || o.created_at).slice(0, 10);
    const panels = (o.order_items ?? [])
      .filter((i) => i.unit === 'แผง')
      .reduce((a, i) => a + Number(i.qty), 0);
    panelsByGroup[key] = (panelsByGroup[key] ?? 0) + panels;
  }
  const commPending = Object.entries(panelsByGroup)
    .filter(([key]) => !settled.has(key))
    .reduce((s, [, panels]) => s + panels * rate, 0);

  return (
    <ExpensesClient
      revenue={revenue}
      cogs={cogs}
      commPaid={commPaid}
      commPending={commPending}
      expenses={expenses ?? []}
    />
  );
}
