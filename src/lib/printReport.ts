// Builds a clean, standalone report document and prints it — so the exported
// PDF contains only the inspection report, not the surrounding app UI.
import type { InspectionReport } from "./data";

const SEV_HEX: Record<string, string> = {
  CRITICAL: "#b42318",
  WARNING: "#c77d18",
  INFO: "#2f6fb0",
};

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function printReport(
  report: InspectionReport,
  opts: { scenarioGoal: string; imageUrl?: string | null },
) {
  const w = window.open("", "_blank", "width=820,height=1040");
  if (!w) {
    // Popup blocked — fall back to native print.
    window.print();
    return;
  }

  const scoreColor =
    report.safetyScore >= 80
      ? "#2e7d32"
      : report.safetyScore >= 50
        ? "#c77d18"
        : "#b42318";

  const suitLabel =
    report.suitability === "SUITABLE"
      ? "Suitable"
      : report.suitability === "SUITABLE_WITH_MODIFICATIONS"
        ? "Modifications needed"
        : "Not suitable";

  const statusRow = (
    label: string,
    data: { status: string; details: string },
  ) => `
    <tr>
      <td class="k">${esc(label)}</td>
      <td><span class="pill">${esc(data.status)}</span> ${esc(data.details)}</td>
    </tr>`;

  const violations = report.violations.length
    ? report.violations
        .map(
          (v) => `
      <div class="viol" style="border-left:5px solid ${SEV_HEX[v.severity] || SEV_HEX.INFO}">
        <div class="viol-head">
          <strong>${esc(v.title)}</strong>
          <span class="sev" style="color:${SEV_HEX[v.severity] || SEV_HEX.INFO}">${esc(v.severity)}</span>
        </div>
        <div class="meta">${esc(v.category)} · ${esc(v.complianceStandard)}</div>
        <p>${esc(v.description)}</p>
        <div class="rec"><strong>Recommendation:</strong> ${esc(v.recommendation)}</div>
      </div>`,
        )
        .join("")
    : `<p class="none">No hazards detected.</p>`;

  const generated = new Date().toLocaleString();

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Sentinel-AI Inspection Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a18; margin: 0; padding: 32px 40px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #6b6b66; font-size: 12px; margin: 0 0 18px; }
  .goal { font-size: 14px; font-style: italic; color: #333; margin: 0 0 20px; }
  .score-row { display: flex; align-items: center; gap: 20px; padding: 16px; border: 1px solid #e2e0da; border-radius: 12px; margin-bottom: 20px; }
  .score { font-size: 40px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
  .score small { display: block; font-size: 10px; color: #888; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; }
  .suit { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .reason { font-size: 13px; color: #444; line-height: 1.5; }
  img.snap { width: 100%; max-height: 320px; object-fit: cover; border-radius: 10px; border: 1px solid #e2e0da; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: #6b6b66; border-bottom: 1px solid #e2e0da; padding-bottom: 5px; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 8px 6px; vertical-align: top; border-bottom: 1px solid #f0eee8; line-height: 1.5; }
  td.k { font-weight: 600; width: 180px; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #eef1f4; margin-right: 6px; }
  .viol { padding: 10px 14px; border: 1px solid #e2e0da; border-radius: 8px; margin-bottom: 10px; }
  .viol-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .sev { font-size: 11px; font-weight: 800; }
  .meta { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .4px; margin: 2px 0 6px; }
  .viol p { font-size: 12.5px; color: #444; line-height: 1.5; margin: 0 0 8px; }
  .rec { font-size: 12px; background: #f6f5f0; border-radius: 6px; padding: 7px 9px; }
  .none { color: #2e7d32; font-weight: 600; }
  @media print { body { padding: 0; } .viol { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Sentinel-AI — Safety Inspection Report</h1>
  <p class="sub">Live walkthrough · Generated ${esc(generated)}</p>
  <p class="goal">“${esc(opts.scenarioGoal)}”</p>
  ${opts.imageUrl ? `<img class="snap" src="${opts.imageUrl}" alt="Inspected area" />` : ""}

  <div class="score-row">
    <div class="score">${report.safetyScore}<small>Safety score</small></div>
    <div>
      <div class="suit">${esc(suitLabel)}</div>
      <div class="reason">${esc(report.suitabilityReason)}</div>
    </div>
  </div>

  <h2>Assessment</h2>
  <table>
    ${statusRow("Structural integrity", report.structuralIntegrity)}
    ${statusRow("Environmental / thermal", report.environmentalCompliance)}
  </table>

  <h2>Hazards (${report.violations.length})</h2>
  ${violations}

  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 200); };
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
