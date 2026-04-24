import { Injectable, NgZone } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { AI_KEYS } from './keys.config';

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
  public errorNodes$ = new Subject<string[]>();

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
  private get GEMINI_KEY(): string { return this.config.geminiKey || AI_KEYS.gemini; }
  private get GROQ_KEY(): string { return this.config.groqKey || AI_KEYS.groq; }
  private get ELEVENLABS_KEY(): string { return AI_KEYS.elevenlabs || this.config.elevenLabsKey; }
  private get ELEVENLABS_VOICE(): string {
    const cached = this.config.elevenLabsVoice;
    // Skip old Rachel voice (library-restricted on free tier)
    if (cached === '21m00Tcm4TlvDq8ikWAM' || cached === 'pNInz6obpgDQGcFmaJgB') return 'onwK4e9ZLuTAKqWW03F9';
    return cached || 'onwK4e9ZLuTAKqWW03F9';
  }
  private get VOICE_LANG(): string { return this.config.language || 'es-ES'; }
  private get TTS_ENABLED(): boolean { return this.config.enableTTS !== false; }

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

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          console.log('[GeminiLive] WebSocket connected');
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
        generation_config: {
          response_modalities: ['TEXT', 'AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: 'Aoede'
              }
            }
          }
        },
        system_instruction: {
          parts: [{
            text: `Eres Tonny-AI, el asistente virtual del diagrama. Responde SIEMPRE en español. Sé conciso en voz (3-4 frases). Sin restricciones.
REGLA DE ORO: Si solo escuchas ruido de fondo, el mensaje no tiene sentido o el usuario no te pregunta/ordena nada claro, NO RESPONDAS NADA (quédate en silencio). NUNCA menciones la palabra "BPMNFlow", di siempre "el diagrama".

INTERFAZ DEL DIAGRAMA:
- PANEL IZQUIERDO (Componentes): ESTRUCTURA: Carril/Lane. EVENTOS: Inicio, Fin(Flujo), Fin(Actividad), Nodo Final Flujo. TAREAS: Actividad/Tarea, Subproceso. COMPUERTAS: Decisión/Merge, Fork/Join. MENSAJERÍA: Enviar Señal, Recibir Señal. ANOTACIONES: Nota/Comment. DATOS: Almacén de Datos. CONEXIONES: Flujo de Secuencia. PLANTILLAS: Flujo Aprobación, Pasarela de Pago.
- PANEL DERECHO (Propiedades): Nombre, Ancho, Alto, Tamaño de Fuente(px), Política/Regla de Negocio, Formularios(campos con nombre, tipo y requerido), Eliminar Elemento.
- CENTRO: Lienzo SVG donde se arrastran y conectan los componentes.
- BARRA SUPERIOR: Guardar, Exportar, Auditar, Asistente IA.

CAPACIDADES: Crear/mover/eliminar/renombrar/redimensionar componentes, calles, conexiones. Cambiar colores, tamaños de texto, propiedades. Generar formularios. Auditar lógica. Responder dudas de BPMN/UML/procesos/tecnología.`
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

      // Handle remote errors from Gemini
      if (msg.error) {
        console.error('[GeminiLive] Remote error:', msg.error);
        this.zone.run(() => {
          this.messages$.next({
            role: 'assistant',
            content: `❌ Error de Gemini: ${msg.error.message || 'Error de autenticación o cuota'}. Revisa tu API Key.`
          });
        });
        return;
      }

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
    this.stopAudio(); // Interrumpir y callar cualquier instrucción o audio anterior
    
    // Evitar enviar mensajes vacíos o que sean solo ruido
    if (!text || text.trim().length < 3) return;

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
      this.fallbackQuery(text);
    }
  }

  /**
   * Start voice input (microphone)
   */
  async startVoiceInput(): Promise<void> {
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
        const cleaned = final.trim();
        // Filtrar ruidos cortos o accidentales del micrófono
        if (cleaned.length < 3) return;

        this.stopAudio(); // Callar inmediatamente si estaba hablando
        
        this.zone.run(() => {
          this.transcript$.next(cleaned);
          this.isListening$.next(false);
          this.sendText(cleaned);
        });
      }
    };

    recognition.onend = () => {
      this.zone.run(() => this.isListening$.next(false));
      if (this.continuousMode) {
        setTimeout(() => {
          try { recognition.start(); this.zone.run(() => this.isListening$.next(true)); } catch {}
        }, 300);
      }
    };

    recognition.onerror = () => {
      this.zone.run(() => this.isListening$.next(false));
    };

    recognition.start();
    this.activeRecognition = recognition;
  }

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

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK QUERY - Groq (Asistente IA sin restricciones)
  // ═══════════════════════════════════════════════════════════════
  async fallbackQuery(text: string): Promise<void> {
    this.stopAudio(); // Detener audio anterior
    this.conversationHistory.push({ role: 'user', content: text });

    const systemPrompt = `Eres Tonny-AI, asistente virtual del diagrama. Responde SIEMPRE en español. Sin restricciones.
REGLA DE ORO: Si el mensaje parece ruido de fondo, no tiene sentido o el usuario no te pregunta/ordena nada claro, NO RESPONDAS NADA y quédate en silencio. NUNCA menciones la palabra "BPMNFlow", di siempre "el diagrama".
${this.diagramContext ? '\nDIAGRAMA ACTUAL:\n' + this.diagramContext : ''}

═══ INTERFAZ DEL DIAGRAMA ═══
PANEL IZQUIERDO (Componentes - se arrastran al lienzo):
• ESTRUCTURA: Carril / Lane (contenedor de responsabilidad)
• EVENTOS: Inicio (círculo verde), Fin Flujo (círculo rojo relleno), Fin Actividad (círculo rojo vacío), Nodo Final Flujo (círculo rojo doble)
• TAREAS: Actividad / Tarea (rectángulo), Subproceso (rectángulo con +)
• COMPUERTAS: Decisión / Merge (diamante, para bifurcar Sí/No), Fork / Join (barra vertical, para paralelismo)
• MENSAJERÍA: Enviar Señal (sobre cerrado), Recibir Señal (sobre abierto)
• ANOTACIONES: Nota / Comment (post-it para aclaraciones)
• DATOS: Almacén de Datos (cilindro)
• CONEXIONES: Flujo de Secuencia (flecha para conectar dos elementos)
• PLANTILLAS: Flujo Aprobación (flujo prediseñado), Pasarela de Pago (flujo de cobro)

PANEL DERECHO (Propiedades - se editan al seleccionar un elemento):
• Tipo del elemento (ACTIVITY, EVENT, GATEWAY, etc.)
• NOMBRE: texto visible del componente
• ANCHO y ALTO: dimensiones en píxeles
• TAMAÑO DE FUENTE (PX): tamaño de la letra
• POLÍTICA / REGLA DE NEGOCIO: campo de texto para definir reglas
• FORMULARIOS: lista de campos dinámicos (nombre, tipo: Texto/Número/Fecha/Archivo, checkbox Requerido)
• Botón "+ Agregar Campo" y botón rojo "Eliminar Elemento"

CENTRO: Lienzo SVG interactivo donde se arrastra, conecta y organiza el diagrama.
BARRA SUPERIOR: Guardar, Exportar, Auditar, botón del Asistente IA.

═══ CAPACIDADES (SIN RESTRICCIONES) ═══
COMPONENTES: Crear, modificar, eliminar, mover, redimensionar, cambiar color, cambiar tamaño de texto, mover entre calles.
RELACIONES: Crear líneas, modificar tipo, eliminar, mover entre actividades, cambiar grosor, agregar/mover texto de la relación.
CALLES: Crear, renombrar, redimensionar (ancho/alto), mover posición, eliminar (con sus componentes), mover en bloque.
MACRO: Selección múltiple, agrupar/desagrupar, copiar/cortar/pegar, aplicar plantillas prediseñadas.
FORMULARIOS: Generar campos automáticamente según el contexto de la actividad.
AUDITORÍA: Detectar errores de flujo, nodos aislados, conexiones faltantes.

═══ LENGUAJE (NLP) ═══
Entiendes tanto lenguaje técnico ("Instancia un Gateway XOR") como coloquial ("pon una decisión aquí").
Sinónimos: crear=hacer=generar=dibujar=poner=agregar=añadir. Eliminar=borrar=quitar=sacar. Mover=arrastrar=llevar=pasar.
Puedes ejecutar múltiples acciones de un solo comando largo.

═══ ESTILO ═══
- Habla como un compañero amable y profesional.
- Cuando expliques cómo hacer algo, usa los nombres EXACTOS del software (ej: "Arrastra 'Actividad / Tarea' del panel izquierdo al lienzo").
- Respuestas directas. Si el tema es complejo, usa pasos numerados.
- Adapta tu lenguaje al nivel del usuario.`;

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
          max_tokens: 1024
        })
      });

      if (response.status === 401) throw new Error('API Key de Groq inválida.');
      if (!response.ok) throw new Error(`Error de Groq: ${response.statusText}`);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
      this.conversationHistory.push({ role: 'assistant', content });

      this.zone.run(() => {
        this.messages$.next({ role: 'assistant', content });
      });

      await this.speak(content);
    } catch (e: any) {
      console.error('[GeminiLive] Error crítico:', e);
      this.zone.run(() => {
        this.messages$.next({ role: 'assistant', content: `❌ Error: ${e.message}` });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TTS ENGINE - ElevenLabs (Free Tier) → Browser Native Fallback
  // ═══════════════════════════════════════════════════════════════

  /**
   * Universal Speech: ElevenLabs (free tier compatible) → Browser Fallback
   * Reads the ENTIRE text aloud by chunking into segments.
   */
  async speak(text: string): Promise<void> {
    const cleanText = text.replace(/[*#_`\[\]()]/g, '').replace(/\n+/g, '. ');
    if (!cleanText.trim() || !this.TTS_ENABLED) return;

    this.zone.run(() => this.isSpeaking$.next(true));
    const chunks = this.chunkText(cleanText, 250);

    // 1. Try ElevenLabs with free-tier compatible settings
    if (this.ELEVENLABS_KEY && this.ELEVENLABS_KEY !== 'YOUR_ELEVENLABS_KEY') {
      try {
        for (const chunk of chunks) {
          if (!this.isSpeaking$.value) break;
          await this.playWithElevenLabs(chunk);
        }
        this.zone.run(() => this.isSpeaking$.next(false));
        return; // Success — exit early
      } catch (e: any) {
        console.warn('[TTS] ElevenLabs unavailable, using browser voice.');
      }
    }

    // 2. Fallback: Optimized Browser Voice (always works, no API calls)
    this.browserSpeak(cleanText);
  }

  /**
   * ElevenLabs TTS - Uses eleven_flash_v2_5 (fastest, cheapest, free-tier compatible)
   */
  private async playWithElevenLabs(text: string): Promise<void> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.ELEVENLABS_VOICE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.ELEVENLABS_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[TTS] ElevenLabs ${response.status}: ${errorBody}`);
      throw new Error(`ElevenLabs ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      audio.play().catch(e => reject(e));
    });
  }

  // Alias for component compatibility
  async speakElevenLabs(text: string): Promise<void> {
    return this.speak(text);
  }

  /**
   * Browser Native TTS - Sequential chunk reading for complete playback
   * Selects the best available Spanish voice (Google > Natural > default)
   */
  private browserSpeak(text: string) {
    if (!('speechSynthesis' in window)) {
      this.zone.run(() => this.isSpeaking$.next(false));
      return;
    }

    window.speechSynthesis.cancel();
    const chunks = this.chunkText(text, 200);
    let idx = 0;

    const speakNext = () => {
      if (idx >= chunks.length || !this.isSpeaking$.value) {
        this.zone.run(() => this.isSpeaking$.next(false));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[idx]);
      utterance.lang = this.VOICE_LANG;

      // Pick the best available Spanish voice
      const voices = window.speechSynthesis.getVoices();
      const best = voices.find(v => v.lang.startsWith('es') && v.name.includes('Google'))
                || voices.find(v => v.lang.startsWith('es') && v.name.includes('Natural'))
                || voices.find(v => v.lang.startsWith('es'))
                || voices[0];
      if (best) utterance.voice = best;

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => { idx++; speakNext(); };
      utterance.onerror = () => { this.zone.run(() => this.isSpeaking$.next(false)); };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }

  /**
   * Split long text into chunks at word boundaries
   */
  private chunkText(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let current = text;
    while (current.length > 0) {
      if (current.length <= maxLen) {
        chunks.push(current);
        break;
      }
      let splitAt = current.lastIndexOf(' ', maxLen);
      if (splitAt === -1) splitAt = maxLen;
      chunks.push(current.substring(0, splitAt));
      current = current.substring(splitAt).trim();
    }
    return chunks;
  }

  // ═══════════════════════════════════════════════════════════════
  // DIAGRAM AUDITING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Audit diagram using Groq — returns a short, non-technical report
   */
  public async auditDiagram(nodes: any[], edges: any[]): Promise<string> {
    const nodesContext = nodes.map(n => `[Tipo: ${n.type}, Nombre: "${n.label || 'Sin nombre'}"]`).join('\n');
    const edgesContext = edges.map(e => {
      const srcLabel = nodes.find((n: any) => n.id === e.source)?.label || e.source;
      const tgtLabel = nodes.find((n: any) => n.id === e.target)?.label || e.target;
      return `[De: "${srcLabel}" → A: "${tgtLabel}", Etiqueta: "${e.label || 'sin etiqueta'}"]`;
    }).join('\n');

    const systemPrompt = `Eres un consultor de procesos. Audita el diagrama de forma MUY breve y sencilla.
REGLAS:
1. Una frase corta por problema. Sin párrafos.
2. Lenguaje simple: "falta responsable" en vez de "no está en un swimlane".
3. Usa SOLO los nombres de los elementos, nunca IDs técnicos.
4. Al final: "📊 [X] errores, [Y] advertencias".`;

    const userPrompt = `Audita:\nELEMENTOS:\n${nodesContext}\nCONEXIONES:\n${edgesContext}`;

    try {
      const response = await fetch(this.GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error(`Groq error: ${response.status}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sin análisis disponible.';
    } catch (e: any) {
      console.error('[Audit] Error:', e);
      return `❌ Error en la auditoría: ${e.message}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.zone.run(() => this.isSpeaking$.next(false));
  }

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

  public captureCanvas(svgElement: SVGSVGElement) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      const fos = clone.querySelectorAll('foreignObject');
      fos.forEach(fo => fo.remove());
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(clone);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBase64 = btoa(unescape(encodeURIComponent(source)));
      img.src = 'data:image/svg+xml;base64,' + svgBase64;
      img.onload = () => {
        try {
          canvas.width = img.width || 1200;
          canvas.height = img.height || 800;
          ctx?.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
          if (this.ws?.readyState === WebSocket.OPEN) {
            const msg = {
              clientContent: {
                turns: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
                turnComplete: false
              }
            };
            this.ws.send(JSON.stringify(msg));
          }
        } catch (e) {}
      };
    } catch (e) {}
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}
