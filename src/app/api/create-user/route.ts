import { createClient as createServer } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// สร้างบัญชีผู้ใช้ใหม่ (แอดมินเท่านั้น) — ต้องตั้ง env SUPABASE_SERVICE_ROLE_KEY
export async function POST(req: Request) {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ยังไม่ได้ล็อกอิน' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'เฉพาะแอดมิน' }, { status: 403 });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY (ดูวิธีใน SETUP.md)' },
      { status: 400 }
    );

  const body = await req.json();
  const { email, password, name, role } = body as {
    email: string;
    password: string;
    name: string;
    role: string;
  };
  if (!email || !password)
    return NextResponse.json({ error: 'กรอกอีเมลและรหัสผ่าน' }, { status: 400 });

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || '', role: role === 'admin' ? 'admin' : 'delivery' },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.user?.id });
}
