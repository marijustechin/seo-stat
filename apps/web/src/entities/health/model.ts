export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}

export type HealthProbe =
  | { kind: 'ok'; database: string; timestamp: string }
  | { kind: 'degraded'; database: string }
  | { kind: 'unreachable' };
