import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatAssistantService {
  private readonly GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
  private readonly VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

  private conversationHistory: { role: string; content: string }[] = [];

  constructor(private http: HttpClient) {}

  private get config(): any {
    try {
      return JSON.parse(localStorage.getItem('bpmnflow_config') || '{}');
    } catch {
      return {};
    }
  }

  private get API_KEY(): string { return this.config.groqKey || ''; }
  private get ELEVENLABS_KEY(): string { return this.config.elevenLabsKey || ''; }

  private hasValidKey(key: string): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    return trimmed.length > 8 && !/^YOUR_/i.test(trimmed);
  }

  /**
   * Level 1 Support Chat — General platform help
   */
  chat(userMessage: string): Observable<string> {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Keep conversation manageable
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-16);
    }

    const systemPrompt = `Eres el Arquitecto UML y Motor de Estado en modo Copiloto para BPMNFlow.

  Tu rol principal en este chat es soporte técnico de ingeniería, directo y minimalista.

═══ FUNCIONALIDADES DE LA PLATAFORMA ═══
1. **Roles**: Diseñador (crea diagramas) y Funcionario (ejecuta procesos)
2. **Jerarquía**: Proyectos → Diseños → Modelados (diagramas)
3. **Editor Visual**: Canvas SVG con drag & drop, nodos (actividades, decisiones, inicio, fin, forks, señales, notas), conexiones ortogonales
4. **Swimlanes**: Carriles como columnas verticales con título superior y flujo de arriba hacia abajo
5. **Formularios**: Cada actividad puede tener formularios dinámicos (texto, número, fecha, select, archivo)
6. **Colaboración**: Edición en tiempo real multi-usuario vía WebSocket
7. **IA**: Comandos de voz/texto para manipular diagramas (Groq Llama 3.3)
8. **Ejecución**: El Funcionario puede instanciar procesos, llenar formularios, cambiar estados de actividades
9. **Validación**: El sistema valida la integridad del diagrama antes de ejecución
10. **Notificaciones**: Alertas en tiempo real de cambios de estado

═══ CÓMO USAR CADA SECCIÓN ═══
- **Proyectos**: Crear nuevo → nombrar → entrar para ver diseños
- **Diseños**: Crear nuevo → abrir modelador (layout actual: carriles en columnas verticales)
- **Modelador**: Arrastrar nodos del panel izquierdo → conectar con "Flujo de Secuencia" → configurar propiedades en panel derecho
- **IA en Modelador**: Clic en "🤖 IA" o "🎤" y dictar comando, ej: "agrega una actividad Revisión"
- **Funcionario**: Seleccionar proceso → iniciar instancia → llenar formularios → avanzar actividades

═══ REGLAS ═══
- Responde SIEMPRE en español
- Sé técnico, preciso y accionable
- Si detectas cuellos de botella, redundancias o errores lógicos, indícalos de forma proactiva
- Si sugieres una mejora estructural compleja, cierra con esta pregunta exacta: "¿Quieres que aplique estos cambios por ti?"
- No inventes funciones que no existan en la plataforma`;

    if (!this.hasValidKey(this.API_KEY)) {
      const local = this.localAssistantReply(userMessage);
      this.conversationHistory.push({ role: 'assistant', content: local });
      return of(local);
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.API_KEY}`
    });

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory
      ],
      temperature: 0.7,
      max_tokens: 1024
    };

    return this.http.post<any>(this.GROQ_API_URL, body, { headers }).pipe(
      map(response => {
        const content = response.choices[0]?.message?.content || 'No pude generar una respuesta.';
        this.conversationHistory.push({ role: 'assistant', content });
        return content;
      }),
      catchError(err => {
        return of(this.localAssistantReply(userMessage));
      })
    );
  }

  /**
   * Level 3 Advisory Agent — Process optimization analysis
   */
  analyzeProcess(processData: any): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.API_KEY}`
    });

    const systemPrompt = `Eres un Agente Asesor de Nivel 3 para optimización de procesos de negocio. 
Analiza los datos de ejecución de procesos y genera recomendaciones formales.

Tu análisis debe incluir:
1. **Resumen Ejecutivo**: Estado general del proceso
2. **Cuellos de Botella**: Actividades con mayor tiempo de espera o procesamiento
3. **Recomendaciones de Optimización**: Sugerencias específicas y accionables
4. **Métricas Clave**: KPIs relevantes
5. **Nivel de Riesgo**: Bajo/Medio/Alto

Responde en español, de forma profesional y estructurada con formato markdown.`;

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analiza estos datos de ejecución de proceso:\n${JSON.stringify(processData, null, 2)}` }
      ],
      temperature: 0.3,
      max_tokens: 2048
    };

    return this.http.post<any>(this.GROQ_API_URL, body, { headers }).pipe(
      map(response => response.choices[0]?.message?.content || 'Sin análisis disponible.'),
      catchError(() => of('❌ Error al generar análisis.'))
    );
  }

  /**
   * Text-to-Speech via ElevenLabs
   */
  speak(text: string): void {
    if (!text || text.length > 500) {
      // Use browser TTS for long texts or as fallback
      this.browserSpeak(text);
      return;
    }

    if (!this.hasValidKey(this.ELEVENLABS_KEY)) {
      this.browserSpeak(text);
      return;
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'xi-api-key': this.ELEVENLABS_KEY
    });

    const body = {
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3
      }
    };

    this.http.post(`${this.ELEVENLABS_URL}/${this.VOICE_ID}`, body, {
      headers,
      responseType: 'blob'
    }).subscribe({
      next: (audioBlob) => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(() => this.browserSpeak(text)); // Fallback
      },
      error: () => this.browserSpeak(text) // Fallback to browser TTS
    });
  }

  /**
   * Browser Speech Synthesis fallback
   */
  private browserSpeak(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  private localAssistantReply(userMessage: string): string {
    const q = (userMessage || '').toLowerCase();
    if (/hola|buenas|hey|hi/.test(q)) {
      return 'Hola. Estoy aquí para ayudarte con BPMNFlow. Puedes pedirme guía, revisar lógica del flujo o proponer cambios.';
    }
    if (/suger|idea|mejora/.test(q)) {
      return 'Excelente, comparte tu sugerencia y la evaluamos juntas con impacto técnico y pasos concretos.';
    }
    if (/cómo|como|para qué|que es|qué es|ayuda/.test(q)) {
      return 'Te ayudo rápido: dime qué parte del modelador estás usando y te doy pasos concretos y buenas prácticas.';
    }
    return 'Entendido. Puedo responder dudas, detectar problemas de flujo y ayudarte a transformar ideas en cambios concretos del diagrama.';
  }
}
