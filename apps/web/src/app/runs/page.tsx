export default function RunsPage() {
  return (
    <>
      <h1>Run history</h1>
      <p>No run history yet. Execution history is not implemented.</p>
      <section className="card" aria-labelledby="planned-title">
        <h2 id="planned-title">Planned</h2>
        <p>
          Each run will record its outcome so that generation and publishing steps can be retried
          safely without repeating work that already succeeded.
        </p>
      </section>
    </>
  );
}
