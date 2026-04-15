import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { NodeData, EdgeData } from '../types';

export interface DiagramCommand {
  action:
    | 'add_node' | 'delete_node' | 'update_node'
    | 'add_edge' | 'delete_edge' | 'update_edge'
    | 'move_node_to_lane'
    | 'reconnect_edge'
    | 'reorder_lanes'
    | 'batch_update_style'
    | 'auto_layout'
    | 'clear_all';
  // Node fields
  nodeType?: string;
  nodeId?: string;
  label?: string;
  newLabel?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;

  policy?: string;
  responsible?: string;
  // Edge fields
  sourceId?: string;
  targetId?: string;
  edgeId?: string;
  edgeStyle?: string;
  edgeColor?: string;
  edgeLabel?: string;
  // Move to lane
  targetLaneName?: string;
  // Reconnect edge
  newSourceId?: string;
  newTargetId?: string;
  // Batch style
  targetType?: string;
  // Reorder lanes
  laneOrder?: string[];
}

export interface IaResponse {
  commands: DiagramCommand[];
  explanation: string;
  umlValidation?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IaService {
  private readonly GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly API_KEY = 'YOUR_GROQ_API_KEY';

  constructor(private http: HttpClient) {}

  processCommand(userMessage: string, currentNodes: NodeData[], currentEdges: EdgeData[]): Observable<IaResponse> {

    const nodesContext = JSON.stringify(currentNodes.map(n => ({
      id: n.id, type: n.type, label: n.label, x: Math.round(n.x), y: Math.round(n.y),
      width: n.width, height: n.height, fontSize: n.fontSize
    })));

    const edgesContext = JSON.stringify(currentEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, label: e.label,
      style: e.style, color: e.color
    })));

    const lanes = currentNodes.filter(n => n.type === 'swimlane');
    const lanesContext = lanes.map(l => `"${l.label}" (id=${l.id}, y=${Math.round(l.y)}, h=${l.height})`).join(', ');

    const systemPrompt = `Eres un Arquitecto de Software Senior y Experto en UML 2.5 con especialización en Diagramas de Actividad y BPMN 2.0.

═══ ESTADO ACTUAL DEL DIAGRAMA ═══
Nodos: ${nodesContext}
Conexiones: ${edgesContext}
Carriles (Swimlanes): [${lanesContext}]

═══ TIPOS DE NODOS DISPONIBLES ═══
- activity: Tarea / Actividad (rectángulo redondeado)
- subprocess: Subproceso (rectángulo con ícono +)
- decision: Compuerta Exclusiva XOR (rombo)
- parallel: Compuerta Paralela AND (rombo con +)
- start: Nodo Inicial (círculo sólido)
- end: Nodo Final (círculo con borde)
- activity_final: Actividad Nodo Final (círculo tipo "bullseye")
- flow_final: Nodo Final del Flujo (círculo con X)
- fork: Tenedor (barra vertical fina para ramificar flujos paralelos)
- join: Unión / Merge (barra vertical fina para unir flujos paralelos)
- signal_send: Envío de Señales (pentágono/flecha hacia la derecha)
- signal_receive: Recepción de señal (pentágono con muesca a la izquierda)
- note: Nota o Comentario (rectángulo con esquina doblada)
- swimlane: Carril / Calle (contenedor horizontal)
- datastore: Almacén de Datos (cilindro)

═══ ACCIONES DISPONIBLES ═══

1. add_node — Agregar nodo
   Campos: nodeType, label, x, y, width, height, fontSize

2. delete_node — Eliminar nodo (también elimina sus conexiones automáticamente)
   Campos: nodeId o label (para buscar por nombre)

3. update_node — Modificar propiedades de un nodo existente
   Campos: nodeId o label (para buscar), newLabel, x, y, width, height, fontSize, policy

4. add_edge — Agregar flujo/conexión
   Campos: sourceId (id o label del origen), targetId (id o label del destino), edgeLabel (guarda o texto), edgeStyle (solid|dashed), edgeColor

5. delete_edge — Eliminar flujo
   Campos: edgeId, o sourceId+targetId para buscar por extremos

6. update_edge — Modificar un flujo existente
   Campos: edgeId (o sourceId+targetId), edgeLabel, edgeStyle, edgeColor

7. move_node_to_lane — Mover una actividad a otro carril, preservando conexiones
   Campos: nodeId o label, targetLaneName (nombre del carril destino)

8. reconnect_edge — Reconectar un flujo existente a nuevos extremos
   Campos: edgeId (o sourceId+targetId actual), newSourceId, newTargetId

9. reorder_lanes — Reorganizar el orden vertical de los carriles
   Campos: laneOrder (array de nombres de carriles en el orden deseado)

10. batch_update_style — Cambiar estilo en lote a todos los nodos de un tipo
    Campos: targetType (tipo de nodo), fontSize, width, height

11. auto_layout — Reorganizar posiciones automáticamente para mejor legibilidad
    (sin campos adicionales, el frontend optimiza posiciones)

12. clear_all — Vaciar el diagrama completo

═══ REGLAS UML 2.5 (OBLIGATORIAS) ═══
- Máximo 1 nodo de inicio (start) por diagrama
- Las compuertas de decisión (decision/XOR) DEBEN tener etiquetas/guardas en cada flujo saliente (ej: "[Sí]", "[No]", "[Aprobado]", "[Rechazado]")
- No pueden existir nodos huérfanos (sin conexión) excepto al momento de creación
- Los flujos de datos (dashed) se diferencian de los flujos de control (solid)
- Las bifurcaciones paralelas (parallel/fork) deben tener igual número de entradas que salidas, o 1 entrada y N salidas (fork) / N entradas y 1 salida (join)
- Si una instrucción viola UML, adviértelo en "umlValidation" y ofrece la solución correcta

═══ POSICIONAMIENTO INTELIGENTE ═══
Al agregar nodos, calcula posiciones inteligentes:
- Si hay carriles, coloca el nodo DENTRO del carril apropiado (entre lane.y y lane.y + lane.height)
- Mantén separación horizontal de ~200px entre nodos consecutivos
- Los nodos de inicio van a la izquierda (x~160), los de fin a la derecha
- Las decisiones se centran entre sus predecesores y sucesores

═══ FORMATO DE RESPUESTA (JSON ESTRICTO) ═══
{
  "commands": [{ ... }],
  "explanation": "Descripción en español de las modificaciones realizadas",
  "umlValidation": "Advertencias de validación UML, o null si todo correcto"
}

IMPORTANTE: Responde SIEMPRE y ÚNICAMENTE con el JSON. Sin texto adicional, sin markdown, sin backticks.

═══ EJEMPLOS COMPLEJOS ═══

Comando: "Mueve la actividad Validación de la calle Usuario a la calle Sistema y reconecta el flujo de error al inicio"
→ commands: [
  { "action": "move_node_to_lane", "label": "Validación", "targetLaneName": "Sistema" },
  { "action": "reconnect_edge", "sourceId": "Validación", "targetId": "Error", "newTargetId": "Inicio" }
]

Comando: "Aumenta el tamaño de letra de todas las decisiones y añade una calle Base de Datos"
→ commands: [
  { "action": "batch_update_style", "targetType": "decision", "fontSize": 16 },
  { "action": "add_node", "nodeType": "swimlane", "label": "Base de Datos", "x": 0, "y": 600, "width": 1200, "height": 200 }
]

Comando: "Agrega una decisión '¿Aprobado?' después de Revisión con flujos Sí hacia Procesamiento y No hacia Rechazo"
→ commands: [
  { "action": "add_node", "nodeType": "decision", "label": "¿Aprobado?", "x": 400, "y": 200 },
  { "action": "add_edge", "sourceId": "Revisión", "targetId": "¿Aprobado?", "edgeStyle": "solid" },
  { "action": "add_edge", "sourceId": "¿Aprobado?", "targetId": "Procesamiento", "edgeLabel": "[Sí]", "edgeStyle": "solid" },
  { "action": "add_edge", "sourceId": "¿Aprobado?", "targetId": "Rechazo", "edgeLabel": "[No]", "edgeStyle": "solid" }
]`;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.API_KEY}`
    });

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    };

    return this.http.post<any>(this.GROQ_API_URL, body, { headers }).pipe(
      map(response => {
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');
        const parsed = JSON.parse(content);
        return parsed as IaResponse;
      }),
      catchError(err => {
        console.error('[IA] Error calling Groq API:', err);
        return throwError(() => new Error('Error communicating with AI: ' + (err.message || 'Unknown error')));
      })
    );
  }
}
