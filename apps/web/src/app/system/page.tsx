import { HealthCard } from '@/features/health-status/ui/health-card';
import { SystemStatusCard } from '@/features/system-status/ui/system-status-card';
import { NotImplemented } from '@/shared/ui/not-implemented';

export default function SystemPage() {
  return (
    <>
      <h1>System</h1>
      <p className="muted">
        Global scope: project management, system settings, and aggregate costs.
      </p>
      <HealthCard />
      <SystemStatusCard />
      <NotImplemented
        title="System settings"
        description="Global system settings are not implemented yet."
      />
      <NotImplemented
        title="Aggregate costs"
        description="Cost aggregation across projects is not implemented yet. Analyses report their own usage and estimated cost on each project."
      />
    </>
  );
}
