import { HealthCard } from '@/features/health-status/ui/health-card';

export default function OverviewPage() {
  return (
    <>
      <h1>Overview</h1>
      <p>
        This is the seo-stat application foundation. It confirms the UI shell, subpath routing,
        and a database-backed API health check.
      </p>
      <HealthCard />
      <section className="card" aria-labelledby="not-implemented-title">
        <h2 id="not-implemented-title">Not implemented yet</h2>
        <ul>
          <li>Scheduling is not implemented yet.</li>
          <li>Job execution history and a simulated action are not implemented yet.</li>
          <li>AI generation and external publishing are not implemented yet.</li>
        </ul>
      </section>
    </>
  );
}
