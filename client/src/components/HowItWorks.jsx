export default function HowItWorks({ algo }) {
  return (
    <section className="card how">
      <h3>How “{algo.name}” works</h3>
      <p>{algo.short}</p>
      <code className="formula">{algo.formula}</code>
      <ol>{algo.explain.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </section>
  );
}
