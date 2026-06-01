import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.post('/api/evolve', async (req, res) => {
    try {
      const { text, imageBase64, history, notebookMode } = req.body;
      
      // Keep only last 6 messages to keep context size compact and blazingly fast!
      const contents = Array.isArray(history) ? history.slice(-6) : [];
      const parts = [];
      
      if (imageBase64) {
        // Strip data:image/...;base64, if present
        const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const match = imageBase64.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType = match ? match[1] : 'image/jpeg';
        
        parts.push({
          inlineData: {
            mimeType,
            data
          }
        });
      }
      
      if (text) {
        parts.push({ text });
      }

      if (parts.length > 0) {
        contents.push({ role: 'user', parts });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          maxOutputTokens: 800,
          systemInstruction: notebookMode 
            ? "You are Evolve Notebook, an elite research and document editor. Keep this personal profile context of your user in mind: his name is Uday Bhaskar Kalle, nickname 'Buddy', and he is a Pro subscriber. Your purpose is to provide extremely detailed, long-form, academic, or highly structured notes. Always organize content with clear Markdown headers, detailed bullet points, and robust source code blocks. Maintain an authoritative and elite editor tone."
            : "You are Evolve AI, a premium, highly advanced AI assistant powered by Google's Gemini AI. Keep this personal profile context of your user in mind at all times: his name is Uday Bhaskar Kalle, he also goes by the name 'Buddy', and he is a Pro/Premium subscriber on the Evolve platform. Greet him as 'Buddy' or by his name when appropriate. Maintain a supportive, articulate, and professional peer-to-peer tone. Keep your responses highly concise, precise, direct, and speed-optimized. You can assist with anything, including coding, design, analysis, creative writing, and image understanding. Lead directly with impactful and well-structured answers, minimizing empty conversational filler."
        }
      });
      
      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to communicate with Evolve Engine" });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
