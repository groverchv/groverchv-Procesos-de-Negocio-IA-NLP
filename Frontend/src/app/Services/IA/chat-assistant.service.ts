import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatAssistantService {
  private readonly GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly API_KEY = 'YOUR_GROQ_API_KEY';
  private readonly ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
  private readonly ELEVENLABS_KEY = 'YOUR_ELEVENLABS_API_KEY';
  private readonly VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

  private conversationHistory: { role: string; content: string }[] = [];

  constructor(private http: HttpClient) {}

  /**
   * Level 1 Support Chat — General platform help
   */
  chat(userMessage: string): Observable<string> {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Keep conversation manageable
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-16);
    }

    const systemPrompt = `Eres un asistente virtual experto de la plataforma BPMNFlow — un sistema empresarial de modelado y ejecución de procesos de negocio.

Tu rol es brindar soporte de Nivel 1: ayudar a los usuarios a entender y usar la plataforma.

═══ FUNCIONALIDADES DE LA PLATAFORMA ═══
1. **Roles**: Diseñador (crea diagramas) y Funcionario (ejecuta procesos)
2. **Jerarquía**: Proyectos → Diseños → Modelados (diagramas)
3. **Editor Visual**: Canvas SVG con drag & drop, nodos (actividades, decisiones, inicio, fin, forks, señales, notas), conexiones ortogonales
4. **Swimlanes**: Carriles horizontales/verticales para organizar actividades por responsable
5. **Formularios**: Cada actividad puede tener formularios dinámicos (texto, número, fecha, select, archivo)
6. **Colaboración**: Edición en tiempo real multi-usuario vía WebSocket
7. **IA**: Comandos de voz/texto para manipular diagramas (Groq Llama 3.3)
8. **Ejecución**: El Funcionario puede instanciar procesos, llenar formularios, cambiar estados de actividades
9. **Validación**: El sistema valida la integridad del diagrama antes de ejecución
10. **Notificaciones**: Alertas en tiempo real de cambios de estado

═══ CÓMO USAR CADA SECCIÓN ═══
- **Proyectos**: Crear nuevo → nombrar → entrar para ver diseños
- **Diseños**: Crear nuevo → elegir layout (horizontal/vertical) → abrir modelador
- **Modelador**: Arrastrar nodos del panel izquierdo → conectar con "Flujo de Secuencia" → configurar propiedades en panel derecho
- **IA en Modelador**: Clic en "🤖 IA" o "🎤" y dictar comando, ej: "agrega una actividad Revisión"
- **Funcionario**: Seleccionar proceso → iniciar instancia → llenar formularios → avanzar actividades

═══ REGLAS ═══
- Responde SIEMPRE en español
- Sé conciso pero amable
- Si el usuario pregunta algo técnico avanzado, sugiere contactar soporte Level 3
- Si no sabes algo, sé honesto y sugiere explorar la documentación
- Puedes usar emojis para ser más amigable`;

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
        console.error('[ChatAssistant] Error:', err);
        return of('❌ Error al conectar con el asistente. Intenta de nuevo.');
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
}
