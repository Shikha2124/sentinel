import { useState, useRef, useEffect } from "react";
import StatusBar from "./StatusBar";
import { PRESETS, type InspectionReport, type Answer, type ChatMessage } from "../lib/data";
import { chat } from "../lib/api";

interface Props {
  report: InspectionReport;
  presetIndex: number | null;
  imageSource: string | null;
  scenarioGoal: string;
  guidelines: string;
  userAnswers: Answer[];
  setUserAnswers: (a: Answer[]) => void;
  onReanalyze: (answers: Answer[]) => Promise<void>;
  onRestart: () => void;
  onNewScan: () => void;
}

const SEV: Record<string, { bg: string; tx: string; dot: string }> = {
  CRITICAL: { bg: "var(--crit-bg)", tx: "var(--crit-tx)", dot: "var(--crit)" },
  WARNING: { bg: "var(--high-bg)", tx: "var(--high-tx)", dot: "#c77d18" },
  INFO: { bg: "var(--info-bg)", tx: "var(--info-tx)", dot: "#2f6fb0" },
};

const STATUS_COLOR: Record<string, { bg: string; tx: string; icon: string }> = {
  PASS: { bg: "var(--ok-bg)", tx: "var(--ok-tx)", icon: "ti-circle-check" },
  WARNING: { bg: "var(--high-bg)", tx: "var(--high-tx)", icon: "ti-alert-triangle" },
  FAIL: { bg: "var(--crit-bg)", tx: "var(--crit-tx)", icon: "ti-circle-x" },
};

function renderMarkdown(text: string) {
  return text.split("\n").map((line, idx) => {
    let processed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    const t = processed.trim();
    if (t.startsWith("- ") || t.startsWith("* "))
      return <li key={idx} style={{ marginLeft: 16, fontSize: 13, lineHeight: 1.5, marginBottom: 3 }} dangerouslySetInnerHTML={{ __html: t.substring(2) }} />;
    if (/^\d+\.\s/.test(t))
      return <li key={idx} style={{ marginLeft: 16, fontSize: 13, lineHeight: 1.5, marginBottom: 3 }} dangerouslySetInnerHTML={{ __html: t.replace(/^\d+\.\s/, "") }} />;
    if (!t) return <div key={idx} style={{ height: 6 }} />;
    return <p key={idx} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 5 }} dangerouslySetInnerHTML={{ __html: processed }} />;
  });
}

export default function ReportScreen(props: Props) {
  const { report, presetIndex, imageSource, scenarioGoal, guidelines, userAnswers, setUserAnswers, onReanalyze, onRestart, onNewScan } = props;

  const [visionMode, setVisionMode] = useState<"optical" | "thermal">("optical");
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [tab, setTab] = useState<"hazards" | "chat">("hazards");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [customAnswer, setCustomAnswer] = useState<Record<string, string>>({});
  const [reErr, setReErr] = useState<string | null>(null);

  const hotSpots = presetIndex !== null ? PRESETS[presetIndex].thermalConfig.hotSpots : [];

  const scoreColor = report.safetyScore >= 80 ? "var(--ok)" : report.safetyScore >= 50 ? "#c77d18" : "var(--crit)";
  const suit = report.suitability;
  const suitStyle =
    suit === "SUITABLE" ? { bg: "var(--ok-bg)", tx: "var(--ok-tx)", icon: "ti-circle-check", label: "Suitable" } :
    suit === "SUITABLE_WITH_MODIFICATIONS" ? { bg: "var(--high-bg)", tx: "var(--high-tx)", icon: "ti-alert-triangle", label: "Modifications needed" } :
    { bg: "var(--crit-bg)", tx: "var(--crit-tx)", icon: "ti-circle-x", label: "Not suitable" };

  const answerDoubt = (q: { id: string; question: string }, answer: string) => {
    setUserAnswers([...userAnswers.filter((a) => a.questionId !== q.id), { questionId: q.id, question: q.question, answer }]);
  };
  const removeAnswer = (id: string) => setUserAnswers(userAnswers.filter((a) => a.questionId !== id));

  const doReanalyze = async () => {
    setReanalyzing(true);
    setReErr(null);
    try { await onReanalyze(userAnswers); }
    catch (e: any) { setReErr(e.message || "Re-analysis failed."); }
    finally { setReanalyzing(false); }
  };

  return (
    <div className="screen">
      <StatusBar />
      <div style={{ padding: "6px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onNewScan} aria-label="Back" style={{ border: "none", background: "transparent", fontSize: 22, color: "var(--text-2)", cursor: "pointer" }}>
          <i className="ti ti-chevron-left" aria-hidden="true"></i>
        </button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Inspection report</span>
        <button onClick={() => window.print()} aria-label="Print" style={{ border: "none", background: "transparent", fontSize: 20, color: "var(--text-2)", cursor: "pointer" }}>
          <i className="ti ti-printer" aria-hidden="true"></i>
        </button>
      </div>

      <div className="scroll">
        {/* Image stage with optical / thermal + markers */}
        {imageSource && (
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 10, position: "relative", aspectRatio: "16 / 10", background: "#0c1016" }}>
            <img
              src={imageSource} alt="Inspected area"
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: visionMode === "thermal" ? "grayscale(0.4) contrast(1.25) brightness(0.9) saturate(1.5)" : "none", transition: "filter .3s" }}
            />
            {visionMode === "thermal" && (
              <>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(45deg, rgba(18,0,56,0.6), rgba(76,29,149,0.55), rgba(185,28,28,0.4), rgba(251,191,36,0.45))", mixBlendMode: "color-dodge", opacity: 0.85, pointerEvents: "none" }} />
                {hotSpots.map((spot, i) => (
                  <div key={i} style={{ position: "absolute", left: `${spot.x}%`, top: `${spot.y}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}>
                    <span style={{ position: "absolute", inset: -6, borderRadius: "50%", background: "rgba(251,191,36,0.75)", animation: "pop 1.4s ease infinite" }} />
                    <div style={{ width: 15, height: 15, borderRadius: "50%", background: "var(--crit)", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <i className="ti ti-flame" style={{ fontSize: 9, color: "#fff" }} aria-hidden="true"></i>
                    </div>
                    <div style={{ position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)", background: "#171430", border: "1px solid #fbbf24", color: "#fff", padding: "3px 6px", borderRadius: 5, fontSize: 9, whiteSpace: "nowrap" }}>
                      <span style={{ color: "#fbbf24", fontWeight: 700 }}>{spot.label}</span> · {spot.temp}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Violation markers */}
            {report.violations.map((v) => {
              const active = activeMarker === v.id;
              const c = SEV[v.severity] || SEV.INFO;
              return (
                <div key={v.id} style={{ position: "absolute", left: `${v.coordinate.x}%`, top: `${v.coordinate.y}%`, transform: "translate(-50%,-50%)", zIndex: 20 }}
                  onClick={() => setActiveMarker(active ? null : v.id)}>
                  <button style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: c.dot, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.4)", transform: active ? "scale(1.15)" : "scale(1)" }}>
                    {v.severity === "CRITICAL" ? "!" : "?"}
                  </button>
                  {active && (
                    <div style={{ position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)", width: 200, background: "#1a1a18", color: "#fff", padding: "9px 11px", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.4)", zIndex: 30 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                        <span className="badge" style={{ background: c.bg, color: c.tx }}>{v.severity}</span>
                        <span style={{ fontSize: 9, color: "#9a9890" }}>{v.category}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{v.title}</div>
                      <p style={{ fontSize: 11, color: "#cfcdc6", lineHeight: 1.4 }}>{v.description}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* optical / thermal toggle */}
            <div className="seg" style={{ position: "absolute", top: 10, right: 10, width: "auto", background: "rgba(20,24,32,0.6)", backdropFilter: "blur(6px)", border: "none", padding: 3, zIndex: 25 }}>
              <button className={visionMode === "optical" ? "active" : ""} style={{ padding: "5px 10px", fontSize: 11, color: visionMode === "optical" ? "var(--text)" : "#fff" }} onClick={() => setVisionMode("optical")}>
                <i className="ti ti-eye" aria-hidden="true"></i> Optical
              </button>
              <button className={visionMode === "thermal" ? "active" : ""} style={{ padding: "5px 10px", fontSize: 11, color: visionMode === "thermal" ? "var(--text)" : "#fff" }} onClick={() => setVisionMode("thermal")}>
                <i className="ti ti-temperature" aria-hidden="true"></i> Thermal
              </button>
            </div>
          </div>
        )}
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14, textAlign: "center" }}>
          {visionMode === "optical" ? "Tap a marker to inspect a hazard." : "Simulated infrared thermographics — hot-spots show heat leakage."}
        </p>

        {/* Score + suitability */}
        <div className="card" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 76, height: 76, flexShrink: 0 }}>
            <svg width="76" height="76" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="38" cy="38" r="32" stroke="var(--med-bg)" strokeWidth="7" fill="none" />
              <circle cx="38" cy="38" r="32" stroke={scoreColor} strokeWidth="7" fill="none" strokeLinecap="round"
                strokeDasharray={201} strokeDashoffset={201 - (201 * report.safetyScore) / 100} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{report.safetyScore}</span>
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

        {/* Structural + environmental */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Structural integrity", data: report.structuralIntegrity },
            { label: "Environmental / thermal", data: report.environmentalCompliance },
          ].map(({ label, data }) => {
            const sc = STATUS_COLOR[data.status] || STATUS_COLOR.WARNING;
            return (
              <div key={label} className="card" style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <i className={"ti " + sc.icon} style={{ fontSize: 20, color: sc.tx, marginTop: 1 }} aria-hidden="true"></i>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                    <span className="badge" style={{ background: sc.bg, color: sc.tx, fontSize: 9 }}>{data.status}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{data.details}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={tab === "hazards" ? "active" : ""} onClick={() => setTab("hazards")}>
            <i className="ti ti-alert-hexagon" aria-hidden="true"></i> Hazards ({report.violations.length})
          </button>
          <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
            <i className="ti ti-sparkles" aria-hidden="true"></i> AI chat
          </button>
        </div>

        {tab === "hazards" ? (
          <>
            {/* Hazards list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {report.violations.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: 20 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 30, color: "var(--ok)" }} aria-hidden="true"></i>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>No hazards detected</p>
                </div>
              )}
              {report.violations.map((v) => {
                const c = SEV[v.severity] || SEV.INFO;
                return (
                  <div key={v.id} className="card" style={{ borderLeft: `4px solid ${c.dot}` }}
                    onMouseEnter={() => setActiveMarker(v.id)} onMouseLeave={() => setActiveMarker(null)}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: 2 }}>{v.category} · {v.complianceStandard}</span>
                        <h4 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{v.title}</h4>
                      </div>
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

            {/* Doubt resolution */}
            <p style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              <i className="ti ti-help-circle" aria-hidden="true"></i> Doubt resolution
            </p>
            {report.doubtQuestions && report.doubtQuestions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {report.doubtQuestions.map((q) => {
                  const resolved = userAnswers.find((a) => a.questionId === q.id);
                  return (
                    <div key={q.id} className="card" style={{ background: "var(--card)" }}>
                      <h4 style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
                        <span style={{ color: "var(--accent)" }}>Q: </span>{q.question}
                      </h4>
                      {resolved ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                          <span style={{ fontSize: 12 }}><span style={{ color: "var(--ok)" }}>✓</span> {resolved.answer}</span>
                          <button onClick={() => removeAnswer(q.id)} style={{ border: "none", background: "transparent", color: "var(--crit)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reset</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {q.options.map((opt, i) => (
                            <button key={i} onClick={() => answerDoubt(q, opt)} style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: 7 }}>
                              <i className="ti ti-chevron-right" style={{ color: "var(--accent)" }} aria-hidden="true"></i> {opt}
                            </button>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            <input
                              value={customAnswer[q.id] || ""}
                              onChange={(e) => setCustomAnswer({ ...customAnswer, [q.id]: e.target.value })}
                              placeholder="Custom answer…"
                              style={{ flex: 1, fontSize: 12, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "var(--font)", outline: "none" }}
                            />
                            <button onClick={() => { const t = (customAnswer[q.id] || "").trim(); if (t) { answerDoubt(q, t); setCustomAnswer({ ...customAnswer, [q.id]: "" }); } }}
                              style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "0 12px", cursor: "pointer" }}>
                              <i className="ti ti-arrow-up" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {reErr && <p style={{ fontSize: 12, color: "var(--crit-tx)" }}>{reErr}</p>}
                {userAnswers.length > 0 && (
                  <button className="btn btn-accent" style={{ padding: 12, fontSize: 13 }} disabled={reanalyzing} onClick={doReanalyze}>
                    {reanalyzing ? <><i className="ti ti-loader-2 spin" aria-hidden="true"></i> Recalibrating…</> : <><i className="ti ti-refresh" aria-hidden="true"></i> Re-analyze with {userAnswers.length} answer(s)</>}
                  </button>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 16, marginBottom: 14, background: "var(--card)" }}>
                <i className="ti ti-circle-check" style={{ fontSize: 22, color: "var(--ok)" }} aria-hidden="true"></i>
                <p style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>No open doubts — full diagnostic confidence.</p>
              </div>
            )}
          </>
        ) : (
          <ChatPanel imageSource={imageSource} scenarioGoal={scenarioGoal} guidelines={guidelines} report={report} presetIndex={presetIndex} />
        )}
      </div>

      <div style={{ padding: "12px 20px 26px" }}>
        <button className="btn btn-ghost" onClick={onRestart}>
          <i className="ti ti-plus" aria-hidden="true"></i> New inspection
        </button>
      </div>
    </div>
  );
}

function ChatPanel({ imageSource, scenarioGoal, guidelines, report, presetIndex }: { imageSource: string | null; scenarioGoal: string; guidelines: string; report: InspectionReport; presetIndex: number | null; }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "ai", text: "Hi! I'm your AI safety inspector. Ask me about anything in the report, or explain what's actually in the space to refine the assessment.", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    const next = [...messages, { sender: "user" as const, text, timestamp: Date.now() }];
    setMessages(next);
    setTyping(true);
    try {
      const reply = await chat({
        image: presetIndex !== null ? imageSource : imageSource, // preset url or data url
        messages: next, instructions: guidelines, scenarioGoal, currentReport: report,
      });
      setMessages([...next, { sender: "ai", text: reply, timestamp: Date.now() }]);
    } catch {
      setMessages([...next, { sender: "ai", text: "Error reaching the safety consultant. Check that the API key is configured and try again.", timestamp: Date.now() }]);
    } finally { setTyping(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", borderRadius: 14, padding: "10px 13px", background: m.sender === "user" ? "var(--ink)" : "var(--surface)", color: m.sender === "user" ? "#fff" : "var(--text)", border: m.sender === "user" ? "none" : "1px solid var(--border)", borderTopRightRadius: m.sender === "user" ? 4 : 14, borderTopLeftRadius: m.sender === "user" ? 14 : 4 }}>
              {m.sender === "ai" ? renderMarkdown(m.text) : <p style={{ fontSize: 13, lineHeight: 1.5 }}>{m.text}</p>}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 4, padding: "10px 13px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "fit-content" }}>
            {[0, 1, 2].map((k) => <span key={k} className="pulse-dot" style={{ animationDelay: `${k * 0.15}s`, background: "var(--text-3)" }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "6px 6px 6px 16px", position: "sticky", bottom: 0 }}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about a hazard or explain the space…" disabled={typing}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", fontFamily: "var(--font)", color: "var(--text)" }}
        />
        <button onClick={send} disabled={typing || !input.trim()} aria-label="Send" style={{ border: "none", width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: typing || !input.trim() ? 0.5 : 1 }}>
          <i className="ti ti-arrow-up" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
