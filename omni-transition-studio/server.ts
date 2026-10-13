import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// EAP fields discovered:
// - Upscaling: No dedicated upscale parameters for video in interactions.create.
// - Resolution: No global resolution parameter in generation_config. Found `resolution` on `VideoContent` input part.
// - Scene Extension: Found `duration` in `VideoResponseFormat_2` (response_format). No specific `extend` flag.
// - Reference Videos: No dedicated reference field in `interactions.create` input.

function mapResolution(qualityOrTarget?: string): 'low' | 'medium' | 'high' | 'ultra_high' {
  if (qualityOrTarget === 'draft' || qualityOrTarget === '360p' || qualityOrTarget === 'low') {
    return 'low';
  }
  if (qualityOrTarget === '720p' || qualityOrTarget === 'medium') {
    return 'medium';
  }
  if (qualityOrTarget === '4k' || qualityOrTarget === '4K' || qualityOrTarget === 'ultra_high') {
    return 'ultra_high';
  }
  return 'high';
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const BASE_PATH = process.env.BASE_PATH || '';
  const router = express.Router();

  const jobs = new Map<string, { status: 'pending' | 'done' | 'error'; mimeType?: string; data?: Buffer; error?: string; createdAt: number }>();

  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, job] of jobs) if (job.createdAt < cutoff) jobs.delete(id);
  }, 5 * 60 * 1000);

  // Increase payload limit to handle base64 video uploads
  router.use(express.json({ limit: '500mb' }));
  router.use(express.urlencoded({ limit: '500mb', extended: true }));

  // Handle body parser errors
  router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Files too large. Please upload smaller videos.' });
    }
    next(err);
  });

  // API health route
  router.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/api/upscale', async (req, res) => {
    try {
      const { video, mimeType, target } = req.body;
      if (!video) return res.status(400).json({ error: 'Video is required' });
      
      const inputParts: any[] = [];
      inputParts.push({ type: 'video', data: video, mime_type: mimeType || 'video/mp4' });
      // FALLBACK (no API field found): No dedicated upscale request parameter
      inputParts.push({ type: 'text', text: `Task: Upscale this video to ${target === '4k' ? '4K (ultra high)' : '1080p (high)'} resolution. Maintain exact content.` });
      
      const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      jobs.set(jobId, { status: 'pending', createdAt: Date.now() });
      res.json({ jobId });

      (async () => {
        try {
          const interaction = await ai.interactions.create(
            {
              model: 'gemini-omni-1.1-flash',
              input: [{ type: 'user_input', content: inputParts }],
              system_instruction: "You are an AI video upscaler. Do not change the visual content, motion, or meaning. Simply increase the resolution and clarify details.",
              background: false,
              store: false,
              stream: false,
              response_format: { type: 'video' },
            },
            { timeout: 600000 }
          );
          
          const videoPart = interaction.output_video;
          if (videoPart && videoPart.data) {
            jobs.set(jobId, { status: 'done', mimeType: videoPart.mime_type || 'video/mp4', data: Buffer.from(videoPart.data, 'base64'), createdAt: Date.now() });
          } else {
            let text = interaction.output_text;
            if (!text) {
              for (const step of interaction.steps) {
                if (step.type === 'model_output') {
                  const t = step.content?.find((c) => c.type === 'text');
                  if (t?.text) text = (text || '') + t.text;
                }
              }
            }
            jobs.set(jobId, { status: 'error', error: text || 'No video output received.', createdAt: Date.now() });
          }
        } catch (err: any) {
          jobs.set(jobId, { status: 'error', error: err.message || 'Generation failed.', createdAt: Date.now() });
        }
      })();
    } catch (error: any) {
      console.error('Error generating Upscale:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  router.post('/api/omni', async (req, res) => {
    try {
      const { prompt, format, media, references, mode, video, mimeType, sourceMedia } = req.body;
      const inputParts: any[] = [];
      
      // Scene Extension mode
      if (mode === 'extend') {
        if (sourceMedia && Array.isArray(sourceMedia)) {
          sourceMedia.forEach((m) => {
            if (m.data && m.mimeType) {
              if (m.mimeType.startsWith('image/')) {
                inputParts.push({ type: 'image', data: m.data, mime_type: m.mimeType });
              } else if (m.mimeType.startsWith('video/')) {
                inputParts.push({ type: 'video', data: m.data, mime_type: m.mimeType });
              }
            }
          });
        }
        inputParts.push({ type: 'text', text: 'Original source context above. Latest generated segment below:' });
        inputParts.push({ type: 'video', data: video, mime_type: mimeType || 'video/mp4' });
        // FALLBACK (no API field found): No source-video/extension flag, using prompt text
        inputParts.push({ type: 'text', text: `Extend this scene by 10 seconds, continuing the exact same shot, motion, lighting, subjects, and ambient audio. Use ALL provided footage — the original source media and the latest segment — as full context so layout, objects, and light remain consistent. ${prompt || ''}` });
      } 
      // Transition mode
      else {
        if (media && Array.isArray(media)) {
          media.forEach((m, index) => {
            if (m.data && m.mimeType) {
              if (index === 0) {
                inputParts.push({ type: 'text', text: 'First frame:' });
              } else if (index === 1) {
                inputParts.push({ type: 'text', text: 'Last frame:' });
              }
              if (m.mimeType.startsWith('image/')) {
                inputParts.push({ type: 'image', data: m.data, mime_type: m.mimeType });
              } else if (m.mimeType.startsWith('video/')) {
                inputParts.push({ type: 'video', data: m.data, mime_type: m.mimeType });
              }
            }
          });
        }
        
        if (references && Array.isArray(references)) {
          references.forEach((r: any) => {
            if (r.data && r.mimeType) {
              // FALLBACK (no API field found): No dedicated reference-video field on the request
              inputParts.push({ type: 'text', text: 'Style reference (do not copy content, match look/character/environment):' });
              inputParts.push({ type: 'video', data: r.data, mime_type: r.mimeType });
            }
          });
        }
        
        if (prompt) {
          inputParts.push({ type: 'text', text: prompt });
        }
      }

      if (inputParts.length === 0) {
        return res.status(400).json({ error: 'Prompt or media is required' });
      }

      // Format can be 'video', 'image', 'audio', or 'text'
      const responseFormat: any = format ? { type: format } : { type: 'video' };
      if (mode === 'extend' && responseFormat.type === 'video') {
        responseFormat.duration = '10s';
      }
      
      const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      jobs.set(jobId, { status: 'pending', createdAt: Date.now() });
      res.json({ jobId });

      (async () => {
        try {
          const interaction = await ai.interactions.create(
            {
              model: 'gemini-omni-1.1-flash',
              input: [{ type: 'user_input', content: inputParts }],
              system_instruction: "You are a world-class visual effects AI specializing in seamless frame interpolation, scene extension, and continuous camera movements. You generate high-quality video that starts exactly on the First frame and ends exactly on the Last frame in a single, continuous, uncut shot. NEVER use hard cuts. NEVER hallucinate new characters. Maintain strict temporal consistency. You execute named transition techniques — object portals, whip pans, match morphs, sky drops, foreground wipes, and time-lapse transformations — boldly and completely. The technique specified in the prompt is the creative priority.",
              background: false,
              store: false,
              stream: false,
              response_format: responseFormat,
            },
            { timeout: 600000 } // 10 minutes timeout for video generation
          );
          const videoPart = interaction.output_video;
          if (videoPart && videoPart.data) {
            jobs.set(jobId, { status: 'done', mimeType: videoPart.mime_type || 'video/mp4', data: Buffer.from(videoPart.data, 'base64'), createdAt: Date.now() });
          } else {
            let text = interaction.output_text;
            if (!text) {
              for (const step of interaction.steps) {
                if (step.type === 'model_output') {
                  const t = step.content?.find((c) => c.type === 'text');
                  if (t?.text) text = (text || '') + t.text;
                }
              }
            }
            jobs.set(jobId, { status: 'error', error: text || 'No video output received.', createdAt: Date.now() });
          }
        } catch (err: any) {
          jobs.set(jobId, { status: 'error', error: err.message || 'Generation failed.', createdAt: Date.now() });
        }
      })();
    } catch (error: any) {
      console.error('Error generating Omni output:', error);
      if (!res.headersSent) res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  router.get('/api/job/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Unknown job' });
    res.json({ status: job.status, error: job.error });
  });

  router.get('/api/job/:id/result', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.status !== 'done' || !job.data) return res.status(404).json({ error: 'Result not ready' });
    res.setHeader('Content-Type', job.mimeType || 'video/mp4');
    res.send(job.data);
  });

  app.use(BASE_PATH, router);

  if (process.env.NODE_ENV !== 'production') {
    // Vite's own `base` config (see vite.config.ts) already matches requests
    // under BASE_PATH, so its middleware is mounted directly on `app`, not
    // stripped through the BASE_PATH router above.
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(BASE_PATH, express.static(distPath));
    app.get(`${BASE_PATH}/*`, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}${BASE_PATH}`);
  });
}

startServer();
