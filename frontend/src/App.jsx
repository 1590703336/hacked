import { useEffect, useRef, useState, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import "./App.css";

export default function App() {
  const [activePage, setActivePage] = useState("main");
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
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [readingTarget, setReadingTarget] = useState(null);
  const [ttsSourceLabel, setTtsSourceLabel] = useState("");
  const [tutorMessages, setTutorMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const [tutorError, setTutorError] = useState(null);
  const [whisperTestRecording, setWhisperTestRecording] = useState(false);
  const [whisperTestTranscribing, setWhisperTestTranscribing] = useState(false);
  const [whisperTestError, setWhisperTestError] = useState(null);
  const [whisperTestText, setWhisperTestText] = useState("");
  const [whisperTestHistory, setWhisperTestHistory] = useState([]);
  const [whisperTestMeta, setWhisperTestMeta] = useState(null);
  const [whisperTestHasPlayback, setWhisperTestHasPlayback] = useState(false);
  const [whisperTestPlaying, setWhisperTestPlaying] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [micPeak, setMicPeak] = useState(0);
  const OCR_CONCURRENCY = 3;
  const TTS_SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

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
  const togglePauseReadingRef = useRef(() => { });
  const pauseReadingRef = useRef(() => { });
  const isReadingRef = useRef(false);
  const whisperTestRecorderRef = useRef(null);
  const whisperTestStreamRef = useRef(null);
  const whisperTestChunksRef = useRef([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const whisperTestStartedAtRef = useRef(0);
  const whisperTestPlaybackAudioRef = useRef(null);
  const whisperTestPlaybackUrlRef = useRef("");
  const whisperTestMonitorAudioContextRef = useRef(null);
  const whisperTestMonitorAnalyserRef = useRef(null);
  const whisperTestMonitorSourceRef = useRef(null);
  const whisperTestMonitorTimerRef = useRef(null);
  const whisperTestPeakRef = useRef(0);
  const tutorStartedAtRef = useRef(0);
  const unmountCleanupRef = useRef(() => { });
  const fileInputRef = useRef(null);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const speakFeedback = useCallback((text) => {
    return new Promise((resolve) => {
      if (!text) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      // Also resolve on error so we don't hang if TTS fails
      utterance.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

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
    if (tutorAudioRef.current) {
      tutorAudioRef.current.pause();
      tutorAudioRef.current.src = "";
      tutorAudioRef.current = null;
    }
  };

  const clearWhisperTestPlayback = () => {
    if (whisperTestPlaybackAudioRef.current) {
      whisperTestPlaybackAudioRef.current.pause();
      whisperTestPlaybackAudioRef.current.src = "";
      whisperTestPlaybackAudioRef.current = null;
    }
    if (whisperTestPlaybackUrlRef.current) {
      URL.revokeObjectURL(whisperTestPlaybackUrlRef.current);
      whisperTestPlaybackUrlRef.current = "";
    }
    setWhisperTestHasPlayback(false);
    setWhisperTestPlaying(false);
  };

  const setWhisperTestPlaybackBlob = (audioBlob) => {
    clearWhisperTestPlayback();
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    whisperTestPlaybackUrlRef.current = url;
    whisperTestPlaybackAudioRef.current = audio;
    audio.onended = () => {
      setWhisperTestPlaying(false);
    };
    audio.onerror = () => {
      setWhisperTestPlaying(false);
      setWhisperTestError("Local playback failed");
    };
    setWhisperTestHasPlayback(true);
  };

  const toggleWhisperTestPlayback = () => {
    const audio = whisperTestPlaybackAudioRef.current;
    if (!audio) return;
    if (whisperTestPlaying) {
      audio.pause();
      setWhisperTestPlaying(false);
      return;
    }
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play().then(() => {
      setWhisperTestPlaying(true);
    }).catch((err) => {
      console.error(err);
      setWhisperTestError("Local playback was blocked by browser");
      setWhisperTestPlaying(false);
    });
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
            speed: String(ttsSpeed),
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

  const loadAudioInputDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === "audioinput");
      setAudioInputs(inputs);
      setSelectedAudioInputId((prev) => prev || inputs[0]?.deviceId || "");
    } catch (err) {
      console.error("Failed to enumerate audio devices:", err);
    }
  };

  const stopWhisperTestMicMonitor = () => {
    if (whisperTestMonitorTimerRef.current) {
      clearInterval(whisperTestMonitorTimerRef.current);
      whisperTestMonitorTimerRef.current = null;
    }
    if (whisperTestMonitorSourceRef.current) {
      whisperTestMonitorSourceRef.current.disconnect();
      whisperTestMonitorSourceRef.current = null;
    }
    if (whisperTestMonitorAnalyserRef.current) {
      whisperTestMonitorAnalyserRef.current.disconnect();
      whisperTestMonitorAnalyserRef.current = null;
    }
    if (whisperTestMonitorAudioContextRef.current) {
      whisperTestMonitorAudioContextRef.current.close().catch(() => { });
      whisperTestMonitorAudioContextRef.current = null;
    }
    setMicLevel(0);
  };

  const startWhisperTestMicMonitor = (stream) => {
    stopWhisperTestMicMonitor();
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      whisperTestMonitorAudioContextRef.current = ctx;
      whisperTestMonitorSourceRef.current = source;
      whisperTestMonitorAnalyserRef.current = analyser;

      whisperTestMonitorTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length);
        const normalized = Math.min(1, rms * 6);
        setMicLevel(normalized);
        whisperTestPeakRef.current = Math.max(whisperTestPeakRef.current, normalized);
        setMicPeak((prev) => Math.max(prev, normalized));
      }, 120);
    } catch (err) {
      console.error("Mic monitor setup failed:", err);
    }
  };

  const playSpeakerTestTone = () => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error("AudioContext unsupported");
      const ctx = new AudioContextCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      oscillator.stop(ctx.currentTime + 0.42);
      oscillator.onended = () => {
        ctx.close().catch(() => { });
      };
    } catch (err) {
      console.error(err);
      setWhisperTestError("Could not play speaker test tone");
    }
  };

  const buildRecorder = (stream) => {
    const mimeType = pickAudioMimeType();
    if (mimeType) {
      return new MediaRecorder(stream, { mimeType });
    }
    return new MediaRecorder(stream);
  };

  const releaseWhisperTestRecorder = () => {
    stopWhisperTestMicMonitor();
    if (whisperTestRecorderRef.current) {
      whisperTestRecorderRef.current.ondataavailable = null;
      whisperTestRecorderRef.current.onstop = null;
      whisperTestRecorderRef.current = null;
    }
    if (whisperTestStreamRef.current) {
      whisperTestStreamRef.current.getTracks().forEach((track) => track.stop());
      whisperTestStreamRef.current = null;
    }
    whisperTestChunksRef.current = [];
  };

  const stopWhisperTestRecording = () => {
    if (!whisperTestRecorderRef.current || whisperTestRecorderRef.current.state === "inactive") return;
    whisperTestRecorderRef.current.stop();
    setWhisperTestRecording(false);
  };

  const startWhisperTestRecording = async () => {
    if (whisperTestRecording || whisperTestTranscribing) return;
    try {
      setWhisperTestError(null);
      setWhisperTestMeta(null);
      stopTutorAnswerAudio();
      setMicLevel(0);
      setMicPeak(0);
      whisperTestPeakRef.current = 0;

      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      };
      if (selectedAudioInputId) {
        audioConstraints.deviceId = { exact: selectedAudioInputId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      whisperTestStreamRef.current = stream;
      const recorder = buildRecorder(stream);
      whisperTestRecorderRef.current = recorder;
      whisperTestChunksRef.current = [];
      whisperTestStartedAtRef.current = Date.now();
      startWhisperTestMicMonitor(stream);
      loadAudioInputDevices();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          whisperTestChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationMs = Date.now() - whisperTestStartedAtRef.current;
        const audioBlob = new Blob(whisperTestChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        releaseWhisperTestRecorder();
        if (!audioBlob || audioBlob.size === 0) {
          setWhisperTestError("No audio captured. Please record longer and speak closer to the mic.");
          return;
        }
        setWhisperTestPlaybackBlob(audioBlob);
        setWhisperTestMeta({
          bytes: audioBlob.size,
          durationMs,
          mimeType: recorder.mimeType || "audio/webm",
          inputDevice: stream.getAudioTracks()[0]?.label || "(unknown input)",
          peak: whisperTestPeakRef.current,
        });
        const likelySilent = whisperTestPeakRef.current < 0.02;
        if (likelySilent || durationMs < 900 || audioBlob.size < 1500) {
          setWhisperTestError(`Recording too short or silent (${audioBlob.size} bytes, ${Math.round(durationMs)} ms, peak ${whisperTestPeakRef.current.toFixed(3)}). Check mic device and OS input level.`);
          setWhisperTestText("(empty)");
          setWhisperTestHistory((prev) => [
            {
              timestamp: new Date().toISOString(),
              text: "(blocked: too short/silent)",
              bytes: audioBlob.size,
              durationMs,
              mimeType: recorder.mimeType || "audio/webm",
              inputDevice: stream.getAudioTracks()[0]?.label || "(unknown input)",
              peak: whisperTestPeakRef.current,
            },
            ...prev,
          ]);
          return;
        }
        try {
          setWhisperTestTranscribing(true);
          const text = await transcribeAudioBlob(audioBlob, getAudioFileName(recorder.mimeType || ""));
          setWhisperTestText(text || "(empty)");
          setWhisperTestHistory((prev) => [
            {
              timestamp: new Date().toISOString(),
              text: text || "(empty)",
              bytes: audioBlob.size,
              durationMs,
              mimeType: recorder.mimeType || "audio/webm",
              inputDevice: stream.getAudioTracks()[0]?.label || "(unknown input)",
              peak: whisperTestPeakRef.current,
            },
            ...prev,
          ]);
        } catch (err) {
          console.error(err);
          setWhisperTestError(err.message || "Whisper test failed");
        } finally {
          setWhisperTestTranscribing(false);
        }
      };

      recorder.start(250);
      setWhisperTestRecording(true);
    } catch (err) {
      console.error(err);
      setWhisperTestError("Microphone access failed");
      releaseWhisperTestRecorder();
      setWhisperTestRecording(false);
    }
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
      body: JSON.stringify({ text: answerText, speed: ttsSpeed, priority: "interactive" }),
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
    answerAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      tutorAudioRef.current = null;
    };
    answerAudio.onerror = () => {
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
      window.speechSynthesis.cancel();
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
      releaseWhisperTestRecorder();
      clearWhisperTestPlayback();
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
    if (window.electronAPI) {
      window.electronAPI.onScreenCaptured((base64Image) => {
        handleImageUpload(base64Image, "screenshot.png", "image/png");
      });
      window.electronAPI.onShortcutCapture(() => {
      });
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      closeStream();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      }
      unmountCleanupRef.current();
    };
  }, []);

  useEffect(() => {
    if (activePage !== "whisper-test") return;
    loadAudioInputDevices();
    const onDeviceChange = () => {
      loadAudioInputDevices();
    };
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    }
    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      }
    };
  }, [activePage]);

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

  const openWhisperTestPage = () => {
    stopReading();
    stopTutorAnswerAudio();
    releaseRecorder();
    setIsRecording(false);
    setIsTranscribing(false);
    setIsTutorThinking(false);
    setActivePage("whisper-test");
  };

  const backToMainPage = () => {
    stopWhisperTestRecording();
    releaseWhisperTestRecorder();
    clearWhisperTestPlayback();
    setWhisperTestRecording(false);
    setWhisperTestTranscribing(false);
    setActivePage("main");
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
      await speakFeedback("OCR chunk processing started. Generating read aloud audio.");
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
      await speakFeedback("Summary chunk processing started. Generating read aloud audio.");
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



  useHotkeys('ctrl+h, cmd+h', (e) => {
    e.preventDefault();
    if (isReadingRef.current && !isPausedRef.current) {
      pauseReadingRef.current();
    }
    speakFeedback("Shortcuts: Control K to read or pause document. Control L to read or pause summary. Control R to record a question. Control Shift A to capture a screenshot and run OCR. Control U to upload a file. Control S to summarize.");
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
      speakFeedback("Application loaded. Shortcuts: Control U to upload a file. Control Shift A to capture screenshot and run OCR. Control H to repeat instructions anytime.");
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
          <h1 className="welcome-title">Accessible OCR Studio</h1>
          <p className="welcome-subtitle">
            点击任意位置或按任意键开始。界面支持高对比度、语音反馈和快捷键操作。
          </p>
          <div className="hotkey-grid">
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + U</kbd>上传文件</span>
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + Shift + A</kbd>截图 OCR</span>
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + K</kbd>朗读正文</span>
            <span className="hotkey-chip"><kbd>Ctrl/Cmd + H</kbd>播报快捷键帮助</span>
          </div>
        </div>
      </div>
    );
  }

  if (activePage === "whisper-test") {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="title-wrap">
            <h1>Whisper Test Lab</h1>
            <p>录音后直连 Whisper，检查原始转写结果与麦克风质量。</p>
          </div>
          <button onClick={backToMainPage} className="btn btn-secondary">Back to OCR</button>
        </div>

        <p className="whisper-note">你可以先做麦克风增益检查，再开始录音，结果会写入历史列表。</p>

        <div className="button-row">
          {!whisperTestRecording ? (
            <button
              onClick={startWhisperTestRecording}
              disabled={whisperTestTranscribing}
              className="btn btn-primary"
            >
              Start Recording
            </button>
          ) : (
            <button onClick={stopWhisperTestRecording} className="btn btn-danger">
              Stop Recording
            </button>
          )}

          <button
            onClick={() => {
              setWhisperTestText("");
              setWhisperTestError(null);
              setWhisperTestHistory([]);
              setWhisperTestMeta(null);
              setMicLevel(0);
              setMicPeak(0);
              whisperTestPeakRef.current = 0;
              clearWhisperTestPlayback();
            }}
            className="btn btn-ghost"
          >
            Clear
          </button>

          <button
            onClick={toggleWhisperTestPlayback}
            disabled={!whisperTestHasPlayback}
            className="btn btn-ghost"
          >
            {whisperTestPlaying ? "Stop Playback" : "Play Local Recording"}
          </button>

          <button onClick={playSpeakerTestTone} className="btn btn-ghost">
            Speaker Test Tone
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div className="info-line">Microphone Device</div>
          <select
            value={selectedAudioInputId}
            onChange={(e) => setSelectedAudioInputId(e.target.value)}
            disabled={whisperTestRecording}
            className="select-control"
          >
            {audioInputs.length === 0 && (
              <option value="">No microphone found</option>
            )}
            {audioInputs.map((device, idx) => (
              <option key={device.deviceId || `device-${idx}`} value={device.deviceId}>
                {device.label || `Microphone ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="info-line">
          Mic Input Level: current {micLevel.toFixed(3)} · peak {micPeak.toFixed(3)}
        </div>
        <div className="level-track">
          <div className="level-fill" style={{ width: `${Math.max(2, Math.round(micLevel * 100))}%` }} />
        </div>

        {(whisperTestRecording || whisperTestTranscribing) && (
          <div className="info-line">
            {whisperTestRecording ? "Recording..." : "Transcribing via Whisper..."}
          </div>
        )}

        {whisperTestMeta && (
          <div className="info-line small">
            Last audio: {whisperTestMeta.bytes} bytes · {Math.round(whisperTestMeta.durationMs)} ms · {whisperTestMeta.mimeType} · peak {whisperTestMeta.peak?.toFixed(3)} · {whisperTestMeta.inputDevice}
          </div>
        )}

        {whisperTestError && (
          <div className="alert alert-error">{whisperTestError}</div>
        )}

        <div className="panel" style={{ padding: "12px", marginBottom: "12px" }}>
          <div className="info-line">Latest Transcription</div>
          <div className="text-block" style={{ marginBottom: 0 }}>
            {whisperTestText || "(no transcription yet)"}
          </div>
        </div>

        <div className="panel" style={{ padding: "12px" }}>
          <div className="info-line">History</div>
          <div className="history-list">
            {whisperTestHistory.length === 0 && (
              <div className="tutor-empty">No records yet.</div>
            )}
            {whisperTestHistory.map((item, idx) => (
              <div key={`${item.timestamp}-${idx}`} className="history-item">
                <div className="history-meta">
                  {new Date(item.timestamp).toLocaleString()} · {item.bytes} bytes · {Math.round(item.durationMs || 0)} ms · {item.mimeType || "unknown"} · peak {(item.peak || 0).toFixed(3)}
                </div>
                <div className="history-meta">{item.inputDevice || "(unknown input)"}</div>
                <div className="text-block" style={{ marginBottom: 0, padding: "8px" }}>{item.text}</div>
              </div>
            ))}
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
          <h1>Accessible OCR Studio</h1>
          <p>高对比度阅读、OCR、摘要、朗读和语音问答一体化工作台。</p>
        </div>
        <button onClick={openWhisperTestPage} className="btn btn-secondary">Whisper Test Page</button>
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
            {file ? `Selected: ${file.name}` : "支持图片与 PDF；选择后自动处理"}
          </span>
          {loading && (
            <span className="status-pill">
              <span className="status-dot" /> Processing document...
            </span>
          )}
        </div>
        <div className="upload-meta mono">Shortcut: Ctrl/Cmd + U 上传，Ctrl/Cmd + Shift + A 截图 OCR</div>
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

          <div className="speed-line">TTS Speed: {ttsSpeed.toFixed(2)}x</div>
          <div className="speed-grid">
            {TTS_SPEED_OPTIONS.map((speedOption) => {
              const active = Math.abs(ttsSpeed - speedOption) < 0.001;
              return (
                <button
                  key={speedOption}
                  onClick={() => setTtsSpeed(speedOption)}
                  className={`speed-btn ${active ? "active" : ""}`}
                >
                  {speedOption}x
                </button>
              );
            })}
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
