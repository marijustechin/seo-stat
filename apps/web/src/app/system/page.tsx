import { HealthCard } from '@/features/health-status/ui/health-card';
import { NotImplemented } from '@/shared/ui/not-implemented';

export default function SystemPage() {
  return (
    <>
      <h1>System</h1>
      <p className="muted">
        Global scope: project management, system settings, and aggregate costs.
      </p>
      <HealthCard />
      <NotImplemented
        title="System settings"
        description="Global system settings are not implemented yet."
      />
      <NotImplemented
        title="Aggregate costs"
        description="Cost aggregation across projects is not implemented yet. Future shared AI usage will be attributed per project rather than shown as invented totals."
      />
    </>
  );
}
