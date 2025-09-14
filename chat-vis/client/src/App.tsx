import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import "./App.css";

/* ========= Types ========= */
type LinearAnim = {
  property: "x" | "y" | "r";
  from: number;
  to: number;
  start?: number;
  end?: number;
};
type OrbitAnim = {
  property: "orbit";
  centerX: number;
  centerY: number;
  radius: number;
  duration?: number;
};
type Anim = LinearAnim | OrbitAnim;

type CircleLayer = {
  id: string;
  type: "circle";
  props: { x: number; y: number; r: number; fill?: string };
  animations?: Anim[];
};
type ArrowLayer = {
  id: string;
  type: "arrow";
  props: { x: number; y: number; dx: number; dy: number; color?: string };
  animations?: Anim[];
};
type Layer = CircleLayer | ArrowLayer;

type VisSpec = {
  id: string;
  duration: number;
  fps?: number;
  layers?: Layer[];
};

type Question = {
  id: string;
  userId: string;
  question: string;
  answerId: string | null;
};

type Answer = {
  id: string;
  questionId: string;
  text: string;
  visualization: VisSpec | null;
};

/* ========= Canvas Renderer (bullet-proof) ========= */
function VisualizationCanvas({
  spec,
  isPlaying,
}: {
  spec: VisSpec | null;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);

  // Acquire 2D context once the canvas DOM node exists.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  // Animation loop (restarts on spec or play/pause change)
  useLayoutEffect(() => {
    if (!spec || !isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return; // canvas not mounted yet

    let startTime = 0;

    const draw = (now: number) => {
      if (!startTime) startTime = now;
      const dur = spec.duration || 4000;
      const t = Math.min(now - startTime, dur);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      (spec.layers ?? []).forEach((layer) => {
        if (layer.type === "circle") {
          let { x, y, r, fill } = layer.props;

          const anims = layer.animations ?? [];
          for (const a of anims) {
            if (a.property === "orbit") {
              const orbitDur = (a as OrbitAnim).duration || dur;
              const p = ((t % orbitDur) / orbitDur) || 0;
              const ang = p * Math.PI * 2;
              x = (a as OrbitAnim).centerX + (a as OrbitAnim).radius * Math.cos(ang);
              y = (a as OrbitAnim).centerY + (a as OrbitAnim).radius * Math.sin(ang);
            } else {
              const start = (a as LinearAnim).start ?? 0;
              const end = (a as LinearAnim).end ?? dur;
              const span = Math.max(end - start, 1);
              const prog = Math.min(Math.max((t - start) / span, 0), 1);
              const val = (a as LinearAnim).from + ((a as LinearAnim).to - (a as LinearAnim).from) * prog;
              if (a.property === "x") x = val;
              if (a.property === "y") y = val;
              if (a.property === "r") r = val;
            }
          }

          ctx.beginPath();
          ctx.fillStyle = fill || "#3498db";
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (layer.type === "arrow") {
          const { x, y, dx, dy, color } = layer.props;
          ctx.strokeStyle = color || "#e74c3c";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + dx, y + dy);
          ctx.stroke();
          // Arrow head
          const ang = Math.atan2(dy, dx);
          const x2 = x + dx, y2 = y + dy, L = 10;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - L * Math.cos(ang - Math.PI / 6), y2 - L * Math.sin(ang - Math.PI / 6));
          ctx.lineTo(x2 - L * Math.cos(ang + Math.PI / 6), y2 - L * Math.sin(ang + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = color || "#e74c3c";
          ctx.fill();
        }
      });

      if (t < dur && isPlaying) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    // kick off next frame to ensure refs are ready even under StrictMode
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [spec, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={400}
      style={{
        background: "#fff",
        border: "2px solid #ddd",
        borderRadius: 10,
      }}
    />
  );
}

/* ========= App ========= */
export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentVis, setCurrentVis] = useState<VisSpec | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [input, setInput] = useState("");

  // Load existing questions on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("http://localhost:3000/api/questions");
        const data: Question[] = await r.json();
        setQuestions(data);
      } catch (e) {
        console.error("Failed to fetch questions:", e);
      }
    })();
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("http://localhost:3000/api/stream");

    es.addEventListener("question_created", (e) => {
      const q = JSON.parse((e as MessageEvent).data) as Question;
      setQuestions((prev) => [...prev, q]);
    });

    es.addEventListener("answer_created", (e) => {
      const a = JSON.parse((e as MessageEvent).data) as Answer;
      setAnswers((prev) => ({ ...prev, [a.id]: a }));
      // Pair answer back to its question by questionId
      setQuestions((prev) =>
        prev.map((q) => (q.id === a.questionId ? { ...q, answerId: a.id } : q))
      );
      setCurrentVis(a.visualization || null);
      setIsPlaying(true); // auto-play new vis
    });

    es.onerror = (err) => console.error("SSE error:", err);
    return () => es.close();
  }, []);

  async function sendQuestion() {
    const q = input.trim();
    if (!q) return;
    try {
      await fetch("http://localhost:3000/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "u1", question: q }),
      });
      setInput("");
    } catch (e) {
      console.error("Failed to send question:", e);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8f9fa" }}>
      {/* Left: Visualization */}
      <div
        style={{
          flex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <VisualizationCanvas spec={currentVis} isPlaying={isPlaying} />
        <button
          onClick={() => setIsPlaying((p) => !p)}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      {/* Right: Chat */}
      <div
        style={{
          flex: 1,
          background: "#fff",
          borderLeft: "1px solid #ddd",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "1rem",
          minWidth: 360,
        }}
      >
        <div style={{ overflowY: "auto", flex: 1 }}>
          {questions.map((q) => {
            const a = q.answerId ? answers[q.answerId] : null;
            return (
              <div
                key={q.id}
                style={{
                  marginBottom: "1rem",
                  padding: "0.5rem",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: a ? "#fdfdfd" : "#fcfcfc",
                }}
              >
                <p>
                  <b>Q:</b> “{q.question.toUpperCase()}”
                </p>
                <p>
                  <b>A:</b> {a ? a.text : <i>...waiting</i>}
                </p>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendQuestion();
            }}
            style={{
              flex: 1,
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: "6px 0 0 6px",
              outline: "none",
            }}
          />
          <button
            onClick={sendQuestion}
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "0 6px 6px 0",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
