import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VanStockClient from '@/components/VanStockClient';
import type { Product } from '@/lib/types';

export default async function VanStockPage() {
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

  const [{ data: drivers }, { data: products }, { data: stocks }, { data: settings }] =
    await Promise.all([
      supabase.from('profiles').select('id, name').eq('role', 'delivery').eq('active', true),
      supabase.from('products').select('*').eq('active', true).order('created_at'),
      supabase.from('driver_stock').select('driver_id, product_id, qty, products(name, unit)'),
      supabase.from('settings').select('shop_name, shop_phone').eq('id', 1).single(),
    ]);

  return (
    <VanStockClient
      drivers={drivers ?? []}
      products={(products ?? []) as Product[]}
      stocks={
        (stocks ?? []) as unknown as {
          driver_id: string;
          product_id: string;
          qty: number;
          products: { name: string; unit: string } | null;
        }[]
      }
      settings={settings ?? {}}
    />
  );
}
