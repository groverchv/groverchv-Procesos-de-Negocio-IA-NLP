import { Injectable, NgZone } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { AI_KEYS } from './keys.config';
import { DiagramCommand } from './ia.service';

export interface GeminiLiveMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiLiveService {

  public messages$ = new Subject<GeminiLiveMessage>();
  public isConnected$ = new BehaviorSubject<boolean>(true);
  public isSpeaking$ = new BehaviorSubject<boolean>(false);
  public isListening$ = new BehaviorSubject<boolean>(false);
  public transcript$ = new Subject<string>();
  public commands$ = new Subject<DiagramCommand[]>();

  private currentNodes: any[] = [];
  private currentEdges: any[] = [];
  private conversationHistory: { role: string; content: string }[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private activeRecognition: any = null;
  private continuousMode = false;
  private isProcessing = false;
  private lastProcessedText = '';
  private lastProcessedTime = 0;
  private currentSpeakId = 0;

  private readonly GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

  private readonly VOICE_NAMES: Record<string, string> = {
    'EXAVITQu4vr4xnSDxMaL': 'Sarah', 'FGY2WhTYpPnrIDTdsKH5': 'Laura',
    'XB0fDUnXU5powFXDhCwa': 'Charlotte', 'Xb7hH8MSUJpSbSDYk0k2': 'Alice',
    'XrExE9yKIg1WjnnlVkGX': 'Matilda', 'pFZP5JQG7iQjIQuC4Bku': 'Lily',
    'cgSgspJ2msm6clMCkdEW': 'Jessica', 'onwK4e9ZLuTAKqWW03F9': 'Daniel',
    'nPczCjzI2devNBz1zQrb': 'Brian', 'cjVigY5qzO86Huf0OWal': 'Eric',
    'iP95p4xoKVk53GoZ742B': 'Chris', 'TX3LPaxmHKxFdv7VOQHJ': 'Liam',
    'IKne3meq5aSn9XLyUdCD': 'Charlie', 'bIHbv24MWmeRgasZH58o': 'Will',
    'pqHfZKP75CvOlQylNhV4': 'Bill', 'JBFqnCBsd6RMkjVDRZzb': 'George',
    'N2lVS1w4EtoT3dr4eOWO': 'Callum', 'SAz9YHcvj6GT2YYXdXww': 'River'
  };

  constructor(private zone: NgZone) {}

  private get config(): any {
    try { return JSON.parse(localStorage.getItem('bpmnflow_config') || '{}'); }
    catch { return {}; }
  }
  private get GROQ_KEY(): string { return this.config.groqKey || AI_KEYS.groq; }
  private get ELEVENLABS_KEY(): string { return this.config.elevenLabsKey || AI_KEYS.elevenlabs; }
  private get ELEVENLABS_VOICE(): string { return this.config.elevenLabsVoice || 'cjVigY5qzO86Huf0OWal'; }
  private get ASSISTANT_NAME(): string { return this.VOICE_NAMES[this.ELEVENLABS_VOICE] || 'Tonny'; }
  private get VOICE_LANG(): string { return this.config.language || 'es-ES'; }
  private get TTS_ENABLED(): boolean { return this.config.enableTTS !== false; }

  async connect(): Promise<void> { this.zone.run(() => this.isConnected$.next(true)); }
  disconnect() { this.stopAudio(); this.stopListening(); this.conversationHistory = []; }
  setDiagramContext(nodes: any[], edges: any[]) { this.currentNodes = nodes; this.currentEdges = edges; }
  captureCanvas(_svg: any) {}
  clearHistory() { this.conversationHistory = []; }

  async sendText(text: string) {
    this.stopAudio();
    const clean = text.trim();
    if (!clean || clean.length < 2 || this.isProcessing) return;

    const now = Date.now();
    if (clean.toLowerCase() === this.lastProcessedText.toLowerCase() && (now - this.lastProcessedTime) < 3000) return;
    this.lastProcessedText = clean; this.lastProcessedTime = now;
    this.isProcessing = true;

    this.zone.run(() => this.messages$.next({ role: 'user', content: clean }));

    try {
      const result = await this.callGroqUnified(clean);
      if (result.reply) {
        this.zone.run(() => this.messages$.next({ role: 'assistant', content: result.reply }));
        this.speak(result.reply);
      }
      if (result.commands.length > 0) this.zone.run(() => this.commands$.next(result.commands));
    } catch (e: any) {
      const msg = e.message?.includes('429') ? 'Espera un momento, estoy procesando mucho.' : 'Error de conexión.';
      this.zone.run(() => this.messages$.next({ role: 'assistant', content: msg }));
      this.speak(msg);
    } finally { this.isProcessing = false; }
  }

  private async callGroqUnified(userText: string): Promise<{ reply: string; commands: DiagramCommand[] }> {
    const nodesCtx = this.currentNodes.map(n => `{id:"${n.id}", type:"${n.type}", label:"${n.label || ''}"}`).join(', ');
    const edgesCtx = this.currentEdges.map(e => `{id:"${e.id}", source:"${e.source}", target:"${e.target}"}`).join(', ');
    const lanesCtx = this.currentNodes.filter(n => n.type === 'swimlane').map(n => `"${n.label}" (id:${n.id})`).join(', ');

    const systemPrompt = `Eres ${this.ASSISTANT_NAME}, el guía experto de este software de diagramas.
TU MISIÓN: Ayudar al usuario a entender el software. Solo respondes preguntas.
INTERFAZ: 
- Izquierda: Panel de Componentes (Carriles, Actividades, Inicio, etc.).
- Derecha: Panel de Propiedades (para nombres, tamaños y formularios).
- Centro: El lienzo donde se dibuja.

REGLAS:
1. Responde SIEMPRE JSON: {"reply": "Texto humano y amigable"}. No incluyas 'commands'.
2. PROHIBIDO hacer cambios en el diagrama. Si el usuario te pide dibujar algo, dile amablemente que use el 'Asistente IA' para modificar el dibujo.
3. Guía siempre indicando la ubicación (Izquierda, Derecha, Arriba).
4. Sé breve (máx 2 frases) y SIEMPRE en español.`;

    this.conversationHistory.push({ role: 'user', content: userText });
    if (this.conversationHistory.length > 8) this.conversationHistory = this.conversationHistory.slice(-4);

    const response = await fetch(this.GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: systemPrompt }, ...this.conversationHistory],
        temperature: 0.1, max_tokens: 400, response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) throw new Error(`Groq ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{"reply":"error"}');
    const reply = (parsed.reply || '').toString().trim();
    if (reply) this.conversationHistory.push({ role: 'assistant', content: reply });

    return { reply, commands: [] };
  }

  private normalizeCommand(raw: any): DiagramCommand {
    const cmd: DiagramCommand = { action: raw.action };
    if (raw.nodeType) cmd.nodeType = raw.nodeType;
    if (raw.label !== undefined) cmd.label = raw.label;
    if (raw.newLabel !== undefined) cmd.newLabel = raw.newLabel;
    if (raw.sourceId !== undefined) cmd.sourceId = raw.sourceId;
    if (raw.targetId !== undefined) cmd.targetId = raw.targetId;
    if (raw.targetLaneName !== undefined) cmd.targetLaneName = raw.targetLaneName;
    if (raw.targetPath !== undefined) cmd.targetPath = raw.targetPath;
    return cmd;
  }

  public async auditDiagram(nodes: any[], edges: any[]): Promise<string> {
    const nodesContext = nodes.map(n => `[${n.type}: "${n.label || ''}"]`).join('\n');
    const systemPrompt = `Audita el diagrama BPMN brevemente en español. Máximo 3 puntos.`;
    try {
      const response = await fetch(this.GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: nodesContext }],
          temperature: 0.2, max_tokens: 300
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sin análisis.';
    } catch (e) { return 'Error auditando.'; }
  }

  async speak(text: string): Promise<void> {
    if (!this.TTS_ENABLED || !text?.trim()) return;
    const speakId = ++this.currentSpeakId;
    const cleanText = text.replace(/[*#_`\[\]()❌⚠️📊]/g, '').trim();
    this.zone.run(() => this.isSpeaking$.next(true));
    if (this.ELEVENLABS_KEY && this.ELEVENLABS_KEY.length > 10) {
      try {
        await this.playWithElevenLabs(cleanText);
        if (speakId === this.currentSpeakId) this.zone.run(() => this.isSpeaking$.next(false));
        return;
      } catch (e) {}
    }
    this.browserSpeak(cleanText, speakId);
  }

  async speakElevenLabs(text: string): Promise<void> { return this.speak(text); }

  private async playWithElevenLabs(text: string): Promise<void> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.ELEVENLABS_VOICE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': this.ELEVENLABS_KEY },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const audio = new Audio(); audio.src = url; this.currentAudio = audio;
      audio.oncanplaythrough = () => audio.play().catch(() => resolve());
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    });
  }

  private browserSpeak(text: string, speakId: number) {
    if (!('speechSynthesis' in window)) { this.zone.run(() => this.isSpeaking$.next(false)); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text); utt.lang = this.VOICE_LANG;
    utt.onend = () => { if (speakId === this.currentSpeakId) this.zone.run(() => this.isSpeaking$.next(false)); };
    window.speechSynthesis.speak(utt);
  }

  stopAudio() {
    this.currentSpeakId++; if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.zone.run(() => this.isSpeaking$.next(false));
  }

  async startVoiceInput(): Promise<void> {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Speech recognition not supported');
    const recognition = new SR(); recognition.lang = this.VOICE_LANG;
    recognition.continuous = false; recognition.interimResults = true;
    this.zone.run(() => this.isListening$.next(true));
    recognition.onresult = (event: any) => {
      let final = ''; let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim) this.zone.run(() => this.transcript$.next(interim));
      if (final) {
        this.stopAudio();
        this.zone.run(() => { this.transcript$.next(final); this.isListening$.next(false); this.sendText(final); });
      }
    };
    recognition.onend = () => this.zone.run(() => this.isListening$.next(false));
    recognition.start(); this.activeRecognition = recognition;
  }

  stopListening() { if (this.activeRecognition) { this.activeRecognition.stop(); this.activeRecognition = null; } this.zone.run(() => this.isListening$.next(false)); }
  toggleContinuousListening(): boolean { this.continuousMode = !this.continuousMode; if (this.continuousMode) this.startVoiceInput().catch(() => {}); else this.stopListening(); return this.continuousMode; }
}
