import { createClient } from './supabase/client';

// ย่อรูปก่อนอัปโหลด (กันไฟล์ใหญ่)
async function resize(file: File, max = 900, quality = 0.8): Promise<Blob> {
  const img = await createImageBitmap(file);
  let w = img.width;
  let h = img.height;
  if (w > max || h > max) {
    const r = Math.min(max / w, max / h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', quality)
  );
  return blob;
}

// อัปโหลดรูปไป Supabase Storage (bucket: images) แล้วคืน public URL
export async function uploadImage(file: File, folder: string): Promise<string> {
  const supabase = createClient();
  const blob = await resize(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('images').getPublicUrl(path);
  return data.publicUrl;
}
