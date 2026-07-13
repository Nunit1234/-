import { createClient } from '@/lib/supabase/server';
import PosClient from '@/components/PosClient';
import type { Customer, Product, Role } from '@/lib/types';

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; sched?: string }>;
}) {
  const sp = await searchParams;
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

  const [{ data: customers }, { data: products }, { data: settings }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('active', true).order('name'),
      supabase.from('products').select('*').eq('active', true).order('created_at'),
      supabase.from('settings').select('*').eq('id', 1).single(),
    ]);

  let drivers: { id: string; name: string }[] = [];
  if (role === 'admin') {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'delivery')
      .eq('active', true);
    drivers = data ?? [];
  }

  const driverStock: Record<string, number> = {};
  if (role === 'delivery') {
    const { data } = await supabase
      .from('driver_stock')
      .select('product_id, qty')
      .eq('driver_id', user!.id);
    (data ?? []).forEach((r: { product_id: string; qty: number }) => {
      driverStock[r.product_id] = r.qty;
    });
  }

  return (
    <PosClient
      role={role}
      products={(products ?? []) as Product[]}
      customers={(customers ?? []) as Customer[]}
      drivers={drivers}
      driverStock={driverStock}
      settings={settings ?? {}}
      initialCustomerId={sp.customer}
      schedId={sp.sched}
    />
  );
}
