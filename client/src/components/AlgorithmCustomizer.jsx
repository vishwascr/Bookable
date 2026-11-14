import { useId, useMemo } from 'react';

export const ALGO_PRESETS = [
  {
    id: 'balanced',
    name: 'Balanced',
    badge: 'Default',
    description: 'Even balance across genre, author, tags, and community rating',
    weights: { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
  },
  {
    id: 'author',
    name: 'Author Focus',
    badge: 'Author 70%',
    description: 'Prioritizes other works by the same authors as your seed books',
    weights: { genre: 0.15, author: 0.70, tag: 0.05, rating: 0.10 },
  },
  {
    id: 'genre',
    name: 'Genre Focus',
    badge: 'Genre 75%',
    description: 'Explores books sharing identical genres across different authors',
    weights: { genre: 0.75, author: 0.10, tag: 0.10, rating: 0.05 },
  },
  {
    id: 'top_rated',
    name: 'Top Rated',
    badge: 'Rating 70%',
    description: 'Surfaces highest community-rated books matching seed profiles',
    weights: { genre: 0.10, author: 0.10, tag: 0.10, rating: 0.70 },
  },
  {
    id: 'thematic',
    name: 'Thematic Tags',
    badge: 'Tags 70%',
    description: 'Emphasizes narrative tropes, vibes, and thematic tags',
    weights: { genre: 0.10, author: 0.10, tag: 0.70, rating: 0.10 },
  },
];

export const DEFAULT_ALGO_WEIGHTS = ALGO_PRESETS[0].weights;

export const HEURISTIC_CONFIG = [
  {
    key: 'genre',
    label: 'Genre Weight',
    symbol: 'w_genre',
    icon: '🎭',
    color: '#007AFF', // iOS blue
    description: 'Matches books sharing literary genres (e.g. Sci-Fi, Classics, Fantasy)',
  },
  {
    key: 'author',
    label: 'Author Weight',
    symbol: 'w_author',
    icon: '✍️',
    color: '#5856D6', // iOS purple
    description: 'Boosts works written by the same author(s) as the selected seeds',
  },
  {
    key: 'tag',
    label: 'Tag Weight',
    symbol: 'w_tag',
    icon: '🏷️',
    color: '#34C759', // iOS green
    description: 'Matches narrative tropes, themes (e.g. space-opera, dystopian, slow-burn)',
  },
  {
    key: 'rating',
    label: 'Rating Weight',
    symbol: 'w_rating',
    icon: '⭐',
    color: '#FF9500', // iOS orange
    description: 'Weights community star ratings and proximity to seed baseline ratings',
  },
];

export default function AlgorithmCustomizer({
  weights = DEFAULT_ALGO_WEIGHTS,
  onChange,
  isOpen = false,
  onToggle,
  onClose,
}) {
  const drawerId = useId();

  // Calculate sum of weights for normalized percentage display
  const rawTotal = useMemo(() => {
    return (
      (weights.genre || 0) +
      (weights.author || 0) +
      (weights.tag || 0) +
      (weights.rating || 0)
    );
  }, [weights]);

  const effectiveTotal = rawTotal > 0 ? rawTotal : 1;

  // Active preset matching
  const activePresetId = useMemo(() => {
    for (const p of ALGO_PRESETS) {
      const match =
        Math.abs(p.weights.genre - (weights.genre || 0)) < 0.02 &&
        Math.abs(p.weights.author - (weights.author || 0)) < 0.02 &&
        Math.abs(p.weights.tag - (weights.tag || 0)) < 0.02 &&
        Math.abs(p.weights.rating - (weights.rating || 0)) < 0.02;
      if (match) return p.id;
    }
    return 'custom';
  }, [weights]);

  const handleSliderChange = (key, val) => {
    const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
    onChange({
      ...weights,
      [key]: Math.round(num * 100) / 100,
    });
  };

  const handleApplyPreset = (preset) => {
    onChange({ ...preset.weights });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_ALGO_WEIGHTS });
  };

  return (
    <div className="algo-customizer-container">
      {/* Collapsible iOS-Styled Tray */}
      {isOpen && (
        <section
          id={drawerId}
          className="algo-customizer-drawer algo-customizer-panel card"
          aria-label="Algorithm Customization Drawer"
        >
          <div className="drawer-grabber" aria-hidden="true" />

          <header className="drawer-header">
            <div>
              <div className="drawer-title-row">
                <h3 className="drawer-title">⚙️ Recommendation Algorithm Customizer</h3>
                <span className="drawer-preset-badge">
                  {ALGO_PRESETS.find((p) => p.id === activePresetId)?.name || 'Custom Mix'}
                </span>
              </div>
              <p className="drawer-subtitle">
                Fine-tune heuristic weights for 3-seed recommendations. Title similarity is strictly excluded per system constraints.
              </p>
            </div>
            <div className="drawer-header-actions">
              <button
                type="button"
                className="btn-reset-algo"
                onClick={handleReset}
                title="Reset weights to default values"
              >
                ↺ Reset to Defaults
              </button>
              {onClose && (
                <button
                  type="button"
                  className="btn-drawer-close"
                  onClick={onClose}
                  aria-label="Close customizer"
                >
                  ✕
                </button>
              )}
            </div>
          </header>

          {/* Presets Row */}
          <div className="presets-section">
            <span className="presets-label">Presets:</span>
            <div className="presets-pills">
              {ALGO_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-pill ${activePresetId === p.id ? 'active' : ''}`}
                  onClick={() => handleApplyPreset(p)}
                  title={p.description}
                >
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-badge">{p.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Distribution Stacked Bar */}
          <div className="distribution-bar-wrapper">
            <div className="distribution-bar">
              {HEURISTIC_CONFIG.map(({ key, color, label }) => {
                const pct = Math.round(((weights[key] || 0) / effectiveTotal) * 100);
                if (pct <= 0) return null;
                return (
                  <div
                    key={key}
                    className="distribution-segment"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    title={`${label}: ${pct}%`}
                  >
                    {pct >= 12 && <span>{pct}%</span>}
                  </div>
                );
              })}
            </div>
            <div className="distribution-legend">
              {HEURISTIC_CONFIG.map(({ key, color, label }) => {
                const pct = Math.round(((weights[key] || 0) / effectiveTotal) * 100);
                return (
                  <div key={key} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: color }} />
                    <span className="legend-text">{label}: <b>{pct}%</b></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Sliders Grid */}
          <div className="sliders-grid">
            {HEURISTIC_CONFIG.map(({ key, label, symbol, icon, color, description }) => {
              const val = weights[key] ?? 0;
              const pct = Math.round((val / effectiveTotal) * 100);

              return (
                <div key={key} className="slider-card">
                  <div className="slider-header">
                    <span className="slider-label">
                      <span className="slider-icon">{icon}</span>
                      <b>{label}</b>
                      <code className="slider-symbol">{symbol}</code>
                    </span>
                    <div className="slider-value-group">
                      <span className="slider-val-num mono">{val.toFixed(2)}</span>
                      <span className="slider-val-pct mono" style={{ color }}>{pct}%</span>
                    </div>
                  </div>

                  <p className="slider-description">{description}</p>

                  <div className="slider-control-row">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={val}
                      onChange={(e) => handleSliderChange(key, e.target.value)}
                      className="ios-slider"
                      style={{ accentColor: color }}
                      aria-label={`${label} slider`}
                      aria-valuenow={val}
                      aria-valuetext={`${label}: ${val.toFixed(2)} (${pct}%)`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* MANDATORY: Permanently Excluded Title Similarity Row */}
          <div className="title-exclusion-banner">
            <div className="exclusion-header">
              <div className="exclusion-title-row">
                <span className="lock-icon">🔒</span>
                <b>Title Similarity Weight (w_title)</b>
                <span className="title-exclusion-badge">EXCLUDED (0.00)</span>
              </div>
              <span className="mono excluded-zero">0.00 (0%)</span>
            </div>

            <div className="disabled-slider-track" aria-hidden="true">
              <div className="disabled-slider-thumb" />
            </div>

            <div className="title-exclusion-notice">
              <span className="info-icon">ℹ️</span>
              <p>
                <strong>Title similarity is strictly excluded (w_title = 0.00)</strong> per project specification. Recommendations are driven exclusively by genre, author, thematic tag, and rating heuristics so surface-level word collisions never distort recommendations.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
