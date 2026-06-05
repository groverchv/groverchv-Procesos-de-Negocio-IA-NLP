import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DiagramCommand } from './ia.service';
import { API_GLOBAL } from '../api.global';

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceAssistantService {
  private readonly BACKEND_CHAT_URL = API_GLOBAL.ia.chatAsesor;
  private readonly BACKEND_TTS_URL = API_GLOBAL.ia.generarVoz;

  public messages$ = new Subject<AssistantMessage>();
  public isConnected$ = new BehaviorSubject<boolean>(true);
  public isSpeaking$ = new BehaviorSubject<boolean>(false);
  public isListening$ = new BehaviorSubject<boolean>(false);
  public transcript$ = new Subject<string>();
  public commands$ = new Subject<DiagramCommand[]>();

  private conversationHistory: AssistantMessage[] = [];
  private currentNodes: any[] = [];
  private currentEdges: any[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private activeRecognition: any = null;
  private continuousMode = false;
  private isProcessing = false;
  private currentSpeakId = 0;
  private activeChatSubscription: Subscription | null = null;
  private userExplicitStop = false;
  private lastSpeakingTime = 0;

  private setSpeaking(val: boolean) {
    this.zone.run(() => {
      this.isSpeaking$.next(val);
      if (val) {
        this.lastSpeakingTime = Date.now() + 99999999;
      } else {
        this.lastSpeakingTime = Date.now();
      }
    });
  }
  
  constructor(private http: HttpClient, private zone: NgZone) {}

  private get config(): any {
    try { return JSON.parse(localStorage.getItem('bpmnflow_config') || '{}'); }
    catch { return {}; }
  }

  private get VOICE_LANG(): string { return this.config.language || 'es-ES'; }
  private get TTS_ENABLED(): boolean { return this.config.enableTTS !== false; }

  async connect(): Promise<void> { this.zone.run(() => this.isConnected$.next(true)); }
  
  disconnect() { 
    this.stopAudio(); 
    this.stopListening(); 
    this.conversationHistory = []; 
  }

  setDiagramContext(nodes: any[], edges: any[]) { 
    this.currentNodes = nodes; 
    this.currentEdges = edges; 
  }
  
  captureCanvas(_svg: any) {}
  
  clearHistory() { 
    this.conversationHistory = []; 
  }

  async sendText(text: string) {
    this.stopAudio();
    
    // Cancel any in-flight chat request to allow instant interruption
    if (this.activeChatSubscription) {
      this.activeChatSubscription.unsubscribe();
      this.activeChatSubscription = null;
    }
    
    const clean = text.trim();
    if (!clean || clean.length < 2) return;

    this.isProcessing = true;
    this.conversationHistory.push({ role: 'user', content: clean });
    
    if (this.conversationHistory.length > 8) {
      this.conversationHistory = this.conversationHistory.slice(-8);
    }
    
    this.zone.run(() => this.messages$.next({ role: 'user', content: clean }));

    const nodesContext = JSON.stringify((this.currentNodes || []).map(n => ({
      id: n.id, type: n.type, label: n.label, x: Math.round(n.x), y: Math.round(n.y),
      width: n.width, height: n.height, fontSize: n.fontSize
    })));

    const edgesContext = JSON.stringify((this.currentEdges || []).map(e => ({
      id: e.id, source: e.source, target: e.target, label: e.label,
      style: e.style, color: e.color
    })));

    const lanes = (this.currentNodes || []).filter(n => n.type === 'swimlane');
    const lanesContext = lanes.map(l => `"${l.label}" (id=${l.id}, x=${Math.round(l.x)}, w=${l.width}, h=${l.height})`).join(', ');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      messages: this.conversationHistory,
      nodes_context: nodesContext,
      edges_context: edgesContext,
      lanes_context: lanesContext
    };

    this.activeChatSubscription = this.http.post<any>(this.BACKEND_CHAT_URL, body, { headers }).subscribe({
      next: (response) => {
        const reply = response.reply;
        this.conversationHistory.push({ role: 'assistant', content: reply });
        this.zone.run(() => this.messages$.next({ role: 'assistant', content: reply }));
        this.speak(reply);
        this.isProcessing = false;
        this.activeChatSubscription = null;
      },
      error: (e) => {
        if (e.name === 'AbortError' || e.status === 0) {
          // Request was cancelled by the user making another request
          return;
        }
        const msg = 'Error conectando con el Motor IA.';
        this.zone.run(() => this.messages$.next({ role: 'assistant', content: msg }));
        this.speak(msg);
        this.isProcessing = false;
        this.activeChatSubscription = null;
      }
    });
  }

  async auditDiagram(nodes: any[], edges: any[]): Promise<string> {
    const nodesContext = nodes.map(n => `[${n.type}: "${n.label || ''}"]`).join(', ');
    const auditPrompt = `Audita el diagrama BPMN brevemente en español. Máximo 3 puntos. Nodos actuales: ${nodesContext}`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      messages: [{ role: 'user', content: auditPrompt }]
    };

    try {
      const response = await this.http.post<any>(this.BACKEND_CHAT_URL, body, { headers }).toPromise();
      return response.reply;
    } catch (e) {
      return 'Error auditando.';
    }
  }

  // Soporte legado para modeler.ts
  async speakElevenLabs(text: string): Promise<void> { 
    return this.speak(text); 
  }

  async speak(text: string): Promise<void> {
    if (!this.TTS_ENABLED || !text?.trim()) return;
    
    const speakId = ++this.currentSpeakId;
    const cleanText = text.replace(/[*#_\`\\[\\]()❌⚠️📊]/g, '').trim();
    
    this.setSpeaking(true);
    
    if (this.TTS_ENABLED) {
      try {
        await this.playBackendTTS(cleanText);
        if (speakId === this.currentSpeakId) {
          this.setSpeaking(false);
        }
        return;
      } catch (e) {
        console.error("Fallo TTS backend, usando fallback", e);
      }
    }
    
    this.browserSpeak(cleanText, speakId);
  }

  private async playBackendTTS(text: string): Promise<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const voiceId = this.config.elevenLabsVoice || 'cjVigY5qzO86Huf0OWal';
    const body = { 
      text: text,
      voice_id: voiceId
    };

    return new Promise((resolve, reject) => {
      this.http.post(this.BACKEND_TTS_URL, body, {
        headers,
        responseType: 'blob'
      }).subscribe({
        next: (audioBlob) => {
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(); 
          audio.src = url; 
          this.currentAudio = audio;
          audio.oncanplaythrough = () => audio.play().catch(() => { resolve(); });
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        },
        error: (err) => { reject(err); }
      });
    });
  }

  private browserSpeak(text: string, speakId: number) {
    if (!('speechSynthesis' in window)) { 
      this.setSpeaking(false); 
      return; 
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text); 
    utt.lang = this.VOICE_LANG;
    utt.onend = () => { 
      if (speakId === this.currentSpeakId) this.setSpeaking(false); 
    };
    window.speechSynthesis.speak(utt);
  }

  stopAudio() {
    this.currentSpeakId++; 
    if (this.currentAudio) { 
      this.currentAudio.pause(); 
      this.currentAudio = null; 
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.setSpeaking(false);
  }

  async startVoiceInput(): Promise<void> {
    this.stopAudio();
    this.userExplicitStop = false;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Speech recognition not supported');
    
    if (this.activeRecognition) {
      try { this.activeRecognition.stop(); } catch {}
    }

    const recognition = new SR(); 
    recognition.lang = this.VOICE_LANG;
    recognition.continuous = true; 
    recognition.interimResults = true;
    
    this.zone.run(() => this.isListening$.next(true));
    
    let lastProcessedIndex = -1;

    recognition.onresult = (event: any) => {
      const isSpeaking = this.isSpeaking$.value;
      const cooldownActive = (Date.now() - this.lastSpeakingTime) < 1800; // 1.8 seconds cooldown to discard late echo transcripts
      
      if (isSpeaking || cooldownActive) {
        return;
      }
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          if (i > lastProcessedIndex) {
            lastProcessedIndex = i;
            const text = result[0].transcript.trim();
            if (text.length >= 2) {
              // Stop audio immediately as user is starting a new command/question
              this.stopAudio();
              this.zone.run(() => { 
                this.transcript$.next(text); 
                this.sendText(text); 
              });
            }
          }
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        this.zone.run(() => this.transcript$.next(interim));
      }
    };

    recognition.onend = () => {
      if (!this.userExplicitStop) {
        // Automatically restart to keep microphone open
        try {
          recognition.start();
        } catch (e) {
          console.warn('Failed to restart speech recognition:', e);
        }
      } else {
        this.zone.run(() => this.isListening$.next(false));
      }
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
      // Restart on non-fatal errors if not explicitly stopped
      if (err.error !== 'aborted' && !this.userExplicitStop) {
        setTimeout(() => {
          if (!this.userExplicitStop) {
            try { recognition.start(); } catch {}
          }
        }, 500);
      }
    };

    recognition.start(); 
    this.activeRecognition = recognition;
  }

  stopListening() { 
    this.userExplicitStop = true;
    if (this.activeRecognition) { 
      try { this.activeRecognition.stop(); } catch {}
      this.activeRecognition = null; 
    } 
    this.zone.run(() => this.isListening$.next(false)); 
  }
  
  toggleContinuousListening(): boolean { 
    this.continuousMode = !this.continuousMode; 
    if (this.continuousMode) this.startVoiceInput().catch(() => {}); 
    else this.stopListening(); 
    return this.continuousMode; 
  }
}
