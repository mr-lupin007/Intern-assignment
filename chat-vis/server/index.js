import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { callLLMService } from "./llm.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const questions = [];
const answers = [];

const clients = new Set();
function sseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write(`data: ${JSON.stringify({ status: "connected" })}\n\n`);
}
function broadcast(event, data) {
  const payload = JSON.stringify(data);
  for (const res of clients) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
  }
}

app.get("/api/stream", (req, res) => {
  sseHeaders(res);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

app.post("/api/questions", async (req, res) => {
  const { userId = "u1", question } = req.body || {};
  if (!question) return res.status(400).json({ error: "question is required" });

  const questionId = "q_" + Date.now();
  const qObj = { id: questionId, userId, question, answerId: null };
  questions.push(qObj);
  broadcast("question_created", qObj);

  try {
    const llm = await callLLMService(question);
    const answerId = "a_" + Date.now();
    const aObj = { id: answerId, questionId, text: llm.text, visualization: llm.visualization };
    answers.push(aObj);
    qObj.answerId = answerId;

    broadcast("answer_created", aObj);
    res.json({ questionId, answerId });
  } catch (e) {
    console.error("LLM error:", e);
    res.status(500).json({ error: "LLM failed" });
  }
});

app.get("/api/questions", (req, res) => res.json(questions));

app.get("/api/answers/:id", (req, res) => {
  const ans = answers.find(a => a.id === req.params.id);
  if (!ans) return res.status(404).json({ error: "not found" });
  res.json(ans);
});

app.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
