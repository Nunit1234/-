import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionClient from '@/components/CommissionClient';

export default async function CommissionPage() {
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

  const [{ data: settings }, { data: orders }, { data: profs }, { data: commissions }] =
    await Promise.all([
      supabase.from('settings').select('commission_rate').eq('id', 1).single(),
      supabase
        .from('orders')
        .select('id, delivery_id, delivered_at, created_at, order_items(unit, qty)')
        .eq('status', 'DELIVERED')
        .not('delivery_id', 'is', null),
      supabase.from('profiles').select('id, name'),
      supabase.from('commissions').select('*').order('paid_date', { ascending: false }),
    ]);

  const profMap: Record<string, string> = {};
  (profs ?? []).forEach((p: { id: string; name: string }) => {
    profMap[p.id] = p.name;
  });

  return (
    <CommissionClient
      rate={settings?.commission_rate ?? 0.3}
      orders={(orders ?? []) as unknown as Parameters<typeof CommissionClient>[0]['orders']}
      profMap={profMap}
      commissions={commissions ?? []}
    />
  );
}
