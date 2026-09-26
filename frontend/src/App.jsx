import { useState, useRef, useEffect } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000/api";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "voice", label: "Voice" },
  { id: "image", label: "Image" },
  { id: "reason", label: "Reasoning" },
];

export default function App() {
  const [tab, setTab] = useState("chat");

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">bench</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"tab" + (tab === t.id ? " tab-active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="rail-foot">llama-3.3 · whisper · groq</div>
      </aside>

      <main className="stage">
        {tab === "chat" && <ChatPanel />}
        {tab === "voice" && <VoicePanel />}
        {tab === "image" && <ImagePanel />}
        {tab === "reason" && <ReasonPanel />}
      </main>
    </div>
  );
}

/* ---------- Chat ---------- */

function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async (text) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "ai", text: data.reply ?? "No reply." }]);
    } catch {
      setMessages((m) => [...m, { role: "error", text: "Request failed. Is the backend running?" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>Chat</h1>
        <p>Talk to the model, one turn at a time.</p>
      </header>

      <div className="thread" ref={scrollRef}>
        {messages.length === 0 && <Empty text="Say something to start." />}
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            <span className="bubble-tag">{m.role}</span>
            <p>{m.text}</p>
          </div>
        ))}
        {busy && <div className="bubble bubble-ai bubble-pending">thinking…</div>}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          autoFocus
        />
        <button type="submit" disabled={busy}>Send</button>
      </form>
    </section>
  );
}

/* ---------- Voice ---------- */

function VoicePanel() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("idle");
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
    mediaRecorder.current.onstop = handleStop;
    mediaRecorder.current.start();
    setRecording(true);
    setStatus("listening");
  };

  const stop = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  const handleStop = async () => {
    setStatus("transcribing");
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    try {
      const res = await fetch(`${API}/transcribe/`, { method: "POST", body: form });
      const data = await res.json();
      setTranscript(data.text ?? "");
      setStatus("replying");

      const chatRes = await fetch(`${API}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.text }),
      });
      const chatData = await chatRes.json();
      setReply(chatData.reply ?? "");
      setStatus("speaking");
      await playSpeech(chatData.reply);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>Voice</h1>
        <p>Record, transcribe, and get a reply.</p>
      </header>

      <div className="voice-stage">
        <button
          className={"mic" + (recording ? " mic-live" : "")}
          onClick={recording ? stop : start}
        >
          {recording ? "■" : "●"}
        </button>
        <span className="voice-status">{statusLabel(status)}</span>
      </div>

      {transcript && (
        <div className="voice-result">
          <p className="voice-label">you said</p>
          <p>{transcript}</p>
        </div>
      )}
      {reply && (
        <div className="voice-result voice-result-ai">
          <p className="voice-label">reply</p>
          <p>{reply}</p>
        </div>
      )}
    </section>
  );
}

function statusLabel(s) {
  return { idle: "ready", listening: "recording…", transcribing: "transcribing…", replying: "thinking…", speaking: "speaking…", error: "something failed" }[s] || s;
}

async function playSpeech(text) {
  if (!text) return;
  const res = await fetch(`${API}/speak/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!data.audio_base64) return;
  const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
  await audio.play();
}

/* ---------- Image ---------- */

function ImagePanel() {
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const generate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API}/image/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.url) setUrl(data.url);
      else setErr("No image returned.");
    } catch {
      setErr("Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>Image</h1>
        <p>Describe a picture, generate it.</p>
      </header>

      <form className="composer" onSubmit={generate}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A lighthouse in a storm, oil painting"
        />
        <button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate"}</button>
      </form>

      <div className="image-stage">
        {err && <Empty text={err} />}
        {!err && !url && !busy && <Empty text="Your image will appear here." />}
        {busy && <Empty text="Generating…" />}
        {url && <img src={url} alt={prompt} className="result-image" />}
      </div>
    </section>
  );
}

/* ---------- Reasoning ---------- */

function ReasonPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch(`${API}/reason/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setAnswer(data.reply ?? "No reply.");
    } catch {
      setAnswer("Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>Reasoning</h1>
        <p>Harder questions, slower model, worked answers.</p>
      </header>

      <form className="composer composer-tall" onSubmit={ask}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something that needs a few steps to work out"
          rows={4}
        />
        <button type="submit" disabled={busy}>{busy ? "Working…" : "Solve"}</button>
      </form>

      <div className="reason-result">
        {!answer && !busy && <Empty text="The worked answer will appear here." />}
        {answer && <p>{answer}</p>}
      </div>
    </section>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}