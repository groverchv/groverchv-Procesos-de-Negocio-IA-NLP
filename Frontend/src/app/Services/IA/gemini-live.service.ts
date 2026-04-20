import { Injectable, NgZone } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

export interface GeminiLiveMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  // Observable streams
  public messages$ = new Subject<GeminiLiveMessage>();
  public isConnected$ = new BehaviorSubject<boolean>(false);
  public isSpeaking$ = new BehaviorSubject<boolean>(false);
  public isListening$ = new BehaviorSubject<boolean>(false);
  public transcript$ = new Subject<string>();
  public errorNodes$ = new Subject<string[]>(); // IDs de nodos con errores

  private currentAudio: HTMLAudioElement | null = null;
  private diagramContext: string = '';
  private diagramNodes: any[] = [];
  private diagramEdges: any[] = [];

  private readonly GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private conversationHistory: { role: string; content: string }[] = [];

  constructor(private zone: NgZone) {}

  // ═══ Dynamic API Key getters (from localStorage/Settings) ═══
  private get config(): any {
    try {
      return JSON.parse(localStorage.getItem('bpmnflow_config') || '{}');
    } catch { return {}; }
  }
  private get GEMINI_KEY(): string { return this.config.geminiKey || ''; }
  private get GROQ_KEY(): string { return this.config.groqKey || ''; }
  private get ELEVENLABS_KEY(): string { return this.config.elevenLabsKey || ''; }
  private get ELEVENLABS_VOICE(): string { return this.config.elevenLabsVoice || '21m00Tcm4TlvDq8ikWAM'; }
  private get VOICE_LANG(): string { return this.config.language || 'es-ES'; }
  private get TTS_ENABLED(): boolean { return this.config.enableTTS !== false; }

  private hasValidKey(key: string): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    return trimmed.length > 8 && !/^YOUR_/i.test(trimmed);
  }

  private get hasGeminiKey(): boolean { return this.hasValidKey(this.GEMINI_KEY); }
  private get hasGroqKey(): boolean { return this.hasValidKey(this.GROQ_KEY); }
  private get hasElevenLabsKey(): boolean { return this.hasValidKey(this.ELEVENLABS_KEY); }

  private get WS_URL(): string {
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.GEMINI_KEY}`;
  }

  /**
   * Set current diagram context for the AI
   */
  setDiagramContext(nodes: any[], edges: any[]) {
    this.diagramNodes = nodes;
    this.diagramEdges = edges;
    const nodesSummary = nodes.map(n => `${n.type}:"${n.label}" (id:${n.id})`).join(', ');
    const edgesSummary = edges.map(e => `${e.source}→${e.target}${e.label ? ' [' + e.label + ']' : ''}`).join(', ');
    this.diagramContext = `Diagrama actual: ${nodes.length} nodos [${nodesSummary}], ${edges.length} conexiones [${edgesSummary}]`;
  }

  /**
   * Connect to Gemini Multimodal Live API via WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    if (!this.hasGeminiKey) {
      this.zone.run(() => this.isConnected$.next(false));
      throw new Error('Gemini key not configured');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          console.log('[GeminiLive] WebSocket connected');
          // Send setup message
          this.sendSetup();
          this.zone.run(() => this.isConnected$.next(true));
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[GeminiLive] WebSocket error:', error);
          this.zone.run(() => this.isConnected$.next(false));
          // Fallback to Groq + ElevenLabs
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[GeminiLive] WebSocket closed');
          this.zone.run(() => this.isConnected$.next(false));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Send initial setup configuration
   */
  private sendSetup() {
    if (!this.ws) return;
    const setup = {
      setup: {
        model: 'models/gemini-2.0-flash-exp',
        generationConfig: {
          responseModalities: ['TEXT', 'AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede'
              }
            }
          }
        },
        systemInstruction: {
          parts: [{
            text: `Eres el Arquitecto UML y Motor de Estado de BPMNFlow.

Rol dual:
1) Copiloto: asesorar, optimizar flujos y explicar conceptos.
2) Motor CRUD: ejecutar mutaciones exactas sobre el diagrama.

Tono:
- Profesional, técnico, directo y minimalista.
- Sin texto ornamental.

Reglas críticas:
- Si propones mejora estructural compleja, pide confirmación exacta: "¿Quieres que aplique estos cambios por ti?".
- No ejecutes mutaciones masivas sin confirmación explícita.
- Si hay autocorrecciones, obedece la última intención.
- Si detectas interrupción (alto, espera, cancela), detén plan previo y sigue la nueva directriz.

Contrato de salida para acciones sobre lienzo (JSON estricto):
{
  "assistant_speech": "texto técnico para TTS",
  "status_icon": "📊 | ⚙️ | 🛑 | 💡 | 🔄",
  "operations": [
    {
      "action": "CREATE | UPDATE | DELETE | MOVE | RESIZE",
      "element_type": "swimlane | node | edge | form | text",
      "target_id": "id o null",
      "payload": { "x": 0, "y": 0, "properties": {} }
    }
  ]
}

Regla condicional:
- En sugerencia, operations = [] y assistant_speech pide confirmación.
- En orden directa o confirmación explícita, completa operations.

Contexto del sistema:
- BPMNFlow modela procesos con nodos, aristas, swimlanes y formularios.
- Swimlanes: columnas verticales con título arriba y flujo de arriba hacia abajo.
- Responde en español.`
          }]
        }
      }
    };
    this.ws.send(JSON.stringify(setup));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;

      // Handle text response
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) {
            this.zone.run(() => {
              this.messages$.next({
                role: 'assistant',
                content: part.text
              });
            });
          }
          // Handle inline audio response
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            this.playAudioFromBase64(part.inlineData.data, part.inlineData.mimeType);
          }
        }
      }

      // Handle turn complete
      if (msg.serverContent?.turnComplete) {
        this.zone.run(() => this.isSpeaking$.next(false));
      }

    } catch (e) {
      console.error('[GeminiLive] Parse error:', e);
    }
  }

  /**
   * Send text message to Gemini
   */
  sendText(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = {
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: this.diagramContext ? `${text}\n\n[CONTEXTO: ${this.diagramContext}]` : text }]
          }],
          turnComplete: true
        }
      };
      this.ws.send(JSON.stringify(msg));
      this.zone.run(() => this.isSpeaking$.next(true));
    } else {
      // Fallback to Groq + ElevenLabs
      this.fallbackQuery(text);
    }
  }

  /**
   * Start voice input (microphone)
   */
  async startVoiceInput(): Promise<void> {
    // Use Web Speech API for recognition (more reliable)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('SpeechRecognition not supported');
    }

    const recognition = new SpeechRecognition();
    recognition.lang = this.VOICE_LANG;
    recognition.continuous = false;
    recognition.interimResults = true;

    this.zone.run(() => this.isListening$.next(true));

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) {
        this.zone.run(() => this.transcript$.next(interim));
      }
      if (final) {
        // Full Duplex: interrupt AI if it's speaking
        if (this.isSpeaking$.value) {
          this.stopAudio();
        }
        this.zone.run(() => {
          this.transcript$.next(final);
          this.isListening$.next(false);
          this.sendText(final);
        });
      }
    };

    recognition.onend = () => {
      this.zone.run(() => this.isListening$.next(false));
      // Auto-restart in continuous mode
      if (this.continuousMode) {
        setTimeout(() => {
          try { recognition.start(); this.zone.run(() => this.isListening$.next(true)); } catch {}
        }, 300);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' && this.continuousMode) {
        // Silence - keep listening
        return;
      }
      this.zone.run(() => this.isListening$.next(false));
    };

    recognition.start();
    this.activeRecognition = recognition;
  }

  // Full Duplex: continuous listening mode
  private continuousMode = false;
  private activeRecognition: any = null;

  toggleContinuousListening(): boolean {
    this.continuousMode = !this.continuousMode;
    if (this.continuousMode) {
      this.startVoiceInput().catch(() => {});
    } else {
      if (this.activeRecognition) {
        try { this.activeRecognition.stop(); } catch {}
        this.activeRecognition = null;
      }
      this.zone.run(() => this.isListening$.next(false));
    }
    return this.continuousMode;
  }

  /**
   * Play audio from base64 data
   */
  private playAudioFromBase64(base64: string, mimeType: string) {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);

      this.stopAudio();
      this.currentAudio = new Audio(url);
      this.zone.run(() => this.isSpeaking$.next(true));

      this.currentAudio.onended = () => {
        this.zone.run(() => this.isSpeaking$.next(false));
        URL.revokeObjectURL(url);
      };
      this.currentAudio.play().catch(() => {});
    } catch (e) {
      console.error('[GeminiLive] Audio play error:', e);
    }
  }

  /**
   * Fallback: Groq for text + ElevenLabs for speech
   */
  async fallbackQuery(text: string): Promise<void> {
    this.conversationHistory.push({ role: 'user', content: text });

    if (!this.hasGroqKey) {
      const local = this.localFriendlyReply(text);
      this.conversationHistory.push({ role: 'assistant', content: local });
      this.zone.run(() => this.messages$.next({ role: 'assistant', content: local }));
      await this.speakElevenLabs(local);
      return;
    }

    const systemPrompt = `Eres el Arquitecto UML y Motor de Estado de BPMNFlow.
Responde en español, técnico y directo.
${this.diagramContext ? '\n' + this.diagramContext : ''}

  Rol dual:
  - Copiloto: asesorar y detectar mejoras de flujo.
  - Motor CRUD: ejecutar operaciones precisas sobre el diagrama.

  Reglas:
  - Si hay mejora estructural compleja, responde con operations=[] y pregunta: "¿Quieres que aplique estos cambios por ti?"
  - Si el usuario confirma o da orden inequívoca, llena operations.
  - Si hay autocorrección, aplica la última intención.
  - Si detectas "alto", "espera" o "cancela", descarta plan previo.

  Formato obligatorio de salida para acciones:
  {
    "assistant_speech": "texto",
    "status_icon": "📊 | ⚙️ | 🛑 | 💡 | 🔄",
    "operations": []
  }

  Reglas de modelado actuales:
  - Los carriles (swimlanes) son columnas verticales
  - El título del carril va arriba
  - El flujo dentro del carril va de arriba hacia abajo`;

    try {
      const response = await fetch(this.GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-16)
          ],
          temperature: 0.7,
          max_tokens: 512
        })
      });

      if (!response.ok) {
        throw new Error(`Groq HTTP ${response.status}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
      const content = this.extractAssistantSpeech(raw);
      this.conversationHistory.push({ role: 'assistant', content });

      this.zone.run(() => {
        this.messages$.next({ role: 'assistant', content });
      });

      // Speak with ElevenLabs
      await this.speakElevenLabs(content);

    } catch (e) {
      const local = this.localFriendlyReply(text);
      this.zone.run(() => {
        this.messages$.next({ role: 'assistant', content: local });
      });
      await this.speakElevenLabs(local);
    }
  }

  /**
   * Speak text via ElevenLabs
   */
  async speakElevenLabs(text: string): Promise<void> {
    const cleanText = text.replace(/[*#_`\[\]()]/g, '').replace(/\n+/g, '. ').slice(0, 800);
    if (!cleanText.trim()) return;
    if (!this.TTS_ENABLED) return;

    this.zone.run(() => this.isSpeaking$.next(true));

    if (!this.hasElevenLabsKey) {
      this.browserSpeak(cleanText);
      return;
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.ELEVENLABS_VOICE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.ELEVENLABS_KEY
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 }
        })
      });

      if (!response.ok) throw new Error('ElevenLabs error');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      this.stopAudio();
      this.currentAudio = new Audio(url);
      this.currentAudio.onended = () => {
        this.zone.run(() => this.isSpeaking$.next(false));
        URL.revokeObjectURL(url);
      };
      await this.currentAudio.play();
    } catch {
      // Browser TTS fallback
      this.browserSpeak(cleanText);
    }
  }

  private browserSpeak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.VOICE_LANG;
      utterance.onend = () => this.zone.run(() => this.isSpeaking$.next(false));
      window.speechSynthesis.speak(utterance);
    } else {
      this.zone.run(() => this.isSpeaking$.next(false));
    }
  }

  /**
   * Run Groq audit on diagram structure
   */
  async auditDiagram(nodes: any[], edges: any[]): Promise<string> {
    const graphData = {
      nodes: nodes.map(n => ({ id: n.id, type: n.type, label: n.label, hasForms: !!(n.forms && n.forms.length > 0) })),
      edges: edges.map(e => ({ source: e.source, target: e.target, label: e.label }))
    };

    try {
      const response = await fetch(this.GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'system',
            content: `Eres un auditor experto de diagramas de procesos de negocio. Analiza el grafo y detecta:
1. Caminos sin salida (nodos sin conexión de salida excepto nodos finales)
2. Nodos de decisión sin al menos 2 salidas
3. Decisiones sin etiquetas/guardas en sus flujos
4. Bucles infinitos (ciclos sin condición de salida)
5. Nodos de actividad/subproceso sin formularios definidos
6. Falta de nodo inicio o fin
7. Nodos aislados

Responde en español con formato:
🔴 ERRORES CRÍTICOS: (lista)
🟡 ADVERTENCIAS: (lista) 
🟢 RECOMENDACIONES: (lista)
📊 RESUMEN: X errores, Y advertencias`
          }, {
            role: 'user',
            content: JSON.stringify(graphData)
          }],
          temperature: 0.2,
          max_tokens: 1024
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sin análisis disponible.';
    } catch {
      return '❌ Error al conectar con el auditor.';
    }
  }

  /**
   * Stop current audio playback
   */
  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.zone.run(() => this.isSpeaking$.next(false));
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopAudio();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected$.next(false);
    this.conversationHistory = [];
  }

  /**
   * Clear conversation
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  private extractAssistantSpeech(raw: string): string {
    if (!raw || typeof raw !== 'string') return 'No pude generar una respuesta.';
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.assistant_speech === 'string' && parsed.assistant_speech.trim()) {
        return parsed.assistant_speech.trim();
      }
    } catch {
      // Ignore non-JSON responses
    }
    return raw;
  }

  private localFriendlyReply(text: string): string {
    const t = (text || '').toLowerCase().trim();
    const greeting = /hola|buenas|qué tal|como estas|cómo estás|hey|hi/i.test(t);
    const suggest = /suger|idea|mejora|optim|propuesta/i.test(t);
    const help = /ayuda|como|cómo|explica|para que|para qué/i.test(t);

    if (greeting) {
      return 'Hola. Estoy lista para ayudarte con tu diagrama. Puedes pedirme crear elementos, moverlos, revisar lógica o proponer mejoras.';
    }

    if (suggest) {
      return 'Perfecto, me encantan tus sugerencias. Compárteme el cambio y te respondo con pasos concretos o lo traduzco a acciones para el diagrama.';
    }

    if (help) {
      return 'Puedo ayudarte en tres modos: 1) resolver dudas rápidas, 2) sugerir mejoras del flujo, 3) convertir instrucciones en operaciones sobre el lienzo.';
    }

    return 'Recibido. Puedo responderte de forma conversacional y también ayudarte a ejecutar cambios en el diagrama. Si quieres, empezamos por tu objetivo del proceso.';
  }
}
