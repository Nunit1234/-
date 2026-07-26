import { createClient } from '@/lib/supabase/server';
import DeliveryClient from '@/components/DeliveryClient';

export default async function DeliveryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: orders }, { data: stock }, { data: products }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        '*, customers(name, phone, address, location_url), order_items(product_id, name, unit, qty, sell_price, cost)'
      )
      .eq('delivery_id', user!.id)
      .in('status', ['CONFIRMED', 'DELIVERING', 'DELIVERED'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('driver_stock').select('product_id, qty').eq('driver_id', user!.id),
    supabase.from('products').select('id, name, unit, cost, default_price').eq('active', true),
  ]);

  // สต๊อกบนรถ ณ ตอนนี้ ใช้โชว์ให้คนส่งเห็นตอนคีย์ยอดจริง
  const vanStock: Record<string, number> = {};
  for (const r of (stock ?? []) as { product_id: string; qty: number }[]) {
    vanStock[r.product_id] = Number(r.qty);
  }

  return (
    <DeliveryClient
      orders={(orders ?? []) as unknown as Parameters<typeof DeliveryClient>[0]['orders']}
      products={(products ?? []) as unknown as Parameters<typeof DeliveryClient>[0]['products']}
      vanStock={vanStock}
    />
  );
}
