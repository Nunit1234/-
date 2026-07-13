'use client';

import { useState } from 'react';
import { uploadImage } from '@/lib/storage';

export default function ImageUpload({
  value,
  onChange,
  folder,
  label = 'แนบรูป',
  size = 88,
}: {
  value?: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  size?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(file: File) {
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      setErr('อัปโหลดไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  }

  return (
    <div>
      <label
        className="inline-flex flex-col items-center justify-center gap-1 border-2 border-dashed border-green-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-green-50 text-green-700 text-sm transition"
        style={{ minWidth: size + 24 }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="rounded-lg object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <span className="text-3xl">📷</span>
        )}
        <span className="font-medium">
          {busy ? 'กำลังอัปโหลด…' : value ? 'เปลี่ยนรูป' : label}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
      </label>
      {value && (
        <button
          type="button"
          className="block text-xs text-red-500 mt-1"
          onClick={() => onChange('')}
        >
          ✕ ลบรูป
        </button>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  );
}
