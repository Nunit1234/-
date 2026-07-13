import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExpensesClient from '@/components/ExpensesClient';

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

  const [{ data: orders }, { data: expenses }, { data: commissions }] = await Promise.all([
    supabase.from('orders').select('total_sell, total_cost').neq('status', 'CANCELLED'),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('commissions').select('amount'),
  ]);

  const revenue = (orders ?? []).reduce(
    (s: number, o: { total_sell: number }) => s + Number(o.total_sell),
    0
  );
  const cogs = (orders ?? []).reduce(
    (s: number, o: { total_cost: number }) => s + Number(o.total_cost),
    0
  );
  const commTotal = (commissions ?? []).reduce(
    (s: number, c: { amount: number }) => s + Number(c.amount),
    0
  );

  return (
    <ExpensesClient
      revenue={revenue}
      cogs={cogs}
      commTotal={commTotal}
      expenses={expenses ?? []}
    />
  );
}
