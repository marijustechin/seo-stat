import { apiFetch } from '@/shared/api/client';

export interface SystemStatus {
  analysis: {
    provider: string;
    model: string;
    configured: boolean;
    limits: Record<string, number>;
  };
}

export function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/system/status');
}
