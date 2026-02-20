import { useState } from "react";

export default function Navbar({ currentPage, navigate }) {
  const [dyslexicFont, setDyslexicFont] = useState(false);

  const toggleFont = () => {
    setDyslexicFont(!dyslexicFont);
    document.body.classList.toggle("dyslexic-mode");
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate("home")}>
        <div className="brand-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="var(--accent)" strokeWidth="2"/>
            <path d="M8 14h4m0 0l-2-3m2 3l-2 3M16 10l4 4-4 4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="brand-name">Lumina<span className="brand-accent">AI</span></span>
      </div>

      <div className="navbar-links">
        <button className={`nav-link ${currentPage === "home" ? "active" : ""}`} onClick={() => navigate("home")}>Capture</button>
        <button className={`nav-link ${currentPage === "reader" ? "active" : ""}`} onClick={() => navigate("reader")}>Reader</button>
        <button className={`nav-link ${currentPage === "tutor" ? "active" : ""}`} onClick={() => navigate("tutor")}>Tutor</button>
      </div>

      <div className="navbar-actions">
        <button className={`font-toggle ${dyslexicFont ? "active" : ""}`} onClick={toggleFont} title="Toggle OpenDyslexic font">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 14V4l6 8 6-8v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Dy</span>
        </button>
        <div className="accessibility-badge">A11Y</div>
      </div>
    </nav>
  );
}
