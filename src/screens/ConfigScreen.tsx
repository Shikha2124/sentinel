import StatusBar from "./StatusBar";
import { PRESETS } from "../lib/data";

interface Props {
  presetIndex: number | null;
  imageSource: string | null;
  scenarioGoal: string;
  isCustomGoalActive: boolean;
  customGoal: string;
  guidelines: string;
  onCustomGoalToggle: (v: boolean) => void;
  onCustomGoalChange: (v: string) => void;
  onGuidelinesChange: (v: string) => void;
  onBack: () => void;
  onStatic: () => void;
  onLive: () => void;
}

export default function ConfigScreen(props: Props) {
  const {
    presetIndex, imageSource, scenarioGoal, isCustomGoalActive, customGoal, guidelines,
    onCustomGoalToggle, onCustomGoalChange, onGuidelinesChange, onBack, onStatic, onLive,
  } = props;

  const title = presetIndex !== null ? PRESETS[presetIndex].name : "Custom inspection";

  return (
    <div className="screen">
      <StatusBar />
      <div style={{ padding: "8px 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} aria-label="Back" style={{ border: "none", background: "transparent", fontSize: 22, color: "var(--text-2)", cursor: "pointer", padding: 0 }}>
          <i className="ti ti-chevron-left" aria-hidden="true"></i>
        </button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-sparkles" style={{ color: "var(--accent)", fontSize: 14 }} aria-hidden="true"></i>
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>Configure inspection</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.3px", lineHeight: 1.2 }}>{title}</h2>
        </div>
      </div>

      <div className="scroll">
        {imageSource && (
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 16, aspectRatio: "16 / 10", background: "#000" }}>
            <img src={imageSource} alt="Selected area" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        {/* Scenario goal */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <i className="ti ti-target-arrow" style={{ color: "var(--text-2)", fontSize: 16 }} aria-hidden="true"></i>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Suitability scenario</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-3)", cursor: "pointer" }}>
              Custom
              <input type="checkbox" checked={isCustomGoalActive} onChange={(e) => onCustomGoalToggle(e.target.checked)} />
            </label>
          </div>
          {isCustomGoalActive ? (
            <textarea
              className="field" rows={3} value={customGoal}
              onChange={(e) => onCustomGoalChange(e.target.value)}
              placeholder="Example: Detect if this space is safe for a childcare nursery with 15 children…"
            />
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>{scenarioGoal}</p>
          )}
        </div>

        {/* Guidelines */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <i className="ti ti-clipboard-list" style={{ color: "var(--text-2)", fontSize: 16 }} aria-hidden="true"></i>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Inspection guidelines</span>
          </div>
          <textarea
            className="field" rows={7} value={guidelines}
            onChange={(e) => onGuidelinesChange(e.target.value)}
            placeholder="List the safety standards and elements to enforce…"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          />
        </div>
      </div>

      <div style={{ padding: "12px 20px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="btn btn-accent" onClick={onStatic} disabled={!imageSource}>
          <i className="ti ti-scan-eye" aria-hidden="true"></i> Run AI safety diagnostic
        </button>
        <button className="btn btn-primary" onClick={onLive}>
          <i className="ti ti-video" aria-hidden="true"></i> Start live AV walkthrough
        </button>
        {!imageSource && (
          <p style={{ fontSize: 11.5, color: "var(--text-3)", textAlign: "center" }}>
            Static analysis needs a photo — go back to pick a preset or upload one. Live walkthrough works without a photo.
          </p>
        )}
      </div>
    </div>
  );
}
