import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import type { Role } from '@/lib/types';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role ?? 'delivery') as Role;
  const name = profile?.name || user.email || '';

  return (
    <div className="flex-1 flex bg-green-50 min-h-screen">
      <Sidebar role={role} name={name} />
      {/* pt-14 เผื่อ top bar บนมือถือ */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
