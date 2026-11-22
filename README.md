# ⚡ Coco Playground

A high-performance, futuristic Groq AI playground with a distinctive cyber-luxury aesthetic, dynamic inference speed telemetry, model duel arena, and direct browser API integration.

![Coco Playground](https://img.shields.io/badge/Powered%20By-Groq%20LPUs-orange?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## ✨ Highlights & Features

- **⚡ Distinctive Cyber-LPU Aesthetics**:
  - Deep cocoa charcoal palette with warm molten amber & electric coconut-mint neon glows.
  - Glassmorphic panels with dynamic micro-interactions.
  - Interactive tactile sound synthesizer (toggleable mechanical key/tick feedback on token generation).

- **⚡ Live Groq LPU Telemetry**:
  - Real-time **Speedometer Gauge** dial animating tokens per second (often exceeding 500–800+ tok/s).
  - Accurate **Time to First Token (TTFT)** measurement in milliseconds.
  - Total inference duration and token counts (Prompt, Completion, Total).

- **⚔️ Duel Arena Mode**:
  - Run **two models side-by-side** in real-time on the same prompt (e.g. `llama-3.3-70b-versatile` vs `llama-3.1-8b-instant` or `deepseek-r1-distill-llama-70b`).
  - Compare speeds, token latencies, and output quality simultaneously.

- **🔑 Secure Client-Side API Key Management**:
  - Easy setup modal with direct verification against the Groq API.
  - Keys are saved strictly in `localStorage` in your local browser and sent directly to `https://api.groq.com/openai/v1/chat/completions`.
  - Live model discovery from the Groq API endpoint to populate all available models for your account.

- **🧠 Deep Reasoning Support**:
  - Automatic detection and rendering of `<think>...</think>` tags (from models like `deepseek-r1-distill-llama-70b`) into a sleek collapsible thought process box.

- **🛠️ Full Hyperparameter Controls**:
  - Temperature slider (0.00 – 2.00)
  - Max Completion Tokens slider (up to 8,192 tokens)
  - Top P slider (0.00 – 1.00)
  - Streaming SSE toggle
  - JSON Object output mode
  - Quick System Prompt Presets (Coco Assistant, Senior Developer, Deep Reasoner, Concise, JSON Extractor)

- **📄 Multi-Language Code Exporter**:
  - One-click export of current conversation to:
    - `cURL`
    - `Python (groq-sdk)`
    - `Node.js / TypeScript (groq-sdk)`
    - `Browser Fetch API`

---

## 🚀 Quick Start

### Option 1: Instant Node.js Server
```bash
# In the project directory:
npm start
# or: node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option 2: Python HTTP Server
```bash
python3 -m http.server 3000
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option 3: Double-Click Direct File
Simply open `index.html` directly in any modern browser (Chrome, Safari, Edge, Arc, Brave, Firefox).

---

## 🔑 Getting Your Groq API Key
1. Go to **[console.groq.com/keys](https://console.groq.com/keys)**
2. Click **Create API Key** and copy your `gsk_...` key.
3. In Coco Playground, click **Set Groq API Key** in the top bar and paste it.
4. Click **Verify & Save Key**.

---

## 📁 Project Structure

```
coco-playground/
├── index.html         # Main UI structure and layout
├── css/
│   └── styles.css     # Cyber-luxury Coco theme & animations
├── js/
│   ├── groq-api.js    # Groq API client with SSE parser & telemetry
│   ├── components.js  # Audio synthesizer, speedometer, code exporter, markdown helper
│   └── app.js         # State orchestration, chat & arena duel engines
├── server.js          # Lightweight local HTTP server
├── package.json       # Project scripts & metadata
└── README.md          # Documentation
```
