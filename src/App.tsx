import { useState } from "react";
import StartScreen from "./screens/StartScreen";
import ConfigScreen from "./screens/ConfigScreen";
import LoadingScreen from "./screens/LoadingScreen";
import ReportScreen from "./screens/ReportScreen";
import LiveScreen from "./screens/LiveScreen";
import { PRESETS, type InspectionReport, type Answer } from "./lib/data";
import { inspect } from "./lib/api";
import { resizeAndCompressImage } from "./lib/image";

type Stage = "start" | "config" | "loading" | "live" | "report";

export default function App() {
  const [stage, setStage] = useState<Stage>("start");

  // Profile: either a preset index or a custom uploaded image.
  const [presetIndex, setPresetIndex] = useState<number | null>(null);
  const [customImage, setCustomImage] = useState<string | null>(null);

  // Scenario + guidelines
  const [guidelines, setGuidelines] = useState<string>(PRESETS[0].guidelines);
  const [presetGoal, setPresetGoal] = useState<string>(PRESETS[0].goal);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [isCustomGoalActive, setIsCustomGoalActive] = useState<boolean>(false);

  // Analysis
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scenarioGoal = isCustomGoalActive ? customGoal || "Analyze workspace for custom safety parameters." : presetGoal;
  const imageSource = presetIndex !== null ? PRESETS[presetIndex].imageUrl : customImage;

  const selectPreset = (idx: number) => {
    setPresetIndex(idx);
    setCustomImage(null);
    setGuidelines(PRESETS[idx].guidelines);
    setPresetGoal(PRESETS[idx].goal);
    setIsCustomGoalActive(false);
    resetAnalysis();
    setStage("config");
  };

  const uploadImage = (dataUrl: string) => {
    setCustomImage(dataUrl);
    setPresetIndex(null);
    setGuidelines("1. Verify clear, unobstructed emergency egress paths and exits.\n2. Check electrical safety: outlets, cabling, overload risk.\n3. Inspect structural integrity of walls, floors, and ceilings.\n4. Assess ventilation, lighting, and thermal conditions.\n5. Confirm presence of fire safety and first-aid equipment.");
    setIsCustomGoalActive(true);
    resetAnalysis();
    setStage("config");
  };

  const startCustomScenario = (text: string) => {
    setPresetIndex(null);
    setCustomImage(null);
    setCustomGoal(text);
    setIsCustomGoalActive(true);
    setGuidelines("1. Verify clear, unobstructed emergency egress paths and exits.\n2. Check electrical safety: outlets, cabling, overload risk.\n3. Inspect structural integrity of walls, floors, and ceilings.\n4. Assess ventilation, lighting, and thermal conditions.\n5. Confirm presence of fire safety and first-aid equipment.");
    resetAnalysis();
    setStage("config");
  };

  function resetAnalysis() {
    setReport(null);
    setUserAnswers([]);
    setReady(false);
    setError(null);
  }

  // Runs the static diagnostic. Used for the initial run (moves to loading first)
  // and returns the report so callers (re-analyze) can react.
  async function runInspection(answers: Answer[]): Promise<InspectionReport> {
    let image = imageSource || "";
    try {
      if (image) image = await resizeAndCompressImage(image);
    } catch {
      image = imageSource || "";
    }
    if (!image) throw new Error("No room image available to analyze.");
    return inspect({ image, instructions: guidelines, scenarioGoal, answers });
  }

  const startStaticInspection = () => {
    resetAnalysis();
    setStage("loading");
    runInspection([])
      .then((r) => { setReport(r); setReady(true); })
      .catch((e) => setError(e.message || "An unexpected error occurred during analysis."));
  };

  const reanalyze = async (answers: Answer[]) => {
    const r = await runInspection(answers);
    setReport(r);
  };

  const restart = () => {
    setPresetIndex(null);
    setCustomImage(null);
    setCustomGoal("");
    setIsCustomGoalActive(false);
    resetAnalysis();
    setStage("start");
  };

  return (
    <div className="phone">
      {stage === "start" && (
        <StartScreen
          onSelectPreset={selectPreset}
          onUploadImage={uploadImage}
          onCustomScenario={startCustomScenario}
        />
      )}

      {stage === "config" && (
        <ConfigScreen
          presetIndex={presetIndex}
          imageSource={imageSource}
          scenarioGoal={scenarioGoal}
          isCustomGoalActive={isCustomGoalActive}
          customGoal={customGoal}
          guidelines={guidelines}
          onCustomGoalToggle={setIsCustomGoalActive}
          onCustomGoalChange={setCustomGoal}
          onGuidelinesChange={setGuidelines}
          onBack={() => setStage("start")}
          onStatic={startStaticInspection}
          onLive={() => setStage("live")}
        />
      )}

      {stage === "loading" && (
        <LoadingScreen
          scenarioGoal={scenarioGoal}
          ready={ready}
          error={error}
          onRetry={startStaticInspection}
          onBack={() => setStage("config")}
          onDone={() => setStage("report")}
        />
      )}

      {stage === "live" && (
        <LiveScreen
          instructions={guidelines}
          scenarioGoal={scenarioGoal}
          onBack={() => setStage("config")}
        />
      )}

      {stage === "report" && report && (
        <ReportScreen
          report={report}
          presetIndex={presetIndex}
          imageSource={imageSource}
          scenarioGoal={scenarioGoal}
          guidelines={guidelines}
          userAnswers={userAnswers}
          setUserAnswers={setUserAnswers}
          onReanalyze={reanalyze}
          onRestart={restart}
          onNewScan={() => setStage("config")}
        />
      )}
    </div>
  );
}
