/**
 * Coco Components
 * - SoundEngine: Tactile audio synthesis using Web Audio API
 * - SpeedometerGauge: Canvas-based Groq inference speedometer
 * - CodeExporter: Formatter for cURL, Python, Node.js, and Fetch
 * - MarkdownHelper: Formatting and code blocks with copy
 */

// Web Audio Tactile Sound Engine
class CocoSoundEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = false;
    this.lastClickTime = 0;
  }

  init() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.init();
      this.playBeep(880, 0.05, 0.1);
    }
    return this.enabled;
  }

  playTokenTick() {
    if (!this.enabled) return;
    const now = performance.now();
    // Throttle sound to at most once every 35ms so high-speed 600+ tok/s doesn't distort
    if (now - this.lastClickTime < 35) return;
    this.lastClickTime = now;

    try {
      this.init();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Soft high-tech subtle mechanical tick
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.015);

      gain.gain.setValueAtTime(0.015, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.015);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.018);
    } catch (e) {
      // Audio autoplay may be prevented before user gesture
    }
  }

  playBeep(freq = 440, duration = 0.08, vol = 0.05) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }
}

// Canvas Speedometer Gauge
class SpeedometerGauge {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.currentSpeed = 0;
    this.targetSpeed = 0;
    this.maxSpeed = 1000; // Groq can exceed 800 tok/s on Llama 3 8B!
    this.animating = false;
    this.render();
  }

  setSpeed(speed) {
    this.targetSpeed = Math.min(Math.max(parseFloat(speed) || 0, 0), this.maxSpeed);
    if (!this.animating) {
      this.animating = true;
      this.animate();
    }
  }

  animate() {
    const diff = this.targetSpeed - this.currentSpeed;
    if (Math.abs(diff) < 0.5) {
      this.currentSpeed = this.targetSpeed;
      this.render();
      this.animating = false;
      return;
    }

    this.currentSpeed += diff * 0.18;
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 4;
    const radius = Math.min(w / 2 - 6, h - 8);

    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    // Background track arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#232938';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Speed ratio
    const ratio = Math.min(this.currentSpeed / this.maxSpeed, 1);
    const currentAngle = startAngle + ratio * Math.PI;

    if (ratio > 0.01) {
      // Glowing active speed arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, currentAngle, false);
      ctx.lineWidth = 4;

      const grad = ctx.createLinearGradient(0, centerY, w, centerY);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(0.6, '#00f5d4');
      grad.addColorStop(1, '#38bdf8');

      ctx.strokeStyle = grad;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Needle
    const needleAngle = currentAngle;
    const needleLength = radius - 5;
    const needleX = centerX + Math.cos(needleAngle) * needleLength;
    const needleY = centerY + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Pivot pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
  }
}

// Code Exporter
const CodeExporter = {
  generateCurl(config) {
    const payload = {
      model: config.model,
      messages: config.messages,
      temperature: parseFloat(config.temperature),
      max_completion_tokens: parseInt(config.maxTokens, 10),
      top_p: parseFloat(config.topP),
      stream: config.stream
    };

    return `curl -X POST "https://api.groq.com/openai/v1/chat/completions" \\
  -H "Authorization: Bearer \${GROQ_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  },

  generatePython(config) {
    const messagesFormatted = JSON.stringify(config.messages, null, 4);
    return `import os
from groq import Groq

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY")
)

completion = client.chat.completions.create(
    model="${config.model}",
    messages=${messagesFormatted},
    temperature=${config.temperature},
    max_completion_tokens=${config.maxTokens},
    top_p=${config.topP},
    stream=${config.stream ? 'True' : 'False'}
)

${config.stream ? `for chunk in completion:
    print(chunk.choices[0].delta.content or "", end="")` : `print(completion.choices[0].message.content)`}`;
  },

  generateNode(config) {
    const messagesFormatted = JSON.stringify(config.messages, null, 2);
    return `import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const completion = await groq.chat.completions.create({
    messages: ${messagesFormatted},
    model: "${config.model}",
    temperature: ${config.temperature},
    max_completion_tokens: ${config.maxTokens},
    top_p: ${config.topP},
    stream: ${config.stream ? 'true' : 'false'}
  });

  ${config.stream ? `for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }` : `console.log(completion.choices[0]?.message?.content);`}
}

main();`;
  },

  generateFetch(config) {
    const payload = {
      model: config.model,
      messages: config.messages,
      temperature: parseFloat(config.temperature),
      max_completion_tokens: parseInt(config.maxTokens, 10),
      top_p: parseFloat(config.topP),
      stream: config.stream
    };

    return `const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${JSON.stringify(payload, null, 2)})
});

const data = await response.json();
console.log(data.choices[0].message.content);`;
  }
};

// Markdown & Safe HTML Helper
const MarkdownHelper = {
  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  parse(rawText) {
    if (!rawText) return '';

    let text = rawText;

    // Check for DeepSeek <think>...</think> reasoning blocks
    let reasoningHtml = '';
    const thinkMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
    if (thinkMatch) {
      const reasoningText = thinkMatch[1].trim();
      text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();

      if (reasoningText) {
        reasoningHtml = `
          <div class="reasoning-box">
            <div class="reasoning-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
              <span>🧠 Deep Thought & Reasoning (${Math.round(reasoningText.length / 4)} tokens)</span>
              <span>▼</span>
            </div>
            <div class="reasoning-content">${this.escapeHtml(reasoningText)}</div>
          </div>
        `;
      }
    }

    // Code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    text = text.replace(codeBlockRegex, (match, lang, code) => {
      const language = lang || 'text';
      const escapedCode = this.escapeHtml(code);
      const randomId = 'code-' + Math.random().toString(36).substring(2, 9);

      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${language}</span>
            <button class="copy-code-btn" onclick="CocoApp.copyTextById('${randomId}', this)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
          </div>
          <pre><code id="${randomId}">${escapedCode}</code></pre>
        </div>
      `;
    });

    // Inline code `...`
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });

    // Headers
    text = text.replace(/^### (.*$)/gim, '<h3 style="font-size:1.05rem; font-weight:700; margin:0.8rem 0 0.4rem; color:#fde68a;">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 style="font-size:1.2rem; font-weight:700; margin:1rem 0 0.5rem; color:#f59e0b;">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 style="font-size:1.4rem; font-weight:800; margin:1.2rem 0 0.6rem; color:#ffffff;">$1</h1>');

    // Bold & Italic
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Blockquotes
    text = text.replace(/^\> (.*$)/gim, '<blockquote style="border-left:3px solid #f59e0b; padding-left:0.8rem; margin:0.6rem 0; color:#94a3b8; font-style:italic;">$1</blockquote>');

    // Unordered lists
    text = text.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left:1.2rem; margin-bottom:0.25rem;">$1</li>');

    // Paragraph line breaks
    text = text.replace(/\n\n+/g, '</p><p>');
    text = '<p>' + text + '</p>';
    text = text.replace(/<p><\/p>/g, '');

    return reasoningHtml + text;
  }
};

window.CocoSoundEngine = CocoSoundEngine;
window.SpeedometerGauge = SpeedometerGauge;
window.CodeExporter = CodeExporter;
window.MarkdownHelper = MarkdownHelper;
