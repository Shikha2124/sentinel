import { useState, useEffect } from "react";
import StatusBar from "./StatusBar";

const STEPS = [
  { icon: "ti-photo-scan", label: "Reading the room image" },
  { icon: "ti-ruler-measure", label: "Assessing structural integrity" },
  { icon: "ti-temperature", label: "Scanning thermal & environmental hazards" },
  { icon: "ti-gavel", label: "Matching OSHA & compliance codes" },
  { icon: "ti-list-check", label: "Compiling the safety report" },
];

interface Props {
  scenarioGoal: string;
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  onDone: () => void;
}

export default function LoadingScreen({ scenarioGoal, ready, error, onRetry, onBack, onDone }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length - 1) {
      if (ready) {
        const t = setTimeout(onDone, 400);
        return () => clearTimeout(t);
      }
      return; // hold on last step until the backend responds
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step, ready, onDone]);

  if (error) {
    return (
      <div className="screen">
        <StatusBar />
        <div className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 6 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--crit-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 28, color: "var(--crit-tx)" }} aria-hidden="true"></i>
          </div>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Diagnostic failed</p>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5, maxWidth: 300 }}>{error}</p>
        </div>
        <div style={{ padding: "12px 20px 26px", display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ width: "auto", flex: "0 0 40%" }} onClick={onBack}>Back</button>
          <button className="btn btn-primary" onClick={onRetry}><i className="ti ti-refresh" aria-hidden="true"></i> Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>Inspector agent working…</span>
        </div>
        <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Analyzing the space</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 28 }}>“{scenarioGoal}”</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 4px", opacity: done || active ? 1 : 0.32, transition: "opacity .3s ease" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                  background: done ? "var(--ok-bg)" : active ? "var(--info-bg)" : "var(--card)",
                  color: done ? "var(--ok-tx)" : active ? "var(--info-tx)" : "var(--text-3)",
                  border: "1px solid var(--border)",
                }}>
                  {done ? <i className="ti ti-check" aria-hidden="true"></i>
                    : active ? <i className="ti ti-loader-2 spin" aria-hidden="true"></i>
                    : <i className={"ti " + s.icon} aria-hidden="true"></i>}
                </div>
                <span style={{ fontSize: 14, fontWeight: done || active ? 500 : 400, color: done || active ? "var(--text)" : "var(--text-3)" }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
