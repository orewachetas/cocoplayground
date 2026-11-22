/**
 * GroqApiClient
 * High-performance Groq Cloud API Client with streaming SSE parser and telemetry.
 */
class GroqApiClient {
  constructor(apiKey = '') {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.abortController = null;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return !!(this.apiKey && this.apiKey.startsWith('gsk_') && this.apiKey.length > 20);
  }

  /**
   * Verify the API key by listing models
   */
  async verifyApiKey() {
    if (!this.apiKey) {
      throw new Error('API key is empty. Please enter your Groq API key.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `Groq API responded with status ${response.status}`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      return { success: true, models: data.data || [] };
    } catch (err) {
      console.error('Groq API Verification Failed:', err);
      throw err;
    }
  }

  /**
   * Fetch list of available models from Groq
   */
  async fetchModels() {
    if (!this.apiKey) {
      return this.getDefaultModels();
    }
    try {
      const result = await this.verifyApiKey();
      if (result.models && result.models.length > 0) {
        // Filter and sort active chat models
        return result.models
          .filter(m => m.active !== false && !m.id.includes('whisper') && !m.id.includes('embedding'))
          .sort((a, b) => b.created - a.created);
      }
      return this.getDefaultModels();
    } catch (err) {
      console.warn('Could not fetch models live, using default fallback list:', err.message);
      return this.getDefaultModels();
    }
  }

  getDefaultModels() {
    return [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', desc: 'Latest flagship, 128k context, versatile coding & reasoning' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', desc: 'Ultra-fast (800+ tok/s), lightweight, 128k context' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', desc: 'SOTA reasoning model with explicit thought process' },
      { id: 'llama3-70b-8192', name: 'Llama 3 70B', desc: 'High capability meta model, 8k context' },
      { id: 'llama3-8b-8192', name: 'Llama 3 8B', desc: 'Fast meta model, 8k context' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'MoE model with 32k context' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', desc: 'Google lightweight high-efficiency instruction model' },
      { id: 'llama-guard-3-8b', name: 'Llama Guard 3 8B', desc: 'Safety classification model' }
    ];
  }

  /**
   * Stop active streaming generation
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Stream a chat completion request with real-time SSE chunk extraction
   */
  async streamChatCompletion({
    model,
    messages,
    temperature = 0.7,
    maxTokens = 2048,
    topP = 1.0,
    stream = true,
    jsonMode = false,
    stopSequences = [],
    seed = null,
    onChunk,
    onFirstToken,
    onMetrics
  }) {
    if (!this.apiKey) {
      throw new Error('Groq API Key is missing. Please set your API key in the top bar or settings.');
    }

    this.cancel(); // Abort previous if any
    this.abortController = new AbortController();

    const bodyPayload = {
      model,
      messages,
      temperature: parseFloat(temperature),
      max_completion_tokens: parseInt(maxTokens, 10),
      top_p: parseFloat(topP),
      stream: Boolean(stream)
    };

    if (jsonMode) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    if (stopSequences && stopSequences.length > 0) {
      bodyPayload.stop = stopSequences;
    }

    if (seed !== null && seed !== '' && !isNaN(seed)) {
      bodyPayload.seed = parseInt(seed, 10);
    }

    // Include usage metrics in Groq stream
    if (stream) {
      bodyPayload.stream_options = { include_usage: true };
    }

    const startTime = performance.now();
    let firstTokenTime = null;
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let tokenChunkCount = 0;

    let response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: this.abortController.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Generation stopped by user.');
      }
      throw err;
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.error?.message || `Groq API Error HTTP ${response.status}`;
      throw new Error(message);
    }

    // NON-STREAMING MODE
    if (!stream) {
      const data = await response.json();
      const endTime = performance.now();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      const totalSeconds = (endTime - startTime) / 1000;
      const speed = usage.completion_tokens ? (usage.completion_tokens / totalSeconds).toFixed(1) : 0;

      if (onMetrics) {
        onMetrics({
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          totalTime: totalSeconds.toFixed(3),
          ttft: (totalSeconds * 1000).toFixed(0),
          tokensPerSecond: speed
        });
      }

      return {
        content,
        usage: {
          ...usage,
          tokensPerSecond: speed,
          totalTime: totalSeconds
        }
      };
    }

    // STREAMING SSE MODE
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalUsage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep uncompleted line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            
            // Check for groq usage data in SSE
            if (parsed.usage) {
              finalUsage = parsed.usage;
            } else if (parsed.x_groq?.usage) {
              finalUsage = parsed.x_groq.usage;
            }

            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle DeepSeek reasoning content if provided
            if (delta.reasoning_content) {
              accumulatedReasoning += delta.reasoning_content;
            }

            const textChunk = delta.content || '';
            if (textChunk) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                if (onFirstToken) {
                  onFirstToken((firstTokenTime - startTime).toFixed(0));
                }
              }

              accumulatedContent += textChunk;
              tokenChunkCount++;

              if (onChunk) {
                onChunk({
                  chunk: textChunk,
                  accumulated: accumulatedContent,
                  reasoning: accumulatedReasoning,
                  isFirst: tokenChunkCount === 1
                });
              }

              // Calculate live rolling tokens/sec
              if (onMetrics && firstTokenTime) {
                const now = performance.now();
                const elapsedStreamSec = (now - firstTokenTime) / 1000;
                if (elapsedStreamSec > 0.05) {
                  const estTokPerSec = (tokenChunkCount * 1.3 / elapsedStreamSec).toFixed(1);
                  onMetrics({
                    liveSpeed: estTokPerSec,
                    ttft: (firstTokenTime - startTime).toFixed(0),
                    elapsed: ((now - startTime) / 1000).toFixed(2)
                  });
                }
              }
            }
          } catch (jsonErr) {
            // Ignore incomplete chunks
          }
        }
      }
    } catch (streamErr) {
      if (streamErr.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        throw streamErr;
      }
    } finally {
      this.abortController = null;
    }

    const endTime = performance.now();
    const totalTimeSec = (endTime - startTime) / 1000;
    const ttftMs = firstTokenTime ? (firstTokenTime - startTime).toFixed(0) : (totalTimeSec * 1000).toFixed(0);

    // Compute final tokens per second
    let completionTokens = finalUsage?.completion_tokens || Math.round(accumulatedContent.length / 4);
    let promptTokens = finalUsage?.prompt_tokens || 0;
    let tokensPerSecond = totalTimeSec > 0 ? (completionTokens / totalTimeSec).toFixed(1) : '0';

    const metricsSummary = {
      promptTokens: promptTokens,
      completionTokens: completionTokens,
      totalTokens: (promptTokens + completionTokens),
      totalTime: totalTimeSec.toFixed(3),
      ttft: ttftMs,
      tokensPerSecond: tokensPerSecond,
      groqUsage: finalUsage
    };

    if (onMetrics) {
      onMetrics(metricsSummary);
    }

    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      metrics: metricsSummary
    };
  }
}

// Export for browser
window.GroqApiClient = GroqApiClient;
