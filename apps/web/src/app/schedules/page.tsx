export default function SchedulesPage() {
  return (
    <>
      <h1>Schedules</h1>
      <p>Scheduling is not implemented yet.</p>
      <section className="card" aria-labelledby="planned-title">
        <h2 id="planned-title">Planned</h2>
        <ul>
          <li>Persistent schedules with explicit timezone handling.</li>
          <li>Safe job claiming and durable execution history.</li>
          <li>Missed-run handling for server downtime.</li>
        </ul>
        <button type="button" className="button" disabled>
          Create schedule (not available)
        </button>
      </section>
    </>
  );
}
