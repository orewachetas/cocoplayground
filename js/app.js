/**
 * Coco Playground Application Orchestrator
 */
const CocoApp = {
  // State
  state: {
    apiKey: '',
    currentModel: 'llama-3.3-70b-versatile',
    arenaModelB: 'llama-3.1-8b-instant',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    stream: true,
    jsonMode: false,
    systemPrompt: 'You are Coco, an ultra-fast, witty, and exceptionally brilliant AI assistant running on Groq hardware. You provide precise, high-impact responses with zero fluff.',
    mode: 'chat', // 'chat' or 'arena'
    isGenerating: false,
    soundEnabled: false,
    messages: [], // Array of { role, content, model, metrics }
    arenaMessagesA: [],
    arenaMessagesB: [],
    availableModels: []
  },

  groqClient: null,
  groqClientB: null, // For arena mode
  soundEngine: null,
  speedometer: null,

  init() {
    this.soundEngine = new CocoSoundEngine();
    this.speedometer = new SpeedometerGauge('speedGaugeCanvas');

    // Load persisted state from localStorage
    this.loadState();

    // Initialize API clients
    this.groqClient = new GroqApiClient(this.state.apiKey);
    this.groqClientB = new GroqApiClient(this.state.apiKey);

    // Setup UI event listeners
    this.bindEvents();

    // Initialize UI components
    this.updateApiKeyUI();
    this.initModelSelector();
    this.renderMessages();
    this.updateMetricsUI({
      tokensPerSecond: '0.0',
      ttft: '0',
      totalTokens: '0',
      totalTime: '0.00'
    });

    // Check if API key is present; if not, show subtle prompt
    if (!this.state.apiKey) {
      setTimeout(() => {
        this.openApiKeyModal();
      }, 600);
    } else {
      // Validate key & fetch real live models
      this.refreshLiveModels();
    }
  },

  loadState() {
    try {
      const savedKey = localStorage.getItem('coco_api_key');
      if (savedKey) this.state.apiKey = savedKey;

      const savedModel = localStorage.getItem('coco_model');
      if (savedModel) this.state.currentModel = savedModel;

      const savedModelB = localStorage.getItem('coco_model_b');
      if (savedModelB) this.state.arenaModelB = savedModelB;

      const savedTemp = localStorage.getItem('coco_temp');
      if (savedTemp !== null) this.state.temperature = parseFloat(savedTemp);

      const savedMaxTokens = localStorage.getItem('coco_max_tokens');
      if (savedMaxTokens !== null) this.state.maxTokens = parseInt(savedMaxTokens, 10);

      const savedTopP = localStorage.getItem('coco_top_p');
      if (savedTopP !== null) this.state.topP = parseFloat(savedTopP);

      const savedStream = localStorage.getItem('coco_stream');
      if (savedStream !== null) this.state.stream = savedStream === 'true';

      const savedSystem = localStorage.getItem('coco_system_prompt');
      if (savedSystem) this.state.systemPrompt = savedSystem;

      const savedSound = localStorage.getItem('coco_sound');
      if (savedSound === 'true') {
        this.state.soundEnabled = true;
        this.soundEngine.enabled = true;
      }
    } catch (e) {
      console.warn('Could not read state from localStorage', e);
    }
  },

  saveState() {
    try {
      localStorage.setItem('coco_api_key', this.state.apiKey);
      localStorage.setItem('coco_model', this.state.currentModel);
      localStorage.setItem('coco_model_b', this.state.arenaModelB);
      localStorage.setItem('coco_temp', this.state.temperature);
      localStorage.setItem('coco_max_tokens', this.state.maxTokens);
      localStorage.setItem('coco_top_p', this.state.topP);
      localStorage.setItem('coco_stream', this.state.stream);
      localStorage.setItem('coco_system_prompt', this.state.systemPrompt);
      localStorage.setItem('coco_sound', this.state.soundEnabled);
    } catch (e) {
      console.warn('Could not save state to localStorage', e);
    }
  },

  bindEvents() {
    // Mode toggles
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = btn.dataset.mode;
        this.switchMode(mode);
      });
    });

    // Form inputs in Sidebar
    const tempSlider = document.getElementById('temperatureSlider');
    const tempVal = document.getElementById('tempValBadge');
    if (tempSlider) {
      tempSlider.value = this.state.temperature;
      tempVal.textContent = this.state.temperature.toFixed(2);
      tempSlider.addEventListener('input', (e) => {
        this.state.temperature = parseFloat(e.target.value);
        tempVal.textContent = this.state.temperature.toFixed(2);
        this.saveState();
      });
    }

    const maxTokensSlider = document.getElementById('maxTokensSlider');
    const maxTokensVal = document.getElementById('maxTokensValBadge');
    if (maxTokensSlider) {
      maxTokensSlider.value = this.state.maxTokens;
      maxTokensVal.textContent = this.state.maxTokens;
      maxTokensSlider.addEventListener('input', (e) => {
        this.state.maxTokens = parseInt(e.target.value, 10);
        maxTokensVal.textContent = this.state.maxTokens;
        this.saveState();
      });
    }

    const topPSlider = document.getElementById('topPSlider');
    const topPVal = document.getElementById('topPValBadge');
    if (topPSlider) {
      topPSlider.value = this.state.topP;
      topPVal.textContent = this.state.topP.toFixed(2);
      topPSlider.addEventListener('input', (e) => {
        this.state.topP = parseFloat(e.target.value);
        topPVal.textContent = this.state.topP.toFixed(2);
        this.saveState();
      });
    }

    const streamToggle = document.getElementById('streamToggle');
    if (streamToggle) {
      streamToggle.checked = this.state.stream;
      streamToggle.addEventListener('change', (e) => {
        this.state.stream = e.target.checked;
        this.saveState();
      });
    }

    const jsonModeToggle = document.getElementById('jsonModeToggle');
    if (jsonModeToggle) {
      jsonModeToggle.checked = this.state.jsonMode;
      jsonModeToggle.addEventListener('change', (e) => {
        this.state.jsonMode = e.target.checked;
      });
    }

    const systemPromptEl = document.getElementById('systemPromptInput');
    if (systemPromptEl) {
      systemPromptEl.value = this.state.systemPrompt;
      systemPromptEl.addEventListener('input', (e) => {
        this.state.systemPrompt = e.target.value;
        this.saveState();
      });
    }

    // Chat textarea auto-expand and Enter-to-send
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
      });
    }

    // Send and Stop buttons
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopGeneration());
    }

    // Sound toggle button
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      this.updateSoundBtnUI(soundBtn);
      soundBtn.addEventListener('click', () => {
        this.state.soundEnabled = this.soundEngine.toggle();
        this.updateSoundBtnUI(soundBtn);
        this.saveState();
        this.showToast(this.state.soundEnabled ? '🔊 Sound effects enabled' : '🔇 Sound effects muted');
      });
    }

    // Modal dismiss on overlay or escape
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  },

  updateSoundBtnUI(btn) {
    if (this.state.soundEnabled) {
      btn.style.color = '#00f5d4';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        <span>Sound On</span>
      `;
    } else {
      btn.style.color = 'var(--coco-muted)';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
        <span>Sound Off</span>
      `;
    }
  },

  switchMode(mode) {
    this.state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const chatView = document.getElementById('chatViewArea');
    const arenaView = document.getElementById('arenaViewArea');

    if (mode === 'arena') {
      chatView.style.display = 'none';
      arenaView.classList.add('active');
      this.initArenaSelectors();
      this.showToast('⚔️ Coco Arena Mode: 2 models streaming side-by-side!');
    } else {
      chatView.style.display = 'flex';
      arenaView.classList.remove('active');
    }
  },

  initModelSelector() {
    const selectA = document.getElementById('modelSelect');
    if (!selectA) return;

    const defaultModels = this.groqClient.getDefaultModels();
    this.state.availableModels = defaultModels;
    this.populateSelect(selectA, defaultModels, this.state.currentModel);

    selectA.addEventListener('change', (e) => {
      this.state.currentModel = e.target.value;
      this.saveState();
      this.updateModelBadge();
    });

    this.updateModelBadge();
  },

  initArenaSelectors() {
    const arenaA = document.getElementById('arenaModelASelect');
    const arenaB = document.getElementById('arenaModelBSelect');
    if (arenaA && arenaB) {
      this.populateSelect(arenaA, this.state.availableModels, this.state.currentModel);
      this.populateSelect(arenaB, this.state.availableModels, this.state.arenaModelB);

      arenaA.addEventListener('change', (e) => {
        this.state.currentModel = e.target.value;
        this.saveState();
      });

      arenaB.addEventListener('change', (e) => {
        this.state.arenaModelB = e.target.value;
        this.saveState();
      });
    }
  },

  populateSelect(selectEl, models, selectedVal) {
    selectEl.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      if (m.id === selectedVal) opt.selected = true;
      selectEl.appendChild(opt);
    });
  },

  updateModelBadge() {
    const badge = document.getElementById('activeModelBadge');
    if (badge) {
      badge.textContent = this.state.currentModel;
    }
  },

  async refreshLiveModels() {
    if (!this.state.apiKey) return;
    try {
      const models = await this.groqClient.fetchModels();
      if (models && models.length > 0) {
        this.state.availableModels = models.map(m => ({
          id: m.id,
          name: m.id,
          desc: m.owned_by ? `Owner: ${m.owned_by}` : ''
        }));
        const selectA = document.getElementById('modelSelect');
        if (selectA) {
          this.populateSelect(selectA, this.state.availableModels, this.state.currentModel);
        }
        this.initArenaSelectors();
      }
    } catch (e) {
      console.warn('Live model refresh skipped:', e.message);
    }
  },

  // API Key Management
  openApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    const input = document.getElementById('modalApiKeyInput');
    if (input) {
      input.value = this.state.apiKey;
    }
    if (modal) {
      modal.classList.add('open');
      input?.focus();
    }
  },

  closeApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    if (modal) modal.classList.remove('open');
  },

  async saveApiKeyFromModal() {
    const input = document.getElementById('modalApiKeyInput');
    const key = (input.value || '').trim();

    if (!key) {
      this.showToast('Please enter an API key', 'error');
      return;
    }

    const testBtn = document.getElementById('saveApiKeyBtn');
    const originalText = testBtn.innerHTML;
    testBtn.innerHTML = `<span>Validating with Groq...</span>`;
    testBtn.disabled = true;

    try {
      this.groqClient.setApiKey(key);
      this.groqClientB.setApiKey(key);
      await this.groqClient.verifyApiKey();

      this.state.apiKey = key;
      this.saveState();
      this.updateApiKeyUI();
      this.closeApiKeyModal();
      this.refreshLiveModels();
      this.showToast('✨ Groq API Key verified and saved successfully!', 'success');
    } catch (err) {
      this.showToast(`Verification failed: ${err.message}`, 'error');
    } finally {
      testBtn.innerHTML = originalText;
      testBtn.disabled = false;
    }
  },

  updateApiKeyUI() {
    const statusPill = document.getElementById('apiKeyStatusPill');
    const statusText = document.getElementById('apiKeyStatusText');
    const dot = document.getElementById('apiKeyStatusDot');

    if (this.state.apiKey) {
      const masked = this.state.apiKey.substring(0, 7) + '••••' + this.state.apiKey.slice(-4);
      if (statusText) statusText.textContent = masked;
      if (dot) {
        dot.style.background = '#00f5d4';
        dot.style.boxShadow = '0 0 8px #00f5d4';
      }
    } else {
      if (statusText) statusText.textContent = 'Set Groq API Key';
      if (dot) {
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 8px #f59e0b';
      }
    }
  },

  // System Prompt Presets
  applyPreset(type) {
    const input = document.getElementById('systemPromptInput');
    const presets = {
      coco: 'You are Coco, an ultra-fast, witty, and exceptionally brilliant AI assistant running on Groq hardware. You provide precise, high-impact responses with zero fluff.',
      dev: 'You are an elite principal software engineer. You write elegant, production-grade, secure, and modern code with concise explanations. Provide runnable examples with tests.',
      thinker: 'You are an advanced chain-of-thought reasoner. Break down the core logic step-by-step, evaluate counterarguments, and present a mathematically and logically sound conclusion.',
      concise: 'Answer directly with extreme brevity. No greetings, no preamble, no filler. Only the exact answer.',
      json: 'You are a structured data extractor. You MUST respond strictly in valid JSON adhering to the user request. Do not include markdown code ticks around the JSON.'
    };

    if (presets[type] && input) {
      input.value = presets[type];
      this.state.systemPrompt = presets[type];
      this.saveState();
      this.showToast(`Applied preset: ${type.toUpperCase()}`);
    }
  },

  // Quick Prompt insertion
  usePrompt(text) {
    const input = document.getElementById('chatInput');
    if (input) {
      input.value = text;
      input.focus();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    }
  },

  // Send Message Dispatcher
  sendMessage() {
    if (this.state.isGenerating) return;

    if (!this.state.apiKey) {
      this.openApiKeyModal();
      this.showToast('Please enter your Groq API key first.', 'error');
      return;
    }

    const input = document.getElementById('chatInput');
    const userText = (input.value || '').trim();
    if (!userText) return;

    input.value = '';
    input.style.height = '48px';

    if (this.state.mode === 'arena') {
      this.executeArenaDuel(userText);
    } else {
      this.executeChatTurn(userText);
    }
  },

  async executeChatTurn(userText) {
    // Hide welcome hero if active
    const welcomeHero = document.getElementById('welcomeHero');
    if (welcomeHero) welcomeHero.style.display = 'none';

    // Add user message to state
    const userMsg = { role: 'user', content: userText };
    this.state.messages.push(userMsg);
    this.renderMessageBubble(userMsg, this.state.messages.length - 1);

    // Prepare assistant placeholder bubble
    const assistantMsg = {
      role: 'assistant',
      content: '',
      model: this.state.currentModel,
      reasoning: '',
      metrics: null
    };
    const assistantIndex = this.state.messages.length;
    this.state.messages.push(assistantMsg);
    const bubbleEl = this.renderMessageBubble(assistantMsg, assistantIndex);

    this.setGenerating(true);

    // Construct full messages payload with system prompt
    const payloadMessages = [];
    if (this.state.systemPrompt.trim()) {
      payloadMessages.push({ role: 'system', content: this.state.systemPrompt.trim() });
    }

    // Include conversation history
    for (let i = 0; i < this.state.messages.length - 1; i++) {
      payloadMessages.push({
        role: this.state.messages[i].role,
        content: this.state.messages[i].content
      });
    }

    try {
      const result = await this.groqClient.streamChatCompletion({
        model: this.state.currentModel,
        messages: payloadMessages,
        temperature: this.state.temperature,
        maxTokens: this.state.maxTokens,
        topP: this.state.topP,
        stream: this.state.stream,
        jsonMode: this.state.jsonMode,
        onFirstToken: (ttft) => {
          this.updateMetric('ttft', `${ttft} ms`);
        },
        onChunk: ({ chunk, accumulated, reasoning }) => {
          assistantMsg.content = accumulated;
          assistantMsg.reasoning = reasoning;
          this.updateMessageContent(bubbleEl, accumulated);
          this.soundEngine.playTokenTick();
        },
        onMetrics: (metrics) => {
          if (metrics.liveSpeed) {
            this.speedometer.setSpeed(metrics.liveSpeed);
            this.updateMetric('speed', `${metrics.liveSpeed} Tok/s`);
          }
          if (metrics.tokensPerSecond) {
            this.speedometer.setSpeed(metrics.tokensPerSecond);
            this.updateMetricsUI(metrics);
          }
        }
      });

      assistantMsg.content = result.content;
      assistantMsg.metrics = result.metrics;
      this.updateMessageContent(bubbleEl, result.content);
    } catch (err) {
      this.showToast(err.message, 'error');
      assistantMsg.content = `⚠️ **Error:** ${err.message}`;
      this.updateMessageContent(bubbleEl, assistantMsg.content);
    } finally {
      this.setGenerating(false);
    }
  },

  // Arena Mode: Two models racing side by side!
  async executeArenaDuel(userText) {
    const arenaColA = document.getElementById('arenaScrollA');
    const arenaColB = document.getElementById('arenaScrollB');

    // Render user prompts in both columns
    this.appendArenaBubble(arenaColA, 'user', userText, 'You');
    this.appendArenaBubble(arenaColB, 'user', userText, 'You');

    const bubbleA = this.appendArenaBubble(arenaColA, 'assistant', 'Thinking...', this.state.currentModel);
    const bubbleB = this.appendArenaBubble(arenaColB, 'model-b', 'Thinking...', this.state.arenaModelB);

    this.setGenerating(true);

    const messages = [];
    if (this.state.systemPrompt.trim()) {
      messages.push({ role: 'system', content: this.state.systemPrompt.trim() });
    }
    messages.push({ role: 'user', content: userText });

    // Race Model A and Model B in parallel!
    const taskA = this.groqClient.streamChatCompletion({
      model: this.state.currentModel,
      messages: messages,
      temperature: this.state.temperature,
      maxTokens: this.state.maxTokens,
      topP: this.state.topP,
      stream: true,
      onChunk: ({ accumulated }) => {
        bubbleA.querySelector('.msg-content').innerHTML = MarkdownHelper.parse(accumulated);
        this.soundEngine.playTokenTick();
      },
      onMetrics: (m) => {
        if (m.tokensPerSecond) {
          const badge = document.getElementById('statBadgeA');
          if (badge) badge.textContent = `⚡ ${m.tokensPerSecond} T/s | ⏱️ ${m.ttft}ms`;
        }
      }
    });

    const taskB = this.groqClientB.streamChatCompletion({
      model: this.state.arenaModelB,
      messages: messages,
      temperature: this.state.temperature,
      maxTokens: this.state.maxTokens,
      topP: this.state.topP,
      stream: true,
      onChunk: ({ accumulated }) => {
        bubbleB.querySelector('.msg-content').innerHTML = MarkdownHelper.parse(accumulated);
      },
      onMetrics: (m) => {
        if (m.tokensPerSecond) {
          const badge = document.getElementById('statBadgeB');
          if (badge) badge.textContent = `⚡ ${m.tokensPerSecond} T/s | ⏱️ ${m.ttft}ms`;
        }
      }
    });

    try {
      await Promise.allSettled([taskA, taskB]);
    } catch (e) {
      console.error('Arena duel error', e);
    } finally {
      this.setGenerating(false);
    }
  },

  appendArenaBubble(container, role, text, authorName) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    
    let avatarSvg = '👤';
    if (role === 'assistant') {
      avatarSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>`;
    } else if (role === 'model-b') {
      avatarSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    }

    div.innerHTML = `
      <div class="msg-avatar ${role}">
        ${avatarSvg}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">${authorName}</span>
        </div>
        <div class="msg-content">${MarkdownHelper.parse(text)}</div>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  },

  stopGeneration() {
    this.groqClient.cancel();
    this.groqClientB.cancel();
    this.setGenerating(false);
    this.showToast('Generation interrupted.');
  },

  setGenerating(isGenerating) {
    this.state.isGenerating = isGenerating;
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (isGenerating) {
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
    } else {
      sendBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
    }
  },

  // Message Bubbles Rendering
  renderMessageBubble(msg, index) {
    const container = document.getElementById('messagesContainer');
    if (!container) return null;

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.id = `msg-${index}`;

    const isUser = msg.role === 'user';
    const avatarIcon = isUser 
      ? '👤' 
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="#111" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#111"/></svg>`;
    const authorTitle = isUser ? 'You' : 'Coco';
    const modelTag = !isUser ? `<span class="msg-model-tag">${msg.model || this.state.currentModel}</span>` : '';

    div.innerHTML = `
      <div class="msg-avatar ${msg.role}">
        ${avatarIcon}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <div class="msg-author">
            <span>${authorTitle}</span>
            ${modelTag}
          </div>
          <div class="msg-actions">
            <button class="msg-action-btn" title="Copy Message" onclick="CocoApp.copyMessageText(${index})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <div class="msg-content">
          ${msg.content ? MarkdownHelper.parse(msg.content) : '<span style="color:#64748b; font-style:italic;">Streaming from Groq LPUs...</span>'}
        </div>
      </div>
    `;

    container.appendChild(div);
    const scrollArea = document.getElementById('chatScrollArea');
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
    return div;
  },

  updateMessageContent(bubbleEl, rawContent) {
    if (!bubbleEl) return;
    const contentEl = bubbleEl.querySelector('.msg-content');
    if (contentEl) {
      contentEl.innerHTML = MarkdownHelper.parse(rawContent);
    }
    const scrollArea = document.getElementById('chatScrollArea');
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  },

  renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    container.innerHTML = '';
    this.state.messages.forEach((msg, idx) => {
      this.renderMessageBubble(msg, idx);
    });
  },

  clearChat() {
    this.state.messages = [];
    const container = document.getElementById('messagesContainer');
    if (container) container.innerHTML = '';

    const welcomeHero = document.getElementById('welcomeHero');
    if (welcomeHero) welcomeHero.style.display = 'flex';

    const arenaA = document.getElementById('arenaScrollA');
    const arenaB = document.getElementById('arenaScrollB');
    if (arenaA) arenaA.innerHTML = '';
    if (arenaB) arenaB.innerHTML = '';

    this.speedometer.setSpeed(0);
    this.updateMetricsUI({
      tokensPerSecond: '0.0',
      ttft: '0',
      totalTokens: '0',
      totalTime: '0.00'
    });

    this.showToast('🧹 Chat history cleared');
  },

  // Telemetry Dashboard
  updateMetric(key, val) {
    if (key === 'speed') {
      const el = document.getElementById('telemetrySpeed');
      if (el) el.textContent = val;
    } else if (key === 'ttft') {
      const el = document.getElementById('telemetryTtft');
      if (el) el.textContent = val;
    }
  },

  updateMetricsUI(metrics) {
    const speedEl = document.getElementById('telemetrySpeed');
    const ttftEl = document.getElementById('telemetryTtft');
    const latencyEl = document.getElementById('telemetryLatency');
    const tokensEl = document.getElementById('telemetryTokens');

    if (speedEl) speedEl.textContent = `${metrics.tokensPerSecond || '0.0'} Tok/s`;
    if (ttftEl) ttftEl.textContent = `${metrics.ttft || '0'} ms`;
    if (latencyEl) latencyEl.textContent = `${metrics.totalTime || '0.00'} s`;
    if (tokensEl) tokensEl.textContent = `${metrics.totalTokens || '0'} tokens`;
  },

  // Code Export Modal
  openCodeModal() {
    const modal = document.getElementById('codeModal');
    if (!modal) return;

    this.renderCodeExportTab('curl');
    modal.classList.add('open');
  },

  closeCodeModal() {
    const modal = document.getElementById('codeModal');
    if (modal) modal.classList.remove('open');
  },

  renderCodeExportTab(lang) {
    document.querySelectorAll('.code-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const codeSnippetEl = document.getElementById('codeSnippetArea');
    if (!codeSnippetEl) return;

    const payloadMessages = [];
    if (this.state.systemPrompt.trim()) {
      payloadMessages.push({ role: 'system', content: this.state.systemPrompt.trim() });
    }
    this.state.messages.forEach(m => {
      payloadMessages.push({ role: m.role, content: m.content });
    });

    if (payloadMessages.length === 0) {
      payloadMessages.push({ role: 'user', content: 'Hello Coco! Tell me something fascinating.' });
    }

    const config = {
      model: this.state.currentModel,
      messages: payloadMessages,
      temperature: this.state.temperature,
      maxTokens: this.state.maxTokens,
      topP: this.state.topP,
      stream: this.state.stream
    };

    let code = '';
    if (lang === 'curl') code = CodeExporter.generateCurl(config);
    else if (lang === 'python') code = CodeExporter.generatePython(config);
    else if (lang === 'node') code = CodeExporter.generateNode(config);
    else if (lang === 'fetch') code = CodeExporter.generateFetch(config);

    codeSnippetEl.textContent = code;
  },

  copyCurrentCode() {
    const codeSnippetEl = document.getElementById('codeSnippetArea');
    if (codeSnippetEl) {
      navigator.clipboard.writeText(codeSnippetEl.textContent);
      this.showToast('📋 Code copied to clipboard!', 'success');
    }
  },

  copyMessageText(index) {
    const msg = this.state.messages[index];
    if (msg && msg.content) {
      navigator.clipboard.writeText(msg.content);
      this.showToast('Copied message content');
    }
  },

  copyTextById(id, btnEl) {
    const el = document.getElementById(id);
    if (el) {
      navigator.clipboard.writeText(el.innerText || el.textContent);
      if (btnEl) {
        const prev = btnEl.innerHTML;
        btnEl.innerHTML = `✓ Copied`;
        setTimeout(() => { btnEl.innerHTML = prev; }, 1500);
      }
    }
  },

  // Toast System
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `coco-toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : (type === 'error' ? '⚠️' : '⚡')}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
};

window.CocoApp = CocoApp;
document.addEventListener('DOMContentLoaded', () => CocoApp.init());
