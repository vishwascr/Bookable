export default function AlgorithmPicker({ algos, value, onChange }) {
  return (
    <div className="picker" role="tablist">
      {algos.map((a) => (
        <button key={a.key} role="tab" aria-selected={value === a.key} className={value === a.key ? 'active' : ''} onClick={() => onChange(a.key)} title={a.short}>
          {a.name}
        </button>
      ))}
      <button role="tab" aria-selected={value === 'all'} className={`cmp ${value === 'all' ? 'active' : ''}`} onClick={() => onChange('all')}>
        ⚖️ Compare all
      </button>
    </div>
  );
}
