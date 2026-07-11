// Talks to sentinel's own Express/Gemini backend (server.ts).
import type { InspectionReport, Answer, ChatMessage } from "./data";

export interface InspectArgs {
  image: string; // base64 data URL or preset image URL
  instructions: string;
  scenarioGoal: string;
  answers?: Answer[];
}

export async function inspect(args: InspectArgs): Promise<InspectionReport> {
  const res = await fetch("/api/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: args.image,
      instructions: args.instructions,
      scenarioGoal: args.scenarioGoal,
      answers: (args.answers || []).map((a) => ({ question: a.question, answer: a.answer })),
    }),
  });

  let data: any = {};
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text.trim().startsWith("<")) {
      throw new Error(`The server hit an error (HTTP ${res.status}). If you just added the API key, restart the app.`);
    }
    throw new Error(text || `Server returned a non-JSON response (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || "Failed to complete the safety diagnostic.");
  return data as InspectionReport;
}

export interface ChatArgs {
  image: string | null;
  messages: ChatMessage[];
  instructions: string;
  scenarioGoal: string;
  currentReport: InspectionReport | null;
}

export async function chat(args: ChatArgs): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: args.image,
      messages: args.messages.map((m) => ({ sender: m.sender, text: m.text })),
      instructions: args.instructions,
      scenarioGoal: args.scenarioGoal,
      currentReport: args.currentReport,
    }),
  });
  if (!res.ok) throw new Error("Safety consultant service is currently unavailable.");
  const data = await res.json();
  return data.text || "I couldn't analyze that detail. Could you elaborate?";
}
