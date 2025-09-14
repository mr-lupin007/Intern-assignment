Chat-to-Visualization App

This project is a chat-based learning tool that explains concepts using text + animated visualizations.
I built it from scratch using Node.js (Express) for the backend and React (Vite + TypeScript) for the frontend.

The goal was to let a user type any scientific question, send it to an LLM, and receive:

A clear text explanation

A visualization spec (JSON) that my frontend renders as an animated canvas

🎯 Objectives

Make learning interactive: chat + visuals side-by-side

Build real-time updates using Server-Sent Events (SSE)

Support multiple LLM backends (Ollama locally, HuggingFace online)

Ensure a smooth demo even without internet → mock mode for fallback answers

🏗 Tech Stack

Backend: Node.js, Express, Nodemon

Frontend: React, Vite, TypeScript

Realtime: Server-Sent Events (SSE)

LLM: Ollama (llama3.2:3b) with JSON output (or fallback mock answers)

📂 Project Structure
chat-vis/
 ├── server/               # Backend
 │   ├── index.js          # Express + SSE endpoints
 │   ├── llm.js            # LLM integration + JSON sanitizer
 │   └── .env              # Config (LLM_MODE, model, port)
 │
 ├── client/               # React frontend
 │   ├── src/App.tsx       # Chat UI + Canvas renderer
 │   └── public/           # Animations, static assets
 │
 └── README.md

🚀 Setup & Run
1️⃣ Backend
cd server
npm install


Create a .env file inside server/:

LLM_MODE=ollama        # mock / ollama / hf
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
PORT=3000


Run the server:

npm run dev

2️⃣ Frontend
cd client
npm install
npm run dev


Open http://localhost:5173

3️⃣ Ollama Setup (for real LLM)

Install Ollama → ollama.com/download

Pull a model:

ollama pull llama3.2:3b


Verify it's running:

ollama ps


Start the backend with LLM_MODE=ollama

🖼 Example Response

LLM returns text + visualization JSON.
Example:

{
  "text": "Newton’s First Law states that an object remains at rest or in uniform motion unless acted upon by a force.",
  "visualization": {
    "id": "vis_001",
    "duration": 4000,
    "fps": 30,
    "layers": [
      {
        "id": "ball1",
        "type": "circle",
        "props": { "x": 100, "y": 200, "r": 20, "fill": "#3498db" },
        "animations": [
          { "property": "x", "from": 100, "to": 400, "start": 0, "end": 3000 }
        ]
      },
      {
        "id": "arrow1",
        "type": "arrow",
        "props": { "x": 90, "y": 200, "dx": 30, "dy": 0, "color": "#e74c3c" },
        "animations": []
      }
    ]
  }
}


My frontend parses this and animates it on a <canvas> with smooth play/pause controls.

📡 API Overview
Method	Endpoint	Purpose
POST	/api/questions	Send user question, trigger LLM
GET	/api/questions	Get all previous questions
GET	/api/answers/:id	Get answer text + visualization
GET	/api/stream	SSE stream for live updates
🧪 Demo Flow

Start backend + frontend

Open browser → ask:

"Explain Newton's First Law"

"Explain the Solar System"

"What is DNA?"

Chat updates in real-time + animation plays on left panel

🛠 Notes & Challenges

Had to sanitize LLM output because models sometimes send invalid JSON

Built a fallback mock mode so the app never stays stuck on "waiting"

Fixed canvas null errors by guarding refs and restarting requestAnimationFrame loop properly

Added auto-play of animations whenever a new answer arrives

🔮 Future Work

Add support for Lottie animations (importing JSON from LottieFiles)

More sophisticated visualization types (graphs, flowcharts)

Deploy on Render/Netlify for public use <img width="1915" height="908" alt="image" src="https://github.com/user-attachments/assets/df4c7c2b-209e-4152-bc2a-7db1e2109cbc" />

