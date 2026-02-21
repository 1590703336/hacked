import { useEffect, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultText, setResultText] = useState("");
  const [processedImages, setProcessedImages] = useState([]);
  const [summaryText, setSummaryText] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsChunkCount, setTtsChunkCount] = useState(0);
  const [ttsChunks, setTtsChunks] = useState([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(null);
  const [readingTarget, setReadingTarget] = useState(null);
  const [ttsSourceLabel, setTtsSourceLabel] = useState("");

  const eventSourceRef = useRef(null);
  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const streamDoneRef = useRef(false);

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const clearAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const stopReading = () => {
    streamDoneRef.current = true;
    closeStream();
    clearAudio();
    setIsReading(false);
    setCurrentChunkIndex(null);
    setReadingTarget(null);
  };

  const playNextChunk = () => {
    if (isPlayingRef.current) return;
    const nextChunk = audioQueueRef.current.shift();

    if (!nextChunk) {
      if (streamDoneRef.current) {
        setIsReading(false);
        setCurrentChunkIndex(null);
      }
      return;
    }

    isPlayingRef.current = true;
    setCurrentChunkIndex(nextChunk.chunkIndex);
    const audio = new Audio(`data:audio/mpeg;base64,${nextChunk.audioBase64}`);
    currentAudioRef.current = audio;

    audio.onended = () => {
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      playNextChunk();
    };

    audio.onerror = () => {
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      setTtsError(`Chunk ${nextChunk.chunkIndex + 1} playback failed`);
      playNextChunk();
    };

    audio.play().catch((playError) => {
      console.error("Audio play failed:", playError);
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      setTtsError("Audio playback was blocked. Click read aloud again.");
      stopReading();
    });
  };

  const startReading = (textToRead, target) => {
    if (!textToRead || typeof textToRead !== "string" || textToRead.trim().length === 0) return;
    if (isReading && readingTarget === target) return;

    stopReading();
    setTtsError(null);
    setTtsChunkCount(0);
    setTtsChunks([]);
    setCurrentChunkIndex(null);
    setReadingTarget(target);
    setTtsSourceLabel(target === "summary" ? "Summary" : "OCR Result");
    streamDoneRef.current = false;

    const params = new URLSearchParams({ markdown: textToRead });
    const stream = new EventSource(`/api/tts/stream?${params.toString()}`);
    eventSourceRef.current = stream;
    setIsReading(true);

    stream.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (parseError) {
        console.error("Invalid SSE payload:", parseError, event.data);
        return;
      }

      if (payload.type === "metadata") {
        setTtsChunkCount(payload.chunkCount || 0);
        return;
      }

      if (payload.type === "audio") {
        setTtsChunks((prev) => {
          const next = [...prev];
          next[payload.chunkIndex] = payload.text || "";
          return next;
        });

        audioQueueRef.current.push(payload);
        playNextChunk();
        return;
      }

      if (payload.type === "error") {
        setTtsError(payload.message || "Failed to synthesize one chunk");
        return;
      }

      if (payload.type === "done") {
        streamDoneRef.current = true;
        closeStream();
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setIsReading(false);
          setCurrentChunkIndex(null);
          setReadingTarget(null);
        }
      }
    };

    stream.onerror = () => {
      streamDoneRef.current = true;
      closeStream();
      setTtsError("TTS stream connection dropped");
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        setIsReading(false);
        setCurrentChunkIndex(null);
        setReadingTarget(null);
      }
    };
  };

  const getSummaryReadableText = () => {
    if (!summaryText) return "";
    if (typeof summaryText === "string") return summaryText;
    if (Array.isArray(summaryText.takeaways)) {
      return summaryText.takeaways
        .map((point, idx) => `${idx + 1}. ${point}`)
        .join("\n");
    }
    return JSON.stringify(summaryText, null, 2);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      }
    };
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    stopReading();
    setLoading(true);
    setError(null);
    setTtsError(null);
    setResultText("");
    setSummaryText("");
    setProcessedImages([]);
    setTtsChunkCount(0);
    setTtsChunks([]);
    setCurrentChunkIndex(null);
    setTtsSourceLabel("");

    try {
      // 1. Capture API
      const formData = new FormData();
      formData.append("file", file);

      const captureRes = await fetch("/api/capture/upload", {
        method: "POST",
        body: formData,
      });

      const captureData = await captureRes.json();
      if (!captureData.success) {
        throw new Error(captureData.message || "Capture API failed");
      }

      const images = captureData.data.images;
      if (!images || images.length === 0) {
        throw new Error("No images returned from Capture API");
      }

      setProcessedImages(images);

      // 2. OCR API for each image
      let combinedText = "";
      for (let i = 0; i < images.length; i++) {
        const base64Image = images[i];
        const ocrRes = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        const ocrData = await ocrRes.json();
        if (!ocrData.success) {
          throw new Error(ocrData.message || `OCR API failed on image ${i + 1}`);
        }

        if (images.length > 1) {
          combinedText += `--- Image ${i + 1} ---\n`;
        }
        if (ocrData.data.noTextDetected) {
          combinedText += "No text detected.\n\n";
        } else {
          combinedText += ocrData.data.markdown + "\n\n";
        }
      }

      setResultText(combinedText);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!resultText) return;
    setSummarizing(true);
    setError(null);
    setSummaryText("");

    try {
      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: resultText }),
      });

      const summarizeData = await summarizeRes.json();
      if (!summarizeData.success) {
        throw new Error(summarizeData.message || "Summarize API failed");
      }

      setSummaryText(summarizeData.data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Simple Upload & OCR</h1>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ color: "var(--text, black)" }}
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            padding: "0.5rem 1rem",
            cursor: (!file || loading) ? "not-allowed" : "pointer",
            backgroundColor: "#3ecfcf",
            color: "#080b0f",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold"
          }}
        >
          {loading ? "Processing..." : "Upload & Process"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#d32f2f", backgroundColor: "#ffebee", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {resultText && (
        <div>
          <h2>Result</h2>
          <pre style={{
            whiteSpace: "pre-wrap",
            backgroundColor: "#1e2836",
            color: "#e8f0f8",
            padding: "1.5rem",
            borderRadius: "8px",
            border: "1px solid #263545",
            marginTop: "1rem",
            marginBottom: "1rem"
              }}>
                {resultText}
              </pre>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              style={{
                padding: "0.5rem 1rem",
                cursor: summarizing ? "not-allowed" : "pointer",
                backgroundColor: "#fcba03",
                color: "#080b0f",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
              }}
            >
              {summarizing ? "Summarizing..." : "Summarize"}
            </button>

            {!isReading ? (
              <button
                onClick={() => startReading(resultText, "ocr")}
                style={{
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  backgroundColor: "#3ef07a",
                  color: "#080b0f",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                }}
              >
                Read OCR Aloud
              </button>
            ) : readingTarget === "ocr" ? (
              <button
                onClick={stopReading}
                style={{
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  backgroundColor: "#ff7c3e",
                  color: "#080b0f",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                }}
              >
                Stop Reading
              </button>
            ) : (
              <button
                onClick={() => startReading(resultText, "ocr")}
                style={{
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  backgroundColor: "#3ef07a",
                  color: "#080b0f",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                }}
              >
                Switch To OCR Read
              </button>
            )}
          </div>

          {(isReading || ttsChunkCount > 0 || ttsChunks.length > 0) && (
            <div style={{
              backgroundColor: "#151d26",
              border: "1px solid #263545",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1rem"
            }}>
              <div style={{ marginBottom: "0.75rem", color: "#8fa4bc", fontSize: "0.9rem" }}>
                {ttsSourceLabel ? `${ttsSourceLabel} Read-Aloud Chunks` : "Read-Aloud Chunks"} ({ttsChunkCount || ttsChunks.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "280px", overflowY: "auto" }}>
                {Array.from({ length: ttsChunkCount || ttsChunks.length }).map((_, idx) => {
                  const chunkText = ttsChunks[idx] || `Chunk ${idx + 1} generating...`;
                  const isActive = currentChunkIndex === idx;
                  const isRead = currentChunkIndex !== null && idx < currentChunkIndex;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderRadius: "8px",
                        border: `1px solid ${isActive ? "#3ecfcf" : "#263545"}`,
                        backgroundColor: isActive ? "rgba(62, 207, 207, 0.14)" : (isRead ? "#0e141b" : "#111923"),
                        color: isActive ? "#e8f0f8" : "#b8c6d5",
                        fontSize: "0.86rem",
                        lineHeight: 1.5
                      }}
                    >
                      {chunkText}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ttsError && (
            <div style={{ color: "#ffd0c0", backgroundColor: "#3c1c0f", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
              <strong>TTS: </strong>{ttsError}
            </div>
          )}

          {summaryText && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                <h3>Summary</h3>
                {!isReading || readingTarget !== "summary" ? (
                  <button
                    onClick={() => startReading(getSummaryReadableText(), "summary")}
                    style={{
                      padding: "0.35rem 0.75rem",
                      cursor: "pointer",
                      backgroundColor: "#3e9fff",
                      color: "#080b0f",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                    }}
                  >
                    Read Summary Aloud
                  </button>
                ) : (
                  <button
                    onClick={stopReading}
                    style={{
                      padding: "0.35rem 0.75rem",
                      cursor: "pointer",
                      backgroundColor: "#ff7c3e",
                      color: "#080b0f",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                    }}
                  >
                    Stop Summary
                  </button>
                )}
              </div>
              <div style={{
                backgroundColor: "#2a3b4c",
                color: "#e8f0f8",
                padding: "1.5rem",
                borderRadius: "8px",
                border: "1px solid #3c5268",
                marginTop: "0.5rem"
              }}>
                {summaryText.takeaways ? (
                  <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
                    {summaryText.takeaways.map((point, i) => (
                      <li key={i} style={{ marginBottom: "0.5rem", lineHeight: "1.5" }}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(summaryText, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {processedImages.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Processed Images ({processedImages.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {processedImages.map((base64Image, idx) => (
              <div key={idx} style={{ border: "1px solid #263545", borderRadius: "8px", padding: "0.5rem", backgroundColor: "#1e2836" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold", color: "#e8f0f8" }}>Image {idx + 1}</p>
                <img
                  src={`data:image/png;base64,${base64Image}`}
                  alt={`Processed ${idx + 1}`}
                  style={{ maxWidth: "100%", height: "auto", borderRadius: "4px" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
