import { useState } from "react";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultText, setResultText] = useState("");
  const [processedImages, setProcessedImages] = useState([]);
  const [summaryText, setSummaryText] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultText("");
    setSummaryText("");
    setProcessedImages([]);

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
              marginBottom: "1rem"
            }}
          >
            {summarizing ? "Summarizing..." : "Summarize"}
          </button>

          {summaryText && (
            <div>
              <h3>Summary</h3>
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
