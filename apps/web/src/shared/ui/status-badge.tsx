import type { ProjectStatus } from '@/entities/project/model';

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`badge ${status === 'archived' ? 'badge-archived' : 'badge-active'}`}>
      {status === 'archived' ? 'Archived' : 'Active'}
    </span>
  );
}
