import { useState } from "react";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultText, setResultText] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultText("");

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

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Simple Upload & OCR</h1>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{ padding: "0.5rem 1rem", cursor: (!file || loading) ? "not-allowed" : "pointer" }}
        >
          {loading ? "Processing..." : "Upload & Process"}
        </button>
      </div>

      {error && (
        <div style={{ color: "red", backgroundColor: "#ffe6e6", padding: "1rem", borderRadius: "4px", marginBottom: "1rem" }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {resultText && (
        <div>
          <h2>Result</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: "1rem", borderRadius: "4px", border: "1px solid #ddd" }}>
            {resultText}
          </pre>
        </div>
      )}
    </div>
  );
}
