import { useState, useEffect, useRef } from "react";
import { inspect } from "../lib/api";
import type { InspectionReport } from "../lib/data";

interface Props {
  instructions: string;
  scenarioGoal: string;
  onBack: () => void;
}

const SEV: Record<string, { bg: string; tx: string; dot: string }> = {
  CRITICAL: { bg: "var(--crit-bg)", tx: "var(--crit-tx)", dot: "var(--crit)" },
  WARNING: { bg: "var(--high-bg)", tx: "var(--high-tx)", dot: "#c77d18" },
  INFO: { bg: "var(--info-bg)", tx: "var(--info-tx)", dot: "#2f6fb0" },
};

export default function LiveScreen({ instructions, scenarioGoal, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const borderRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inCtxRef = useRef<AudioContext | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frameTimer = useRef<any>(null);
  const activeSources = useRef<AudioBufferSourceNode[]>([]);
  const nextStart = useRef<number>(0);

  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [caption, setCaption] = useState("Connecting to Sentinel…");
  const [userCaption, setUserCaption] = useState("");

  // Report popup generated from the live walkthrough.
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pcmToBase64 = (f32: Float32Array) => {
    const buf = new ArrayBuffer(f32.length * 2);
    const view = new DataView(buf);
    for (let i = 0, o = 0; i < f32.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const playChunk = async (b64: string) => {
    const ctx = outCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    const buffer = ctx.createBuffer(1, f32.length, 24000);
    buffer.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    activeSources.current.push(src);
    src.onended = () => { activeSources.current = activeSources.current.filter((s) => s !== src); };
    const now = ctx.currentTime;
    if (nextStart.current < now) nextStart.current = now;
    src.start(nextStart.current);
    nextStart.current += buffer.duration;
  };

  const clearPlayback = () => {
    activeSources.current.forEach((s) => { try { s.stop(); } catch {} });
    activeSources.current = [];
    if (outCtxRef.current) nextStart.current = outCtxRef.current.currentTime;
  };

  async function start() {
    setStatus("connecting");
    setCaption("Connecting to Sentinel…");
    try {
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await inCtx.resume().catch(() => {});
      await outCtx.resume().catch(() => {});
      inCtxRef.current = inCtx;
      outCtxRef.current = outCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { facingMode: { ideal: "environment" }, width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const secure = window.location.protocol === "https:";
      const ws = new WebSocket(`${secure ? "wss:" : "ws:"}//${window.location.host}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "init", instructions, scenarioGoal }));
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.status === "connected") { setStatus("live"); setCaption("Connected — say hi when you're ready."); harvest(stream); }
          else if (d.error) { setCaption(d.error); setStatus("error"); }
          else if (d.audio) playChunk(d.audio);
          else if (d.text) setCaption(d.text);
          else if (d.userText) setUserCaption(d.userText);
          else if (d.interrupted) clearPlayback();
        } catch {}
      };
      ws.onclose = () => setStatus((s) => (s === "live" ? "error" : s));
      ws.onerror = () => { setStatus("error"); setCaption("Connection error. Ensure the server is running and the API key is set."); };
    } catch (e: any) {
      setStatus("error");
      setCaption("I need camera and mic access. Allow them, then reopen the walk.");
    }
  }

  function harvest(stream: MediaStream) {
    const inCtx = inCtxRef.current;
    if (!inCtx) return;
    const source = inCtx.createMediaStreamSource(stream);
    srcNodeRef.current = source;
    const proc = inCtx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;
    source.connect(proc);
    proc.connect(inCtx.destination);
    let ampSmooth = 0;
    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      ampSmooth += (Math.min(1, rms * 5) - ampSmooth) * 0.3;
      if (borderRef.current) borderRef.current.style.setProperty("--amp", ampSmooth.toFixed(3));
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ audio: pcmToBase64(input) }));
      }
    };
    frameTimer.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const g = canvas.getContext("2d");
      if (g) {
        g.drawImage(v, 0, 0, 640, 480);
        const b64 = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
        if (b64) wsRef.current.send(JSON.stringify({ video: b64 }));
      }
    }, 1000);
  }

  function stop() {
    clearInterval(frameTimer.current);
    clearPlayback();
    try { procRef.current?.disconnect(); } catch {}
    try { srcNodeRef.current?.disconnect(); } catch {}
    try { inCtxRef.current?.close(); } catch {}
    try { outCtxRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { wsRef.current?.close(); } catch {}
  }

  // Grab the current frame from the live feed so we can inspect it.
  function captureFrame(): string | null {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const g = canvas.getContext("2d");
    if (!g) return null;
    g.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  // End the walkthrough, then generate + show the inspection report in a popup.
  const end = async () => {
    const frame = captureFrame();
    stop();
    setShowReport(true);
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    if (!frame) {
      setReportError("Couldn't capture a frame from the live feed. Try the static inspection instead.");
      setReportLoading(false);
      return;
    }
    try {
      const r = await inspect({ image: frame, instructions, scenarioGoal, answers: [] });
      setReport(r);
    } catch (e: any) {
      setReportError(e?.message || "Failed to generate the report.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="screen" style={{ background: "#0c1016", position: "relative" }}>
      <video ref={videoRef} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div ref={borderRef} className="glow-border" aria-hidden="true" />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 22%, transparent 52%, rgba(0,0,0,0.62) 100%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", paddingTop: "max(env(safe-area-inset-top), 14px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge glass"><i className="ti ti-map-pin" aria-hidden="true"></i> Live walkthrough</span>
            <span className="badge" style={{ background: status === "live" ? "rgba(226,75,74,0.92)" : "rgba(120,130,140,0.6)", color: "#fff" }}>
              {status === "live" ? "● LIVE" : status === "error" ? "OFFLINE" : "…"}
            </span>
          </div>
          <button aria-label="End" className="ctl" onClick={end}><i className="ti ti-x" aria-hidden="true"></i></button>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Reticle live={status === "live"} />
        </div>

        {userCaption && (
          <div style={{ margin: "0 14px 8px", background: "rgba(83,74,183,0.28)", backdropFilter: "blur(10px)", border: "1px solid rgba(150,140,240,0.4)", borderRadius: 14, padding: "9px 13px" }}>
            <p style={{ fontSize: 12, color: "#fff", margin: 0 }}><span style={{ opacity: 0.7 }}>You: </span>{userCaption}</p>
          </div>
        )}

        <VoiceBar caption={caption} listening={status === "live"} />
      </div>

      {showReport && (
        <ReportPopup
          report={report}
          loading={reportLoading}
          error={reportError}
          onClose={onBack}
        />
      )}

      <style>{`
        .glass { background: rgba(255,255,255,0.16); color: #fff; backdrop-filter: blur(8px); }
        .glow-border {
          --amp: 0; position: absolute; inset: 0; pointer-events: none; z-index: 3;
          padding: calc(3px + var(--amp) * 5px);
          background: conic-gradient(from 0deg, #534ab7, #7f77dd, #4285F4, #534ab7);
          background-size: 200% 200%;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          opacity: calc(0.5 + var(--amp) * 0.5);
          box-shadow: inset 0 0 calc(14px + var(--amp) * 52px) rgba(83,74,183, calc(0.22 + var(--amp) * 0.55));
          animation: shimmer 5s linear infinite; transition: opacity .1s linear;
        }
        @keyframes shimmer { to { background-position: 200% 0; } }
        .ctl { width: 48px; height: 48px; border-radius: 16px; border: none; background: rgba(255,255,255,0.16); backdrop-filter: blur(8px); color: #fff; font-size: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .12s ease; }
        .ctl:active { transform: scale(0.92); }
        .wave { animation: wave 0.9s ease infinite; }
        @keyframes wave { 0%,100% { transform: scaleY(0.5); } 50% { transform: scaleY(1.4); } }
      `}</style>
    </div>
  );
}

function Reticle({ live }: { live: boolean }) {
  const c: React.CSSProperties = { position: "absolute", width: 28, height: 28 };
  return (
    <div style={{ width: 150, height: 150, position: "relative", opacity: live ? 1 : 0.5 }}>
      <div style={{ ...c, top: 0, left: 0, borderTop: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "10px 0 0 0" }} />
      <div style={{ ...c, top: 0, right: 0, borderTop: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 10px 0 0" }} />
      <div style={{ ...c, bottom: 0, left: 0, borderBottom: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "0 0 0 10px" }} />
      <div style={{ ...c, bottom: 0, right: 0, borderBottom: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 0 10px 0" }} />
    </div>
  );
}

function ReportPopup({ report, loading, error, onClose }: { report: InspectionReport | null; loading: boolean; error: string | null; onClose: () => void; }) {
  const scoreColor = report ? (report.safetyScore >= 80 ? "var(--ok)" : report.safetyScore >= 50 ? "#c77d18" : "var(--crit)") : "var(--text-3)";
  const suit = report?.suitability;
  const suitStyle =
    suit === "SUITABLE" ? { bg: "var(--ok-bg)", tx: "var(--ok-tx)", icon: "ti-circle-check", label: "Suitable" } :
    suit === "SUITABLE_WITH_MODIFICATIONS" ? { bg: "var(--high-bg)", tx: "var(--high-tx)", icon: "ti-alert-triangle", label: "Modifications needed" } :
    { bg: "var(--crit-bg)", tx: "var(--crit-tx)", icon: "ti-circle-x", label: "Not suitable" };

  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(6,8,12,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg)", color: "var(--text)", width: "100%", maxHeight: "88%", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
      >
        {/* Popup header with cross button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", flex: "0 0 auto" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            <i className="ti ti-clipboard-check" style={{ color: "var(--accent)", marginRight: 6 }} aria-hidden="true"></i>
            Walkthrough report
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => window.print()} aria-label="Export / print report" disabled={!report}
              style={{ border: "none", background: "var(--card)", width: 32, height: 32, borderRadius: "50%", color: "var(--text-2)", fontSize: 17, cursor: report ? "pointer" : "not-allowed", opacity: report ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <i className="ti ti-printer" aria-hidden="true"></i>
            </button>
            <button
              onClick={onClose} aria-label="Close report"
              style={{ border: "none", background: "var(--card)", width: 32, height: 32, borderRadius: "50%", color: "var(--text-2)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 18px 24px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 10px" }}>
              <i className="ti ti-loader-2 spin" style={{ fontSize: 30, color: "var(--accent)" }} aria-hidden="true"></i>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 12 }}>Compiling the safety report from your walkthrough…</p>
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--crit-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 26, color: "var(--crit-tx)" }} aria-hidden="true"></i>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Couldn't generate the report</p>
              <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {!loading && !error && report && (
            <>
              {/* Score + suitability */}
              <div className="card" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="36" cy="36" r="30" stroke="var(--med-bg)" strokeWidth="7" fill="none" />
                    <circle cx="36" cy="36" r="30" stroke={scoreColor} strokeWidth="7" fill="none" strokeLinecap="round"
                      strokeDasharray={188} strokeDashoffset={188 - (188 * report.safetyScore) / 100} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 19, fontWeight: 700 }}>{report.safetyScore}</span>
                    <span style={{ fontSize: 8, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Score</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span className="badge" style={{ background: suitStyle.bg, color: suitStyle.tx, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <i className={"ti " + suitStyle.icon} aria-hidden="true"></i> {suitStyle.label}
                  </span>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{report.suitabilityReason}</p>
                </div>
              </div>

              {/* Hazards */}
              <p style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                <i className="ti ti-alert-hexagon" aria-hidden="true"></i> Hazards ({report.violations.length})
              </p>
              {report.violations.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 18 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 26, color: "var(--ok)" }} aria-hidden="true"></i>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>No hazards detected</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {report.violations.map((v) => {
                    const c = SEV[v.severity] || SEV.INFO;
                    return (
                      <div key={v.id} className="card" style={{ borderLeft: `4px solid ${c.dot}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{v.title}</h4>
                          <span className="badge" style={{ background: c.bg, color: c.tx, height: "fit-content" }}>{v.severity}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 6 }}>{v.description}</p>
                        <div style={{ fontSize: 11.5, color: "var(--text)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px" }}>
                          <i className="ti ti-arrow-right" style={{ color: "var(--accent)" }} aria-hidden="true"></i> {v.recommendation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={onClose}>
            <i className="ti ti-check" aria-hidden="true"></i> Done
          </button>
        </div>
      </div>
    </div>
  );
}

function VoiceBar({ caption, listening }: { caption: string; listening: boolean }) {
  return (
    <div style={{ margin: "0 14px 16px", background: "rgba(255,255,255,0.14)", backdropFilter: "blur(12px)", borderRadius: 18, padding: "13px 15px", display: "flex", alignItems: "center", gap: 11, minHeight: 52 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }} aria-hidden="true">
        {[9, 16, 7, 13, 10].map((h, k) => (
          <span key={k} className="wave" style={{ width: 3, height: h, background: "#9a90ff", borderRadius: 2, animationPlayState: listening ? "running" : "paused", animationDelay: k * 0.12 + "s" }} />
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: "#fff", lineHeight: 1.45, margin: 0 }}>{caption}</p>
    </div>
  );
}
