
import { ExpiryStatus } from '../types';

export const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {}
  // Fallback para contextos não seguros (HTTP via IP)
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const calculateDaysRemaining = (expiryDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getExpiryStatus = (daysRemaining: number): ExpiryStatus => {
  if (daysRemaining < 0) return ExpiryStatus.EXPIRED;
  if (daysRemaining <= 7) return ExpiryStatus.WARNING;
  return ExpiryStatus.SAFE;
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const getStatusColor = (status: ExpiryStatus): string => {
  switch (status) {
    case ExpiryStatus.EXPIRED: return 'text-rose-600 bg-rose-50 border-rose-100';
    case ExpiryStatus.WARNING: return 'text-amber-600 bg-amber-50 border-amber-100';
    case ExpiryStatus.SAFE: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    default: return 'text-slate-600 bg-slate-50 border-slate-100';
  }
};
