// Preset room scenarios + shared types for the Sentinel-AI inspector.

export interface HotSpot { label: string; temp: string; x: number; y: number; }

export interface Preset {
  name: string;
  short: string;
  icon: string; // Tabler icon class suffix, e.g. "ti-building"
  goal: string;
  imageUrl: string;
  guidelines: string;
  thermalConfig: { ambient: string; hotSpots: HotSpot[] };
}

export const PRESETS: Preset[] = [
  {
    name: "50-Person High-Occupancy Office Workspace",
    short: "Office",
    icon: "ti-building",
    goal: "Verify suitability for a 50-person high-occupancy open-office workspace.",
    imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Verify egress paths and fire escape routes can accommodate high occupant load (50 people).\n2. Check ventilation density, air-conditioning volume, and lighting conditions.\n3. Identify power-strip daisy-chaining and electrical outlet distribution overload risk.\n4. Scan for structural pillars, tripping hazards, or corridor bottlenecks.\n5. Inspect ceiling tile integrity and potential water leakage spots.",
    thermalConfig: {
      ambient: "22°C",
      hotSpots: [
        { label: "Overloaded Multi-plug Outlet", temp: "42°C", x: 74, y: 78 },
        { label: "Server Rack Vent (Ambient)", temp: "35°C", x: 12, y: 45 },
      ],
    },
  },
  {
    name: "High-Density IT Server Room setup",
    short: "Server Room",
    icon: "ti-server-2",
    goal: "Verify suitability for installing a high-density, high-load IT Server Room.",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Evaluate dedicated HVAC system, cooling inlets, and thermal airflow channels.\n2. Inspect for nearby overhead plumbing, structural condensation, or fluid leakage hazards.\n3. Check routing of fiber and high-voltage cable trays to avoid safety interference.\n4. Verify electronic lock and access-control security options on the doorway.\n5. Scan ceiling for dust buildup, and verify chemical-based fire suppression system options.",
    thermalConfig: {
      ambient: "18°C",
      hotSpots: [
        { label: "Main Switchboard Hub", temp: "68°C", x: 82, y: 18 },
        { label: "Primary Cooling Intake", temp: "14°C", x: 45, y: 5 },
      ],
    },
  },
  {
    name: "Commercial Kitchen & Food-Prep Area",
    short: "Kitchen",
    icon: "ti-tools-kitchen-2",
    goal: "Verify suitability for high-heat commercial kitchen conversion.",
    imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Scan for commercial-grade range exhaust ventilation and hood safety options.\n2. Inspect floor pathways for wet drainage capacity and non-slip floor materials.\n3. Check electrical socket ground-fault protection (GFCI) near sanitation sink locations.\n4. Look for appropriate clearances around heat-generating stove equipment.\n5. Confirm fire-suppression triggers and manual emergency gas shutoff valve clearance.",
    thermalConfig: {
      ambient: "26°C",
      hotSpots: [
        { label: "Gas Range Cooktop (Idle)", temp: "95°C", x: 34, y: 58 },
        { label: "Electrical Sub-panel", temp: "48°C", x: 88, y: 32 },
      ],
    },
  },
  {
    name: "Heavy-Duty Industrial Storage & Warehouse",
    short: "Warehouse",
    icon: "ti-building-warehouse",
    goal: "Verify structural integrity and environmental safety for heavy-duty industrial storage.",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    guidelines: "1. Scan columns, ceiling beams, and concrete support beams for structural stress cracks.\n2. Assess high-bay lighting fixture mount safety and clearance heights.\n3. Inspect concrete flooring slabs for settlement, moisture, or expansion fractures.\n4. Check emergency exit pathway clearances, roll-up loading dock guards, and signage.\n5. Look for proper natural draft cross-ventilation to prevent high-density gas buildup.",
    thermalConfig: {
      ambient: "20°C",
      hotSpots: [
        { label: "Ceiling Transformer", temp: "52°C", x: 50, y: 15 },
        { label: "Compressor Vent Outlet", temp: "38°C", x: 18, y: 82 },
      ],
    },
  },
];

export interface Violation {
  id: string;
  title: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  description: string;
  complianceStandard: string;
  estimatedLocation: string;
  recommendation: string;
  coordinate: { x: number; y: number };
}

export interface DoubtQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface InspectionReport {
  safetyScore: number;
  suitability: "SUITABLE" | "SUITABLE_WITH_MODIFICATIONS" | "NOT_SUITABLE";
  suitabilityReason: string;
  structuralIntegrity: { status: "PASS" | "WARNING" | "FAIL"; details: string };
  environmentalCompliance: { status: "PASS" | "WARNING" | "FAIL"; details: string };
  violations: Violation[];
  doubtQuestions: DoubtQuestion[];
}

export interface ChatMessage { sender: "user" | "ai"; text: string; timestamp: number; }

export interface Answer { questionId: string; question: string; answer: string; }
