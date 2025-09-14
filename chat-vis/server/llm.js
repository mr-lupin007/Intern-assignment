import dotenv from "dotenv";
dotenv.config();

const MODE = process.env.LLM_MODE || "mock";

/* ---------- helpers ---------- */
function safeNumber(n, def) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function sanitizeAnswer(ans) {
  // Ensure shape: { text, visualization: { id, duration, fps, layers: [] } }
  const text = typeof ans?.text === "string" && ans.text.trim()
    ? ans.text.trim()
    : "Here’s a concise explanation with a simple visualization.";
  const vis = ans?.visualization || {};
  const duration = clamp(safeNumber(vis.duration, 5000), 1000, 10000);
  const fps = clamp(safeNumber(vis.fps, 30), 1, 60);
  let layers = Array.isArray(vis.layers) ? vis.layers : [];

  // sanitize layers
  layers = layers.map((l, i) => {
    const id = l?.id || `layer_${i}`;
    const type = l?.type;
    if (type === "circle") {
      const p = l.props || {};
      return {
        id, type,
        props: {
          x: clamp(safeNumber(p.x, 160), 0, 640),
          y: clamp(safeNumber(p.y, 200), 0, 400),
          r: clamp(safeNumber(p.r, 16), 1, 120),
          fill: typeof p.fill === "string" ? p.fill : "#3498db",
        },
        animations: Array.isArray(l.animations) ? l.animations.map((a) => {
          if (a?.property === "orbit") {
            return {
              property: "orbit",
              centerX: clamp(safeNumber(a.centerX, 320), 0, 640),
              centerY: clamp(safeNumber(a.centerY, 200), 0, 400),
              radius: clamp(safeNumber(a.radius, 100), 10, 250),
              duration: clamp(safeNumber(a.duration, duration), 500, 10000),
            };
          }
          const start = clamp(safeNumber(a?.start, 0), 0, duration - 100);
          const end = clamp(safeNumber(a?.end, duration), start + 100, duration);
          return {
            property: a?.property === "y" ? "y" : a?.property === "r" ? "r" : "x",
            from: safeNumber(a?.from, 100),
            to: safeNumber(a?.to, 500),
            start, end,
          };
        }) : [],
      };
    }
    if (type === "arrow") {
      const p = l.props || {};
      return {
        id, type,
        props: {
          x: clamp(safeNumber(p.x, 90), 0, 640),
          y: clamp(safeNumber(p.y, 220), 0, 400),
          dx: clamp(safeNumber(p.dx, 40), -640, 640),
          dy: clamp(safeNumber(p.dy, 0), -400, 400),
          color: typeof p.color === "string" ? p.color : "#e74c3c",
        },
        animations: [],
      };
    }
    if (type === "lottie") {
      const p = l.props || {};
      return {
        id, type,
        props: {
          url: typeof p.url === "string" ? p.url : "/animations/dna.json",
          x: clamp(safeNumber(p.x, 430), 0, 640),
          y: clamp(safeNumber(p.y, 140), 0, 400),
          width: clamp(safeNumber(p.width, 180), 40, 640),
          height: clamp(safeNumber(p.height, 180), 40, 400),
          loop: Boolean(p.loop ?? true),
        },
        animations: [],
      };
    }
    // unknown types ignored
    return null;
  }).filter(Boolean);

  // if nothing valid, add a safe default
  if (!layers.length) {
    layers = [
      {
        id: "ball",
        type: "circle",
        props: { x: 120, y: 220, r: 18, fill: "#3498db" },
        animations: [{ property: "x", from: 120, to: 520, start: 0, end: duration - 1000 }],
      },
      { id: "arrow", type: "arrow", props: { x: 90, y: 220, dx: 40, dy: 0, color: "#e74c3c" }, animations: [] },
    ];
  }

  return {
    text,
    visualization: { id: vis.id || "vis_safe", duration, fps, layers },
  };
}
// ✅ Keep only one copy of this
function extractJSON(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}$/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}

async function withTimeout(promise, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await promise(ctrl.signal);
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/* ---------- MOCK ---------- */
function mockAnswer(question) {
  const q = (question || "").toLowerCase();
  if (q.includes("solar")) {
    return {
      text: "The Sun is at the center; planets orbit due to gravity.",
      visualization: {
        id: "vis_solar", duration: 6000, fps: 30,
        layers: [
          { id: "sun", type: "circle", props: { x: 320, y: 200, r: 40, fill: "#f39c12" }, animations: [] },
          { id: "earth", type: "circle", props: { x: 220, y: 200, r: 12, fill: "#3498db" },
            animations: [{ property: "orbit", centerX: 320, centerY: 200, radius: 100, duration: 6000 }] },
        ],
      },
    };
  }
  if (q.includes("newton")) {
    return {
      text: "An object remains at rest or moves uniformly unless acted on by a net external force.",
      visualization: {
        id: "vis_newton", duration: 4500, fps: 30,
        layers: [
          { id: "ball", type: "circle", props: { x: 120, y: 220, r: 18, fill: "#3498db" },
            animations: [{ property: "x", from: 120, to: 520, start: 0, end: 3500 }] },
          { id: "arrow", type: "arrow", props: { x: 90, y: 220, dx: 40, dy: 0, color: "#e74c3c" }, animations: [] },
        ],
      },
    };
  }
  if (q.includes("dna")) {
    return {
      text: "DNA stores genetic information using sequences of A, T, C, and G bases.",
      visualization: {
        id: "vis_dna", duration: 5000, fps: 30,
        layers: [
          { id: "dnaAnim", type: "lottie",
            props: { url: "/animations/dna.json", x: 430, y: 140, width: 180, height: 180, loop: true }, animations: [] },
          { id: "dot", type: "circle", props: { x: 120, y: 220, r: 14, fill: "#2ecc71" },
            animations: [{ property: "x", from: 120, to: 360, start: 400, end: 2800 }] },
        ],
      },
    };
  }
  // generic
  return {
    text: `Here’s a clear explanation of “${question}”.`,
    visualization: {
      id: "vis_generic", duration: 5000, fps: 30,
      layers: [
        { id: "ball", type: "circle", props: { x: 160, y: 220, r: 16, fill: "#3498db" },
          animations: [{ property: "x", from: 160, to: 480, start: 300, end: 3200 }] },
        { id: "arrow", type: "arrow", props: { x: 200, y: 220, dx: 200, dy: 0, color: "#e74c3c" }, animations: [] },
      ],
    },
  };
}

/* ---------- OLLAMA ---------- */
async function askOllama(question) {
  const url = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

  // Very explicit instructions; keep values inside canvas.
  const prompt = `
You are a tutor that must respond with valid STRICT JSON only (no markdown, no prose outside JSON).
Canvas size is 640x400. duration <= 6000. At least one animated layer (x/y linear or orbit).

Schema:
{
  "text": "<concise explanation>",
  "visualization": {
    "id": "vis_any",
    "duration": 5000,
    "fps": 30,
    "layers": [
      { "id":"ball","type":"circle","props":{"x":120,"y":220,"r":18,"fill":"#3498db"},
        "animations":[{ "property":"x","from":120,"to":520,"start":0,"end":3500 }] },
      { "id":"arrow","type":"arrow","props":{"x":90,"y":220,"dx":40,"dy":0,"color":"#e74c3c"}, "animations":[] }
    ]
  }
}

User question: "${question}"
Return ONLY valid JSON parsable by JSON.parse.
`;

  // IMPORTANT: format:"json" asks Ollama to return strict JSON
  const resp = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
      format: "json"
    }),
  });

  const data = await resp.json();  // { response: "..." }
  const raw = (data && typeof data.response === "string") ? data.response.trim() : "";

  // tolerant parsing
  let parsed = extractJSON(raw);
  if (!parsed) {
    // some models still ignore format; try removing backticks etc.
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "");
    parsed = extractJSON(cleaned);
  }
  if (!parsed) throw new Error("Bad JSON from Ollama");

  return parsed;
}


/* ---------- HF ---------- */
async function askHF(question) {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
  const prompt = `
Return ONLY strict JSON as described earlier. Canvas=640x400, duration<=6000.
Include at least one animated layer. Q: "${question}"
`;

  const r = await withTimeout(async (signal) =>
    fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
      signal,
    })
  , 10000);

  const out = await r.json();
  const txt = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text;
  const parsed = extractJSON(txt);
  if (!parsed) throw new Error("Bad JSON from HF");
  return parsed;
}

/* ---------- Public entry ---------- */
export async function callLLMService(question) {
  try {
    if ((process.env.LLM_MODE || "mock") === "ollama") {
      const res = await askOllama(question);
      return sanitizeAnswer(res);          // keep your sanitizer
    }
    // ... hf branch if you use it ...
    return sanitizeAnswer(mockAnswer(question));
  } catch (e) {
    console.warn("LLM error, falling back to mock:", e?.message || e);
    return sanitizeAnswer(mockAnswer(question));
  }
}

