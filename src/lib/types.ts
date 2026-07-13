export type Role = 'admin' | 'delivery';

export const EGG_TYPES: Record<string, string> = {
  DUCK: 'ไข่เป็ด',
  CHICKEN: 'ไข่ไก่',
  SALTED: 'ไข่เค็ม',
  CENTURY: 'ไข่เยี่ยวม้า',
};

export const UNIT_PER: Record<string, number> = { 'ฟอง': 1, 'แผง': 30, 'กล่อง': 50 };

export type Product = {
  id: string;
  name: string;
  type: string;
  size: string;
  unit: string;
  per_unit: number;
  cost: number;
  default_price: number;
  stock: number;
  image_url: string;
  active: boolean;
  created_at?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  location_url: string;
  active: boolean;
  created_at?: string;
};
