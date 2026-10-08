import { apiFetch } from '@/shared/api/client';

export interface SystemStatus {
  analysis: {
    provider: string;
    model: string;
    configured: boolean;
    limits: Record<string, number>;
    research: {
      direct: { configured: boolean };
      firecrawl: { configured: boolean };
    };
  };
}

export function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/system/status');
}
