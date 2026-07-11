import React, { useState, useEffect, useRef } from 'react';
import LiveAVSession from './components/LiveAVSession';
import SentinelPortal from './components/SentinelPortal';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Flame, 
  Thermometer, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  HelpCircle, 
  Send, 
  Layers, 
  MapPin, 
  Sparkles, 
  Cpu, 
  Users, 
  Printer, 
  ClipboardList, 
  Check, 
  CornerDownRight,
  Info,
  ChevronRight,
  Maximize2,
  ArrowLeft
} from 'lucide-react';

// Preset Room Scenarios
const PRESETS = [
  {
    name: "50-Person High-Occupancy Office Workspace",
    goal: "Verify suitability for a 50-person high-occupancy open-office workspace.",
    imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Verify egress paths and fire escape routes can accommodate high occupant load (50 people).\n2. Check ventilation density, air-conditioning volume, and lighting conditions.\n3. Identify power-strip daisy-chaining and electrical outlet distribution overload risk.\n4. Scan for structural pillars, tripping hazards, or corridor bottlenecks.\n5. Inspect ceiling tile integrity and potential water leakage spots.",
    thermalConfig: {
      ambient: "22°C",
      hotSpots: [
        { label: "Overloaded Multi-plug Outlet", temp: "42°C", x: 74, y: 78 },
        { label: "Server Rack Vent (Ambient)", temp: "35°C", x: 12, y: 45 }
      ]
    }
  },
  {
    name: "High-Density IT Server Room setup",
    goal: "Verify suitability for installing a high-density, high-load IT Server Room.",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Evaluate dedicated HVAC system, cooling inlets, and thermal airflow channels.\n2. Inspect for nearby overhead plumbing, structural condensation, or fluid leakage hazards.\n3. Check routing of fiber and high-voltage cable trays to avoid safety interference.\n4. Verify electronic lock and access-control security options on the doorway.\n5. Scan ceiling for dust buildup, and verify chemical-based fire suppression system options.",
    thermalConfig: {
      ambient: "18°C",
      hotSpots: [
        { label: "Main Switchboard Hub", temp: "68°C", x: 82, y: 18 },
        { label: "Primary Cooling Intake", temp: "14°C", x: 45, y: 5 }
      ]
    }
  },
  {
    name: "Commercial Kitchen & Food-Prep Area",
    goal: "Verify suitability for high-heat commercial kitchen conversion.",
    imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Scan for commercial-grade range exhaust ventilation and hood safety options.\n2. Inspect floor pathways for wet drainage capacity and non-slip floor materials.\n3. Check electrical socket ground-fault protection (GFCI) near sanitation sink locations.\n4. Look for appropriate clearances around heat-generating stove equipment.\n5. Confirm fire-suppression triggers and manual emergency gas shutoff valve clearance.",
    thermalConfig: {
      ambient: "26°C",
      hotSpots: [
        { label: "Gas Range Cooktop (Idle)", temp: "95°C", x: 34, y: 58 },
        { label: "Electrical Sub-panel", temp: "48°C", x: 88, y: 32 }
      ]
    }
  },
  {
    name: "Heavy-Duty Industrial Storage & Warehouse",
    goal: "Verify structural integrity and environmental safety for heavy-duty industrial storage.",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Scan columns, ceiling beams, and concrete support beams for structural stress cracks.\n2. Assess high-bay lighting fixture mount safety and clearance heights.\n3. Inspect concrete flooring slabs for settlement, moisture, or expansion fractures.\n4. Check emergency exit pathway clearances, roll-up loading dock guards, and signage.\n5. Look for proper natural draft cross-ventilation to prevent high-density gas buildup.",
    thermalConfig: {
      ambient: "20°C",
      hotSpots: [
        { label: "Ceiling Transformer", temp: "52°C", x: 50, y: 15 },
        { label: "Compressor Vent Outlet", temp: "38°C", x: 18, y: 82 }
      ]
    }
  }
];

interface Violation {
  id: string;
  title: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  description: string;
  complianceStandard: string;
  estimatedLocation: string;
  recommendation: string;
  coordinate: {
    x: number;
    y: number;
  };
}

interface DoubtQuestion {
  id: string;
  question: string;
  options: string[];
}

interface InspectionReport {
  safetyScore: number;
  suitability: "SUITABLE" | "SUITABLE_WITH_MODIFICATIONS" | "NOT_SUITABLE";
  suitabilityReason: string;
  structuralIntegrity: {
    status: "PASS" | "WARNING" | "FAIL";
    details: string;
  };
  environmentalCompliance: {
    status: "PASS" | "WARNING" | "FAIL";
    details: string;
  };
  violations: Violation[];
  doubtQuestions: DoubtQuestion[];
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function App() {
  // Config state
  const [isPortalOpen, setIsPortalOpen] = useState<boolean>(true);
  const [sessionMode, setSessionMode] = useState<'static' | 'live'>('static');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(0);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string>(PRESETS[0].guidelines);
  const [scenarioGoal, setScenarioGoal] = useState<string>(PRESETS[0].goal);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [isCustomGoalActive, setIsCustomGoalActive] = useState<boolean>(false);

  // App interaction states
  const [visionMode, setVisionMode] = useState<'normal' | 'thermal'>('normal');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Array<{ questionId: string; question: string; answer: string }>>([]);
  const [customAnswerText, setCustomAnswerText] = useState<{ [key: string]: string }>({});

  // Analysis result
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat consultation states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: `Hi! I am your AI Safety Inspector. Let's inspect this space together! You can ask me to explain what safety features are present or missing, or click **Run AI Safety Diagnostic** to map all potential compliance hazards.`,
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatTyping, setIsChatTyping] = useState<boolean>(false);
  const [activeReportTab, setActiveReportTab] = useState<'violations' | 'chat'>('violations');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePortalSelectScenario = (config: {
    presetIndex: number | null;
    goal: string;
    instructions: string;
  }) => {
    if (config.presetIndex !== null) {
      handlePresetSelect(config.presetIndex);
    } else {
      setSelectedPresetIndex(null);
      setCustomImage(null);
      setScenarioGoal(config.goal);
      setCustomGoal(config.goal);
      setInstructions(config.instructions);
      setIsCustomGoalActive(true);
      setReport(null);
      setUserAnswers([]);
      setError(null);
      setChatMessages([
        {
          sender: 'ai',
          text: `Hi! I have configured the custom scenario: **${config.goal}**. Let's inspect this area together! Upload a photo of the workspace or start a Live AV session, then we can run a full AI Safety Diagnostic.`,
          timestamp: new Date()
        }
      ]);
      setActiveReportTab('violations');
    }
    setIsPortalOpen(false);
  };

  const handleLiveSessionEnd = (lastFrameDataUrl: string, transcript: string[]) => {
    // 1. Switch back to static mode so report output is visible
    setSessionMode('static');
    
    // 2. Set custom image to the final snapshot of the live stream
    if (lastFrameDataUrl) {
      setCustomImage(lastFrameDataUrl);
      setSelectedPresetIndex(null);
    }

    // 3. Reset previous states
    setReport(null);
    setError(null);

    // 4. Build dynamic message summarizing the live discussion points
    let greetingText = `Live AV Session completed! I have captured the final feed snapshot.`;
    if (transcript.length > 0) {
      const displayTranscript = transcript.slice(-4).map(t => `- ${t}`).join('\n');
      greetingText += `\n\n**Discussed during live audit:**\n${displayTranscript}`;
    }
    
    setChatMessages([
      {
        sender: 'ai',
        text: `${greetingText}\n\nGenerating your professional Compliance & Safety report now. Please hold on...`,
        timestamp: new Date()
      }
    ]);
    setActiveReportTab('violations');

    // 5. Package the live conversation transcript as answered question context so /api/inspect integrates it fully
    const customAnswerLog: typeof userAnswers = transcript.length > 0 ? [
      {
        id: "live-transcript",
        question: "Summary of discussion points covered during the Live AV inspection",
        answer: transcript.join("\n")
      }
    ] : [];

    setUserAnswers(customAnswerLog);

    // 6. Automatically trigger inspection using the last frame & instructions
    setTimeout(() => {
      triggerInspection(customAnswerLog, lastFrameDataUrl || undefined);
    }, 200);
  };

  // Sync preset selections
  const handlePresetSelect = (index: number) => {
    setSelectedPresetIndex(index);
    setCustomImage(null);
    setInstructions(PRESETS[index].guidelines);
    setScenarioGoal(PRESETS[index].goal);
    setIsCustomGoalActive(false);
    setReport(null);
    setUserAnswers([]);
    setError(null);
    setChatMessages([
      {
        sender: 'ai',
        text: `Hi! I have loaded the **${PRESETS[index].name}** profile. Let's inspect this area together! Feel free to ask me to explain the safety parameters, ask clarifying questions, or explain what you see in the space.`,
        timestamp: new Date()
      }
    ]);
    setActiveReportTab('violations');
  };

  const handleCustomGoalToggle = (active: boolean) => {
    setIsCustomGoalActive(active);
    if (active) {
      setScenarioGoal(customGoal || "Analyze workspace for custom safety parameters.");
    } else if (selectedPresetIndex !== null) {
      setScenarioGoal(PRESETS[selectedPresetIndex].goal);
    } else {
      setScenarioGoal("Analyze general safety and environmental compliance.");
    }
  };

  const handleCustomGoalTextChange = (text: string) => {
    setCustomGoal(text);
    if (isCustomGoalActive) {
      setScenarioGoal(text || "Analyze workspace for custom safety parameters.");
    }
  };

  // Image Upload handlers
  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCustomImage(e.target.result as string);
        setSelectedPresetIndex(null);
        setReport(null);
        setUserAnswers([]);
        setChatMessages([
          {
            sender: 'ai',
            text: `Hi! I've uploaded your custom room image. Select your custom evaluation scenario or instructions, then ask me anything or click **Run AI Safety Diagnostic** to initiate the compliance scan!`,
            timestamp: new Date()
          }
        ]);
        setActiveReportTab('violations');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Image compression and resizing utility for maximum API performance & reliability
  const resizeAndCompressImage = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800; // Optimal resolution for computer vision analysis
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error("Canvas context is uninitialized"));
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to process image"));
      };
      img.src = src;
    });
  };

  // Trigger safety analysis api
  const triggerInspection = async (updatedAnswers: typeof userAnswers = [], imageOverride?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setActiveMarkerId(null);

    let imageBase64 = "";
    try {
      const sourceImage = imageOverride || (selectedPresetIndex !== null ? PRESETS[selectedPresetIndex].imageUrl : customImage);
      if (!sourceImage) {
        throw new Error("Please select a preset room or upload an image to analyze.");
      }
      // Compress and resize to ensure near-instantaneous uploads and avoid timeouts
      imageBase64 = await resizeAndCompressImage(sourceImage);
    } catch (compressErr) {
      console.warn("Client-side image preparation failed, falling back to original source format", compressErr);
      imageBase64 = selectedPresetIndex !== null ? PRESETS[selectedPresetIndex].imageUrl : (customImage || "");
    }

    if (!imageBase64) {
      setError("Failed to prepare room image for diagnostic scan.");
      setIsAnalyzing(false);
      return;
    }

    // Prepare payload
    const payload: any = {
      instructions,
      scenarioGoal: isCustomGoalActive ? customGoal : scenarioGoal,
      answers: updatedAnswers.map(ans => ({ question: ans.question, answer: ans.answer })),
      image: imageBase64
    };

    try {
      const response = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        // If it looks like HTML (starts with <), extract body or summarize
        if (text.trim().startsWith('<')) {
          throw new Error(`The server encountered an error (HTTP ${response.status}). If you just added the API key, please try restarting the app or check Settings > Secrets.`);
        }
        throw new Error(text || `Server returned a non-JSON response with status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete the room compliance diagnostic.");
      }

      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to parse basic markdown format from Gemini outputs
  const parseMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let processed = line;
      // Convert bold blocks **text** to strong tags
      const boldRegex = /\*\*(.*?)\*\*/g;
      processed = processed.replace(boldRegex, '<strong>$1</strong>');
      
      // Convert bullet points starting with - or *
      if (processed.trim().startsWith('- ') || processed.trim().startsWith('* ')) {
        const content = processed.trim().substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs leading-relaxed text-slate-700 mb-1" dangerouslySetInnerHTML={{ __html: content }} />
        );
      }
      
      // Convert numbered lists
      if (/^\d+\.\s/.test(processed.trim())) {
        const content = processed.trim().replace(/^\d+\.\s/, '');
        return (
          <li key={idx} className="ml-4 list-decimal text-xs leading-relaxed text-slate-700 mb-1" dangerouslySetInnerHTML={{ __html: content }} />
        );
      }
      
      // If empty line, render a small space
      if (!processed.trim()) {
        return <div key={idx} className="h-2" />;
      }
      
      return (
        <p key={idx} className="text-xs leading-relaxed text-slate-700 mb-1.5" dangerouslySetInnerHTML={{ __html: processed }} />
      );
    });
  };

  // Handler to send interactive consultation messages
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatTyping) return;

    const userText = chatInput.trim();
    setChatInput("");

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { sender: 'user', text: userText, timestamp: new Date() }
    ];
    setChatMessages(newMessages);
    setIsChatTyping(true);

    try {
      const payload = {
        image: selectedPresetIndex !== null ? PRESETS[selectedPresetIndex].imageUrl : customImage,
        messages: newMessages.map(m => ({ sender: m.sender, text: m.text })),
        instructions,
        scenarioGoal: isCustomGoalActive ? customGoal : scenarioGoal,
        currentReport: report
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Safety consultant service is currently unavailable.");
      }

      const data = await response.json();
      setChatMessages([
        ...newMessages,
        { sender: 'ai', text: data.text || "I was unable to analyze that detail. Could you elaborate?", timestamp: new Date() }
      ]);
    } catch (err: any) {
      console.error(err);
      setChatMessages([
        ...newMessages,
        { sender: 'ai', text: "Error connecting to the safety consulting service. Please verify that your API key is correctly configured in Settings > Secrets.", timestamp: new Date() }
      ]);
    } finally {
      setIsChatTyping(false);
    }
  };

  // Reusable Chat UI component
  const renderChatPanel = (heightClass = "h-[480px]") => {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col ${heightClass}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">AI Safety Consultation Hub</h3>
              <p className="text-[10px] text-slate-500">Ask safety questions, verify details, or explain corrections</p>
            </div>
          </div>
          <button
            onClick={() => {
              const profileName = selectedPresetIndex !== null ? PRESETS[selectedPresetIndex].name : "custom room";
              setChatMessages([
                {
                  sender: 'ai',
                  text: `Hi! I am your AI Safety Inspector. Let's inspect the **${profileName}** together! Feel free to ask me to explain compliance standards, ask clarifying questions, or let me know what objects are actually in the space.`,
                  timestamp: new Date()
                }
              ]);
            }}
            className="text-[10px] text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded-md bg-slate-50 transition-colors"
          >
            Reset Chat
          </button>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 scrollbar-thin">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                }`}
              >
                <div className="space-y-1">
                  {parseMarkdown(msg.text)}
                </div>
                <span className={`text-[8px] mt-1.5 block text-right ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-500 font-mono'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isChatTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 border border-slate-200/50 text-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-xs">
                <div className="flex items-center gap-1.5 py-1 px-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a question, explain room features, or discuss missing gear..."
            disabled={isChatTyping}
            className="flex-1 text-xs px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
          />
          <button
            type="submit"
            disabled={isChatTyping || !chatInput.trim()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:bg-slate-200 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  };

  // Handle answering doubt questions
  const handleAnswerSubmit = (questionId: string, question: string, optionSelected: string) => {
    const newAnswers = [
      ...userAnswers.filter(ans => ans.questionId !== questionId),
      { questionId, question, answer: optionSelected }
    ];
    setUserAnswers(newAnswers);
  };

  const handleCustomAnswerSubmit = (questionId: string, question: string) => {
    const text = customAnswerText[questionId];
    if (!text || !text.trim()) return;

    const newAnswers = [
      ...userAnswers.filter(ans => ans.questionId !== questionId),
      { questionId, question, answer: text.trim() }
    ];
    setUserAnswers(newAnswers);
    // Clear field
    setCustomAnswerText({
      ...customAnswerText,
      [questionId]: ""
    });
  };

  const removeAnswer = (questionId: string) => {
    setUserAnswers(userAnswers.filter(ans => ans.questionId !== questionId));
  };

  // Export report to markdown/print
  const handlePrint = () => {
    window.print();
  };

  // Helper to get image element
  const getCurrentImageUrl = () => {
    if (selectedPresetIndex !== null) {
      return PRESETS[selectedPresetIndex].imageUrl;
    }
    return customImage;
  };

  if (isPortalOpen) {
    return (
      <SentinelPortal 
        presets={PRESETS} 
        onSelectScenario={handlePortalSelectScenario} 
        userName="Akarsh"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg text-white">
              <ShieldAlert className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Safety Inspector</h1>
              <p className="text-xs text-slate-500">Multimodal Computer Vision &amp; Thermal Compliance Analyzer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => setIsPortalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Sentinel Portal</span>
            </button>

            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              System Online &bull; Gemini 3.5 Ready
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: SETUP & CONFIGURATION */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* Presets & Custom Upload Selector */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-slate-600" />
                <h2 className="font-semibold text-slate-900">1. Room / Scenario Profile</h2>
              </div>
              
              {/* Presets */}
              <div className="space-y-2 mb-4">
                <span className="text-xs font-medium text-slate-500 block">Select a Preset Room:</span>
                <div className="grid grid-cols-1 gap-2">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePresetSelect(idx)}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-start gap-3 ${
                        selectedPresetIndex === idx 
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 font-medium' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded bg-cover bg-center shrink-0 border border-slate-200" style={{ backgroundImage: `url(${preset.imageUrl})` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 truncate font-semibold">{preset.name}</p>
                        <p className="text-slate-500 line-clamp-1 text-[10px] mt-0.5">{preset.goal}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload custom room */}
              <div className="relative">
                <div className="flex items-center my-3">
                  <div className="flex-1 border-t border-slate-200"></div>
                  <span className="px-3 text-[10px] text-slate-400 font-medium uppercase tracking-wider">or</span>
                  <div className="flex-1 border-t border-slate-200"></div>
                </div>

                <label 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all block ${
                    isDragOver 
                      ? 'border-slate-900 bg-slate-50' 
                      : customImage 
                        ? 'border-emerald-500 bg-emerald-50/20' 
                        : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <input 
                    type="file" 
                    onChange={(e) => e.target.files && processFile(e.target.files[0])}
                    className="sr-only" 
                    accept="image/*"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <Upload className={`w-5 h-5 ${customImage ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <p className="text-xs font-medium text-slate-700">
                      {customImage ? "Custom Room Uploaded" : "Upload Custom Room Image"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {customImage ? "Click or drag another image to replace" : "Drag & drop or browse device"}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Scenario Evaluation Goal */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-600" />
                  <h2 className="font-semibold text-slate-900">2. Suitability Scenario</h2>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-500">Custom Mode</span>
                  <input 
                    type="checkbox"
                    checked={isCustomGoalActive}
                    onChange={(e) => handleCustomGoalToggle(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                </div>
              </div>

              {!isCustomGoalActive ? (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider mb-1">Target Scenario</span>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    {scenarioGoal}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Describe Custom Evaluation Scenario:</span>
                  <textarea
                    rows={3}
                    value={customGoal}
                    onChange={(e) => handleCustomGoalTextChange(e.target.value)}
                    placeholder="Example: Detect if this space is safe for setting up a childcare nursery with 15 children..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 italic">
                    The AI inspector will evaluate compliance specifically against this scenario.
                  </p>
                </div>
              )}
            </div>

            {/* Safety Inspection Instructions */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-slate-600" />
                <h2 className="font-semibold text-slate-900">3. Inspection Guidelines</h2>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Customize the safety standards and specific elements the AI inspector must enforce:
              </p>
              
              <textarea
                rows={6}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="List rules or compliance standards..."
                className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white font-mono"
              />
              
              <div className="mt-4">
                <button
                  disabled={isAnalyzing}
                  onClick={() => triggerInspection()}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-lg font-medium text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Compliance...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      Run AI Safety Diagnostic
                    </>
                  )}
                </button>
              </div>
            </div>

          </section>

          {/* CENTER COLUMN: CAMERA & SENSOR VIEW */}
          <section className="lg:col-span-8 space-y-6">
            
            {/* Main Inspection Mode Tabs */}
            <div className="flex bg-slate-200/60 p-1.5 rounded-xl border border-slate-200/80 gap-1.5">
              <button
                onClick={() => setSessionMode('static')}
                className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  sessionMode === 'static'
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Static Photo Analysis</span>
              </button>
              <button
                onClick={() => setSessionMode('live')}
                className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  sessionMode === 'live'
                    ? 'bg-slate-900 text-yellow-300 shadow-md ring-1 ring-yellow-400/25'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${sessionMode === 'live' ? 'animate-ping' : ''}`}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </div>
                <span>Live Real-Time AV Inspector</span>
              </button>
            </div>

            {sessionMode === 'live' ? (
              <LiveAVSession 
                instructions={instructions} 
                scenarioGoal={scenarioGoal} 
                onSessionEnd={handleLiveSessionEnd}
              />
            ) : (
              <>
                {/* Vision Stage Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="border-b border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-semibold text-xs text-slate-700 tracking-wide uppercase">Active Sensor Camera feed</span>
                </div>
                
                {/* Vision Mode Selector */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                  <button
                    onClick={() => setVisionMode('normal')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                      visionMode === 'normal' 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Optical Lens
                  </button>
                  <button
                    onClick={() => setVisionMode('thermal')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                      visionMode === 'thermal' 
                        ? 'bg-[#1e1b4b] text-yellow-300 shadow-sm ring-1 ring-yellow-400/20' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Thermometer className="w-3.5 h-3.5" />
                    Thermal Sensor
                  </button>
                </div>
              </div>

              {/* Interactive Stage Canvas */}
              <div className="relative aspect-video bg-slate-950 overflow-hidden group">
                {getCurrentImageUrl() ? (
                  <div className="w-full h-full relative">
                    <img 
                      src={getCurrentImageUrl()!} 
                      alt="Room Diagnostic Stage" 
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        visionMode === 'thermal' 
                          ? 'grayscale-40 contrast-125 brightness-90 saturate-150 filter' 
                          : ''
                      }`}
                    />
                    
                    {/* Simulated Thermal Heat Overlay */}
                    {visionMode === 'thermal' && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#120038]/60 via-[#4c1d95]/70 via-[#b91c1c]/50 to-[#fbbf24]/50 mix-blend-color-dodge opacity-85 pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#020617]/50 via-transparent to-[#fbbf24]/20 mix-blend-color opacity-80 pointer-events-none" />
                        
                        {/* Preset Hot Spots Indicators */}
                        {selectedPresetIndex !== null && PRESETS[selectedPresetIndex].thermalConfig.hotSpots.map((spot, i) => (
                          <div 
                            key={i} 
                            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group/spot z-10"
                          >
                            <span className="absolute inline-flex h-6 w-6 rounded-full bg-yellow-400 opacity-75 animate-ping" />
                            <div className="w-4 h-4 rounded-full bg-red-500 border border-white cursor-pointer relative flex items-center justify-center shadow-md">
                              <Flame className="w-2.5 h-2.5 text-white animate-pulse" />
                            </div>
                            
                            {/* Hot Spot Tooltip */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-slate-900 border border-yellow-400 text-white p-2 rounded-md shadow-lg text-[10px] font-mono whitespace-nowrap opacity-100 transition-opacity z-20">
                              <p className="font-semibold text-yellow-400">{spot.label}</p>
                              <p className="text-slate-300 font-bold mt-0.5">Temp: {spot.temp}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Safety Violation Overlay Markers (Optical Mode) */}
                    {report && report.violations && report.violations.map((violation) => {
                      const isSelected = activeMarkerId === violation.id;
                      const severityColor = 
                        violation.severity === 'CRITICAL' ? 'bg-red-500 text-white border-red-200' :
                        violation.severity === 'WARNING' ? 'bg-amber-500 text-white border-amber-200' :
                        'bg-blue-500 text-white border-blue-200';

                      return (
                        <div 
                          key={violation.id}
                          style={{ left: `${violation.coordinate.x}%`, top: `${violation.coordinate.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group/marker"
                          onMouseEnter={() => setActiveMarkerId(violation.id)}
                          onMouseLeave={() => setActiveMarkerId(null)}
                        >
                          <span className={`absolute inline-flex h-8 w-8 rounded-full ${isSelected ? 'scale-125 opacity-40 animate-pulse' : 'scale-100 opacity-20'} transition-all ${
                            violation.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          
                          <button 
                            className={`w-6 h-6 rounded-full border shadow-lg font-bold text-[10px] flex items-center justify-center transition-transform ${severityColor} ${
                              isSelected ? 'scale-110 ring-2 ring-white' : 'scale-100'
                            }`}
                          >
                            {violation.severity === 'CRITICAL' ? '!' : '?'}
                          </button>

                          {/* Interactive Marker Tooltip */}
                          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border ${
                            violation.severity === 'CRITICAL' ? 'border-red-500' : 'border-amber-400'
                          } text-white p-3 rounded-lg shadow-xl text-xs w-64 transition-all duration-200 ${
                            isSelected ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                          }`}>
                            <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5 mb-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                violation.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}>
                                {violation.severity}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">{violation.category}</span>
                            </div>
                            <h4 className="font-bold text-white mb-1 leading-tight">{violation.title}</h4>
                            <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed mb-1.5">{violation.description}</p>
                            <p className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded inline-block">
                              {violation.complianceStandard}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Thermal Overlay Marker Labels in Thermal Mode */}
                    {visionMode === 'thermal' && report && report.violations && report.violations.map((violation) => {
                      // Estimate hypothetical thermographics for violations
                      const pseudoTemp = violation.severity === 'CRITICAL' ? "72°C - overheating risk" : "44°C - high ambient";
                      return (
                        <div
                          key={`thermal-${violation.id}`}
                          style={{ left: `${violation.coordinate.x}%`, top: `${violation.coordinate.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                        >
                          <div className="w-3 h-3 rounded-full bg-red-600 border border-white flex items-center justify-center animate-ping" />
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-950/90 text-yellow-300 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-400/30 whitespace-nowrap pointer-events-none">
                            {pseudoTemp}
                          </div>
                        </div>
                      );
                    })}

                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-lg">
                    <Activity className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
                    <h3 className="font-semibold text-sm text-slate-300">Stage Uninitialized</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Choose a room preset or upload a custom image from the left panel, and trigger the AI Diagnostic to initialize active vision tracking.
                    </p>
                  </div>
                )}
                
                {/* Vision Status Overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-30">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-2 border-slate-800 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                      </div>
                      <span className="absolute top-0 right-0 h-3.5 w-3.5 bg-indigo-500 rounded-full flex items-center justify-center border border-slate-950 text-[8px] text-white font-bold animate-bounce">
                        AI
                      </span>
                    </div>
                    <div>
                      <h3 className="text-slate-200 text-sm font-semibold tracking-wide text-center">Processing Multi-Sensor Vision</h3>
                      <p className="text-slate-500 text-[11px] text-center mt-1">
                        Detecting hazards, structural integrity &amp; thermal anomalies...
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Vision Instructions Footer */}
              {getCurrentImageUrl() && (
                <div className="bg-slate-50 border-t border-slate-200 p-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <p className="leading-relaxed">
                      {visionMode === 'normal' 
                        ? "Hover over violation circles ( ! ) on the image to locate and isolate risk details in real-time."
                        : "Simulated infrared heat thermographics based on environmental compliance guidelines. Hot-spots indicate temperature leakage."
                      }
                    </p>
                  </div>
                  {visionMode === 'normal' && report && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                      {report.violations.length} Hazards Mapped
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error Message banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Diagnostic Error</h4>
                  <p className="text-xs mt-0.5 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* If no report has been generated yet, show the Chat Consulting Panel to allow immediate talking/questioning */}
            {!report && getCurrentImageUrl() && (
              <div className="mt-6">
                {renderChatPanel("h-[500px]")}
              </div>
            )}

            {/* LOWER PORTION: DIAGNOSTIC REPORT AND INTERACTIVE RESOLUTIONS */}
            {report && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* SUB-COLUMN 1: COMPLIANCE METRICS & STATS */}
                <div className="space-y-6">
                  
                  {/* Performance / Safety Score Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-950 text-xs uppercase tracking-wider text-slate-400 mb-3">Overall Compliance</h3>
                    
                    <div className="flex items-center gap-6">
                      {/* Radial score meter */}
                      <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                          <circle 
                            cx="48" 
                            cy="48" 
                            r="40" 
                            stroke={report.safetyScore >= 80 ? "#10b981" : report.safetyScore >= 50 ? "#f59e0b" : "#ef4444"} 
                            strokeWidth="8" 
                            fill="transparent" 
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * report.safetyScore) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-900">{report.safetyScore}%</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Score</span>
                        </div>
                      </div>

                      {/* Suitability details */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          {report.suitability === 'SUITABLE' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle className="w-3.5 h-3.5" /> SUITABLE
                            </span>
                          )}
                          {report.suitability === 'SUITABLE_WITH_MODIFICATIONS' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-3.5 h-3.5" /> MODIFICATIONS NEEDED
                            </span>
                          )}
                          {report.suitability === 'NOT_SUITABLE' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                              <XCircle className="w-3.5 h-3.5" /> NOT SUITABLE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {report.suitabilityReason}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Structural & Environmental Checklist */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-xs uppercase tracking-wider text-slate-400">System Integrations Checklist</h3>
                    
                    {/* Structural Check */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="mt-0.5">
                        {report.structuralIntegrity.status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : report.structuralIntegrity.status === 'WARNING' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-xs text-slate-950">Structural Integrity</h4>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                            report.structuralIntegrity.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' :
                            report.structuralIntegrity.status === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {report.structuralIntegrity.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {report.structuralIntegrity.details}
                        </p>
                      </div>
                    </div>

                    {/* Environmental & Thermal */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="mt-0.5">
                        {report.environmentalCompliance.status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : report.environmentalCompliance.status === 'WARNING' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-xs text-slate-950">Environmental / Thermal</h4>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                            report.environmentalCompliance.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' :
                            report.environmentalCompliance.status === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {report.environmentalCompliance.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {report.environmentalCompliance.details}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Doubt Resolution Console */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-slate-600" />
                        <h3 className="font-bold text-slate-950 text-xs uppercase tracking-wider">Doubt Resolution Center</h3>
                      </div>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 border border-slate-200 rounded-full font-semibold text-slate-600">
                        Interactive Loop
                      </span>
                    </div>

                    {report.doubtQuestions && report.doubtQuestions.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          To refine the diagnosis accuracy, resolve these doubts that the AI has highlighted:
                        </p>
                        
                        {report.doubtQuestions.map((q) => {
                          const resolvedAnswer = userAnswers.find(ans => ans.questionId === q.id);
                          return (
                            <div key={q.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
                              <h4 className="text-xs font-bold text-slate-900 leading-snug flex items-start gap-1.5">
                                <span className="text-indigo-600">Q:</span>
                                {q.question}
                              </h4>

                              {resolvedAnswer ? (
                                <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span className="text-slate-400">Resolved Answer:</span>
                                    <span className="font-semibold text-slate-800">{resolvedAnswer.answer}</span>
                                  </div>
                                  <button
                                    onClick={() => removeAnswer(q.id)}
                                    className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                                  >
                                    Reset
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {/* Multiple Choice Options */}
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {q.options.map((option, oIdx) => (
                                      <button
                                        key={oIdx}
                                        onClick={() => handleAnswerSubmit(q.id, q.question, option)}
                                        className="w-full text-left bg-white hover:bg-slate-50 active:bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-xs transition-colors flex items-center gap-2 font-medium"
                                      >
                                        <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                                        {option}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Custom response text */}
                                  <div className="flex gap-2 border-t border-slate-200/60 pt-2.5">
                                    <input
                                      type="text"
                                      value={customAnswerText[q.id] || ""}
                                      onChange={(e) => setCustomAnswerText({
                                        ...customAnswerText,
                                        [q.id]: e.target.value
                                      })}
                                      placeholder="Provide custom verification details..."
                                      className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                                    />
                                    <button
                                      onClick={() => handleCustomAnswerSubmit(q.id, q.question)}
                                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {userAnswers.length > 0 && (
                          <button
                            disabled={isAnalyzing}
                            onClick={() => triggerInspection(userAnswers)}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                          >
                            {isAnalyzing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Recalibrating Report...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                Re-Analyze with Resolved Doubts ({userAnswers.length})
                              </>
                            )}
                          </button>
                        )}

                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                        <p className="text-xs font-semibold text-slate-800">Perfect Diagnostic Confidence</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">The AI safety model has resolved all visual variables and has no doubts requiring user resolution.</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* SUB-COLUMN 2: DETAILED LIST OF VIOLATIONS & RECOMMENDATIONS OR CONSULTATION CHAT */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-full flex flex-col">
                  {/* Tab Selector */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setActiveReportTab('violations')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                          activeReportTab === 'violations' 
                            ? 'bg-white text-slate-900 shadow-sm font-bold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                        Detected Hazards
                      </button>
                      <button
                        onClick={() => setActiveReportTab('chat')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                          activeReportTab === 'chat' 
                            ? 'bg-white text-slate-900 shadow-sm font-bold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        AI Compliance Chat
                      </button>
                    </div>

                    {activeReportTab === 'violations' && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handlePrint}
                          className="p-1 text-slate-400 hover:text-slate-950 rounded transition-colors"
                          title="Print Compliance Report"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                          {report.violations.length} Detected
                        </span>
                      </div>
                    )}
                  </div>

                  {activeReportTab === 'violations' ? (
                    report.violations.length > 0 ? (
                      <div className="space-y-4 overflow-y-auto max-h-[640px] pr-1">
                        {report.violations.map((v) => {
                          const isHovered = activeMarkerId === v.id;
                          const severityClass = 
                            v.severity === 'CRITICAL' ? 'border-l-4 border-l-red-500 bg-red-50/20' :
                            v.severity === 'WARNING' ? 'border-l-4 border-l-amber-500 bg-amber-50/20' :
                            'border-l-4 border-l-blue-500 bg-blue-50/20';

                          return (
                            <div 
                              key={v.id}
                              onMouseEnter={() => setActiveMarkerId(v.id)}
                              onMouseLeave={() => setActiveMarkerId(null)}
                              className={`p-4 border border-slate-200/80 rounded-xl transition-all duration-200 cursor-pointer ${severityClass} ${
                                isHovered ? 'ring-1 ring-slate-400 shadow-md translate-x-1' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="text-[9px] font-mono text-slate-400 block uppercase tracking-wider mb-0.5">
                                    {v.category} &bull; {v.complianceStandard}
                                  </span>
                                  <h4 className="font-bold text-xs text-slate-950 flex items-center gap-2 leading-tight">
                                    {v.title}
                                    {v.severity === 'CRITICAL' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />}
                                  </h4>
                                </div>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${
                                  v.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                  v.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {v.severity}
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                                {v.description}
                              </p>

                              <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] bg-white border border-slate-100 p-2 rounded-lg font-medium">
                                <div>
                                  <span className="text-slate-400 block font-normal">Approx. Location:</span>
                                  <span className="text-slate-700 truncate block">{v.estimatedLocation}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-normal">Sensing Coordinates:</span>
                                  <span className="text-slate-700 font-mono block">X:{v.coordinate.x}% Y:{v.coordinate.y}%</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px]">
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                  <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
                                  Recommended Correction:
                                </span>
                                <p className="text-slate-500 mt-0.5 leading-relaxed font-normal">
                                  {v.recommendation}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
                        <h4 className="font-bold text-sm text-slate-800">No Safety Violations Detected</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                          The AI inspection model scanned all visual boundaries and did not identify any compliance failures matching your active scenario or instructions.
                        </p>
                      </div>
                    )
                  ) : (
                    /* Render high-fidelity chat consultation */
                    renderChatPanel("h-[600px]")
                  )}
                </div>
              </div>
            )}
          </>
        )}

          </section>

        </div>
      </main>

      {/* Hidden layout formatted specifically for standard printing/report generation */}
      <div id="print-section" className="hidden print:block p-8 bg-white text-black font-sans leading-relaxed">
        <h1 className="text-2xl font-bold border-b-2 border-black pb-3 mb-4">Official Safety Inspection Compliance Report</h1>
        <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-gray-50 p-4 rounded border">
          <div>
            <p><strong>Date of Inspection:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>Scenario Assessed:</strong> {isCustomGoalActive ? customGoal : scenarioGoal}</p>
          </div>
          <div>
            <p><strong>Compliance Safety Score:</strong> {report?.safetyScore}%</p>
            <p><strong>Final Suitability State:</strong> {report?.suitability}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold border-b border-gray-400 pb-1 mb-2 mt-6">Executive Suitability Summary</h2>
        <p className="text-sm mb-4 leading-relaxed">{report?.suitabilityReason}</p>

        <h2 className="text-lg font-bold border-b border-gray-400 pb-1 mb-2 mt-6">Structural &amp; Environmental Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div className="border p-3 rounded">
            <p className="font-bold">Structural Integrity: {report?.structuralIntegrity.status}</p>
            <p className="text-xs text-gray-600 mt-1">{report?.structuralIntegrity.details}</p>
          </div>
          <div className="border p-3 rounded">
            <p className="font-bold">Environmental / Thermal: {report?.environmentalCompliance.status}</p>
            <p className="text-xs text-gray-600 mt-1">{report?.environmentalCompliance.details}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold border-b border-gray-400 pb-1 mb-2 mt-6">Detailed Violations &amp; Corrective Actions</h2>
        <div className="space-y-4">
          {report?.violations && report.violations.map((v, idx) => (
            <div key={v.id} className="border p-4 rounded-lg text-xs leading-relaxed">
              <div className="flex justify-between font-bold text-sm mb-1">
                <span>{idx + 1}. {v.title} ({v.severity})</span>
                <span className="text-gray-500">{v.complianceStandard}</span>
              </div>
              <p><strong>Category:</strong> {v.category} | <strong>Location:</strong> {v.estimatedLocation}</p>
              <p className="mt-1.5"><strong>Description:</strong> {v.description}</p>
              <p className="mt-1.5 text-gray-700 bg-gray-100 p-2 rounded"><strong>Corrective Recommendation:</strong> {v.recommendation}</p>
            </div>
          ))}
          {(!report?.violations || report.violations.length === 0) && (
            <p className="text-sm italic">No safety violations detected under specified criteria.</p>
          )}
        </div>
      </div>
    </div>
  );
}
