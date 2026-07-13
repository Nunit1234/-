import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CustomersClient from '@/components/CustomersClient';
import type { Customer, Product } from '@/lib/types';

export default async function CustomersPage() {
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

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from('customers').select('*').order('created_at'),
    supabase.from('products').select('*').eq('active', true).order('created_at'),
  ]);

  return (
    <CustomersClient
      initialCustomers={(customers ?? []) as Customer[]}
      products={(products ?? []) as Product[]}
    />
  );
}
