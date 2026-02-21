import { useEffect, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [activePage, setActivePage] = useState("main");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultText, setResultText] = useState("");
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
  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const streamDoneRef = useRef(false);
  const tutorMessagesRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const tutorAudioRef = useRef(null);
  const togglePauseReadingRef = useRef(() => {});
  const isReadingRef = useRef(false);
  const whisperTestRecorderRef = useRef(null);
  const whisperTestStreamRef = useRef(null);
  const whisperTestChunksRef = useRef([]);
  const whisperTestStartedAtRef = useRef(0);
  const whisperTestPlaybackAudioRef = useRef(null);
  const whisperTestPlaybackUrlRef = useRef("");
  const whisperTestMonitorAudioContextRef = useRef(null);
  const whisperTestMonitorAnalyserRef = useRef(null);
  const whisperTestMonitorSourceRef = useRef(null);
  const whisperTestMonitorTimerRef = useRef(null);
  const whisperTestPeakRef = useRef(0);
  const tutorStartedAtRef = useRef(0);
  const unmountCleanupRef = useRef(() => {});

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
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
    streamDoneRef.current = true;
    closeStream();
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
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
  };

  const resumeReading = () => {
    if (!isReading) return;
    stopTutorAnswerAudio();
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

    const params = new URLSearchParams({
      markdown: textToRead,
      speed: String(ttsSpeed),
    });
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

  const getCurrentReadingText = () => {
    if (readingTarget === "summary") return getSummaryReadableText();
    if (readingTarget === "ocr") return resultText;
    if (summaryText) return getSummaryReadableText();
    return resultText;
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
      whisperTestMonitorAudioContextRef.current.close().catch(() => {});
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
        ctx.close().catch(() => {});
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
      body: JSON.stringify({ text: answerText, speed: ttsSpeed }),
    });
    if (!ttsRes.ok) {
      const fallback = await ttsRes.text();
      throw new Error(`Tutor TTS failed: ${fallback || ttsRes.status}`);
    }
    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);
    stopTutorAnswerAudio();
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

  const startRecordingQuestion = async () => {
    if (isRecording || isTranscribing || isTutorThinking) return;
    try {
      setTutorError(null);
      if (isReading && !isPausedRef.current) {
        pauseReading();
      }
      stopTutorAnswerAudio();
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
    togglePauseReadingRef.current = togglePauseReading;
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
      const targetTag = event.target?.tagName;
      const isEditable =
        targetTag === "INPUT" ||
        targetTag === "TEXTAREA" ||
        event.target?.isContentEditable;
      if (isEditable) return;
      if (event.code === "Space" && isReadingRef.current) {
        event.preventDefault();
        togglePauseReadingRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
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

  if (activePage === "whisper-test") {
    return (
      <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <h1>Whisper Test</h1>
          <button
            onClick={backToMainPage}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: "8px",
              border: "1px solid #3c5268",
              color: "#d3dfeb",
              backgroundColor: "#1b2938",
              fontWeight: "bold",
            }}
          >
            Back
          </button>
        </div>

        <p style={{ color: "#a8bbcf", marginBottom: "1rem" }}>
          Record your voice, send to Whisper, and inspect raw transcription text only.
        </p>

        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {!whisperTestRecording ? (
            <button
              onClick={startWhisperTestRecording}
              disabled={whisperTestTranscribing}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#3ecfcf",
                color: "#080b0f",
                fontWeight: "bold",
                opacity: whisperTestTranscribing ? 0.6 : 1,
                cursor: whisperTestTranscribing ? "not-allowed" : "pointer",
              }}
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopWhisperTestRecording}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#ff7c3e",
                color: "#080b0f",
                fontWeight: "bold",
              }}
            >
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
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #3c5268",
              color: "#d3dfeb",
              backgroundColor: "#1b2938",
              fontWeight: "bold",
            }}
          >
            Clear
          </button>
          <button
            onClick={toggleWhisperTestPlayback}
            disabled={!whisperTestHasPlayback}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #3c5268",
              color: "#d3dfeb",
              backgroundColor: "#1b2938",
              fontWeight: "bold",
              opacity: whisperTestHasPlayback ? 1 : 0.45,
              cursor: whisperTestHasPlayback ? "pointer" : "not-allowed",
            }}
          >
            {whisperTestPlaying ? "Stop Playback" : "Play Local Recording"}
          </button>
          <button
            onClick={playSpeakerTestTone}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "8px",
              border: "1px solid #3c5268",
              color: "#d3dfeb",
              backgroundColor: "#1b2938",
              fontWeight: "bold",
            }}
          >
            Speaker Test Tone
          </button>
        </div>

        <div style={{ marginBottom: "0.9rem" }}>
          <div style={{ color: "#8fa4bc", fontSize: "0.82rem", marginBottom: "0.45rem" }}>Microphone Device</div>
          <select
            value={selectedAudioInputId}
            onChange={(e) => setSelectedAudioInputId(e.target.value)}
            disabled={whisperTestRecording}
            style={{
              width: "100%",
              padding: "0.55rem 0.65rem",
              borderRadius: "8px",
              border: "1px solid #3c5268",
              backgroundColor: "#14202d",
              color: "#d3dfeb",
            }}
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

        <div style={{ marginBottom: "0.9rem" }}>
          <div style={{ color: "#8fa4bc", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
            Mic Input Level (live while recording): current {micLevel.toFixed(3)} · peak {micPeak.toFixed(3)}
          </div>
          <div style={{ height: "10px", borderRadius: "999px", backgroundColor: "#172334", overflow: "hidden", border: "1px solid #2d3d52" }}>
            <div
              style={{
                width: `${Math.max(2, Math.round(micLevel * 100))}%`,
                height: "100%",
                background: "linear-gradient(90deg, #3ef07a, #fcba03, #ff7c3e)",
                transition: "width 120ms linear",
              }}
            />
          </div>
        </div>

        {(whisperTestRecording || whisperTestTranscribing) && (
          <div style={{ color: "#9fb1c5", marginBottom: "1rem" }}>
            {whisperTestRecording ? "Recording..." : "Transcribing via Whisper..."}
          </div>
        )}

        {whisperTestMeta && (
          <div style={{ color: "#8fa4bc", fontSize: "0.82rem", marginBottom: "0.8rem" }}>
            Last audio: {whisperTestMeta.bytes} bytes · {Math.round(whisperTestMeta.durationMs)} ms · {whisperTestMeta.mimeType} · peak {whisperTestMeta.peak?.toFixed(3)} · {whisperTestMeta.inputDevice}
          </div>
        )}

        {whisperTestError && (
          <div style={{ color: "#ffd0c0", backgroundColor: "#3c1c0f", padding: "0.8rem", borderRadius: "8px", marginBottom: "1rem" }}>
            {whisperTestError}
          </div>
        )}

        <div style={{ backgroundColor: "#121b26", border: "1px solid #263545", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ color: "#8fa4bc", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Latest Transcription</div>
          <div style={{ color: "#e8f0f8", fontSize: "1rem", minHeight: "2rem", whiteSpace: "pre-wrap" }}>
            {whisperTestText || "(no transcription yet)"}
          </div>
        </div>

        <div style={{ backgroundColor: "#0f1620", border: "1px solid #2b3a4d", borderRadius: "10px", padding: "1rem" }}>
          <div style={{ color: "#8fa4bc", fontSize: "0.85rem", marginBottom: "0.6rem" }}>History</div>
          <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {whisperTestHistory.length === 0 && (
              <div style={{ color: "#8fa4bc" }}>No records yet.</div>
            )}
            {whisperTestHistory.map((item, idx) => (
              <div key={`${item.timestamp}-${idx}`} style={{ backgroundColor: "#182433", border: "1px solid #2b3a4d", borderRadius: "8px", padding: "0.7rem" }}>
                <div style={{ color: "#7f97b0", fontSize: "0.72rem", marginBottom: "0.2rem" }}>
                  {new Date(item.timestamp).toLocaleString()} · {item.bytes} bytes · {Math.round(item.durationMs || 0)} ms · {item.mimeType || "unknown"} · peak {(item.peak || 0).toFixed(3)}
                </div>
                <div style={{ color: "#7f97b0", fontSize: "0.72rem", marginBottom: "0.2rem" }}>{item.inputDevice || "(unknown input)"}</div>
                <div style={{ color: "#e8f0f8", whiteSpace: "pre-wrap" }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1>Simple Upload & OCR</h1>
        <button
          onClick={openWhisperTestPage}
          style={{
            padding: "0.5rem 0.9rem",
            borderRadius: "8px",
            border: "1px solid #3c5268",
            color: "#d3dfeb",
            backgroundColor: "#1b2938",
            fontWeight: "bold",
          }}
        >
          Whisper Test Page
        </button>
      </div>
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

            {!isReading || readingTarget !== "ocr" ? (
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
                {isReading ? "Switch To OCR Read" : "Read OCR Aloud"}
              </button>
            ) : (
              <>
                <button
                  onClick={togglePauseReading}
                  style={{
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    backgroundColor: isPaused ? "#3ef07a" : "#ff7c3e",
                    color: "#080b0f",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  {isPaused ? "Resume OCR (Space)" : "Pause OCR (Space)"}
                </button>
                <button
                  onClick={stopReading}
                  style={{
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    backgroundColor: "#9ba7b4",
                    color: "#080b0f",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  Stop OCR
                </button>
              </>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ color: "#8fa4bc", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
              TTS Speed: {ttsSpeed.toFixed(2)}x
            </div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {TTS_SPEED_OPTIONS.map((speedOption) => {
                const active = Math.abs(ttsSpeed - speedOption) < 0.001;
                return (
                  <button
                    key={speedOption}
                    onClick={() => setTtsSpeed(speedOption)}
                    style={{
                      padding: "0.35rem 0.6rem",
                      borderRadius: "7px",
                      border: `1px solid ${active ? "#3ecfcf" : "#3c5268"}`,
                      backgroundColor: active ? "rgba(62,207,207,0.14)" : "#1b2938",
                      color: active ? "#e8f0f8" : "#d3dfeb",
                      fontWeight: "bold",
                      fontSize: "0.78rem",
                    }}
                  >
                    {speedOption}x
                  </button>
                );
              })}
            </div>
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
                {isReading && isPaused ? " - Paused" : ""}
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
                    onClick={togglePauseReading}
                    style={{
                      padding: "0.35rem 0.75rem",
                      cursor: "pointer",
                      backgroundColor: isPaused ? "#3ef07a" : "#ff7c3e",
                      color: "#080b0f",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                    }}
                  >
                    {isPaused ? "Resume Summary (Space)" : "Pause Summary (Space)"}
                  </button>
                )}
                {isReading && readingTarget === "summary" && (
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

      {(resultText || summaryText) && (
        <div
          style={{
            position: "fixed",
            right: "20px",
            bottom: "20px",
            width: "360px",
            maxWidth: "calc(100vw - 40px)",
            backgroundColor: "#0f1620",
            border: "1px solid #2b3a4d",
            borderRadius: "12px",
            padding: "12px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <strong style={{ color: "#e8f0f8", fontSize: "0.95rem" }}>Tutor Q&A</strong>
            <span style={{ color: "#8fa4bc", fontSize: "0.75rem" }}>Multi-turn</span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            {!isRecording ? (
              <button
                onClick={startRecordingQuestion}
                disabled={isTranscribing || isTutorThinking}
                style={{
                  padding: "0.4rem 0.7rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#3ecfcf",
                  color: "#080b0f",
                  fontWeight: "bold",
                  fontSize: "0.78rem",
                  cursor: isTranscribing || isTutorThinking ? "not-allowed" : "pointer",
                  opacity: isTranscribing || isTutorThinking ? 0.6 : 1,
                }}
              >
                Start Voice Question
              </button>
            ) : (
              <button
                onClick={stopRecordingQuestion}
                style={{
                  padding: "0.4rem 0.7rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#ff7c3e",
                  color: "#080b0f",
                  fontWeight: "bold",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                Stop Recording
              </button>
            )}

            {isReading && (
              <button
                onClick={togglePauseReading}
                style={{
                  padding: "0.4rem 0.7rem",
                  borderRadius: "8px",
                  border: "1px solid #3b4a5d",
                  backgroundColor: "#162130",
                  color: "#d3dfeb",
                  fontWeight: "bold",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {isPaused ? "Continue Reading" : "Pause Reading"}
              </button>
            )}
          </div>

          {(isRecording || isTranscribing || isTutorThinking) && (
            <div style={{ color: "#9fb1c5", fontSize: "0.76rem", marginBottom: "8px" }}>
              {isRecording
                ? "Recording... click Stop Recording when done."
                : isTranscribing
                  ? "Transcribing question with Whisper..."
                  : "Thinking and generating answer..."}
            </div>
          )}

          {tutorError && (
            <div style={{ color: "#ffd0c0", backgroundColor: "#3c1c0f", padding: "0.5rem", borderRadius: "8px", marginBottom: "8px", fontSize: "0.78rem" }}>
              {tutorError}
            </div>
          )}

          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              paddingTop: "2px",
            }}
          >
            {tutorMessages.length === 0 && (
              <div style={{ color: "#8fa4bc", fontSize: "0.78rem" }}>
                Ask by voice about what was just read. Space pauses/resumes reading.
              </div>
            )}
            {tutorMessages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  backgroundColor: msg.role === "user" ? "#1f374d" : "#1a2634",
                  color: "#e8f0f8",
                  border: "1px solid #2b3a4d",
                  borderRadius: "8px",
                  padding: "0.5rem 0.6rem",
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                  maxWidth: "95%",
                }}
              >
                <div style={{ opacity: 0.75, fontSize: "0.68rem", marginBottom: "2px" }}>
                  {msg.role === "user" ? "You" : "Tutor"}
                </div>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
