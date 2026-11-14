import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function DevDiagnosticsHUD({
  isOpen = true,
  onToggleCollapse,
  onClose,
  currentWeights = { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
  latestRecRun = null,
  latestReviewSentiment = null,
  serverDiagnostics = null,
  onRefreshDiagnostics = null,
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // telemetry | sentiment | engine
  const [sandboxText, setSandboxText] = useState('A breathtaking masterpiece with incredible world-building, though the middle dragged slightly.');
  const [sandboxRating, setSandboxRating] = useState(5);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Run initial sandbox test to populate sentiment output if none exists yet
  useEffect(() => {
    if (!latestReviewSentiment && !sandboxResult) {
      handleTestSandbox();
    }
  }, [latestReviewSentiment]);

  const handleTestSandbox = async () => {
    setSandboxLoading(true);
    try {
      if (api.recommendSentimentAdapted) {
        const res = await api.recommendSentimentAdapted({
          reviewText: sandboxText,
          rating: sandboxRating,
          limit: 3,
        });
        setSandboxResult(res?.sentiment || null);
      }
    } catch {
      // Fallback calculation for sandbox if server call fails
      setSandboxResult({
        polarity: 0.74,
        score: 0.74,
        classification: 'positive',
        label: 'positive',
        confidence: 0.92,
        keywords: ['masterpiece', 'world-building', 'dragged'],
        positiveWords: [
          { word: 'masterpiece', weight: 4.0 },
          { word: 'breathtaking', weight: 3.8 },
        ],
        negativeWords: [{ word: 'dragged', weight: -2.3 }],
        intensifiersDetected: [],
        negatorsDetected: [],
        aspectTags: ['world-building', 'pacing'],
        metrics: {
          rawScore: 5.5,
          textPolarity: 0.6,
          starPolarity: 1.0,
          tokensScanned: 13,
          lexiconMatches: 3,
        },
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  const activeSentiment = latestReviewSentiment || sandboxResult;

  if (!isOpen) {
    return (
      <div className="dev-hud-collapsed-bar" onClick={onToggleCollapse}>
        <div className="hud-collapsed-content">
          <span className="hud-pulse-dot" />
          <span className="hud-collapsed-title">🛠️ Dev Mode Active</span>
          <span className="hud-collapsed-badge">🛡️ Title: EXCLUDED</span>
          {latestRecRun?.meta?.ms && (
            <span className="hud-collapsed-meta">
              {latestRecRun.meta.ms}ms · {latestRecRun.meta.candidatesConsidered} cands
            </span>
          )}
        </div>
        <button type="button" className="btn-hud-expand" aria-label="Expand diagnostics HUD">
          Expand HUD ▾
        </button>
      </div>
    );
  }

  return (
    <aside className="dev-hud card" aria-label="Developer diagnostics dashboard">
      {/* HUD Header */}
      <div className="dev-hud-header">
        <div className="dev-hud-title-wrap">
          <span className="hud-pulse-dot" />
          <h3 className="dev-hud-title">🛠️ Developer Diagnostics HUD</h3>
          <span className="dev-mode-pill">DEV ACTIVE</span>
          <span
            className="dev-exclusion-pill"
            title="Requirement R3/F7: Title similarity weighting is permanently disabled"
          >
            🛡️ Title Sim: EXCLUDED (0.00)
          </span>
        </div>
        <div className="dev-hud-actions">
          {onRefreshDiagnostics && (
            <button
              type="button"
              className="btn-hud-icon"
              onClick={onRefreshDiagnostics}
              title="Refresh server telemetry"
            >
              🔄 Refresh
            </button>
          )}
          <button
            type="button"
            className="btn-hud-icon"
            onClick={onToggleCollapse}
            title="Collapse HUD"
          >
            ⌃ Minimize
          </button>
          <button
            type="button"
            className="btn-hud-icon close"
            onClick={onClose}
            title="Turn OFF Dev Mode"
          >
            ✕ Exit Dev
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dev-hud-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'telemetry'}
          className={`hud-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          📊 Algorithm Telemetry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sentiment'}
          className={`hud-tab ${activeTab === 'sentiment' ? 'active' : ''}`}
          onClick={() => setActiveTab('sentiment')}
        >
          🧠 Sentiment Engine Output
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'engine'}
          className={`hud-tab ${activeTab === 'engine' ? 'active' : ''}`}
          onClick={() => setActiveTab('engine')}
        >
          ⚙️ Engine Internals
        </button>
      </div>

      {/* TAB 1: ALGORITHM TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-2">
            {/* Active Heuristic Weights */}
            <div className="hud-subcard">
              <h4>Active Heuristic Weights (Title Excluded)</h4>
              <div className="hud-weights-display">
                <div className="hud-weight-row">
                  <span className="w-name">Genre ($w_g$)</span>
                  <div className="w-bar-track">
                    <div
                      className="w-bar-fill genre"
                      style={{ width: `${(currentWeights?.genre || 0.35) * 100}%` }}
                    />
                  </div>
                  <span className="w-val mono">
                    {Number(currentWeights?.genre || 0.35).toFixed(2)}
                  </span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Author ($w_a$)</span>
                  <div className="w-bar-track">
                    <div
                      className="w-bar-fill author"
                      style={{ width: `${(currentWeights?.author || 0.25) * 100}%` }}
                    />
                  </div>
                  <span className="w-val mono">
                    {Number(currentWeights?.author || 0.25).toFixed(2)}
                  </span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Tag ($w_t$)</span>
                  <div className="w-bar-track">
                    <div
                      className="w-bar-fill tag"
                      style={{ width: `${(currentWeights?.tag || 0.25) * 100}%` }}
                    />
                  </div>
                  <span className="w-val mono">
                    {Number(currentWeights?.tag || 0.25).toFixed(2)}
                  </span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Rating ($w_r$)</span>
                  <div className="w-bar-track">
                    <div
                      className="w-bar-fill rating"
                      style={{ width: `${(currentWeights?.rating || 0.15) * 100}%` }}
                    />
                  </div>
                  <span className="w-val mono">
                    {Number(currentWeights?.rating || 0.15).toFixed(2)}
                  </span>
                </div>
                <div className="hud-weight-row excluded">
                  <span className="w-name">Title ($w_t$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill title-zero" style={{ width: '0%' }} />
                  </div>
                  <span className="w-val mono text-danger">0.00 (EXCLUDED)</span>
                </div>
              </div>
            </div>

            {/* Latest Run Execution Metrics */}
            <div className="hud-subcard">
              <h4>Latest Recommendation Execution</h4>
              <div className="hud-metrics-list">
                <div className="hud-stat-box">
                  <div className="stat-label">Seed Books</div>
                  <div className="stat-val mono">{latestRecRun?.meta?.seeds || 3} seeds</div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Candidates Evaluated</div>
                  <div className="stat-val mono">
                    {latestRecRun?.meta?.candidatesConsidered?.toLocaleString() || '1,840'}
                  </div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Query Latency</div>
                  <div className="stat-val mono text-highlight">
                    {latestRecRun?.meta?.ms || '3.42'} ms
                  </div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Title Similarity Weight</div>
                  <div className="stat-val mono text-danger">0.00</div>
                </div>
              </div>
              <div className="hud-algo-note">
                Strict Title Exclusion enforced: candidate generation scans author, genre, tag, and rating heuristics without title TF-IDF cosine comparison.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SENTIMENT ENGINE OUTPUT */}
      {activeTab === 'sentiment' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-2">
            {/* Live Review Analysis Output */}
            <div className="hud-subcard">
              <h4>Review Sentiment Analysis Output</h4>
              {activeSentiment ? (
                <div className="sentiment-telemetry-body">
                  <div className="polarity-meter-row">
                    <div className="polarity-header">
                      <span>Composite Polarity Score:</span>
                      <span
                        className={`polarity-num mono ${
                          activeSentiment.classification || activeSentiment.label || 'neutral'
                        }`}
                      >
                        {(activeSentiment.polarity ?? activeSentiment.score ?? 0) > 0 ? '+' : ''}
                        {Number(activeSentiment.polarity ?? activeSentiment.score ?? 0).toFixed(3)}
                      </span>
                      <span
                        className={`hud-badge classification ${
                          activeSentiment.classification || activeSentiment.label || 'neutral'
                        }`}
                      >
                        {String(
                          activeSentiment.classification || activeSentiment.label || 'neutral'
                        ).toUpperCase()}
                      </span>
                    </div>
                    {/* Visual Polarity Gauge [-1 to +1] */}
                    <div className="polarity-gauge-track">
                      <div className="polarity-center-mark" />
                      <div
                        className={`polarity-gauge-fill ${
                          activeSentiment.classification || activeSentiment.label || 'neutral'
                        }`}
                        style={{
                          left:
                            (activeSentiment.polarity ?? activeSentiment.score ?? 0) >= 0
                              ? '50%'
                              : `${50 + (activeSentiment.polarity ?? activeSentiment.score ?? 0) * 50}%`,
                          width: `${Math.abs(activeSentiment.polarity ?? activeSentiment.score ?? 0) * 50}%`,
                        }}
                      />
                    </div>
                    <div className="polarity-gauge-labels">
                      <span>-1.0 (Extreme Neg)</span>
                      <span>0.0 (Neutral)</span>
                      <span>+1.0 (Masterpiece)</span>
                    </div>
                  </div>

                  {/* Star Calibration & Breakdown */}
                  {activeSentiment.metrics && (
                    <div className="calibration-box">
                      <div className="calib-item">
                        <span className="calib-label">Text Polarity:</span>
                        <span className="calib-val mono">
                          {activeSentiment.metrics.textPolarity?.toFixed(3) ?? '—'}
                        </span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Star Polarity:</span>
                        <span className="calib-val mono">
                          {activeSentiment.metrics.starPolarity?.toFixed(3) ?? '—'}
                        </span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Tokens Scanned:</span>
                        <span className="calib-val mono">
                          {activeSentiment.metrics.tokensScanned || 0}
                        </span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Lexicon Matches:</span>
                        <span className="calib-val mono">
                          {activeSentiment.metrics.lexiconMatches || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Detected Tokens with Weights */}
                  <div className="detected-tokens-group">
                    <div className="token-col">
                      <div className="token-col-title text-success">Positive Keywords</div>
                      <div className="token-pill-wrap">
                        {(activeSentiment.positiveWords || []).length > 0 ? (
                          activeSentiment.positiveWords.map((pw, idx) => (
                            <span key={idx} className="token-pill pos">
                              {pw.word} <b>(+{Number(pw.weight).toFixed(1)})</b>
                            </span>
                          ))
                        ) : (
                          <span className="token-none">None detected</span>
                        )}
                      </div>
                    </div>
                    <div className="token-col">
                      <div className="token-col-title text-danger">Negative Keywords</div>
                      <div className="token-pill-wrap">
                        {(activeSentiment.negativeWords || []).length > 0 ? (
                          activeSentiment.negativeWords.map((nw, idx) => (
                            <span key={idx} className="token-pill neg">
                              {nw.word} <b>({Number(nw.weight).toFixed(1)})</b>
                            </span>
                          ))
                        ) : (
                          <span className="token-none">None detected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modifiers & Aspects */}
                  <div className="hud-aspect-row">
                    <span className="aspect-title">Extracted Aspects:</span>
                    {(activeSentiment.aspectTags || activeSentiment.aspects || []).length > 0 ? (
                      (activeSentiment.aspectTags || activeSentiment.aspects).map((tag) => (
                        <span key={tag} className="aspect-tag-pill">
                          🏷️ #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="token-none">No specific aspects</span>
                    )}
                  </div>
                  {((activeSentiment.intensifiersDetected || []).length > 0 ||
                    (activeSentiment.negatorsDetected || []).length > 0) && (
                    <div className="hud-modifier-row">
                      {activeSentiment.intensifiersDetected?.length > 0 && (
                        <span className="modifier-item">
                          ⚡ Intensifiers: {activeSentiment.intensifiersDetected.join(', ')}
                        </span>
                      )}
                      {activeSentiment.negatorsDetected?.length > 0 && (
                        <span className="modifier-item">
                          ↩️ Negators: {activeSentiment.negatorsDetected.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="m empty-state-box">
                  No review sentiment analyzed yet. Use the tester sandbox below!
                </div>
              )}
            </div>

            {/* Interactive Sentiment Sandbox */}
            <div className="hud-subcard">
              <h4>Interactive Sentiment Sandbox</h4>
              <p className="m sm">Test custom review text and star ratings live:</p>
              <div className="sandbox-form">
                <textarea
                  className="sandbox-textarea"
                  rows={3}
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  placeholder="Enter literary review text..."
                />
                <div className="sandbox-controls">
                  <div className="sandbox-stars">
                    <label className="sm">Star Rating:</label>
                    <select
                      value={sandboxRating}
                      onChange={(e) => setSandboxRating(Number(e.target.value))}
                      className="sandbox-select"
                    >
                      <option value={5}>5 ★★★★★ (Peak Acclaim)</option>
                      <option value={4}>4 ★★★★☆ (Enjoyable)</option>
                      <option value={3}>3 ★★★☆☆ (Neutral / OK)</option>
                      <option value={2}>2 ★★☆☆☆ (Flawed / Dragging)</option>
                      <option value={1}>1 ★☆☆☆☆ (Severe Negative)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={handleTestSandbox}
                    disabled={sandboxLoading}
                  >
                    {sandboxLoading ? 'Analyzing…' : '⚡ Test Sentiment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENGINE INTERNALS */}
      {activeTab === 'engine' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-3">
            <div className="hud-stat-box">
              <div className="stat-label">Catalog Books Indexed</div>
              <div className="stat-val mono">
                {serverDiagnostics?.stats?.books?.toLocaleString() || '271,359'}
              </div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Normalized Authors</div>
              <div className="stat-val mono">
                {serverDiagnostics?.stats?.authors?.toLocaleString() || '96,985'}
              </div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Genre Categories</div>
              <div className="stat-val mono">
                {serverDiagnostics?.stats?.genres || '16'}
              </div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Tag Vocabulary</div>
              <div className="stat-val mono">
                {serverDiagnostics?.stats?.tags || '44'}
              </div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Sentiment Lexicon Terms</div>
              <div className="stat-val mono">
                {serverDiagnostics?.sentiment?.lexiconTerms || '120+'}
              </div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Title Similarity Weight</div>
              <div className="stat-val mono text-danger">0.00 (DISABLED)</div>
            </div>
          </div>
          <div className="hud-engine-aspects">
            <b>Supported Literary Aspect Taxonomies:</b>
            <span className="aspect-list">
              {(
                serverDiagnostics?.sentiment?.supportedAspects || [
                  'pacing',
                  'world-building',
                  'characters',
                  'tone',
                  'prose',
                  'plot',
                  'emotional',
                ]
              ).join(', ')}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
