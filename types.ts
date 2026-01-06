
export enum ExpiryStatus {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  EXPIRED = 'EXPIRED'
}

export interface Product {
  id: string;
  name: string;
  category: string;
  expiryDate: string; // ISO format YYYY-MM-DD
  quantity: number;
  location?: string;
  barcode?: string;
  createdAt: number;
}

export interface InventoryStats {
  total: number;
  expired: number;
  expiringSoon: number;
  safe: number;
}
