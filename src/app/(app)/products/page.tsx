import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProductsClient from '@/components/ProductsClient';
import type { Product } from '@/lib/types';

export default async function ProductsPage() {
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

  const { data } = await supabase
    .from('products')
    .select('*')
    .order('created_at');

  return <ProductsClient initial={(data ?? []) as Product[]} />;
}
