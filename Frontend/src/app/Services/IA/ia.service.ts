import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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
    | 'clear_all'
    | 'group_nodes' | 'ungroup_nodes' | 'copy_paste_nodes' | 'apply_template' | 'select_nodes'
    | 'focus_node' | 'zoom_canvas' | 'zoom_fit' | 'pan_canvas' | 'expand_subprocess' | 'collapse_subprocess'
    | 'analyze_bottlenecks' | 'simulate_load' | 'clear_lane';
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
  edgeThickness?: number;
  edgeLabel?: string;
  edgeLabelPosition?: { x: number; y: number };
  waypoints?: { x: number; y: number }[];
  // Move to lane
  targetLaneName?: string;
  // Reconnect edge
  newSourceId?: string;
  newTargetId?: string;
  // Batch style
  targetType?: string;
  // Reorder lanes
  laneOrder?: string[];
  // Predictive forms
  forms?: any[];
  // Macro-operations
  nodeIds?: string[];
  templateName?: string;
  offsetX?: number;
  offsetY?: number;
  // Navigation & Analytics
  zoomLevel?: number;
  panX?: number;
  panY?: number;
}

export interface IaResponse {
  commands: DiagramCommand[];
  explanation: string;
  user_feedback?: string;
  umlValidation?: string;
}

interface StrictCrudOperation {
  action?: string;
  element_type?: string;
  target_id?: string | null;
  payload?: {
    x?: number;
    y?: number;
    properties?: Record<string, any>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class IaService {
  private readonly GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private get API_KEY(): string {
    try {
      const config = JSON.parse(localStorage.getItem('bpmnflow_config') || '{}');
      return config.groqKey || '';
    } catch { return ''; }
  }
  private get hasValidApiKey(): boolean {
    const key = this.API_KEY.trim();
    return key.length > 8 && !/^YOUR_/i.test(key);
  }
  private static readonly CONFIRM_WORDS = /\b(si|sí|dale|procesa|hazlo|aplicar|aplícalo|ejecuta)\b/i;
  private static readonly IMPROVEMENT_WORDS = /\b(mejorar|mejora|optimiza|optimizar|ayudame a mejorar|ayúdame a mejorar)\b/i;
  private static readonly INTERRUPT_WORDS = /\b(alto|espera|cancela|cancelar|deten|detener)\b/i;

  constructor(private http: HttpClient) {}

  processCommand(userMessage: string, currentNodes: NodeData[], currentEdges: EdgeData[]): Observable<IaResponse> {

    // If no valid API key, use local fallback directly (no 401 errors)
    if (!this.hasValidApiKey) {
      const fallback = this.localFallback(userMessage, currentNodes);
      if (fallback.commands.length > 0) {
        return of(fallback);
      }
      return of({
        commands: [],
        explanation: fallback.explanation || 'No logré entender el comando localmente. Modifica tu frase o usa tu API Key en Configuración para activar comprensión en la nube.',
        umlValidation: undefined
      });
    }

    const nodesContext = JSON.stringify(currentNodes.map(n => ({
      id: n.id, type: n.type, label: n.label, x: Math.round(n.x), y: Math.round(n.y),
      width: n.width, height: n.height, fontSize: n.fontSize
    })));

    const edgesContext = JSON.stringify(currentEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, label: e.label,
      style: e.style, color: e.color
    })));

    const lanes = currentNodes.filter(n => n.type === 'swimlane');
    const lanesContext = lanes.map(l => `"${l.label}" (id=${l.id}, x=${Math.round(l.x)}, w=${l.width}, h=${l.height})`).join(', ');
    const systemPrompt = `[ROL Y OBJETIVO PRINCIPAL]
Eres el Arquitecto de Software y Motor de Orquestación de Diagramas (UML/BPMN). Tu objetivo principal es democratizar la creación de diagramas: debes interpretar el lenguaje natural, coloquial y no técnico de usuarios principiantes, y traducir sus deseos en comandos estructurados que el sistema pueda renderizar. Sé extremadamente flexible; tu trabajo es hacer que las cosas funcionen en el lienzo, sin importar cómo el usuario lo pida.

[REGLAS DE COMPORTAMIENTO Y LENGUAJE (NLP)]
1. Adaptabilidad para personas técnicas: Procesar comandos con jerga especializada de ingeniería y arquitectura de software (ej. "Instancia un Gateway XOR y conéctalo a un endpoint").
2. Adaptabilidad para personas no técnicas: Interpretar lenguaje coloquial o de negocio de usuarios que no conocen el tema (ej. "Pon una decisión aquí y si dicen que no, mándalo de vuelta").
3. Vocabulario y verbos extendidos: Reconocer un diccionario masivo de sinónimos para que múltiples palabras (crear, hacer, generar, dibujar, poner) disparen la acción correcta sin fallar.
4. Procesamiento Narrativo Integral: Capacidad de ejecutar múltiples acciones lógicas a partir de un solo comando largo (ej. "Crea una zona de ventas, mete ahí el cobro y conéctalo al fin").

[ESTÁNDARES Y NORMATIVAS OBLIGATORIAS]
- Estándar de Calidad (Los 7): La IA debe validar que todo lo generado cumpla con los 7 atributos de calidad de la norma ISO (Funcionalidad, Fiabilidad, Usabilidad, Eficiencia, Mantenibilidad, Portabilidad y Seguridad).
- Estándar de Codificación (camelCase): Absolutamente todo código generado, nombre de variable, propiedad y payload JSON emitido por la IA debe estar formateado estrictamente en camelCase (ej. crearNuevaCalle, moverComponente).

[CONCIENCIA DEL ECOSISTEMA]
Eres el motor de acción estructural. Conoce tus límites dentro de la plataforma técnica:
- Asistente de Chat: Se encarga de enseñar y responder dudas teóricas sobre BPMN.
- Coach Virtual (Gemini Live): Se encarga del análisis en tiempo real por voz, detectando bucles y dando feedback hablado.
Si el usuario requiere teoría pura o análisis de voz, ignora la acción en el lienzo y responde indicando que pueden consultar al Chat o al Coach Virtual. Tú concéntrate en manipular el lienzo.

═══ ESTADO ACTUAL DEL DIAGRAMA ═══
Nodos: \${nodesContext}
Conexiones: \${edgesContext}
Carriles (Swimlanes): [\${lanesContext}]

═══ TIPOS DE NODOS DISPONIBLES ═══
- activity: Tarea / Actividad (rectángulo redondeado) — alias: cuadrito, paso, caja, bloque, tarea
- subprocess: Subproceso (rectángulo con ícono +)
- decision: Compuerta Exclusiva XOR (rombo) — alias: pregunta, condición, filtro, rombo, si/no
- parallel: Compuerta Paralela AND (rombo con +)
- start: Nodo Inicial (círculo sólido) — alias: inicio, bolita, comienzo
- end: Nodo Final (círculo con borde) — alias: fin, final, salida
- activity_final: Actividad Nodo Final (círculo tipo "bullseye")
- flow_final: Nodo Final del Flujo (círculo con X)
- fork: Tenedor (barra vertical fina para ramificar flujos paralelos)
- join: Unión / Merge (barra vertical fina para unir flujos paralelos)
- signal_send: Envío de Señales (pentágono/flecha hacia la derecha)
- signal_receive: Recepción de señal (pentágono con muesca a la izquierda)
- note: Nota o Comentario (rectángulo con esquina doblada) — alias: nota, comentario, post-it
- swimlane: Carril / Calle (columna vertical, título arriba y cuerpo hacia abajo) — alias: zona, área, calle, carril, sección
- datastore: Almacén de Datos (cilindro) — alias: base de datos, almacén, disco

═══ ACCIONES DISPONIBLES (mapea a estos 17 comandos) ═══

1. add_node — Crear: Instanciar elementos nuevos en el lienzo a partir de texto o voz.
   Campos: nodeType, label, x, y, width, height, fontSize

2. delete_node — Eliminar: Borrar el componente del diagrama de forma segura.
   Campos: nodeId o label (para buscar por nombre)

3. update_node — Modificar: Alterar propiedades, cambiar tamaño de texto, agrandar/reducir componentes, cambiar color.
   Campos: nodeId o label (para buscar), newLabel, x, y, width, height, fontSize, policy, nodeColor

4. add_edge — Crear relación: Trazar una nueva línea conectora entre dos elementos.
   Campos: sourceId, targetId, edgeLabel (guarda o texto), edgeStyle (solid|dashed), edgeColor
   Lenguaje natural aceptado: conectar, relacionar, unir, vincular, enlazar, asociar, ligar, tirar línea, juntar, pasar a, mandar a

5. delete_edge — Eliminar relación: Borrar la línea de conexión.
   Campos: edgeId, o sourceId+targetId para buscar por extremos

6. update_edge — Modificar relación: Cambiar grosor, poner texto (ej. [Sí]/[No]), mover texto, cambiar color, mover (waypoints).
   Campos: edgeId (o sourceId+targetId), edgeLabel, edgeStyle, edgeColor, edgeThickness, edgeLabelPosition ({x,y}), waypoints ([{x,y}])

7. move_node_to_lane — Mover componentes a otras calles: Reasignar visual y lógicamente una tarea a un carril diferente.
   Campos: nodeId o label, targetLaneName (nombre del carril destino)

8. reconnect_edge — Mover relación entre actividades: Desconectar de un elemento inicial/final y conectarlo a uno distinto.
   Campos: edgeId (o sourceId+targetId actual), newSourceId, newTargetId

9. reorder_lanes — Mover las calles en distintas posiciones: Reordenar el orden de los carriles.
   Campos: laneOrder (array de nombres de carriles en el orden deseado)

10. batch_update_style — Cambiar estilo en lote a todos los nodos de un tipo.
    Campos: targetType (tipo de nodo), fontSize, width, height

11. auto_layout — Auto-Layout (Posicionamiento Inteligente): Calcular automáticamente las coordenadas para organizar los nodos manteniendo un espaciado simétrico.
    (sin campos adicionales, el frontend optimiza posiciones)

12. clear_all — Vaciar el diagrama completo

13. select_nodes — Selección Múltiple: Seleccionar varios componentes al mismo tiempo.
    Campos: nodeIds (array de strings con IDs o labels)

14. group_nodes — Agrupar: Envolver un conjunto de actividades dentro de un contenedor o Subproceso.
    Campos: nodeIds (array de IDs o labels), label (nombre del grupo/subproceso)

15. ungroup_nodes — Desagrupar: Sacar actividades de un contenedor.
    Campos: nodeId o label (del grupo a deshacer)

16. copy_paste_nodes — Copiar y Pegar: Duplicar fragmentos enteros del flujo.
    Campos: nodeIds (array), offsetX, offsetY

17. apply_template — Aplicación de Plantillas: Insertar flujos prefabricados completos.
    Campos: templateName

18. focus_node — Búsqueda y Foco (Find & Zoom): Encontrar un nodo, centrar la cámara y resaltarlo.
    Campos: nodeId o label

19. zoom_canvas — Control de Zoom: Acercar o alejar el lienzo.
    Campos: zoomLevel (número para escala)

20. zoom_fit — Acomodar diagrama: Ajustar la vista para que todo el diagrama entre en pantalla (acomodar / encajar todo).

21. pan_canvas — Control de Paneo: Desplazar la vista del lienzo.
    Campos: panX, panY

21. expand_subprocess / collapse_subprocess — Nivel de Detalle: Expandir o contraer subprocesos (Drill-down).
    Campos: nodeId o label

22. analyze_bottlenecks / simulate_load — Auditoría Analítica: Analizar flujos para detectar cuellos de botella o simular carga.

23. clear_lane — Vaciar carril: Elimina todos los componentes y tareas que están dentro de un carril (calle) específico, dejando el carril vacío pero sin borrar el carril en sí. Úsalo cuando el usuario pida "borrar los componentes de la calle X".
    Campos: targetLaneName (nombre del carril a vaciar)

═══ INTELIGENCIA, MACRO-OPERACIONES Y ENTRENADOR ═══
- Generación Predictiva de Formularios: Crear dinámicamente los campos necesarios basándose en el nombre de la actividad.
- Corrección UML y Errores Lógicos: Prevenir errores estructurales, alertar sobre nodos huérfanos, bucles infinitos y caminos sin salida (usa umlValidation).
- Sugerir mejoras: Actuar de forma proactiva proponiendo optimizaciones estructurales si el flujo es muy largo.
- Asistente Virtual: Si el usuario pide ayuda de cómo usar el software, guía paso a paso. Tienes memoria de contexto multimodal.
- Sincronización en Tiempo Real: Tus cambios se sincronizarán por WebSockets a todos los usuarios; asume un rol de árbitro si hay ambigüedad.

═══ REGLA DE CONFIRMACIÓN ═══
- Si el usuario pide optimización global o mejora estructural compleja, NO mutar todavía.
- Responde con commands: [] y en user_feedback pregunta: "¿Quieres que aplique estos cambios por ti?"
- Solo ejecutar cambios masivos cuando el usuario confirme (sí, procesa, hazlo, dale).

═══ FORMATO DE RESPUESTA (JSON ESTRICTO) ═══
Responde SIEMPRE y ÚNICAMENTE con JSON válido. Sin markdown, sin texto fuera del JSON.

{
  "user_feedback": "Un mensaje empático, amigable y coloquial de máximo 2 líneas explicando lo que hiciste. Demuestra que entiendes el negocio.",
  "commands": [
    {
      "action": "nombre_del_comando_exacto",
      "nodeType": "tipo_si_aplica",
      "nodeId": "id_si_aplica",
      "label": "nombre_del_nodo",
      "newLabel": "nuevo_nombre_si_aplica",
      "x": 100,
      "y": 200,
      "width": 160,
      "height": 80,
      "fontSize": 12,
      "sourceId": "id_o_label_origen",
      "targetId": "id_o_label_destino",
      "edgeLabel": "guarda_o_texto",
      "edgeStyle": "solid",
      "edgeColor": "#455a64",
      "edgeThickness": 2,
      "edgeLabelPosition": { "x": 10, "y": -10 },
      "waypoints": [{ "x": 150, "y": 200 }],
      "targetLaneName": "nombre_carril_destino",
      "laneOrder": ["carril1", "carril2"],
      "targetType": "tipo_de_nodo_para_batch",
      "nodeIds": ["id1", "id2"],
      "templateName": "patron_pasarela_pago",
      "offsetX": 50,
      "offsetY": 50,
      "forms": [
        { "label": "Nombre del Campo", "type": "text|number|date|select|file", "required": true }
      ]
    }
  ],
  "umlValidation": "advertencia UML de los 7 atributos ISO si aplica, o null"
}

Reglas Finales:
1. "action" solo puede ser uno de los 22 comandos listados.
2. Todo nombre de propiedad JSON debe estar ESTRICTAMENTE en camelCase.
3. Si la instrucción no requiere manipular el diagrama, commands debe ser [].
4. La respuesta debe ser parseable por JSON.parse().

Formato alternativo TAMBIÉN aceptado (legacy):
{
  "assistant_speech": "texto",
  "operations": [ { "action": "CREATE", "element_type": "node", "target_id": null, "payload": {} } ]
}

═══ EJEMPLOS ═══

Usuario: "Ponme un cuadrito que diga Cobro"
→ { "user_feedback": "¡Listo! Puse una actividad llamada Cobro.", "commands": [{ "action": "add_node", "nodeType": "activity", "label": "Cobro" }] }

Usuario: "Crea una zona de ventas, mete ahí el cobro y mándalo al fin"
→ { "user_feedback": "¡Hecho! Creé la zona Ventas, agregué Cobro dentro y lo conecté al Fin.", "commands": [
  { "action": "add_node", "nodeType": "swimlane", "label": "Ventas", "x": 0, "y": 0, "width": 300, "height": 520 },
  { "action": "add_node", "nodeType": "activity", "label": "Cobro", "x": 50, "y": 100 },
  { "action": "add_edge", "sourceId": "Cobro", "targetId": "Fin", "edgeStyle": "solid" }
] }

Usuario: "Agrega una decisión '¿Aprobado?' después de Revisión con caminos Sí a Procesar y No a Rechazo"
→ { "user_feedback": "¡Perfecto! Puse la decisión ¿Aprobado? con sus dos caminos.", "commands": [
  { "action": "add_node", "nodeType": "decision", "label": "¿Aprobado?", "x": 400, "y": 200 },
  { "action": "add_edge", "sourceId": "Revisión", "targetId": "¿Aprobado?", "edgeStyle": "solid" },
  { "action": "add_edge", "sourceId": "¿Aprobado?", "targetId": "Procesar", "edgeLabel": "[Sí]", "edgeStyle": "solid" },
  { "action": "add_edge", "sourceId": "¿Aprobado?", "targetId": "Rechazo", "edgeLabel": "[No]", "edgeStyle": "solid" }
] }`;

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
        return this.normalizeIaResponse(parsed, userMessage, currentNodes);
      }),
      catchError(err => {
        console.error('[IA] Error calling Groq API:', err);
        const fallback = this.localFallback(userMessage, currentNodes);
        if (fallback.commands.length > 0) {
          return of(fallback);
        }
        return throwError(() => new Error('Error communicating with AI: ' + (err.message || 'Unknown error')));
      })
    );
  }

  private normalizeIaResponse(raw: any, userMessage: string, currentNodes: NodeData[]): IaResponse {
    const normalizedMessage = this.resolveLatestIntent(userMessage);

    if (this.requiresConfirmation(normalizedMessage) && !this.isConfirmed(normalizedMessage)) {
      return {
        commands: [],
        explanation: 'Detecté una mejora estructural del flujo. ¿Quieres que aplique estos cambios por ti?',
        user_feedback: 'Detecté una mejora. ¿Quieres que aplique los cambios?',
        umlValidation: undefined
      };
    }

    // Support new format { user_feedback, commands[{ action, payload }] }
    // as well as legacy { commands } and { operations } formats
    let inputCommands: any[];
    if (Array.isArray(raw?.commands)) {
      // Check if commands use the new payload-wrapped format
      inputCommands = raw.commands.map((cmd: any) => {
        if (cmd.payload && typeof cmd.payload === 'object') {
          // New format: flatten payload into the command
          return { action: cmd.action, ...cmd.payload };
        }
        return cmd;
      });
    } else {
      inputCommands = this.mapOperationsToCommands(Array.isArray(raw?.operations) ? raw.operations : []);
    }
    const normalized: DiagramCommand[] = [];

    let nextLaneX = this.getNextLaneX(currentNodes);
    for (const cmd of inputCommands) {
      const fixed = this.normalizeCommand(cmd as DiagramCommand, nextLaneX, currentNodes);
      if (fixed) {
        if (fixed.action === 'add_node' && fixed.nodeType === 'swimlane') {
          nextLaneX += fixed.width || 300;
        }
        normalized.push(fixed);
      }
    }

    // En instrucciones explícitas de una sola acción, no ejecutar acciones adicionales.
    const strictSingle = this.enforceSingleAction(normalizedMessage, normalized);

    const fallback = strictSingle.length === 0 ? this.localFallback(normalizedMessage, currentNodes).commands : [];
    
    // Extract user_feedback from new format, or assistant_speech from legacy
    const userFeedback = typeof raw?.user_feedback === 'string' ? raw.user_feedback.trim() : '';
    const assistantSpeech = typeof raw?.assistant_speech === 'string' ? raw.assistant_speech.trim() : '';
    const displayMessage = userFeedback || assistantSpeech;
    
    return {
      commands: strictSingle.length > 0 ? strictSingle : fallback,
      explanation: displayMessage || (typeof raw?.explanation === 'string' && raw.explanation.trim().length > 0
        ? raw.explanation
        : 'Comando interpretado y normalizado correctamente.'),
      user_feedback: userFeedback || undefined,
      umlValidation: raw?.umlValidation ?? null
    };
  }

  private enforceSingleAction(message: string, commands: DiagramCommand[]): DiagramCommand[] {
    // Permitir operaciones en lote sin truncar
    return commands;
  }

  private parseLaneReference(message: string): string | null {
    if (!message) return null;
    const byNumber = message.match(/\b(?:en|a|al|hacia|de|del|desde)\b\s+(?:el\s+|la\s+)?(?:calle|carril|swimlane|zona|area|seccion|pista|pool|departamento|sector|pasillo)\s*(\d+)/i);
    if (byNumber?.[1]) return byNumber[1];

    const byName = message.match(/\b(?:en|a|al|hacia|sobre|dentro|de|del|desde)\b\s+(?:el\s+|la\s+)?(?:calle|carril|swimlane|zona|area|seccion|pista|pool|departamento|sector|pasillo)\s+([\p{L}\d_-]+)/iu);
    return byName?.[1] || null;
  }

  private resolveLaneFromReference(reference: string | null, nodes: NodeData[]): NodeData | null {
    const matches = this.findLaneMatches(reference, nodes);
    return matches.length > 0 ? matches[0] : null;
  }

  private getNextNodeYInLane(lane: NodeData, nodes: NodeData[]): number {
    const laneX = lane.x || 0;
    const laneW = lane.width || 300;
    const laneY = lane.y || 0;
    const laneHeader = 70;
    const nodeBottoms = nodes
      .filter(n => n.type !== 'swimlane' && (n.x || 0) >= laneX && (n.x || 0) < (laneX + laneW))
      .map(n => (n.y || 0) + (n.height || 80));
    if (!nodeBottoms.length) return laneY + laneHeader;
    return Math.max(...nodeBottoms) + 40;
  }

  private mapOperationsToCommands(operations: StrictCrudOperation[]): DiagramCommand[] {
    const mapped: DiagramCommand[] = [];
    for (const op of operations) {
      const cmd = this.mapOperationToCommand(op);
      if (cmd) mapped.push(cmd);
    }
    return mapped;
  }

  private mapOperationToCommand(op: StrictCrudOperation): DiagramCommand | null {
    if (!op || typeof op !== 'object') return null;

    const action = (op.action || '').toUpperCase();
    const type = (op.element_type || '').toLowerCase();
    const id = op.target_id || undefined;
    const x = op.payload?.x;
    const y = op.payload?.y;
    const p = op.payload?.properties || {};

    if (action === 'CREATE') {
      if (type === 'edge') {
        return {
          action: 'add_edge',
          sourceId: p['sourceId'] || p['source'] || p['from'],
          targetId: p['targetId'] || p['target'] || p['to'],
          edgeLabel: p['edgeLabel'] || p['label'],
          edgeStyle: p['edgeStyle'] || p['style'],
          edgeColor: p['edgeColor'] || p['color']
        };
      }
      if (type === 'swimlane' || type === 'node') {
        return {
          action: 'add_node',
          nodeType: type === 'swimlane' ? 'swimlane' : (p['nodeType'] || p['type'] || 'activity'),
          label: p['label'] || p['name'],
          x,
          y,
          width: p['width'],
          height: p['height'],
          fontSize: p['fontSize'],
          responsible: p['responsible']
        };
      }
      return null;
    }

    if (action === 'UPDATE' || action === 'RESIZE') {
      if (type === 'edge') {
        return {
          action: 'update_edge',
          edgeId: id,
          edgeLabel: p['edgeLabel'] || p['label'],
          edgeStyle: p['edgeStyle'] || p['style'],
          edgeColor: p['edgeColor'] || p['color']
        };
      }
      if (type === 'swimlane' || type === 'node') {
        return {
          action: 'update_node',
          nodeId: id,
          newLabel: p['newLabel'] || p['label'] || p['name'],
          x,
          y,
          width: p['width'],
          height: p['height'],
          fontSize: p['fontSize'],
          policy: p['policy']
        };
      }
      return null;
    }

    if (action === 'MOVE') {
      if (type === 'node' || type === 'swimlane') {
        if (p['targetLaneName']) {
          return {
            action: 'move_node_to_lane',
            nodeId: id,
            targetLaneName: p['targetLaneName']
          };
        }
        return {
          action: 'update_node',
          nodeId: id,
          x,
          y
        };
      }
      return null;
    }

    if (action === 'DELETE') {
      if (type === 'edge') return { action: 'delete_edge', edgeId: id };
      if (type === 'node' || type === 'swimlane') return { action: 'delete_node', nodeId: id };
      return null;
    }

    return null;
  }

  private normalizeCommand(cmd: DiagramCommand, nextLaneX: number, currentNodes: NodeData[]): DiagramCommand | null {
    if (!cmd || typeof cmd !== 'object') return null;

    const actionAlias: Record<string, DiagramCommand['action']> = {
      create_node: 'add_node',
      remove_node: 'delete_node',
      edit_node: 'update_node',
      connect_nodes: 'add_edge',
      remove_edge: 'delete_edge',
      edit_edge: 'update_edge',
      move_to_lane: 'move_node_to_lane',
      relink_edge: 'reconnect_edge',
      reorder_swimlanes: 'reorder_lanes',
      style_batch: 'batch_update_style',
      autolayout: 'auto_layout',
      clear: 'clear_all'
    };

    const action = ((cmd.action && actionAlias[cmd.action as string]) || cmd.action) as DiagramCommand['action'];
    const fixed: DiagramCommand = { ...cmd, action };

    if (fixed.action === 'add_node' && fixed.nodeType === 'swimlane') {
      fixed.width = fixed.width || 300;
      fixed.height = fixed.height || 520;
      fixed.y = 0;
      if (fixed.x === undefined || fixed.x === null) fixed.x = nextLaneX;
      if (!fixed.label || !fixed.label.trim()) {
        fixed.label = this.getNextLaneName(currentNodes);
      }
    }

    if (fixed.action === 'reorder_lanes' && (!Array.isArray(fixed.laneOrder) || fixed.laneOrder.length === 0)) {
      fixed.laneOrder = undefined;
    }

    return fixed;
  }

  private getNextLaneX(nodes: NodeData[]): number {
    const lanes = nodes.filter(n => n.type === 'swimlane');
    if (lanes.length === 0) return 0;
    return Math.max(...lanes.map(l => (l.x || 0) + (l.width || 300)));
  }

  private getNextLaneName(nodes: NodeData[] = []): string {
    const lanes = nodes.filter(n => n.type === 'swimlane');
    const used = new Set<number>();
    for (const lane of lanes) {
      const m = (lane.label || '').match(/^Calle\s+(\d+)$/i);
      if (m) used.add(Number(m[1]));
    }
    let i = 1;
    while (used.has(i)) i += 1;
    return `Calle ${i}`;
  }

  private resolveLatestIntent(message: string): string {
    if (!message) return '';
    const cutRegex = /(no\s*,?\s*espera|espera\s*,?\s*mejor|mejor|corrijo|corrección)/gi;
    const matches = [...message.matchAll(cutRegex)];
    if (matches.length === 0) return message;
    const last = matches[matches.length - 1];
    const idx = (last.index ?? 0) + last[0].length;
    return message.slice(idx).trim() || message;
  }

  private requiresConfirmation(message: string): boolean {
    return IaService.IMPROVEMENT_WORDS.test(message);
  }

  private isConfirmed(message: string): boolean {
    return IaService.CONFIRM_WORDS.test(message);
  }

  private localFallback(userMessage: string, currentNodes: NodeData[]): IaResponse {
    const latestMessage = this.resolveLatestIntent(userMessage || '');
    const canonical = this.canonicalizeText(latestMessage);
    const text = canonical.toLowerCase();
    const commands: DiagramCommand[] = [];

    if (IaService.INTERRUPT_WORDS.test(text) && !/(agrega|añade|crea|mueve|borra|elimina|ordena|organiza|limpiar|vaciar)/.test(text)) {
      return {
        commands: [],
        explanation: 'Operación detenida por instrucción del usuario.',
        umlValidation: undefined
      };
    }

    if (this.requiresConfirmation(latestMessage) && !this.isConfirmed(latestMessage)) {
      return {
        commands: [],
        explanation: 'Detecté una mejora estructural del flujo. ¿Quieres que aplique estos cambios por ti?',
        umlValidation: undefined
      };
    }

    const simulatedNodes = [...currentNodes];

    const steps = this.splitIntoSteps(canonical);
    for (const step of steps) {
      const normalizedStep = step.toLowerCase().trim();
      if (!normalizedStep) continue;

      const ambiguityQuestion = this.buildAmbiguityQuestion(step, simulatedNodes);
      if (ambiguityQuestion) {
        return {
          commands: [],
          explanation: ambiguityQuestion,
          umlValidation: undefined
        };
      }

      const missingLaneQuestion = this.buildMissingLaneQuestion(step, simulatedNodes);
      if (missingLaneQuestion) {
        return {
          commands: [],
          explanation: missingLaneQuestion,
          umlValidation: undefined
        };
      }

      const missingNodeQuestion = this.buildMissingNodeQuestion(step, simulatedNodes);
      if (missingNodeQuestion) {
        return {
          commands: [],
          explanation: missingNodeQuestion,
          umlValidation: undefined
        };
      }

      if (/limpiar|vaciar|borrar\s+todo|clear\s+all/.test(normalizedStep)) {
        commands.push({ action: 'clear_all' });
        continue;
      }

      if (/auto\s*layout|autolayout|ordena|organiza|acomoda|distribuye/.test(normalizedStep)) {
        commands.push({ action: 'auto_layout' });
        continue;
      }

      const moveNode = this.tryParseMoveNode(step, simulatedNodes);
      if (moveNode) {
        commands.push(moveNode);
        continue;
      }

      const addNodes = this.tryParseAddNode(step, simulatedNodes);
      if (addNodes) {
        const arr = Array.isArray(addNodes) ? addNodes : [addNodes];
        for (const addNode of arr) {
          commands.push(addNode);
          simulatedNodes.push({
            id: `sim_${Date.now()}_${Math.random()}`,
            type: addNode.nodeType || 'activity',
            label: addNode.label || '',
            x: addNode.x || 0,
            y: addNode.y || 0,
            width: addNode.width || 160,
            height: addNode.height || 80
          });
        }
        continue;
      }

      const renameNode = this.tryParseRename(step, currentNodes);
      if (renameNode) {
        commands.push(renameNode);
        continue;
      }

      const naturalEdge = this.tryBuildAddEdgeFromNaturalLanguage(step, currentNodes);
      if (naturalEdge) {
        commands.push(naturalEdge);
        continue;
      }

      const deleteEdge = this.tryParseDeleteEdge(step, currentNodes);
      if (deleteEdge) {
        commands.push(deleteEdge);
        continue;
      }

      const deleteInLane = this.tryParseDeleteNodesInLane(step, currentNodes);
      if (deleteInLane) {
        commands.push(...deleteInLane);
        continue;
      }

      const styling = this.tryParseStyle(step, currentNodes);
      if (styling) {
        if (Array.isArray(styling)) commands.push(...styling);
        else commands.push(styling);
        continue;
      }

      const removeNode = this.tryParseDeleteNode(step, currentNodes);
      if (removeNode) {
        commands.push(removeNode);
        continue;
      }

      const generalUpd = this.tryParseGeneralUpdate(step, currentNodes);
      if (generalUpd) {
        commands.push(generalUpd);
        continue;
      }
    }

    if (commands.length > 1) {
      return {
        commands,
        explanation: 'Se procesó un lote de instrucciones en orden secuencial.',
        umlValidation: undefined
      };
    }

    return {
      commands,
      explanation: commands.length > 0
        ? 'Se aplicó una interpretación local del comando para mantener la operación.'
        : 'No se pudo interpretar el comando con suficiente precisión.',
      umlValidation: undefined
    };
  }

  private canonicalizeText(message: string): string {
    let value = (message || '').trim();
    // Remover puntuación final agresiva que rompe el split o la detección
    value = value.replace(/[.,:;!¡?¿]+$/g, '');
    
    // Remover frases de ruido / cortesía
    const noise = [
      /por\s+favor/gi, /puedes/gi, /me\s+gustaria\s+que/gi, /me\s+gustaría\s+que/gi,
      /quisiera/gi, /haz\s+que/gi, /deberias\s+de/gi, /deberías\s+de/gi,
      /quiero\s+que/gi, /procede\s+a/gi, /favor\s+de/gi, /necesito\s+que/gi,
      /\bahora\b/gi, /\bbien\b/gi, /\bbueno\b/gi, /\bmira\b/gi, /\boye\b/gi, /\balguna\b/gi
    ];
    noise.forEach(r => value = value.replace(r, ''));
    
    const replacements: Array<[RegExp, string]> = [
      [/\brelasion(ar|a|o)?\b/gi, 'relacionar'],
      [/\bconekt(ar|a|o)?\b/gi, 'conectar'],
      [/\benlas(ar|a|o)?\b/gi, 'enlazar'],
      [/\bactividada?s?\b/gi, 'actividad'],
      [/\bclle?s?\b/gi, 'calle'],
      [/\bcaye?s?\b/gi, 'calle'],
      [/\bcarriles?\b/gi, 'carril'],
      [/\bdespues\b/gi, 'después'],
      [/\bqita\b/gi, 'quita'],
      // Colloquial aliases → technical terms
      [/\bcuadrit?o?s?\b/gi, 'actividad'],
      [/\bcajit?a?s?\b/gi, 'actividad'],
      [/\bbloque?s?\b/gi, 'actividad'],
      [/\bpas(?:it)?o?s?\b/gi, 'actividad'],
      [/\bbolit?a?s?\b/gi, 'inicio'],
      [/\bpregunt?a?s?\b/gi, 'decision'],
      [/\bfiltro?s?\b/gi, 'decision'],
      [/\bromb(?:it)?o?s?\b/gi, 'decision'],
      [/\bzona?s?\b/gi, 'calle'],
      [/\barea?s?\b/gi, 'calle'],
      [/\bseccione?s?\b/gi, 'calle'],
      [/\bcomienza?o?\b/gi, 'inicio'],
      [/\bsalida?s?\b/gi, 'fin'],
      [/\bpost-?its?\b/gi, 'nota'],
      [/\bdiscos?\b/gi, 'datastore'],
      // Connect aliases
      [/\btiral[ea]\b/gi, 'conectar'],
      [/\bjuntal[oa]s?\b/gi, 'conectar'],
      [/\bpasal[oa]\b/gi, 'conectar'],
      [/\bmandal[oa]\b/gi, 'conectar']
    ];
    for (const [pattern, replacement] of replacements) {
      value = value.replace(pattern, replacement);
    }
    return value.replace(/\s+/g, ' ').trim();
  }

  private splitIntoSteps(message: string): string[] {
    return (message || '')
      .split(/\s*(?:,|;|\by\b|\bluego\b|\bdespués\b|\bentonces\b|\by\s+luego\b|\bahora\b|\bal\s+tiro\b|\by\s+ahora\b)\s*/i)
      .map(s => s.trim())
      .filter(Boolean);
  }

  private tryParseAddNode(step: string, currentNodes: NodeData[]): DiagramCommand | DiagramCommand[] | null {
    const s = step.toLowerCase();
    const asksAdd = /\b(agrega|añade|crea|inserta|pon|ponme|coloca|genera|haz|mete|dame|plantea|proyecta|instala|dibuja|traza|abre|dispone|sitúa|situa|arm[ao]|construy|fabric[ao]|diseñ[ao]|desarroll[ao]|fund[ao]|mont[ao]|establec|inicia|form[ao]|forj[ao]|origin[ao]|invent[ao]|agreguemos|añadamos|creemos|insertemos|pongamos|coloquemos|generemos|hagamos|metamos|planteemos|dibujemos|diseñemos|montemos)\b/i.test(s);
    if (!asksAdd) return null;

    // Extraer multiplicador ("agrega 3 calles")
    let count = 1;
    const countMatch = s.match(/(?:agrega|crea|añade|inserta|pon|ponme|dame|haz|mete|dibuja|construy|arm|monta|diseñ|genera|agreguemos|creemos|añadamos|hagamos|pongamos|metamos|dibujemos)\s+(un|una|dos|tres|cuatro|cinco|\d+)\b/i);
    if (countMatch && countMatch[1]) {
      const p = countMatch[1];
      if (p === 'un' || p === 'una') count = 1;
      else if (p === 'dos') count = 2;
      else if (p === 'tres') count = 3;
      else if (p === 'cuatro') count = 4;
      else if (p === 'cinco') count = 5;
      else count = parseInt(p, 10) || 1;
    }

    const normStep = this.normalizeForSearch(step);
    const asksActivity = /(actividad|tarea|task|cuadrit|cajit|bloque|paso)\b/i.test(normStep);
    const activityIdx = normStep.search(/(actividad|tarea|task|cuadrit|cajit|bloque|paso)\b/i);
    const laneIdx = normStep.search(/(calle|carril|swimlane|zona|area|seccion|fila|banda|pasillo|pool|departamento|sector|estrato|nivel|columna)\b/i);
    
    // Si menciona una calle antes que una actividad (Ej: "crea una calle con una actividad"), es una orden principal de calle.
    const isPrimaryLane = laneIdx >= 0 && (activityIdx === -1 || laneIdx < activityIdx);

    // Caso prioritario: "agrega actividad/tarea en la calle/carril X"
    if (asksActivity && !isPrimaryLane) {
      const laneRef = this.parseLaneReference(step);
      if (laneRef) {
        const lane = this.resolveLaneFromReference(laneRef, currentNodes);
        if (lane) {
          const cmds: DiagramCommand[] = [];
          for (let i = 0; i < count; i++) {
             cmds.push({
               action: 'add_node',
               nodeType: 'activity',
               label: this.extractLabel(step, ['actividad', 'tarea', 'task']) || this.defaultLabelForNode('activity'),
               x: (lane.x || 0) + 50 + (i * 20),
               y: this.getNextNodeYInLane(lane, currentNodes) + (i * 90)
             });
          }
          return cmds;
        }
      }
    }

    let nodeType = this.detectNodeType(step);
    if (isPrimaryLane) {
      nodeType = 'swimlane';
    }
    if (!nodeType) return null;

    if (nodeType === 'swimlane') {
      let label = this.extractLabel(step, ['calle', 'carril', 'swimlane', 'zona', 'area', 'seccion', 'fila', 'banda', 'pasillo', 'pool', 'departamento', 'sector', 'estrato', 'nivel', 'columna']) || 
                  this.extractFallbackLabel(step, ['agrega', 'crea', 'añade', 'inserta', 'pon', 'calle', 'carril', 'swimlane', 'plantea', 'proyecta', 'instala', 'dibuja', 'traza', 'abre', 'dispone', 'sitúa', 'situa']) ||
                  this.getNextLaneName(currentNodes);
      
      label = label.replace(/^(una|un|el|la|los|las)\s+/i, '').trim();

      const cmds: DiagramCommand[] = [];
      const virtualNodes = [...currentNodes];

      for (let i = 0; i < count; i++) {
        let currentLabel = label;
        if (count > 1 && label !== this.getNextLaneName(virtualNodes)) {
           currentLabel = `${label} ${i + 1}`;
        }
        
        const alreadyExists = virtualNodes
          .filter(n => n.type === 'swimlane' && !!n.label)
          .some(n => this.normalizeForSearch(n.label || '') === this.normalizeForSearch(currentLabel));
        
        if (alreadyExists) {
          currentLabel = `${currentLabel} ${virtualNodes.filter(n => n.type === 'swimlane').length + 1}`;
        }

        const nextX = this.getNextLaneX(virtualNodes);
        
        cmds.push({
          action: 'add_node',
          nodeType: 'swimlane',
          label: this.capitalize(currentLabel),
          x: nextX,
          y: 0,
          width: 300,
          height: 520
        });

        virtualNodes.push({ id: `virtual_${Date.now()}_${i}`, type: 'swimlane', label: currentLabel, x: nextX, y: 0, width: 300 });

        // Detección de subcomandos en la misma frase (Ej. "con una actividad proceso")
        const innerMatch = step.match(/(?:con|que\s+tenga|incluyendo)\s+(?:un|una|dos|tres)?\s*(actividad|tarea|proceso)(?:\s+(?:llamada|llamado|nombre|con\s+nombre)?\s*([\p{L}\d_ -]+))?/iu);
        if (innerMatch) {
          let innerLabel = innerMatch[2] ? innerMatch[2].trim() : 'Actividad';
          innerLabel = innerLabel.replace(/^(una|un|el|la)\s+/i, '').trim();
          cmds.push({
            action: 'add_node',
            nodeType: 'activity',
            label: this.capitalize(innerLabel),
            x: nextX + 50,
            y: 70
          });
        }
      }
      return cmds;
    }

    const laneRef = this.parseLaneReference(step);
    const label = this.extractLabel(step, ['actividad', 'tarea', 'decision', 'decisión', 'nodo', 'subproceso', 'proceso', 'inicio', 'fin']) || 
                  this.extractFallbackLabel(step, ['agrega', 'crea', 'añade', 'inserta', 'pon', 'coloca', 'actividad', 'tarea']) ||
                  this.defaultLabelForNode(nodeType);

    if (laneRef) {
      const lane = this.resolveLaneFromReference(laneRef, currentNodes);
      if (lane) {
        const cmds: DiagramCommand[] = [];
        for (let i = 0; i < count; i++) {
          cmds.push({
            action: 'add_node',
            nodeType,
            label: this.capitalize(label),
            x: (lane.x || 0) + 50 + (i * 20),
            y: this.getNextNodeYInLane(lane, currentNodes) + (i * 90)
          });
        }
        return cmds;
      }
    }

    const cmds: DiagramCommand[] = [];
    for (let i = 0; i < count; i++) {
      cmds.push({
        action: 'add_node',
        nodeType,
        label: this.capitalize(label)
      });
    }
    return cmds;
  }

  private extractFallbackLabel(step: string, stopWords: string[]): string | null {
    const words = step.split(/\s+/);
    // Intentar tomar la última palabra que no sea un verbo de acción o palabra clave de tipo
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i].toLowerCase().replace(/[^\p{L}\d]/gu, '');
      if (w.length > 2 && !stopWords.map(s => s.toLowerCase()).includes(w)) {
        return words[i].replace(/[^\p{L}\d]/gu, '');
      }
    }
    return null;
  }

  private capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private detectNodeType(step: string): string | null {
    const s = this.normalizeForSearch(step);
    // Priorizar componentes operativos antes de interpretar "calle" como tipo.
    if (/(actividad|tarea|task|cuadrit|cajit|bloque|paso)/.test(s)) return 'activity';
    if (/(subproceso|subprocess)/.test(s)) return 'subprocess';
    if (/(decision|decisión|merge|xor|pregunt|filtro|rombit|si\/no)/.test(s)) return 'decision';
    if (/(parallel|paralelo|and\s*gate|compuerta\s*paralela)/.test(s)) return 'parallel';
    if (/(\bfork\b)/.test(s)) return 'fork';
    if (/(\bjoin\b)/.test(s)) return 'join';
    if (/(señal|senal).*(enviar|send)|signal\s*send/.test(s)) return 'signal_send';
    if (/(señal|senal).*(recibir|receive)|signal\s*receive/.test(s)) return 'signal_receive';
    if (/(nota|note|comentario|post-?it)/.test(s)) return 'note';
    if (/(datastore|almacen|almacén|base\s*de\s*datos|disco)/.test(s)) return 'datastore';

    if (/(swimlane|calle|carril|zona|area|seccion|bloque\s*horizontal|fila|banda|pista|callejón|callejon|pasillo|pool|departamento|sector|estrato|nivel|columna|contenedor)/.test(s)) return 'swimlane';
    if (/(inicio|start|bolit|comienzo|circulit|verde|comenzar|punto\s+de\s+partida|arranque)/.test(s)) return 'start';
    if (/(fin\s*\(flujo\)|fin\s*flujo|flow\s*final|circulo\s*doble|meta|objetivo)/.test(s)) return 'flow_final';
    if (/(fin\s*\(actividad\)|fin\s*actividad|activity\s*final|bloqueo|cierre)/.test(s)) return 'activity_final';
    if (/(\bfin\b|\bfinal\b|\bend\b|salida|terminar|concluir|rojo|parada)/.test(s)) return 'end';
    return null;
  }

  private tryParseGeneralUpdate(step: string, nodes: NodeData[]): DiagramCommand | null {
    const s = step.toLowerCase();
    
    // 1. Detección de actualización por Responsable
    const respMatch = step.match(/(?:responsable|encargado|dueno|dueño|quien\s+hace|lo\s+hace|quien\s+lo\s+hace|persona)\s+(?:es|sea|de|a)?\s*"?([\p{L}\d_ -]+)"?/iu);
    if (respMatch?.[1]) {
       const target = this.resolveNodeLabelFromReference(step.replace(respMatch[0], ''), nodes);
       if (target) {
         return { action: 'update_node', label: target, responsible: respMatch[1].trim() };
       }
    }

    // 2. Detección de Normatividad/Política
    const polMatch = step.match(/(?:politica|política|norma|regla|procedimiento)\s+(?:es|sea|de|a)?\s*"?([\p{L}\d_\s.,-]{3,})"?/iu);
    if (polMatch?.[1]) {
       const target = this.resolveNodeLabelFromReference(step.replace(polMatch[0], ''), nodes);
       if (target) {
         return { action: 'update_node', label: target, policy: polMatch[1].trim() };
       }
    }

    // 3. Detección de Colores de Nodo (Si no fue detectado por style batch)
    const colorMatch = s.match(/(?:pinta|colorea|pon|cambia|haz).*?(rojo|azul|verde|amarillo|naranja|negro|blanco)/i);
    if (colorMatch?.[1] && !/(linea|arista|conexion|relacion|edge)/i.test(s)) {
      const colorMap: Record<string, string> = { rojo: '#F44336', azul: '#2196F3', verde: '#4CAF50', amarillo: '#FFEB3B', naranja: '#FF9800', negro: '#455a64', blanco: '#ECEFF1' };
      const target = this.resolveNodeLabelFromReference(step.replace(colorMatch[0], ''), nodes);
      // Nota: modeler.ts necesita ser actualizado para soportar nodeColor en update_node si se desea, 
      // pero por ahora lo dejamos como extensión de metadata o fallback.
    }

    return null;
  }

  private extractLabel(step: string, keywords: string[]): string | null {
    const quoted = step.match(/"([^"]+)"/);
    if (quoted?.[1]) return quoted[1].trim();

    const keys = keywords.join('|');
    const m = step.match(new RegExp(`(?:${keys})\\s+(?:llamada|llamado|nombre|con\\s+nombre)?\\s*([\\p{L}\\d_ -]{2,})`, 'iu'));
    if (!m?.[1]) return null;

    const value = m[1]
      .replace(/\b(en|a|al|con|sobre|dentro|del|de\s+la|de\s+el)\b.*$/i, '')
      .trim();
    return value || null;
  }

  private defaultLabelForNode(nodeType: string): string {
    const map: Record<string, string> = {
      activity: 'Actividad',
      decision: 'Condición',
      subprocess: 'Subproceso',
      start: 'Inicio',
      end: 'Fin',
      flow_final: 'Fin Flujo',
      activity_final: 'Fin Actividad',
      note: 'Nota',
      datastore: 'Datos',
      signal_send: 'Enviar Señal',
      signal_receive: 'Recibir Señal',
      parallel: 'Paralelo',
      fork: 'Fork/Join'
    };
    return map[nodeType] || 'Nodo';
  }

  private tryParseMoveNode(step: string, currentNodes: NodeData[]): DiagramCommand | null {
    const s = step.toLowerCase();
    if (!/\b(muev[aeo]|mover|traslad[aeo]|pas[a|e|o|ar]|llev[a|e|o|ar]|cambi[a|e|o]\s+de\s+(?:calle|zona|carril|area)|acomod[aeo]|ubic[aeo]|situ[aeo]|desplaz[aeo]|reubic[aeo]|empuj[aeo]|mand[aeo]|transfer|transfier|transport|migr[aeo]|movamos|traslademos|pasemos|llevemos|cambiemos|acomodemos|ubiquemos|situemos|desplacemos|posiciona|pon)\b/i.test(s)) return null;

    const candidates = currentNodes.filter(n => n.type !== 'swimlane' && !!n.label);
    const quoted = step.match(/"([^"]+)"/);
    const nodeLabel = quoted?.[1]
      ? this.resolveNodeLabelFromReference(quoted[1], candidates)
      : this.resolveNodeLabelFromReference(step.replace(/(?:mueve|mover|traslada|trasladar|pasa|pasar|lleva|llevar|manda|mandar|transfiere|reubica|ubica|desplaza|posiciona|pon|a\s+la\s+calle|al\s+carril|a\s+la\s+zona|mas\s+abajo|mas\s+arriba|mas\s+a\s+la\s+derecha|mas\s+a\s+la\s+izquierda|abajo|arriba|derecha|izquierda).*/gi, '').trim(), candidates);

    if (!nodeLabel) return null;
    const node = currentNodes.find(n => n.label === nodeLabel);

    // Caso 1: Movimiento a carril
    const laneRef = this.parseLaneReference(step);
    const lane = this.resolveLaneFromReference(laneRef, currentNodes);
    if (lane) {
      return {
        action: 'move_node_to_lane',
        label: nodeLabel,
        targetLaneName: lane.label || undefined
      };
    }

    // Caso 2: Movimiento relativo
    if (node) {
      let nx = node.x;
      let ny = node.y;
      const stepDist = 120;

      if (s.includes('abajo') || s.includes('descend')) ny += stepDist;
      else if (s.includes('arriba') || s.includes('subir')) ny = Math.max(0, ny - stepDist);
      
      if (s.includes('derecha')) nx += stepDist;
      else if (s.includes('izquierda')) nx = Math.max(0, nx - stepDist);

      if (nx !== node.x || ny !== node.y) {
        return {
          action: 'update_node',
          label: nodeLabel,
          x: nx,
          y: ny
        };
      }
    }

    return null;
  }

  private tryParseStyle(step: string, currentNodes: NodeData[]): DiagramCommand | DiagramCommand[] | null {
    const s = step.toLowerCase();
    
    // 1. Agrandar texto o achicar
    if (/(agranda|aumenta|crece|sube|maximiza).*texto|texto.*(grande|mayor)/.test(s)) {
      return { action: 'batch_update_style', targetType: 'activity', fontSize: 16 };
    }
    if (/(achica|reduce|disminuye|baja|minimiza).*texto|texto.*(pequeno|pequeño|menor)/.test(s)) {
      return { action: 'batch_update_style', targetType: 'activity', fontSize: 10 };
    }

    // 2. Anchar calles
    if (/(ancha|ampli|agranda|engorda|ensancha).*calle|calle.*(ancha|grande)/.test(s)) {
      return { action: 'batch_update_style', targetType: 'swimlane', width: 450 };
    }
    if (/(angosta|estrech|achica|reduce|delgaza).*calle|calle.*(angosta|pequeña|fina)/.test(s)) {
      return { action: 'batch_update_style', targetType: 'swimlane', width: 200 };
    }

    // 3. Agrosar líneas
    if (/(engrosa|agros(?:a|e)|gruesa|ancha|gord).*linea/i.test(s) || /linea.*(gruesa|gord|ancha)/i.test(s) || /flecha.*(gruesa)/i.test(s)) {
      return { action: 'batch_update_style', targetType: 'edge', edgeThickness: 4 };
    }
    if (/(adelgaza|fina|delgada).*linea/i.test(s) || /linea.*(fina|delgada)/i.test(s) || /flecha.*(fina)/i.test(s)) {
       return { action: 'batch_update_style', targetType: 'edge', edgeThickness: 1 };
    }

    // 4. Cambiar color a líneas
    const colorMatch = s.match(/(?:pon|pinta|colorea|cambia|haz).*?(rojo|azul|verde|amarillo|naranja|negro|blanco)/i);
    if (colorMatch?.[1] && /(linea|línea|flecha|ruta|conexion|conexión|arista|relacion|relación)/i.test(s)) {
       const colorMap: Record<string, string> = { rojo: '#F44336', azul: '#2196F3', verde: '#4CAF50', amarillo: '#FFEB3B', naranja: '#FF9800', negro: '#455a64', blanco: '#ECEFF1' };
       return { action: 'batch_update_style', targetType: 'edge', edgeColor: colorMap[colorMatch[1].toLowerCase()] };
    }
    
    return null;
  }

  private tryParseDeleteNodesInLane(step: string, currentNodes: NodeData[]): DiagramCommand[] | null {
    const s = step.toLowerCase();
    if (!/\b(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|limpia|aniquila|liquida|purga|desecha|vuela|quiebra|vacia|tumba|mata|arrasa|revienta|fulmina|eliminemos|borremos|quitemos|removamos|limpiemos|vaciemos)\b\s+(todo|todas|los|las|cualquier)/.test(s) &&
        !/\b(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|limpia|aniquila|liquida|purga|desecha|vuela|quiebra|vacia|tumba|mata|arrasa|revienta|fulmina|eliminemos|borremos|quitemos|removamos|limpiemos|vaciemos)\b\s+.*(nodos|componentes|actividades|tareas|elementos|cosas|pasos|basura)/.test(s) &&
        !/\b(vacia|limpia|desocupa|despeja|vaciemos|limpiemos|desocupemos|despejemos)\b\s+.*(calle|zona|carril|area|pista|seccion)/.test(s)) {
      return null;
    }

    const laneRef = this.parseLaneReference(step) || step.match(/(?:calle|zona|carril|departamento|campo|espacio|area)\s+([\p{L}\d_-]+)/iu)?.[1];
    if (!laneRef) return null;

    const lane = this.resolveLaneFromReference(laneRef, currentNodes);
    if (!lane) return null;

    return [{ action: 'clear_lane', targetLaneName: lane.label }];
  }

  private tryParseDeleteNode(step: string, currentNodes: NodeData[]): DiagramCommand | null {
    const s = step.toLowerCase();
    if (!/\b(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|aniquila|liquida|purga|desecha|vuela|quiebra|cargate|revienta|mata|funde|tumba|limpia|arrasa|pela|desecha|bota|deshaz|borralo|eliminemos|borremos|quitemos|removamos|matemos|limpiemos)\b/.test(s)) return null;
    
    // Evitar interceptar comandos de eliminar "líneas/edges"
    if (/(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta)/.test(s)) return null;

    const candidates = currentNodes.filter(n => n.type !== 'swimlane' && !!n.label);
    const quoted = step.match(/"([^"]+)"/);
    const resolved = quoted?.[1]
      ? this.resolveNodeLabelFromReference(quoted[1], candidates)
      : this.resolveNodeLabelFromReference(step.replace(/(?:elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|aniquila|liquida|purga|desecha|vuela|quiebra|cargate|revienta|mata|funde|tumba|limpia|arrasa|pela|bota|deshaz|borralo)\s*/gi, ''), candidates);

    return resolved ? { action: 'delete_node', label: resolved } : null;
  }

  private tryParseDeleteEdge(step: string, nodes: NodeData[]): DiagramCommand | null {
    const s = step.toLowerCase();
    if (!/(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|desconecta|desvincula)\s+.*(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta)/i.test(s) &&
        !/(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta).*(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|desconecta|desvincula)/i.test(s)) {
      return null;
    }

    const candidateNodes = nodes.filter(n => n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0);
    if (candidateNodes.length < 1) return null;

    const relMatch = step.match(/(?:de|desde|entre)\s+(.+?)\s+(?:y|e|con|a|hacia|->)\s+(.+)/i);
    let srcLabel, tgtLabel;

    if (relMatch?.[1] && relMatch?.[2]) {
      srcLabel = this.resolveNodeLabelFromReference(relMatch[1], candidateNodes);
      tgtLabel = this.resolveNodeLabelFromReference(relMatch[2], candidateNodes);
    }

    if (!srcLabel || !tgtLabel) {
       const normalizedMsg = this.normalizeForSearch(step);
       const found = candidateNodes
         .map(n => ({
           label: n.label || '',
           idx: normalizedMsg.indexOf(this.normalizeForSearch(n.label || ''))
         }))
         .filter(x => x.idx >= 0)
         .sort((a, b) => b.label.length - a.label.length); // Sort by length descending to match longest name first
       
       if (found.length >= 2 && found[0].label !== found[1].label) {
          srcLabel = found[0].label;
          tgtLabel = found[1].label;
       }
    }

    if (srcLabel && tgtLabel) {
      return { action: 'delete_edge', sourceId: srcLabel, targetId: tgtLabel };
    }
    
    // Si no encontró un par, buscar un solo nodo para borrar TODAS sus conexiones
    const unMatch = step.match(/(?:de|del|desde|hacia|a|para)\s+(.+)/i);
    if (unMatch?.[1]) {
       const single = this.resolveNodeLabelFromReference(unMatch[1], candidateNodes);
       if (single) return { action: 'delete_edge', sourceId: single };
    }

    return null;
  }

  private buildMissingLaneQuestion(step: string, currentNodes: NodeData[]): string | null {
    const laneRef = this.parseLaneReference(step);
    if (!laneRef) return null;

    const lane = this.resolveLaneFromReference(laneRef, currentNodes);
    if (lane) return null;

    const laneName = /^\d+$/.test(laneRef) ? `Calle ${laneRef}` : laneRef;
    
    // Si la acción era agregar, ofrecer crearlo
    const normalized = this.normalizeForSearch(step);
    if (/(agrega|anade|añade|crea|inserta|pon|coloca|genera|haz)/.test(normalized)) {
       return `No encontre el carril "${laneName}". Quieres que lo cree y luego aplique los cambios?`;
    }
    
    return `La instruccion fallo porque la calle o carril "${laneName}" no existe en tu diagrama. Revisa el nombre.`;
  }

  private buildMissingNodeQuestion(step: string, currentNodes: NodeData[]): string | null {
    const s = step.toLowerCase();
    
    if (this.isConnectIntent(step)) {
       const explicit = step.match(/(?:conecta|relaciona|relacion|une|unir|vincula|enlaza|asocia|liga|junta)(?:\s+el\s+flujo)?\s+(?:de\s+)?(.+?)\s+(?:con|a|hacia|y|->)\s+(.+)/i);
       if (explicit?.[1] && explicit?.[2]) {
           const candidateNodes = currentNodes.filter(n => n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0);
           const src = this.resolveNodeLabelFromReference(explicit[1], candidateNodes);
           const tgt = this.resolveNodeLabelFromReference(explicit[2], candidateNodes);
           if (!src) return `Error al relacionar: No encontre el componente origen "${explicit[1].trim()}".`;
           if (!tgt) return `Error al relacionar: No encontre el destino "${explicit[2].trim()}" para relacionarlo.`;
       }
    }
    
    if (/(elimina|borrar|borra|quita|remueve|eliminar)/.test(s) && !/(linea|línea|arista|conexion|conexión|relacion|relación|edge|todo|todas|los|las)/.test(s)) {
       const candidateNodes = currentNodes.filter(n => n.type !== 'swimlane' && !!n.label);
       const quoted = step.match(/"([^"]+)"/);
       let ref = quoted?.[1] || step.replace(/(?:elimina|borrar|borra|quita|remueve|eliminar)\s*/gi, '').trim();
       ref = ref.replace(/^(el|la|los|las|un|una)\s+/i, '').trim();
       
       const resolved = this.resolveNodeLabelFromReference(ref, candidateNodes);
       if (!resolved && ref.length > 1) {
           return `Error de borrado: No logre encontrar nada llamado "${ref}" en el sistema.`;
       }
    }

    return null;
  }

  private tryParseRename(step: string, currentNodes: NodeData[]): DiagramCommand | null {
    const s = this.normalizeForSearch(step);
    if (!/\b(renombr[ae]|cambi[ae]|modific[ae]|actualiz[ae]|reemplaz[ae]|poner\s+nombre|ponle\s+nombre|llama(?:r|le|la)?|rectifica|ajusta|perfecciona|edita|reforma|altera|bautiza|titula|renombremos|cambiemos|modifiquemos|actualicemos|bauticemos|titulemos)\b/.test(s)) {
      return null;
    }

    const parts = this.extractRenameParts(step);
    if (!parts) return null;

    const { targetRef, newLabel, isLane } = parts;
    if (!newLabel) return null;

    if (isLane) {
      const laneRef = this.parseLaneReference(targetRef) || targetRef;
      const lane = this.resolveLaneFromReference(laneRef, currentNodes);
      if (lane?.id) {
        return {
          action: 'update_node',
          nodeId: lane.id,
          newLabel
        };
      }
      return null;
    }

    const candidates = currentNodes.filter(n => !!n.label);
    const resolved = this.resolveNodeLabelFromReference(targetRef, candidates);
    if (!resolved) return null;

    return {
      action: 'update_node',
      label: resolved,
      newLabel
    };
  }

  private extractRenameParts(step: string): { targetRef: string; newLabel: string; isLane: boolean } | null {
    const trimmed = step.trim();

    // Check strict Lane renaming first
    const lanePattern = trimmed.match(/(?:renombr[ae]|cambi[ae](?:r)?|modific[ae](?:r)?|actualiz[ae](?:r)?|reemplaz[ae](?:r)?|bautiz[ae](?:r)?|titul[ae](?:r)?|renombremos|cambiemos|modifiquemos|actualicemos|bauticemos|titulemos(?:\s+(?:el\s+)?nombre(?:\s+de)?)?)\s+(?:la\s+|el\s+)?((?:calle|carril|swimlane|zona|area|área|seccion)\s*[\p{L}\d_-]+)\s+(?:a|por|como|para\s+que\s+sea)\s+"?([\p{L}\d_ -]{2,})"?$/iu);
    if (lanePattern?.[1] && lanePattern?.[2]) {
      return {
        targetRef: lanePattern[1].trim(),
        newLabel: lanePattern[2].trim(),
        isLane: true
      };
    }

    // Node renaming (or fallback)
    const base = trimmed.match(/(?:renombr[ae]|cambi[ae](?:r)?|modific[ae](?:r)?|actualiz[ae](?:r)?|reemplaz[ae](?:r)?|bautiz[ae](?:r)?|titul[ae](?:r)?|renombremos|cambiemos|modifiquemos|actualicemos|bauticemos|titulemos(?:\s+(?:el\s+)?nombre(?:\s+de)?)?|pon(?:er|le)?\s+nombre\s+(?:a|de)?|llámale|llama|llámala|llamemos)\s+(?:la\s+|el\s+|al\s+)?(.+?)\s+(?:a|por|como|para\s+que\s+sea)\s+"?([\p{L}\d_ -]{2,})"?$/iu);
    if (base?.[1] && base?.[2]) {
      return {
        targetRef: base[1].replace(/^de\s+/i, '').trim(),
        newLabel: base[2].trim(),
        isLane: false
      };
    }

    return null;
  }

  private isConnectIntent(text: string): boolean {
    return /(conecta(?:r|le|la|los|las|mos|dos)?|relaciona(?:r|le|la|los|las|mos|dos)?|une(?:r|le|la|los|las|mos|dos)?|vincula(?:r|le|la|los|las|mos|dos)?|enlaza(?:r|le|la|los|las|mos|dos)?|asocia(?:r|le|la|los|las|mos|dos)?|liga(?:r|le|la|los|las|mos|dos)?|junta(?:r|le|la|los|las|mos|dos)?|tira(?:le|la|mos)?|pasa(?:lo|la|le|mos)?|manda(?:lo|la|le|mos)?|manda\s+a|pasa\s+a|tira.*linea|tira.*línea|apunta(?:le)?\s+a|dirige|encadena|amarra|conforma|concatena|engancha|conectemos|relacionemos|unamos|vinculemos|enlacemos|asociemos|liguemos|juntemos)/i.test(text || '');
  }

  private normalizeForSearch(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private resolveNodeLabelFromReference(ref: string, nodes: NodeData[]): string | null {
    const matches = this.findNodeMatches(ref, nodes);
    return matches.length > 0 ? (matches[0].label || null) : null;
  }

  private findLaneMatches(reference: string | null, nodes: NodeData[]): NodeData[] {
    const lanes = nodes
      .filter(n => n.type === 'swimlane')
      .sort((a, b) => (a.x || 0) - (b.x || 0));
    if (!reference || lanes.length === 0) return [];

    const ref = reference.trim();
    if (!ref) return [];

    if (/^\d+$/.test(ref)) {
      const idx = Number(ref);
      const byLabel = lanes.find(l => this.normalizeForSearch(l.label || '') === this.normalizeForSearch(`calle ${idx}`));
      if (byLabel) return [byLabel];
      const byIndex = lanes[idx - 1];
      return byIndex ? [byIndex] : [];
    }

    const target = this.normalizeForSearch(ref);
    const exact = lanes.filter(l => this.normalizeForSearch(l.label || '') === target);
    if (exact.length > 0) return exact;

    return lanes.filter(l => this.normalizeForSearch(l.label || '').includes(target) || target.includes(this.normalizeForSearch(l.label || '')));
  }

  private findNodeMatches(ref: string, nodes: NodeData[]): NodeData[] {
    let cleanRef = (ref || '').replace(/["'.,;:!?()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Eliminar prefijos comunes de lenguaje natural que ensucian la búsqueda de etiquetas
    cleanRef = cleanRef.replace(/^(?:la\s+actividad|el\s+nodo|la\s+tarea|el\s+paso|la\s+decision|el\s+inicio|el\s+fin|la\s+nota|el\s+datastore|la\s+caja|el\s+cuadrito|el\s+bloque|la\s+pregunta|la\s+condicion|el\s+subproceso|un|una|el|la|los|las)\s+/i, '').trim();

    if (!cleanRef) return [];

    const candidates = nodes.filter(n => !!n.label && n.label.trim().length > 0);
    const target = this.normalizeForSearch(cleanRef);

    const exact = candidates.filter(n => this.normalizeForSearch(n.label || '') === target);
    if (exact.length > 0) return exact;

    return candidates.filter(n => this.normalizeForSearch(n.label || '').includes(target) || target.includes(this.normalizeForSearch(n.label || '')));
  }

  private buildAmbiguityQuestion(step: string, nodes: NodeData[]): string | null {
    const laneRef = this.parseLaneReference(step);
    if (laneRef && !/^\d+$/.test(laneRef)) {
      const laneMatches = this.findLaneMatches(laneRef, nodes);
      if (laneMatches.length > 1) {
        const options = laneMatches
          .sort((a, b) => (a.x || 0) - (b.x || 0))
          .map((l, i) => `${i + 1}) ${l.label || 'Sin nombre'}`)
          .join(' | ');
        return `Encontre varios carriles con el nombre "${laneRef}". Cual quieres usar? ${options}`;
      }
    }

    const quotedRefs = [...step.matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(Boolean);
    for (const ref of quotedRefs) {
      const nodeMatches = this.findNodeMatches(ref, nodes);
      if (nodeMatches.length > 1) {
        const options = nodeMatches
          .slice(0, 5)
          .map((n, i) => `${i + 1}) ${n.label || 'Sin nombre'} (${n.type})`)
          .join(' | ');
        return `Hay varios nodos llamados "${ref}". Cual quieres usar? ${options}`;
      }
    }

    return null;
  }

  private tryBuildAddEdgeFromNaturalLanguage(message: string, nodes: NodeData[]): DiagramCommand | null {
    if (!this.isConnectIntent(message)) return null;

    const candidateNodes = nodes.filter(n => n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0);
    if (candidateNodes.length < 2) return null;

    // 1) Prioridad: nombres entre comillas, ej: relaciona "A" con "B"
    const quoted = [...message.matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(Boolean);
    if (quoted.length >= 2) {
      const src = this.resolveNodeLabelFromReference(quoted[0], candidateNodes);
      const tgt = this.resolveNodeLabelFromReference(quoted[1], candidateNodes);
      if (src && tgt && src !== tgt) {
        return { action: 'add_edge', sourceId: src, targetId: tgt, edgeStyle: 'solid' };
      }
    }

    // 2) Patrón natural: relacionar X con Y / unir X y Y / conectar X a Y
    const explicit = message.match(/(?:conecta(?:r)?|relaciona(?:r)?|une?|unir|vincula(?:r)?|enlaza(?:r)?|asocia(?:r)?|liga(?:r)?|junta(?:r)?)(?:\s+el\s+flujo)?\s+(?:de\s+)?(.+?)\s+(?:con|a|hacia|y|->)\s+(.+)/i);
    if (explicit?.[1] && explicit?.[2]) {
      const src = this.resolveNodeLabelFromReference(explicit[1], candidateNodes);
      const tgt = this.resolveNodeLabelFromReference(explicit[2], candidateNodes);
      if (src && tgt && src !== tgt) {
        return { action: 'add_edge', sourceId: src, targetId: tgt, edgeStyle: 'solid' };
      }
    }

    // 3) Heurística: tomar los dos nodos mencionados en el texto por aparición
    const normalizedMsg = this.normalizeForSearch(message);
    const found = candidateNodes
      .map(n => ({
        label: n.label || '',
        idx: normalizedMsg.indexOf(this.normalizeForSearch(n.label || ''))
      }))
      .filter(x => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    if (found.length >= 2 && found[0].label !== found[1].label) {
      return { action: 'add_edge', sourceId: found[0].label, targetId: found[1].label, edgeStyle: 'solid' };
    }

    return null;
  }
}
