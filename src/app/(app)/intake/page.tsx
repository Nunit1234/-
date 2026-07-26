import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import IntakeClient from '@/components/IntakeClient';

export default async function IntakePage() {
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

  const [{ data: products }, { data: intakes }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('type').order('name'),
    supabase
      .from('stock_intakes')
      .select('*, stock_intake_items(name, unit, qty, cost)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  return (
    <IntakeClient
      products={(products ?? []) as unknown as Parameters<typeof IntakeClient>[0]['products']}
      intakes={(intakes ?? []) as unknown as Parameters<typeof IntakeClient>[0]['intakes']}
    />
  );
}
