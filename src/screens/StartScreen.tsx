import { useRef, useState } from "react";
import StatusBar from "./StatusBar";
import { PRESETS } from "../lib/data";

interface Props {
  onSelectPreset: (idx: number) => void;
  onUploadImage: (dataUrl: string) => void;
  onCustomScenario: (text: string) => void;
}

const EXAMPLES = [
  "Warehouse, Zone B, night crew of 12",
  "Childcare nursery for 15 children — safety fit-out",
];

export default function StartScreen({ onSelectPreset, onUploadImage, onCustomScenario }: Props) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (val?: string) => {
    const v = (val ?? text).trim();
    if (!v) return;
    onCustomScenario(v);
  };

  const onFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) onUploadImage(e.target.result as string); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <i className="ti ti-shield-check" style={{ fontSize: 18 }} aria-hidden="true"></i>
            </div>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Sentinel-AI</span>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 15, marginBottom: 6 }}>AI Safety Inspector</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.22, letterSpacing: "-0.6px" }}>
            <span style={{ color: "var(--accent)" }}>Where</span> are we<br />inspecting today?
          </h1>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
          {PRESETS.map((p, i) => (
            <button key={p.short} className="chip" onClick={() => onSelectPreset(i)}>
              <i className={"ti " + p.icon} aria-hidden="true"></i> {p.short}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Or upload a photo</p>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: "100%", textAlign: "left", background: "var(--surface)", border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "14px", fontSize: 13.5, color: "var(--text-2)", cursor: "pointer", fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: 10 }}
          >
            <i className="ti ti-camera-plus" style={{ fontSize: 20, color: "var(--accent)" }} aria-hidden="true"></i>
            Upload a custom room / area image
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <div style={{ marginTop: 22 }}>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Or describe a scenario</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => submit(ex)} style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "var(--text-2)", cursor: "pointer", fontFamily: "var(--font)" }}>
                <i className="ti ti-history" style={{ marginRight: 8, color: "var(--text-3)" }} aria-hidden="true"></i>{ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 20px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "6px 6px 6px 18px" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Describe the site…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", fontFamily: "var(--font)", color: "var(--text)" }}
          />
          <button aria-label="Send" onClick={() => submit()} style={{ border: "none", width: 38, height: 38, borderRadius: "50%", background: "var(--ink)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-arrow-up" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
