export const FEATURE_LABELS = { title: 'Title', author: 'Author', publisher: 'Publisher', year: 'Year' };

export default function WeightSliders({ weights, onChange }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return (
    <section className="card">
      <h3>Hybrid weights</h3>
      {Object.entries(weights).map(([k, v]) => (
        <label key={k} className="slider">
          <span>{FEATURE_LABELS[k]}</span>
          <input type="range" min="0" max="1" step="0.05" value={v} onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })} />
          <span className="mono">{Math.round((v / total) * 100)}%</span>
        </label>
      ))}
    </section>
  );
}
