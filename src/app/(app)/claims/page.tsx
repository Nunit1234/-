import { createClient } from '@/lib/supabase/server';
import ClaimsClient from '@/components/ClaimsClient';
import type { Role } from '@/lib/types';

export default async function ClaimsPage() {
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

  const { data: claims } = await supabase
    .from('claims')
    .select('*, customers(name), claim_items(name, unit, qty)')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: profs } = await supabase.from('profiles').select('id, name');
  const profMap: Record<string, string> = {};
  (profs ?? []).forEach((p: { id: string; name: string }) => {
    profMap[p.id] = p.name;
  });

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('active', true)
    .order('name');

  let stock: {
    product_id: string;
    qty: number;
    products: { name: string; unit: string; per_unit: number } | null;
  }[] = [];
  if (role === 'delivery') {
    const { data } = await supabase
      .from('driver_stock')
      .select('product_id, qty, products(name, unit, per_unit)')
      .eq('driver_id', user!.id)
      .gt('qty', 0);
    stock = (data ?? []) as unknown as typeof stock;
  }

  return (
    <ClaimsClient
      role={role}
      claims={(claims ?? []) as unknown as Parameters<typeof ClaimsClient>[0]['claims']}
      profMap={profMap}
      customers={customers ?? []}
      stock={stock}
    />
  );
}
