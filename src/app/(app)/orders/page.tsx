import { createClient } from '@/lib/supabase/server';
import OrdersClient from '@/components/OrdersClient';
import type { Role } from '@/lib/types';

export default async function OrdersPage() {
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

  const { data: orders } = await supabase
    .from('orders')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: profs } = await supabase.from('profiles').select('id, name');
  const profMap: Record<string, string> = {};
  (profs ?? []).forEach((p: { id: string; name: string }) => {
    profMap[p.id] = p.name;
  });

  let drivers: { id: string; name: string }[] = [];
  if (role === 'admin') {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'delivery')
      .eq('active', true);
    drivers = data ?? [];
  }

  return (
    <OrdersClient
      role={role}
      orders={orders ?? []}
      profMap={profMap}
      drivers={drivers}
    />
  );
}
