import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Warehouse, 
  Factory, 
  Building2, 
  FlaskConical, 
  History, 
  ArrowUp, 
  Mic, 
  MicOff,
  AlertCircle
} from 'lucide-react';

interface SentinelPortalProps {
  presets: Array<{
    name: string;
    goal: string;
    imageUrl: string;
    guidelines: string;
  }>;
  onSelectScenario: (config: {
    presetIndex: number | null;
    goal: string;
    instructions: string;
  }) => void;
  userName?: string;
}

export default function SentinelPortal({ presets, onSelectScenario, userName = "Akarsh" }: SentinelPortalProps) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(prev => prev ? prev + " " + transcript : transcript);
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleChipClick = (type: 'warehouse' | 'factory' | 'office' | 'lab') => {
    if (type === 'warehouse') {
      // Find warehouse preset (index 3 or default)
      const index = presets.findIndex(p => p.name.toLowerCase().includes('warehouse')) !== -1 
        ? presets.findIndex(p => p.name.toLowerCase().includes('warehouse')) 
        : 3;
      onSelectScenario({
        presetIndex: index,
        goal: presets[index].goal,
        instructions: presets[index].guidelines
      });
    } else if (type === 'office') {
      const index = presets.findIndex(p => p.name.toLowerCase().includes('office')) !== -1 
        ? presets.findIndex(p => p.name.toLowerCase().includes('office')) 
        : 0;
      onSelectScenario({
        presetIndex: index,
        goal: presets[index].goal,
        instructions: presets[index].guidelines
      });
    } else if (type === 'factory') {
      const index = presets.findIndex(p => p.name.toLowerCase().includes('kitchen')) !== -1 
        ? presets.findIndex(p => p.name.toLowerCase().includes('kitchen')) 
        : 2;
      onSelectScenario({
        presetIndex: index,
        goal: "Verify industrial safety, machine clearances, and OSHA hazard compliance in manufacturing plant.",
        instructions: "1. Evaluate heavy machinery layout, warning signage, and mechanical safeguard zones.\n2. Inspect for chemical handling safeguards, hazard labels, and emergency eyewash pathways.\n3. Check high-voltage panels, cable trunk routing, and grounding terminals.\n4. Scan pathways for forklift corridors, pedestrian clearance, and trip protection.\n5. Verify exhaust ventilation rates and particulate filtering hoods."
      });
    } else if (type === 'lab') {
      const index = presets.findIndex(p => p.name.toLowerCase().includes('server')) !== -1 
        ? presets.findIndex(p => p.name.toLowerCase().includes('server')) 
        : 1;
      onSelectScenario({
        presetIndex: index,
        goal: "Verify laboratory containment, biological hood safety, and chemical storage suitability.",
        instructions: "1. Inspect safety cabinets, chemical storage clearance, and secondary spill containment.\n2. Verify local exhaust ventilation, bio-safety cabinet certification labels, and sash levels.\n3. Check floor drainage options and chemical-resistant surface coatings.\n4. Confirm emergency safety shower and eyewash station pathway clearance.\n5. Look for clear warning signage, PPE requirements, and access control mechanisms."
      });
    }
  };

  const handleRecentClick = (scenarioName: string) => {
    if (scenarioName.includes('Zone B')) {
      onSelectScenario({
        presetIndex: null,
        goal: "Warehouse, Zone B, night crew of 12",
        instructions: "1. Scan for structural pillars, racking stress fractures, and load capacity safety markers.\n2. Verify emergency exit pathway clearances, emergency lights, and fire extinguisher markers.\n3. Look for adequate high-bay lighting levels for late-night shifts.\n4. Inspect loading dock guard rails and vehicle restraint interlock switches.\n5. Assess forklift lanes and physical barriers separating pedestrian pathways."
      });
    } else if (scenarioName.includes('Chemical')) {
      onSelectScenario({
        presetIndex: null,
        goal: "Chemical plant — quarterly OSHA audit",
        instructions: "1. Scan chemical storage barrels for proper secondary containment and ventilation.\n2. Verify hazard labeling compliance, safety data sheet (SDS) lockers, and eyewash accessibility.\n3. Inspect high-temp reactors and steam pipes for insulation integrity and safety valves.\n4. Check emergency isolation switches and master electrical breaker layouts.\n5. Verify proper ventilation extraction rates and toxic gas sensors presence."
      });
    }
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSelectScenario({
      presetIndex: null,
      goal: inputText.trim(),
      instructions: `1. Evaluate safety features and physical layouts specifically for: "${inputText.trim()}"\n2. Check structural components, exits, and clearances.\n3. Identify power outlets distribution and electrical hazards.\n4. Scan for physical tripping hazards, corridor bottle-necks, and egress constraints.\n5. Highlight compliance warnings and actionable safety improvement recommendations.`
    });
  };

  // Get dynamic greeting based on actual hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Outer Card frame mimicking mockup perfectly */}
      <div className="w-full max-w-lg bg-[#F7F6F3] rounded-[32px] border border-slate-200/50 shadow-2xl overflow-hidden flex flex-col justify-between min-h-[740px] p-8 sm:p-10 relative">
        
        {/* Top Header */}
        <div className="flex flex-col gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4F46E5] rounded-2xl text-white shadow-md flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Sentinel-AI</span>
          </div>

          {/* Welcome Text */}
          <div className="mt-2">
            <p className="text-slate-500 font-medium text-xs tracking-wider uppercase">
              {getGreeting()}, {userName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mt-1.5">
              <span className="text-[#4F46E5]">Where</span> are we<br />inspecting today?
            </h1>
          </div>

          {/* Quick category chips */}
          <div className="flex flex-wrap gap-2.5 mt-2">
            <button
              onClick={() => handleChipClick('warehouse')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-slate-700 text-xs font-semibold shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Warehouse className="w-4 h-4 text-slate-500" />
              <span>Warehouse</span>
            </button>
            <button
              onClick={() => handleChipClick('factory')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-slate-700 text-xs font-semibold shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Factory className="w-4 h-4 text-slate-500" />
              <span>Factory</span>
            </button>
            <button
              onClick={() => handleChipClick('office')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-slate-700 text-xs font-semibold shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>Office</span>
            </button>
            <button
              onClick={() => handleChipClick('lab')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-slate-700 text-xs font-semibold shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <FlaskConical className="w-4 h-4 text-slate-500" />
              <span>Lab</span>
            </button>
          </div>

          {/* Or Describe It list */}
          <div className="mt-8">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-3.5">
              Or Describe It
            </span>
            
            <div className="space-y-3">
              <button
                onClick={() => handleRecentClick("Warehouse, Zone B, night crew of 12")}
                className="w-full flex items-center gap-3.5 px-4.5 py-4 bg-white border border-slate-100 rounded-2xl text-left shadow-xs hover:border-slate-200 hover:shadow-sm transition-all group"
              >
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                  <History className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-slate-700 font-medium text-xs sm:text-sm">
                  Warehouse, Zone B, night crew of 12
                </span>
              </button>

              <button
                onClick={() => handleRecentClick("Chemical plant — quarterly OSHA audit")}
                className="w-full flex items-center gap-3.5 px-4.5 py-4 bg-white border border-slate-100 rounded-2xl text-left shadow-xs hover:border-slate-200 hover:shadow-sm transition-all group"
              >
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                  <History className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-slate-700 font-medium text-xs sm:text-sm">
                  Chemical plant — quarterly OSHA audit
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom input form */}
        <form onSubmit={handleSubmitCustom} className="mt-10 relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe the site..."
              className="w-full bg-white text-slate-800 placeholder-slate-400 pl-5 pr-24 py-4 rounded-3xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] text-xs sm:text-sm font-medium shadow-sm transition-all"
            />
            
            <div className="absolute right-2 flex items-center gap-1.5">
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    isListening 
                      ? 'bg-red-50 text-red-600 animate-pulse' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title={isListening ? "Listening... Click to stop" : "Use Voice Input"}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
              
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 text-white disabled:text-slate-300 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isListening && (
            <div className="absolute -bottom-6 left-5 text-[10px] text-red-500 font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Listening... speak clearly to describe your inspection area
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
