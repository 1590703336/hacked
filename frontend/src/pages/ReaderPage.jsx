import { useState, useEffect, useRef } from "react";
import { summarizerService, MOCK_CONTENT, MOCK_CHUNKS } from "../services/index.js";

export default function ReaderPage({ content, navigate }) {
  const [text] = useState(content?.text || MOCK_CONTENT);
  const [title] = useState(content?.title || "Statistics Lecture — ANOVA & Hypothesis Testing");
  const [chunks, setChunks] = useState(MOCK_CHUNKS);
  const [activeChunk, setActiveChunk] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef(null);

  // Simulate TTS playback by advancing highlighted chunk
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setActiveChunk(prev => {
          if (prev >= chunks.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 3000 / speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, chunks.length]);

  const handleSummarize = async () => {
    setShowSummary(true);
    if (summary) return;
    setLoadingSummary(true);
    const result = await summarizerService.summarize(text);
    setLoadingSummary(false);
    if (result.success) setSummary(result.data);
  };

  const handlePlay = () => {
    if (activeChunk === -1) setActiveChunk(0);
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setActiveChunk(-1);
  };

  return (
    <div className="reader-page">
      {/* Left: Content */}
      <div className="reader-main">
        <div className="reader-header">
          <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
          <h2 className="reader-title">{title}</h2>
        </div>

        <div className="reader-content">
          {chunks.map((chunk, i) => (
            <p
              key={i}
              className={`reader-chunk ${activeChunk === i ? "active-chunk" : ""} ${activeChunk > i ? "read-chunk" : ""}`}
            >
              {chunk}
            </p>
          ))}

          <div className="reader-divider" />

          {/* Raw markdown preview */}
          <div className="markdown-preview">
            <pre className="markdown-raw">{text}</pre>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="reader-sidebar">
        {/* Audio Controls */}
        <div className="control-panel">
          <h3 className="panel-title">Audio Playback</h3>
          <div className="audio-controls">
            <button className="ctrl-btn secondary" onClick={handleReset}>⏮</button>
            <button className="ctrl-btn primary" onClick={handlePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className="ctrl-btn secondary" onClick={() => navigate("tutor", { text, title })}>🎙</button>
          </div>
          <div className="speed-control">
            <span className="speed-label">Speed</span>
            <div className="speed-buttons">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                <button key={s} className={`speed-btn ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <div className="progress-info">
            <span>Sentence {Math.max(0, activeChunk + 1)} of {chunks.length}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((activeChunk + 1) / chunks.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Summarize */}
        <button className="btn-primary full-width" onClick={handleSummarize}>
          🧠 TL;DR Summary
        </button>

        {/* Ask Tutor */}
        <button className="btn-ghost full-width" onClick={() => navigate("tutor", { text, title })}>
          🎙️ Ask AI Tutor
        </button>

        {/* Reading Progress */}
        <div className="control-panel">
          <h3 className="panel-title">Accessibility</h3>
          <div className="a11y-options">
            <label className="toggle-row">
              <span>High contrast</span>
              <input type="checkbox" className="toggle-input" onChange={e => document.body.classList.toggle("high-contrast", e.target.checked)} />
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </label>
            <label className="toggle-row">
              <span>Large text</span>
              <input type="checkbox" className="toggle-input" onChange={e => document.body.classList.toggle("large-text", e.target.checked)} />
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </label>
            <label className="toggle-row">
              <span>Reduce motion</span>
              <input type="checkbox" className="toggle-input" onChange={e => document.body.classList.toggle("reduce-motion", e.target.checked)} />
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Overlay */}
      {showSummary && (
        <div className="summary-overlay" onClick={() => setShowSummary(false)}>
          <div className="summary-panel" onClick={e => e.stopPropagation()}>
            <div className="summary-header">
              <h3>TL;DR — Key Takeaways</h3>
              <button className="close-btn" onClick={() => setShowSummary(false)}>✕</button>
            </div>
            {loadingSummary ? (
              <div className="summary-loading">
                <div className="thinking-dots"><span /><span /><span /></div>
                <p>AI is summarizing...</p>
              </div>
            ) : (
              <>
                <div className="takeaways">
                  {summary?.takeaways.map((t, i) => (
                    <div key={i} className="takeaway-card" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="takeaway-num">{i + 1}</div>
                      <p>{t}</p>
                    </div>
                  ))}
                </div>
                <div className="summary-footer">
                  <span className="token-badge">~{summary?.tokensUsed} tokens used</span>
                  <button className="btn-primary" onClick={() => navigate("tutor", { text, title })}>
                    Ask follow-up →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
