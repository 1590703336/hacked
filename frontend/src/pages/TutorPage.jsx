import { useState, useRef, useEffect } from "react";
import { tutorService, MOCK_CHAT_HISTORY } from "../services/index.js";

export default function TutorPage({ content, navigate }) {
  const [messages, setMessages] = useState(MOCK_CHAT_HISTORY);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    const result = await tutorService.ask(text, content?.text || "");
    setIsThinking(false);

    if (result.success) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "ai", text: result.data.answer }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      // Mock: simulate voice transcription
      setIsThinking(true);
      const result = await tutorService.transcribe(null);
      setIsThinking(false);
      if (result.success) sendMessage(result.data.text);
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div className="tutor-page">
      {/* Context sidebar */}
      <div className="tutor-sidebar">
        <button className="back-btn" onClick={() => navigate("reader", content)}>← Reader</button>
        <div className="context-panel">
          <h3 className="panel-title">Current Context</h3>
          <div className="context-snippet">
            <p className="context-title">{content?.title || "Statistics Lecture — ANOVA"}</p>
            <p className="context-preview">{(content?.text || "").slice(0, 200)}...</p>
          </div>
        </div>
        <div className="control-panel">
          <h3 className="panel-title">Quick Questions</h3>
          <div className="quick-questions">
            {[
              "Explain this in simple terms",
              "What's the most important concept?",
              "Give me a real-world example",
              "What should I know before this?",
            ].map((q, i) => (
              <button key={i} className="quick-q-btn" onClick={() => sendMessage(q)}>{q}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-area">
        <div className="chat-header">
          <div className="ai-avatar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="var(--accent)" strokeWidth="1.5"/>
              <path d="M6 10h8M10 6v8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="chat-ai-name">Lumina Tutor</div>
            <div className="chat-ai-status">● Online — context-aware</div>
          </div>
        </div>

        <div className="chat-messages">
          <div className="chat-intro">
            <div className="intro-bubble">
              👋 Hi! I'm your AI tutor. I have context from your document and can answer questions, explain concepts, or give real-world analogies. Ask me anything!
            </div>
          </div>

          {messages.map((msg, i) => (
            <div key={msg.id} className={`chat-bubble-wrap ${msg.role}`} style={{ animationDelay: `${i * 50}ms` }}>
              {msg.role === "ai" && (
                <div className="bubble-avatar">AI</div>
              )}
              <div className={`chat-bubble ${msg.role}`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="chat-bubble-wrap ai">
              <div className="bubble-avatar">AI</div>
              <div className="chat-bubble ai thinking">
                <div className="thinking-dots"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <button
            className={`voice-btn ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title="Voice input"
          >
            🎙️
          </button>
          <textarea
            className="chat-input"
            placeholder="Ask about anything in the document..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim()}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
