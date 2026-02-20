import { useState, useRef } from "react";
import { captureService, summarizerService, ocrService, MOCK_CAPTURES } from "../services/index.js";

export default function HomePage({ navigate }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captures] = useState(MOCK_CAPTURES);
  const fileRef = useRef();

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) await processFile(file);
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    try {
      const uploadResult = await captureService.upload(file);
      if (uploadResult.success && uploadResult.data.images?.length > 0) {
        let fullMarkdown = "";
        // Process sequentially to avoid aggressive rate-limiting on the AI provider for long docs
        for (const imageBase64 of uploadResult.data.images) {
          const ocrResult = await ocrService.process(imageBase64);
          if (ocrResult.success && ocrResult.data.markdown) {
            fullMarkdown += ocrResult.data.markdown + "\n\n";
          }
        }

        if (fullMarkdown.trim()) {
          navigate("reader", { text: fullMarkdown.trim(), title: file.name });
        }
      }
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-text">
          <div className="hero-tag">AI-Powered Accessibility</div>
          <h1 className="hero-title">
            Learn without<br />
            <span className="gradient-text">barriers.</span>
          </h1>
          <p className="hero-subtitle">
            Designed for cognitive accessibility — ADHD, dyslexia, low vision, motor impairment.
            Paste, capture, or drop anything and let AI make it readable.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => fileRef.current.click()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v10M4 7l5-5 5 5M3 15h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload Document
            </button>
            <button className="btn-ghost" onClick={() => navigate("reader", { text: null, demo: true })}>
              Try Demo →
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-dot green" />
            <span>Reading level adjusted</span>
          </div>
          <div className="floating-card card-2">
            <div className="card-dot blue" />
            <span>3 key takeaways</span>
          </div>
          <div className="floating-card card-3">
            <div className="card-dot orange" />
            <span>Voice Q&A active</span>
          </div>
          <div className="hero-orb" />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""} ${isProcessing ? "processing" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={handleFileSelect} hidden />
        {isProcessing ? (
          <div className="processing-state">
            <div className="spinner" />
            <p>Processing your document...</p>
          </div>
        ) : (
          <>
            <div className="drop-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="8" y="6" width="24" height="28" rx="3" stroke="var(--accent)" strokeWidth="1.5" />
                <path d="M14 14h12M14 19h12M14 24h8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="30" cy="30" r="8" fill="var(--accent)" />
                <path d="M30 26v8M26 30h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="drop-title">Drop PDF or image here</p>
            <p className="drop-sub">or click to browse · PDF, PNG, JPG supported</p>
          </>
        )}
      </div>

      {/* Recent Captures */}
      <div className="section">
        <div className="section-header">
          <h2>Recent Captures</h2>
          <span className="section-count">{captures.length} items</span>
        </div>
        <div className="captures-grid">
          {captures.map((item, i) => (
            <div
              key={item.id}
              className="capture-card"
              style={{ animationDelay: `${i * 80}ms` }}
              onClick={() => navigate("reader", { text: item.preview, title: item.title })}
            >
              <div className="capture-card-header">
                <div className={`capture-type-badge ${item.type}`}>{item.type.toUpperCase()}</div>
                <span className="capture-time">{item.timestamp}</span>
              </div>
              <h3 className="capture-title">{item.title}</h3>
              <p className="capture-preview">{item.preview}</p>
              <div className="capture-footer">
                <button className="capture-action">Read →</button>
                <button className="capture-action" onClick={(e) => { e.stopPropagation(); navigate("tutor", { text: item.preview, title: item.title }); }}>Ask AI</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Strip */}
      <div className="features-strip">
        {[
          { icon: "👁️", label: "Screen Capture", desc: "Global shortcut capture" },
          { icon: "🧠", label: "TL;DR AI", desc: "3 key takeaways instantly" },
          { icon: "🔊", label: "Smart TTS", desc: "Natural voice with LaTeX" },
          { icon: "🎙️", label: "Voice Tutor", desc: "Ask questions mid-read" },
          { icon: "📖", label: "Bionic Reader", desc: "Dynamic word highlighting" },
        ].map((f, i) => (
          <div className="feature-pill" key={i}>
            <span className="feature-icon">{f.icon}</span>
            <div>
              <div className="feature-label">{f.label}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
