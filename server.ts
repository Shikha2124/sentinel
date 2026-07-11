import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

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

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on port 3000');
  });
}

startServer();
