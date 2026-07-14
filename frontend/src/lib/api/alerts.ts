import { apiFetch } from './client';
import type { Alert } from '@/types';

export const alertsApi = {
  /** GET /api/alerts — returns all alerts for the authenticated user */
  getAll: (): Promise<Alert[]> => apiFetch<Alert[]>('/api/alerts'),
};
