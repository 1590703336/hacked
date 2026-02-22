import { useEffect, useRef, useState, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultText, setResultText] = useState("");
  const [showOcrText, setShowOcrText] = useState(false);
  const [processedImages, setProcessedImages] = useState([]);
  const [summaryText, setSummaryText] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsChunkCount, setTtsChunkCount] = useState(0);
  const [ttsChunks, setTtsChunks] = useState([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(null);
  const [readingTarget, setReadingTarget] = useState(null);
  const [ttsSourceLabel, setTtsSourceLabel] = useState("");
  const [tutorMessages, setTutorMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const [tutorError, setTutorError] = useState(null);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const OCR_CONCURRENCY = 3;
  const TTS_SPEED = 1.0;
  const TTS_GAIN_BOOST = 2.3;

  const eventSourceRef = useRef(null);
  const streamSessionIdRef = useRef("");
  const streamPausedOnServerRef = useRef(false);
  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const streamDoneRef = useRef(false);
  const ttsMimeTypeRef = useRef("audio/wav");
  const tutorMessagesRef = useRef([]);
  const resultTextRef = useRef("");
  const summaryTextRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const tutorAudioRef = useRef(null);
  const currentAudioBoostCleanupRef = useRef(() => { });
  const tutorAudioBoostCleanupRef = useRef(() => { });
  const ttsAudioContextRef = useRef(null);
  const ttsGainNodeRef = useRef(null);
  const ttsCompressorRef = useRef(null);
  const togglePauseReadingRef = useRef(() => { });
  const pauseReadingRef = useRef(() => { });
  const isReadingRef = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const tutorStartedAtRef = useRef(0);
  const unmountCleanupRef = useRef(() => { });
  const fileInputRef = useRef(null);
  const broadcastEnabledRef = useRef(true);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const speakFeedback = useCallback((text, { force = false } = {}) => {
    return new Promise((resolve) => {
      if (!text) return resolve();
      if (!force && !broadcastEnabledRef.current) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      // Also resolve on error so we don't hang if TTS fails
      utterance.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const toggleBroadcast = useCallback(() => {
    if (broadcastEnabledRef.current) {
      window.speechSynthesis.cancel();
      broadcastEnabledRef.current = false;
      setBroadcastEnabled(false);
      return;
    }
    broadcastEnabledRef.current = true;
    setBroadcastEnabled(true);
    speakFeedback("Broadcast voice is on.", { force: true });
  }, [speakFeedback]);

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const makeStreamId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `tts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const sendStreamControl = (action) => {
    const streamId = streamSessionIdRef.current;
    if (!streamId) return;
    fetch("/api/tts/stream/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamId, action }),
    }).catch((err) => {
      console.error(`Failed to send stream ${action}:`, err);
    });
  };

  const stopTutorAnswerAudio = () => {
    tutorAudioBoostCleanupRef.current();
    tutorAudioBoostCleanupRef.current = () => { };
    if (tutorAudioRef.current) {
      tutorAudioRef.current.pause();
      tutorAudioRef.current.src = "";
      tutorAudioRef.current = null;
    }
  };

  const ensureTtsAudioProcessing = () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!ttsAudioContextRef.current) {
      const ctx = new AudioContextCtor();
      const gain = ctx.createGain();
      gain.gain.value = TTS_GAIN_BOOST;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 20;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      gain.connect(compressor);
      compressor.connect(ctx.destination);
      ttsAudioContextRef.current = ctx;
      ttsGainNodeRef.current = gain;
      ttsCompressorRef.current = compressor;
    }
    if (ttsAudioContextRef.current.state === "suspended") {
      ttsAudioContextRef.current.resume().catch(() => { });
    }
    return {
      ctx: ttsAudioContextRef.current,
      gain: ttsGainNodeRef.current,
    };
  };

  const attachTtsBoost = (audioElement) => {
    const chain = ensureTtsAudioProcessing();
    if (!chain) return () => { };
    try {
      const sourceNode = chain.ctx.createMediaElementSource(audioElement);
      sourceNode.connect(chain.gain);
      return () => {
        try {
          sourceNode.disconnect();
        } catch {
          // no-op
        }
      };
    } catch (err) {
      console.warn("TTS boost hookup skipped:", err);
      return () => { };
    }
  };

  const releaseTtsAudioProcessing = () => {
    if (ttsAudioContextRef.current) {
      ttsAudioContextRef.current.close().catch(() => { });
    }
    ttsAudioContextRef.current = null;
    ttsGainNodeRef.current = null;
    ttsCompressorRef.current = null;
  };

  const releaseRecorder = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    recordedChunksRef.current = [];
  };

  const clearAudio = () => {
    currentAudioBoostCleanupRef.current();
    currentAudioBoostCleanupRef.current = () => { };
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const stopReading = () => {
    if (streamSessionIdRef.current) {
      sendStreamControl("stop");
    }
    streamDoneRef.current = true;
    closeStream();
    streamSessionIdRef.current = "";
    streamPausedOnServerRef.current = false;
    clearAudio();
    isPausedRef.current = false;
    setIsReading(false);
    setIsPaused(false);
    setCurrentChunkIndex(null);
    setReadingTarget(null);
  };

  const pauseReading = () => {
    if (!isReading) return;
    isPausedRef.current = true;
    setIsPaused(true);
    if (!streamPausedOnServerRef.current) {
      streamPausedOnServerRef.current = true;
      sendStreamControl("pause");
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
  };

  const resumeReading = () => {
    if (!isReading) return;
    stopTutorAnswerAudio();
    if (streamPausedOnServerRef.current) {
      streamPausedOnServerRef.current = false;
      sendStreamControl("resume");
    }
    isPausedRef.current = false;
    setIsPaused(false);
    if (currentAudioRef.current) {
      currentAudioRef.current.play().catch((err) => {
        console.error("Resume playback failed:", err);
        setTtsError("Unable to resume playback automatically");
      });
      return;
    }
    playNextChunk();
  };

  const togglePauseReading = () => {
    if (!isReading) return;
    if (isPausedRef.current) {
      resumeReading();
    } else {
      pauseReading();
    }
  };

  const playNextChunk = () => {
    if (isPlayingRef.current || isPausedRef.current) return;
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
    const mimeType = nextChunk.mimeType || ttsMimeTypeRef.current || "audio/wav";
    const audio = new Audio(`data:${mimeType};base64,${nextChunk.audioBase64}`);
    currentAudioRef.current = audio;
    currentAudioBoostCleanupRef.current = attachTtsBoost(audio);

    audio.onended = () => {
      currentAudioBoostCleanupRef.current();
      currentAudioBoostCleanupRef.current = () => { };
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      playNextChunk();
    };

    audio.onerror = () => {
      currentAudioBoostCleanupRef.current();
      currentAudioBoostCleanupRef.current = () => { };
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

  const handleTtsStreamPayload = (payload) => {
    if (payload.type === "metadata") {
      setTtsChunkCount(payload.chunkCount || 0);
      if (typeof payload.streamId === "string" && payload.streamId.length > 0) {
        streamSessionIdRef.current = payload.streamId;
      }
      if (typeof payload.mimeType === "string" && payload.mimeType.length > 0) {
        ttsMimeTypeRef.current = payload.mimeType;
      }
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
      streamSessionIdRef.current = "";
      streamPausedOnServerRef.current = false;
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        setIsReading(false);
        setCurrentChunkIndex(null);
        setReadingTarget(null);
      }
    }
  };

  const startReading = (textToRead, target) => {
    if (!textToRead || typeof textToRead !== "string" || textToRead.trim().length === 0) return;
    if (isReading && readingTarget === target) return;

    stopTutorAnswerAudio();
    stopReading();
    setTtsError(null);
    setTtsChunkCount(0);
    setTtsChunks([]);
    setCurrentChunkIndex(null);
    isPausedRef.current = false;
    setIsPaused(false);
    setReadingTarget(target);
    setTtsSourceLabel(target === "summary" ? "Summary" : "OCR Result");
    streamDoneRef.current = false;
    ttsMimeTypeRef.current = "audio/wav";
    streamPausedOnServerRef.current = false;

    const streamId = makeStreamId();
    streamSessionIdRef.current = streamId;
    const abortController = new AbortController();
    eventSourceRef.current = {
      close: () => abortController.abort(),
    };
    setIsReading(true);

    (async () => {
      try {
        const res = await fetch("/api/tts/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streamId,
            markdown: textToRead,
            speed: String(TTS_SPEED),
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const fallback = await res.text().catch(() => "");
          throw new Error(`TTS stream failed: ${fallback || res.status}`);
        }

        if (!res.body) {
          throw new Error("TTS stream unavailable");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");

          let boundaryIndex = sseBuffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const eventBlock = sseBuffer.slice(0, boundaryIndex).trim();
            sseBuffer = sseBuffer.slice(boundaryIndex + 2);

            if (eventBlock) {
              const dataLines = eventBlock
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim());

              if (dataLines.length > 0) {
                const rawPayload = dataLines.join("\n");
                try {
                  const payload = JSON.parse(rawPayload);
                  handleTtsStreamPayload(payload);
                } catch (parseError) {
                  console.error("Invalid SSE payload:", parseError, rawPayload);
                }
              }
            }

            boundaryIndex = sseBuffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("TTS stream failed:", err);
        streamDoneRef.current = true;
        closeStream();
        streamSessionIdRef.current = "";
        streamPausedOnServerRef.current = false;
        setTtsError("TTS stream connection dropped");
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setIsReading(false);
          setCurrentChunkIndex(null);
          setReadingTarget(null);
        }
      }
    })();
  };

  const getSummaryReadableText = (summaryInput = summaryText) => {
    if (!summaryInput) return "";
    if (typeof summaryInput === "string") return summaryInput;
    if (Array.isArray(summaryInput.takeaways)) {
      return summaryInput.takeaways
        .map((point, idx) => `${idx + 1}. ${point}`)
        .join("\n");
    }
    return JSON.stringify(summaryInput, null, 2);
  };

  const getCurrentReadingText = () => {
    const latestResultText = resultTextRef.current;
    const latestSummaryText = summaryTextRef.current;
    let context = "";
    if (latestResultText) {
      context += `[DOCUMENT TEXT]\n${latestResultText}\n\n`;
    }
    if (latestSummaryText) {
      context += `[SUMMARY]\n${getSummaryReadableText(latestSummaryText)}\n\n`;
    }
    return context.trim() || "(no content available)";
  };

  const addTutorMessage = (role, text) => {
    if (!text) return;
    setTutorMessages((prev) => [...prev, { role, text }]);
  };

  const transcribeAudioBlob = async (audioBlob, fileName = "question.webm") => {
    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);
    const transcribeRes = await fetch("/api/tutor/transcribe", {
      method: "POST",
      body: formData,
    });
    const transcribeData = await transcribeRes.json();
    if (!transcribeData.success) {
      throw new Error(transcribeData.message || "Transcription failed");
    }
    return transcribeData.data?.text?.trim() || "";
  };

  const getAudioFileName = (mimeType) => (
    mimeType && mimeType.includes("mp4") ? "question.m4a" : "question.webm"
  );

  const pickAudioMimeType = () => {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
      return "";
    }
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];
    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
  };

  const buildRecorder = (stream) => {
    const mimeType = pickAudioMimeType();
    if (mimeType) {
      return new MediaRecorder(stream, { mimeType });
    }
    return new MediaRecorder(stream);
  };

  const askTutorAndSpeak = async (questionText) => {
    const readingText = getCurrentReadingText();
    const historySnippet = tutorMessagesRef.current
      .slice(-6)
      .map((msg) => `${msg.role === "user" ? "Student" : "Tutor"}: ${msg.text}`)
      .join("\n");
    const context = [
      "Current reading content:",
      readingText || "(no content available)",
      "",
      "Recent Q&A history:",
      historySnippet || "(none)",
    ].join("\n");

    setIsTutorThinking(true);
    const askRes = await fetch("/api/tutor/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: questionText, context }),
    });
    const askData = await askRes.json();
    if (!askData.success) {
      throw new Error(askData.message || "Tutor answer failed");
    }

    const answerText = askData.data?.answer?.trim() || "";
    addTutorMessage("assistant", answerText || "I could not generate an answer.");

    if (!answerText) return;

    const ttsRes = await fetch("/api/tts/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: answerText, speed: TTS_SPEED, priority: "interactive" }),
    });
    if (!ttsRes.ok) {
      const fallback = await ttsRes.text();
      throw new Error(`Tutor TTS failed: ${fallback || ttsRes.status}`);
    }
    const audioBuffer = await ttsRes.arrayBuffer();
    const mimeType = ttsRes.headers.get("content-type") || "audio/wav";
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    const audioUrl = URL.createObjectURL(audioBlob);
    stopTutorAnswerAudio();
    if (isReadingRef.current && !isPausedRef.current) {
      pauseReadingRef.current(); // Ensuring background TTS pauses before Tutor speaks
    }
    const answerAudio = new Audio(audioUrl);
    tutorAudioRef.current = answerAudio;
    tutorAudioBoostCleanupRef.current = attachTtsBoost(answerAudio);
    answerAudio.onended = () => {
      tutorAudioBoostCleanupRef.current();
      tutorAudioBoostCleanupRef.current = () => { };
      URL.revokeObjectURL(audioUrl);
      tutorAudioRef.current = null;
    };
    answerAudio.onerror = () => {
      tutorAudioBoostCleanupRef.current();
      tutorAudioBoostCleanupRef.current = () => { };
      URL.revokeObjectURL(audioUrl);
      tutorAudioRef.current = null;
      setTutorError("Failed to play tutor audio response");
    };
    await answerAudio.play();
  };

  const stopRecordingQuestion = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const startRecordingQuestion = async ({ announce = false } = {}) => {
    if (isRecording || isTranscribing || isTutorThinking) return;
    try {
      setTutorError(null);
      if (isReadingRef.current && !isPausedRef.current) {
        pauseReadingRef.current();
      }
      stopTutorAnswerAudio();
      if (announce) {
        await speakFeedback("Recording started. Please speak your question.");
        await delay(150);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const recorder = buildRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      tutorStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationMs = Date.now() - tutorStartedAtRef.current;
        const audioBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        releaseRecorder();
        if (!audioBlob || audioBlob.size === 0) {
          setTutorError("No audio captured. Please try again.");
          return;
        }
        if (audioBlob.size < 4096 || durationMs < 900) {
          setTutorError(`Recording too short or silent (${audioBlob.size} bytes, ${Math.round(durationMs)} ms). Please speak for at least 1 second.`);
          return;
        }
        try {
          setIsTranscribing(true);
          const questionText = await transcribeAudioBlob(audioBlob, getAudioFileName(recorder.mimeType || ""));
          setIsTranscribing(false);
          if (!questionText) {
            setTutorError("Could not detect speech. Please try again.");
            return;
          }
          addTutorMessage("user", questionText);
          await askTutorAndSpeak(questionText);
        } catch (err) {
          console.error(err);
          setTutorError(err.message || "Tutor request failed");
        } finally {
          setIsTranscribing(false);
          setIsTutorThinking(false);
        }
      };

      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setTutorError("Microphone access failed");
      releaseRecorder();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    tutorMessagesRef.current = tutorMessages;
  }, [tutorMessages]);

  useEffect(() => {
    resultTextRef.current = resultText;
  }, [resultText]);

  useEffect(() => {
    summaryTextRef.current = summaryText;
  }, [summaryText]);

  useEffect(() => {
    togglePauseReadingRef.current = togglePauseReading;
    pauseReadingRef.current = pauseReading;
  });

  useEffect(() => {
    isReadingRef.current = isReading;
  }, [isReading]);

  useEffect(() => {
    unmountCleanupRef.current = () => {
      stopTutorAnswerAudio();
      releaseRecorder();
      releaseTtsAudioProcessing();
    };
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      // Just catch general global events if we need them, 
      // Space logic has been moved purely to react-hotkeys-hook.
      if (event.code === "Escape") {
        stopReading();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    // Electron IPC handlers
    let unsubscribeScreenCaptured;
    let unsubscribeShortcutCapture;
    if (window.electronAPI) {
      unsubscribeScreenCaptured = window.electronAPI.onScreenCaptured((base64Image) => {
        handleImageUpload(base64Image, "screenshot.png", "image/png");
      });
      unsubscribeShortcutCapture = window.electronAPI.onShortcutCapture(() => {
      });
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (typeof unsubscribeScreenCaptured === "function") {
        unsubscribeScreenCaptured();
      }
      if (typeof unsubscribeShortcutCapture === "function") {
        unsubscribeShortcutCapture();
      }
      closeStream();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      }
      unmountCleanupRef.current();
    };
  }, []);

  const handleImageUpload = (base64String, filename, mimeType) => {
    // Convert base64 to Blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const fileBlob = new Blob([byteArray], { type: mimeType });

    // Create a File object
    const newFile = new File([fileBlob], filename, { type: mimeType });
    setFile(newFile);
  };

  // Trigger upload whenever setFile is called (either by IPC capture or by manual file selection)
  useEffect(() => {
    if (file) {
      handleUpload();
    }
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;
    stopReading();
    stopTutorAnswerAudio();
    releaseRecorder();
    setIsRecording(false);
    setIsTranscribing(false);
    setIsTutorThinking(false);
    setTutorMessages([]);
    setTutorError(null);
    setLoading(true);
    setError(null);
    setTtsError(null);
    setResultText("");
    resultTextRef.current = "";
    setShowOcrText(false);
    setSummaryText("");
    summaryTextRef.current = "";
    setProcessedImages([]);
    setTtsChunkCount(0);
    setTtsChunks([]);
    setCurrentChunkIndex(null);
    setTtsSourceLabel("");

    if (file.name === "screenshot.png") {
      speakFeedback("Screenshot captured. Uploading and processing now.");
    } else {
      speakFeedback("Uploading and processing now.");
    }

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

      // 2. OCR API (concurrent workers, ordered output)
      const segments = new Array(images.length);
      let nextImageIndex = 0;

      const processOneImage = async (index) => {
        const base64Image = images[index];
        const ocrRes = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        const ocrData = await ocrRes.json();
        if (!ocrData.success) {
          throw new Error(ocrData.message || `OCR API failed on image ${index + 1}`);
        }

        let segment = "";
        if (images.length > 1) {
          segment += `--- Image ${index + 1} ---\n`;
        }
        if (ocrData.data.noTextDetected) {
          segment += "No text detected.\n\n";
        } else {
          segment += `${ocrData.data.markdown}\n\n`;
        }
        segments[index] = segment;
      };

      const worker = async () => {
        while (true) {
          const current = nextImageIndex;
          nextImageIndex += 1;
          if (current >= images.length) {
            return;
          }
          await processOneImage(current);
        }
      };

      const workers = Array.from(
        { length: Math.min(OCR_CONCURRENCY, images.length) },
        () => worker(),
      );
      await Promise.all(workers);
      const combinedText = segments.join("");
      setResultText(combinedText);
      resultTextRef.current = combinedText;
      speakFeedback("OCR processing finished. Document is ready.");
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
    summaryTextRef.current = "";
    speakFeedback("Summary processing started.");

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
      summaryTextRef.current = summarizeData.data;
      speakFeedback("Summary processing finished.");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSummarizing(false);
    }
  };

  // --- HOTKEYS ---
  useHotkeys('ctrl+k, cmd+k', async (e) => {
    e.preventDefault();
    if (isReadingRef.current && readingTarget === "ocr") {
      if (isPausedRef.current) {
        await speakFeedback("Reading resumed");
        togglePauseReadingRef.current();
      } else {
        togglePauseReadingRef.current();
        speakFeedback("Reading paused");
      }
    } else if (resultText) {
      void speakFeedback("OCR chunk processing started. Generating read aloud audio.");
      startReading(resultText, "ocr");
    } else {
      speakFeedback("No document is currently available to read.");
    }
  }, { enableOnFormTags: true }, [resultText, isReadingRef, isPausedRef, readingTarget]);

  useHotkeys('ctrl+l, cmd+l', async (e) => {
    e.preventDefault();
    if (isReadingRef.current && readingTarget === "summary") {
      if (isPausedRef.current) {
        await speakFeedback("Reading resumed");
        togglePauseReadingRef.current();
      } else {
        togglePauseReadingRef.current();
        speakFeedback("Reading paused");
      }
    } else if (summaryText) {
      void speakFeedback("Summary chunk processing started. Generating read aloud audio.");
      startReading(getSummaryReadableText(), "summary");
    } else {
      speakFeedback("No summary has been generated yet.");
    }
  }, { enableOnFormTags: true }, [summaryText, isReadingRef, isPausedRef, readingTarget]);

  useHotkeys('ctrl+r, cmd+r', async (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecordingQuestion();
      await speakFeedback("Recording stopped. Processing.");
    } else {
      await startRecordingQuestion({ announce: true });
    }
  }, { enableOnFormTags: true }, [isRecording, startRecordingQuestion, stopRecordingQuestion, speakFeedback]);

  useHotkeys('ctrl+u, cmd+u', (e) => {
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
      speakFeedback("Upload file dialog opened");
    }
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+shift+a, cmd+shift+a', async (e) => {
    e.preventDefault();
    if (window.electronAPI?.requestCapture) {
      window.electronAPI.requestCapture();
      return;
    }
  }, { enableOnFormTags: true }, [speakFeedback]);

  useHotkeys('ctrl+s, cmd+s', (e) => {
    e.preventDefault();
    if (resultText && !summarizing) {
      handleSummarize();
    } else if (summarizing) {
      speakFeedback("Already summarizing.");
    } else {
      speakFeedback("No document to summarize.");
    }
  }, { enableOnFormTags: true }, [resultText, summarizing]);

  useHotkeys('ctrl+m', (e) => {
    e.preventDefault();
    toggleBroadcast();
  }, { enableOnFormTags: true }, [toggleBroadcast]);

  useHotkeys('ctrl+h, cmd+h', (e) => {
    e.preventDefault();
    if (isReadingRef.current && !isPausedRef.current) {
      pauseReadingRef.current();
    }
    speakFeedback("Shortcuts: Control K to read or pause document. Control L to read or pause summary. Control R to record a question. Control Shift A to capture a screenshot and run OCR. Control U to upload a file. Control S to summarize. Control M toggles broadcast voice.");
  }, { enableOnFormTags: true });

  // --- ACCESSIBILITY ANNOUNCEMENTS ---
  // Browsers block autoplay audio (including TTS) until a user interaction occurs.
  // We fire the welcome message explicitly in the onClick/onKeyDown of the welcome overlay.

  useEffect(() => {
    if (resultText && !summaryText) {
      speakFeedback("Document processed. Control S to summarize. Control K to read document aloud. Control R to ask a question. Control Shift A to capture another screenshot.");
    }
  }, [resultText, summaryText, speakFeedback]);

  useEffect(() => {
    if (summaryText) {
      speakFeedback("Summary generated. Control L to read summary aloud.");
    }
  }, [summaryText, speakFeedback]);

  const handleInitialInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      speakFeedback("Lumina is ready. Shortcuts: Control U to upload a file. Control Shift A to capture screenshot and run OCR. Control M toggles broadcast voice. Control H repeats shortcut help.");
    }
  };

  if (!hasInteracted) {
    return (
      <div
        onClick={handleInitialInteraction}
        onKeyDown={handleInitialInteraction}
        tabIndex={0}
        className="welcome-shell"
      >
        <div className="welcome-card">
          <span className="welcome-tag mono">Accessibility First</span>
          <h1 className="welcome-title">Lumina</h1>
          <p className="welcome-subtitle">
            Click anywhere or press any key to start. Lumina is tuned for high contrast, keyboard-first control, and voice feedback.
          </p>
          <div className="hotkey-grid">
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + U</kbd>Upload file</span>
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + Shift + A</kbd>Capture OCR</span>
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + K</kbd>Read document</span>
            <span className="hotkey-chip"><kbd>Ctrl + M</kbd>Toggle broadcast</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? "Processing document. Please wait." : ""}
        {summarizing ? "Generating summary." : ""}
        {isRecording ? "Listening to your question." : ""}
        {isTranscribing ? "Transcribing your audio." : ""}
        {isTutorThinking ? "Tutor is thinking." : ""}
        {error ? "Error: " + error : ""}
        {ttsError ? "Audio Error: " + ttsError : ""}
        {tutorError ? "Tutor Error: " + tutorError : ""}
      </div>

      <div className="topbar">
        <div className="title-wrap">
          <h1>Lumina</h1>
          <p>High-contrast OCR, summarization, read-aloud, and voice Q&A in one workspace.</p>
        </div>
        <button onClick={toggleBroadcast} className={`btn ${broadcastEnabled ? "btn-primary" : "btn-ghost"}`}>
          Broadcast: {broadcastEnabled ? "On" : "Off"} (Ctrl+M)
        </button>
      </div>

      <div className="panel upload-panel">
        <div className="upload-row">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden-file-input"
            onChange={(e) => {
              const selectedFile = e.target.files[0];
              if (selectedFile) {
                setFile(selectedFile);
              }
            }}
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary">
            Choose File
          </button>
          <span className="info-line small" style={{ margin: 0 }}>
            {file ? `Selected: ${file.name}` : "Supports images and PDF. Processing starts automatically after selection."}
          </span>
          {loading && (
            <span className="status-pill">
              <span className="status-dot" /> Processing document...
            </span>
          )}
        </div>
        <div className="upload-meta mono">Shortcuts: Ctrl/Cmd + U upload, Ctrl/Cmd + Shift + A capture OCR, Ctrl + M broadcast toggle</div>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error: </strong> {error}
        </div>
      )}

      {resultText && (
        <div className="panel" style={{ padding: "14px" }}>
          <div className="section-title">
            <h2>Document Processed</h2>
          </div>

          {processedImages && processedImages.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div className="section-title">
                <h3>Images (Screenshots / Uploads)</h3>
              </div>
              <div className="image-strip">
                {processedImages.map((base64Img, idx) => (
                  <img
                    key={idx}
                    src={`data:image/png;base64,${base64Img}`}
                    alt={`Processed document page ${idx + 1}`}
                    className="image-thumb"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="button-row">
            <button onClick={() => setShowOcrText(!showOcrText)} className="btn btn-ghost">
              {showOcrText ? "Hide Transcription" : "Show Transcription"}
            </button>
          </div>

          {showOcrText && <pre className="text-block">{resultText}</pre>}

          <div className="button-row">
            <button onClick={handleSummarize} disabled={summarizing} className="btn btn-warning">
              {summarizing ? "Summarizing..." : "Summarize"}
            </button>

            {!isReading || readingTarget !== "ocr" ? (
              <button onClick={() => startReading(resultText, "ocr")} className="btn btn-success">
                {isReading ? "Switch To OCR Read" : "Read OCR Aloud"}
              </button>
            ) : (
              <>
                <button onClick={togglePauseReading} className={`btn ${isPaused ? "btn-success" : "btn-danger"}`}>
                  {isPaused ? "Resume OCR (Space)" : "Pause OCR (Space)"}
                </button>
                <button onClick={stopReading} className="btn btn-ghost">
                  Stop OCR
                </button>
              </>
            )}
          </div>

          {(isReading || ttsChunkCount > 0 || ttsChunks.length > 0) && (
            <div className="chunk-panel">
              <div className="chunk-head">
                {ttsSourceLabel ? `${ttsSourceLabel} Read-Aloud Chunks` : "Read-Aloud Chunks"} ({ttsChunkCount || ttsChunks.length})
                {isReading && isPaused ? " - Paused" : ""}
              </div>
              <div className="chunk-list">
                {Array.from({ length: ttsChunkCount || ttsChunks.length }).map((_, idx) => {
                  const chunkText = ttsChunks[idx] || `Chunk ${idx + 1} generating...`;
                  const isActive = currentChunkIndex === idx;
                  const isRead = currentChunkIndex !== null && idx < currentChunkIndex;
                  return (
                    <div
                      key={idx}
                      className={`chunk-item ${isActive ? "active" : ""} ${isRead ? "read" : ""}`}
                    >
                      {chunkText}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ttsError && (
            <div className="alert alert-error">
              <strong>TTS: </strong>{ttsError}
            </div>
          )}

          {summaryText && (
            <div>
              <div className="section-title">
                <h3>Summary</h3>
                <div className="button-row" style={{ marginBottom: 0 }}>
                  {!isReading || readingTarget !== "summary" ? (
                    <button onClick={() => startReading(getSummaryReadableText(), "summary")} className="btn btn-info btn-xs">
                      Read Summary Aloud
                    </button>
                  ) : (
                    <button onClick={togglePauseReading} className={`btn btn-xs ${isPaused ? "btn-success" : "btn-danger"}`}>
                      {isPaused ? "Resume Summary (Space)" : "Pause Summary (Space)"}
                    </button>
                  )}
                  {isReading && readingTarget === "summary" && (
                    <button onClick={stopReading} className="btn btn-xs btn-ghost">
                      Stop Summary
                    </button>
                  )}
                </div>
              </div>
              <div className="summary-box">
                {Array.isArray(summaryText?.takeaways) ? (
                  <ul className="summary-list">
                    {summaryText.takeaways.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  <pre className="text-block" style={{ marginBottom: 0 }}>
                    {JSON.stringify(summaryText, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(resultText || summaryText) && (
        <div className="floating-tutor">
          <div className="tutor-head">
            <strong>Tutor Q&A</strong>
            <span>Multi-turn</span>
          </div>

          <div className="button-row" style={{ marginBottom: "8px" }}>
            {!isRecording ? (
              <button
                onClick={startRecordingQuestion}
                disabled={isTranscribing || isTutorThinking}
                className="btn btn-primary btn-xs"
              >
                Start Voice Question
              </button>
            ) : (
              <button onClick={stopRecordingQuestion} className="btn btn-danger btn-xs">
                Stop Recording
              </button>
            )}

            {isReading && (
              <button onClick={togglePauseReading} className="btn btn-ghost btn-xs">
                {isPaused ? "Continue Reading" : "Pause Reading"}
              </button>
            )}
          </div>

          {(isRecording || isTranscribing || isTutorThinking) && (
            <div className="tutor-status">
              {isRecording
                ? "Recording... click Stop Recording when done."
                : isTranscribing
                  ? "Transcribing question with Whisper..."
                  : "Thinking and generating answer..."}
            </div>
          )}

          {tutorError && <div className="alert alert-error">{tutorError}</div>}

          <div className="tutor-history">
            {tutorMessages.length === 0 && (
              <div className="tutor-empty">
                Ask by voice about what was just read. Space pauses/resumes reading.
              </div>
            )}
            {tutorMessages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`tutor-bubble ${msg.role === "user" ? "user" : ""}`}>
                <div className="tutor-role">{msg.role === "user" ? "You" : "Tutor"}</div>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
