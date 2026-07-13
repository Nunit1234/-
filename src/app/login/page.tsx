'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-green-100 to-green-300">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="โลโก้"
          className="w-24 h-24 rounded-full object-cover mx-auto shadow-lg"
        />
        <h1 className="text-center text-2xl font-bold mt-3 text-green-900">
          เจ้านายฟาร์มเป็ด
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          ระบบ POS &amp; สต๊อก ล้งไข่
        </p>

        <label className="block text-sm text-gray-600 mb-1">อีเมล</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="you@example.com"
        />

        <label className="block text-sm text-gray-600 mb-1">รหัสผ่าน</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="••••••••"
        />

        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
        >
          {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
