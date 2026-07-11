import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Increase payload limit to handle base64 images
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // API Endpoint: Inspect Room
  app.post('/api/inspect', async (req, res) => {
    try {
      const { image, imageUrl, instructions, scenarioGoal, answers } = req.body;

      const currentApiKey = process.env.GEMINI_API_KEY;
      if (!currentApiKey) {
        return res.status(500).json({ 
          error: 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.' 
        });
      }

      // Lazy initialization of Gemini client to guarantee use of active environment secret
      const ai = new GoogleGenAI({
        apiKey: currentApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image;
        }
      } else {
        const targetUrl = image || imageUrl;
        if (targetUrl) {
          // Fetch preset image on the server and convert to base64
          try {
            const fetchResponse = await fetch(targetUrl);
            const arrayBuffer = await fetchResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            mimeType = fetchResponse.headers.get('content-type') || 'image/jpeg';
            base64Data = buffer.toString('base64');
          } catch (fetchErr) {
            console.error('Failed to fetch image URL:', targetUrl, fetchErr);
            return res.status(400).json({ error: 'Failed to retrieve preset room image.' });
          }
        } else {
          return res.status(400).json({ error: 'No room image or preset selected.' });
        }
      }

      // Format user answers if provided
      let answersText = '';
      if (answers && Array.isArray(answers) && answers.length > 0) {
        answersText = answers.map((ans: any) => `Question: "${ans.question}"\nUser Answer: "${ans.answer}"`).join('\n\n');
      }

      // Detailed system prompt
      const promptText = `
You are an expert industrial safety engineer and safety compliance inspector. Your task is to analyze the provided image of a room or area for safety hazards, structural integrity, and environmental compliance, based on a specific scenario goal and a set of safety guidelines.

Scenario Goal: "${scenarioGoal}"
Safety Guidelines/Instructions to enforce:
"${instructions}"

${answersText ? `The user has provided additional details and answered previous doubts:
${answersText}
Please integrate this new information into your final analysis and adjust the safety score, violations, and suitability accordingly.` : ''}

Analyze the room or area and identify:
1. Overall compliance and safety score (0 to 100, where 100 is perfectly compliant and safe).
2. Suitability decision for the requested scenario goal:
   - "SUITABLE": Room is fully fit for the proposed scenario.
   - "SUITABLE_WITH_MODIFICATIONS": Room is fit, but requires critical or warning corrections first.
   - "NOT_SUITABLE": Room cannot be safely used for this purpose under current conditions.
3. A clear, thorough description of the suitability reasoning.
4. Structural Integrity status ("PASS", "WARNING", "FAIL") and detailed findings.
5. Environmental Compliance status ("PASS", "WARNING", "FAIL") and detailed findings (e.g. ventilation, temperature, thermal hazards, airflow).
6. A list of concrete safety violations or hazards. For each violation, specify:
   - Category (e.g. Electrical, Fire Safety, Structural, Obstruction, Mechanical, Chemical, Environmental)
   - Title (short descriptive name, e.g., "Blocked Emergency Exit")
   - Severity ("CRITICAL", "WARNING", "INFO")
   - Description (what is wrong in detail)
   - Compliance Standard violated (e.g. OSHA 1910.xxx, NFPA, or general safety standards)
   - Estimated Location in the room
   - Corrective Action / Recommendation
   - Coordinate: Give an approximate (x, y) coordinate as integer percentages (0-100) representing where this violation is located on the image relative to the top-left corner (0,0 is top-left, 100,100 is bottom-right). This is used to draw markers on the image. Make sure to assign coordinates that logically match the description.
7. Up to 3 follow-up "doubt" questions about things that are visually unclear, obscured, or require local knowledge (e.g., presence of fire extinguishers, load-bearing status of a column, hidden wiring, backup power, sprinkler coverage). These must be realistic, helpful questions that would refine your assessment. Provide 2-3 multiple choice options for the user.

You must respond with a JSON object that strictly adheres to the following JSON format structure:
{
  "safetyScore": number (0-100),
  "suitability": "SUITABLE" | "SUITABLE_WITH_MODIFICATIONS" | "NOT_SUITABLE",
  "suitabilityReason": string,
  "structuralIntegrity": {
    "status": "PASS" | "WARNING" | "FAIL",
    "details": string
  },
  "environmentalCompliance": {
    "status": "PASS" | "WARNING" | "FAIL",
    "details": string
  },
  "violations": [
    {
      "id": string (unique identifier like v1, v2),
      "title": string,
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "category": string,
      "description": string,
      "complianceStandard": string,
      "estimatedLocation": string,
      "recommendation": string,
      "coordinate": {
        "x": number (0-100),
        "y": number (0-100)
      }
    }
  ],
  "doubtQuestions": [
    {
      "id": string (unique q1, q2),
      "question": string,
      "options": string[]
    }
  ]
}
`;

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const textPart = {
        text: promptText,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: 'Gemini returned an empty response.' });
      }

      // Parse and return JSON
      try {
        const parsedData = JSON.parse(responseText);
        return res.json(parsedData);
      } catch (parseErr) {
        console.error('Failed to parse Gemini JSON:', responseText, parseErr);
        return res.status(500).json({ 
          error: 'Failed to parse safety inspection details.', 
          rawResponse: responseText 
        });
      }

    } catch (err: any) {
      console.error('Inspection Error:', err);
      return res.status(500).json({ error: err.message || 'An error occurred during inspection.' });
    }
  });

  // API Endpoint: Interactive Safety Compliance Chat
  app.post('/api/chat', async (req, res) => {
    try {
      const { image, messages, instructions, scenarioGoal, currentReport } = req.body;

      const currentApiKey = process.env.GEMINI_API_KEY;
      if (!currentApiKey) {
        return res.status(500).json({ 
          error: 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.' 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: currentApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Prepare image part if available
      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image;
        }
      } else if (image) {
        try {
          const fetchResponse = await fetch(image);
          const arrayBuffer = await fetchResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          mimeType = fetchResponse.headers.get('content-type') || 'image/jpeg';
          base64Data = buffer.toString('base64');
        } catch (fetchErr) {
          console.error('Failed to fetch image for chat context:', fetchErr);
        }
      }

      const imagePart = base64Data ? {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      } : null;

      // Map chat history
      const contents: any[] = [];
      if (messages && Array.isArray(messages)) {
        messages.forEach((msg: any, idx: number) => {
          const role = msg.sender === 'user' ? 'user' : 'model';
          const parts: any[] = [{ text: msg.text }];
          
          // Attach image to the first user message so the model sees the room
          if (idx === 0 && role === 'user' && imagePart) {
            parts.unshift(imagePart);
          }
          
          contents.push({ role, parts });
        });
      }

      // Fallback if no messages are present yet
      if (contents.length === 0) {
        const parts: any[] = [{ text: "Introduce yourself as my AI safety assistant and summarize the room/area's safety highlights and potential issues." }];
        if (imagePart) {
          parts.unshift(imagePart);
        }
        contents.push({ role: 'user', parts });
      }

      // Specialized system instruction for chat
      const systemInstruction = `You are a professional, helpful, and friendly AI Safety Inspector.
The user is currently inspecting a room or area for safety compliance.
Here is the context of this inspection:
- Scenario Goal: "${scenarioGoal}"
- Inspection Guidelines: "${instructions}"
${currentReport ? `- Current Active Inspection Report Status: Safety Score: ${currentReport.safetyScore}%, Suitability: ${currentReport.suitability}. Reasoning: ${currentReport.suitabilityReason}` : ''}

Your instructions for this conversation are:
1. Talk directly to the user to explain what is in the room/area (such as compliant safety equipment, hazards, layout elements) and what is NOT in the room/area (such as missing fire escapes, missing signage, missing GFCI outlets, lack of fire extinguishers, or other guidelines from the instructions that you don't see).
2. Answer all user questions clearly and constructively with actionable safety tips.
3. Ask the user clarifying questions about things that are visually obscured, unclear, or require local knowledge (e.g., "I see some cables near the desk, are those secured?", "Is there a backup power system in this room?").
4. Listen to the user's explanations or corrections! If the user explains "Actually, that red canister is a fire extinguisher, not a trash can" or "That is a low-voltage outlet", say "Thank you for the correction!", update your understanding, and explain how that changes the safety situation.
5. Keep your tone helpful, professional, polite, and reassuring. Avoid overly dry developer jargon or marketing hype. Use markdown for lists and bolding.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
        }
      });

      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: 'Gemini returned an empty chat response.' });
      }

      return res.json({ text: responseText });

    } catch (err: any) {
      console.error('Chat Error:', err);
      return res.status(500).json({ error: err.message || 'An error occurred during chat consultation.' });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on port 3000');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected for Live Inspection');
    let session: any = null;

    ws.on('message', async (messageData) => {
      try {
        const msg = JSON.parse(messageData.toString());

        if (msg.type === 'init') {
          const { instructions, scenarioGoal } = msg;
          console.log('Initializing Gemini Live API with instructions and scenario goal');

          const currentApiKey = process.env.GEMINI_API_KEY;
          if (!currentApiKey) {
            ws.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' }));
            return;
          }

          const ai = new GoogleGenAI({
            apiKey: currentApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          // Establish Live connection
          try {
            session = await ai.live.connect({
              model: "gemini-3.1-flash-live-preview",
              callbacks: {
                onmessage: (message: any) => {
                  // Forward audio output to client
                  const audio = message.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data || message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audio) {
                    ws.send(JSON.stringify({ audio }));
                  }

                  // Forward bot spoken text (subtitles) to client
                  const text = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
                  if (text) {
                    ws.send(JSON.stringify({ text }));
                  }

                  // Forward user transcribed text (user subtitles) to client
                  const userText = message.serverContent?.userTurn?.parts?.find((p: any) => p.text)?.text;
                  if (userText) {
                    ws.send(JSON.stringify({ userText }));
                  }

                  if (message.serverContent?.interrupted) {
                    ws.send(JSON.stringify({ interrupted: true }));
                  }
                },
                onclose: () => {
                  console.log('Gemini Live session closed');
                  ws.send(JSON.stringify({ status: 'closed' }));
                },
                onerror: (err: any) => {
                  console.error('Gemini Live error:', err);
                  ws.send(JSON.stringify({ error: err.message || 'Gemini Live encountered an error.' }));
                }
              },
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                },
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                systemInstruction: `You are a professional, friendly, and helpful AI Safety Inspector.
The user is currently inspecting a room or area for safety compliance in real-time via live video and audio.
Here is the context of this live inspection:
- Scenario Goal: "${scenarioGoal}"
- Inspection Guidelines/Instructions to enforce: "${instructions}"

Your instructions for this live conversation are:
1. Explain what is in the room/area (compliant safety equipment, hazards, layout elements) and what is NOT in the room/area (missing fire escapes, lack of signage, lack of fire extinguishers, etc.) based on the live video stream frames they are sending you.
2. Answer all user questions clearly and constructively with actionable safety tips.
3. Keep your responses short, concise, energetic, and polite. Since this is an audio conversation, avoid long lists or paragraphs. Speak in short, punchy sentences.
4. Listen to the user's explanations or corrections! If they explain or correct you, say "Thank you for the correction!", update your understanding, and adapt.
5. Ask clarifying questions about things that are visually obscured or unclear in the video.
6. Keep your tone reassuring, helpful, and professional.`
              }
            });

            console.log('Gemini Live session connected successfully');
            ws.send(JSON.stringify({ status: 'connected' }));

          } catch (connErr: any) {
            console.error('Error connecting to Gemini Live:', connErr);
            ws.send(JSON.stringify({ error: `Failed to connect to Gemini Live: ${connErr.message || connErr}` }));
          }
        } else if (msg.audio) {
          if (session) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        } else if (msg.video) {
          if (session) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: 'image/jpeg' }
            });
          }
        }
      } catch (err: any) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      if (session) {
        try {
          session.close();
        } catch (closeErr) {
          console.error('Error closing Gemini Live session:', closeErr);
        }
      }
    });
  });
}

startServer();
