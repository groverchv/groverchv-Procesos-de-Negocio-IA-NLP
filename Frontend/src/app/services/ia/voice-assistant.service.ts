import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, BehaviorSubject, Observable, of } from 'rxjs';
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
    const clean = text.trim();
    if (!clean || clean.length < 2 || this.isProcessing) return;

    this.isProcessing = true;
    this.conversationHistory.push({ role: 'user', content: clean });
    
    // Mantener un historial de tamaño manejable
    if (this.conversationHistory.length > 8) {
      this.conversationHistory = this.conversationHistory.slice(-8);
    }
    
    this.zone.run(() => this.messages$.next({ role: 'user', content: clean }));

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      messages: this.conversationHistory
    };

    try {
      const response = await this.http.post<any>(this.BACKEND_CHAT_URL, body, { headers }).toPromise();
      const reply = response.reply;
      
      this.conversationHistory.push({ role: 'assistant', content: reply });
      this.zone.run(() => this.messages$.next({ role: 'assistant', content: reply }));
      
      this.speak(reply);
    } catch (e: any) {
      const msg = 'Error conectando con el Motor IA.';
      this.zone.run(() => this.messages$.next({ role: 'assistant', content: msg }));
      this.speak(msg);
    } finally { 
      this.isProcessing = false; 
    }
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
    
    this.zone.run(() => this.isSpeaking$.next(true));
    
    if (this.TTS_ENABLED) {
      try {
        await this.playBackendTTS(cleanText);
        if (speakId === this.currentSpeakId) {
          this.zone.run(() => this.isSpeaking$.next(false));
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

    const body = { text: text };

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
      this.zone.run(() => this.isSpeaking$.next(false)); 
      return; 
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text); 
    utt.lang = this.VOICE_LANG;
    utt.onend = () => { 
      if (speakId === this.currentSpeakId) this.zone.run(() => this.isSpeaking$.next(false)); 
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
    this.zone.run(() => this.isSpeaking$.next(false));
  }

  async startVoiceInput(): Promise<void> {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Speech recognition not supported');
    const recognition = new SR(); 
    recognition.lang = this.VOICE_LANG;
    recognition.continuous = false; 
    recognition.interimResults = true;
    
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
        this.zone.run(() => { 
          this.transcript$.next(final); 
          this.isListening$.next(false); 
          this.sendText(final); 
        });
      }
    };
    recognition.onend = () => this.zone.run(() => this.isListening$.next(false));
    recognition.start(); 
    this.activeRecognition = recognition;
  }

  stopListening() { 
    if (this.activeRecognition) { 
      this.activeRecognition.stop(); 
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
