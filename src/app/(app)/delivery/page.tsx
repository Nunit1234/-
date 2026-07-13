import { createClient } from '@/lib/supabase/server';
import DeliveryClient from '@/components/DeliveryClient';

export default async function DeliveryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from('orders')
    .select(
      '*, customers(name, phone, address, location_url)'
    )
    .eq('delivery_id', user!.id)
    .in('status', ['CONFIRMED', 'DELIVERING', 'DELIVERED'])
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <DeliveryClient
      orders={
        (orders ?? []) as unknown as Parameters<typeof DeliveryClient>[0]['orders']
      }
    />
  );
}
