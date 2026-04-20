# 📋 DOCUMENTACIÓN COMPLETA: BPMNFlow - IA y Funcionalidades

**Última actualización:** 17 de abril de 2026  
**Versión:** 1.0

---

## 📑 TABLA DE CONTENIDOS

1. [Visión General del Software](#visión-general-del-software)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Los 3 Sistemas de IA](#los-3-sistemas-de-ia)
4. [Flujos de Trabajo](#flujos-de-trabajo)
5. [Comandos de Diagrama](#comandos-de-diagrama)
6. [Tipos de Nodos](#tipos-de-nodos)
7. [Reglas UML/BPMN](#reglas-umlbpmn)
8. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 🎯 VISIÓN GENERAL DEL SOFTWARE

**BPMNFlow** es una plataforma empresarial moderna para:
- **Diseño** de procesos de negocio usando diagramas UML 2.5 / BPMN 2.0
- **Ejecución** de procesos con formularios dinámicos
- **Colaboración** en tiempo real entre múltiples usuarios
- **Automatización** mediante IA para generación de comandos

### Roles de Usuarios

#### 1. **Diseñador**
- Crea proyectos y diseños de procesos
- Usa el editor visual para construir diagramas
- Modela flujos, decisiones, actividades en paralelo
- Usa IA para acelerar la creación

#### 2. **Funcionario**
- Ejecuta procesos ya modelados
- Llena formularios dinámicos asociados a actividades
- Avanza actividades de estado en estado
- Ve notificaciones en tiempo real

### Jerarquía de Datos

```
Proyecto
  ├── Diseño 1
  │   ├── Modelado (Diagrama Visual)
  │   │   ├── Nodos (Actividades, Decisiones, etc.)
  │   │   └── Conexiones (Flujos)
  │   └── Formularios Dinámicos
  ├── Diseño 2
  └── Diseño N

Ejecución
  └── Instancia de Proceso
      ├── Estado General (Pendiente → En Proceso → Finalizado)
      ├── Actividades con Estados
      ├── Datos de Formularios Completados
      └── Historial de Cambios
```

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Stack Tecnológico

**Frontend:**
- **Angular 18+** (TypeScript)
- **SVG Canvas** para renderizado visual
- **RxJS** para reactividad
- **WebSocket** para colaboración en tiempo real

**Backend:**
- **Spring Boot 3.x** (Java)
- **Gradle** como build tool
- **Base de Datos** (pendiente especificar)

**IA/APIs Externas:**
- **Groq API** (llama-3.3-70b-versatile) - IA rápida y económica
- **Google Gemini 2.0 Flash** - Multimodal (voz/texto)
- **ElevenLabs API** - Síntesis de voz (TTS)
- **Web Speech API** - Reconocimiento de voz (STT)

### Componentes Principales

#### **Frontend**
```
app/
├── components/         (UI reutilizable)
├── pages/             (Vistas principales)
├── Services/IA/       (Servicios de IA)
│   ├── ia.service.ts           (Procesador de comandos)
│   ├── chat-assistant.service.ts (Soporte Nivel 1)
│   └── gemini-live.service.ts  (Tonny-AI multimodal)
├── Services/
│   ├── modeling-socket.service.ts (WebSocket colaborativo)
│   └── types.ts                  (Interfaces TypeScript)
└── app.ts            (Componente raíz)
```

#### **Backend**
```
Backend/
├── src/main/java/com/example/Procesos/
│   ├── ProcesosApplication.java    (Punto de entrada)
│   ├── controller/                 (API REST endpoints)
│   ├── service/                    (Lógica de negocio)
│   ├── model/                      (Entidades de BD)
│   └── repository/                 (Acceso a datos)
└── pom.xml (Dependencias Maven)
```

---

## 🤖 LOS 3 SISTEMAS DE IA

### 1️⃣ **IA SERVICE** (Procesador de Comandos de Diagrama)

**Ubicación:** `Frontend/src/app/Services/IA/ia.service.ts`

**Propósito:** Convertir instrucciones de voz/texto natural en comandos estructurados para manipular el diagrama.

**Entrada:** Comando en lenguaje natural  
**Salida:** JSON con lista de comandos de diagrama

**Ejemplo:**
```
Usuario dice: "Agrega una actividad Revisión después de Validación"
↓
IA interpreta y genera:
{
  "commands": [
    {
      "action": "add_node",
      "nodeType": "activity",
      "label": "Revisión",
      "x": 320,
      "y": 200
    },
    {
      "action": "add_edge",
      "sourceId": "Validación",
      "targetId": "Revisión",
      "edgeStyle": "solid"
    }
  ],
  "explanation": "Agregué una actividad 'Revisión' y conecté el flujo desde 'Validación'",
  "umlValidation": null
}
```

**Carácter/Personalidad:**
> "Eres un Arquitecto de Software Senior y Experto en UML 2.5 con especialización en Diagramas de Actividad y BPMN 2.0."

**Lo que sabe hacer:**

#### **Entender el Estado Actual**
- Lee lista de nodos del diagrama (tipo, label, posición, dimensiones)
- Lee lista de conexiones (source, target, estilo, etiqueta)
- Lee carriles/swimlanes actuales (posición, ancho, alto)
- Contextualiza todo en el JSON que genera

#### **Interpretar Comandos Naturales**
- Identifica el tipo de acción: agregar, eliminar, mover, conectar, reorganizar, limpiar
- Busca referencias a nodos por nombre (label) o ID
- Entiende conceptos BPMN: "decisión", "rama paralela", "flujo condicional"
- Reconoce gramática variada: "crea", "agrega", "añade", "inserta"

#### **Generar JSON de Comandos**
Valida y genera comandos estructurados para 12 acciones posibles:
1. `add_node` - Agregar nodo al diagrama
2. `delete_node` - Eliminar nodo
3. `update_node` - Modificar propiedades
4. `add_edge` - Crear conexión/flujo
5. `delete_edge` - Eliminar flujo
6. `update_edge` - Cambiar propiedades del flujo
7. `move_node_to_lane` - Mover actividad a otro carril
8. `reconnect_edge` - Redirigir flujo a nuevos extremos
9. `reorder_lanes` - Reorganizar orden horizontal de carriles
10. `batch_update_style` - Cambiar estilo en lote (por tipo de nodo)
11. `auto_layout` - Reorganizar automáticamente
12. `clear_all` - Limpiar todo el diagrama

#### **Validar Reglas UML**
- Verifica máximo 1 nodo de inicio (start) por diagrama
- Comprueba que decisiones (XOR) tengan etiquetas en flujos salientes: `[Sí]`, `[No]`, etc.
- Alerta si hay nodos huérfanos (sin conexión)
- Diferencia flujos de control (solid) vs flujos de datos (dashed)
- Valida bifurcaciones paralelas: fork/join con entradas y salidas balanceadas

#### **Posicionamiento Inteligente**
- **Carriles como columnas:** x aumenta por carril, y inicia en 0
- **Dentro de carril:** coloca nodos entre `lane.x` y `lane.x + lane.width`
- **Espaciado vertical:** ~140px entre nodos consecutivos en el mismo carril
- **Nuevos carriles:** dimensión base 300×520 (ancho × alto)

#### **Manejo de Errores - FALLBACK**
Si la API Groq falla, intenta interpretar localmente:

```javascript
Palabras clave reconocidas:
- "agrega carril" → add_node swimlane
- "agrega calle" → add_node swimlane
- "agrega actividad X" → add_node activity
- "agrega decisión X" → add_node decision
- "agrega inicio" → add_node start
- "agrega fin" → add_node end
- "auto layout" → auto_layout
- "limpiar" → clear_all
- "borrar todo" → clear_all
```

Si tampoco hay fallback, notifica al usuario que falló la IA.

---

### 2️⃣ **CHAT ASSISTANT SERVICE** (Soporte de Nivel 1)

**Ubicación:** `Frontend/src/app/Services/IA/chat-assistant.service.ts`

**Propósito:** Responder preguntas generales sobre la plataforma BPMNFlow. Es el "helper" educativo.

**Entrada:** Pregunta en español sobre la plataforma  
**Salida:** Respuesta explicativa y amigable

**Ejemplo:**
```
Usuario pregunta: "¿Cómo funcionan los carriles en BPMNFlow?"
↓
IA responde: "Los carriles (swimlanes) en BPMNFlow son columnas verticales que 
representan actores, departamentos o sistemas en tu proceso. El título del carril 
va en la parte superior, y las actividades y flujos se colocan dentro de su 
correspondiente carril de arriba hacia abajo. Esto facilita ver quién es 
responsable de cada actividad."
```

**Carácter/Personalidad:**
> "Eres un asistente virtual experto de la plataforma BPMNFlow"

**Lo que sabe hacer:**

#### **Educar sobre Funcionalidades**
```
Puede explicar:
- Qué son roles (Diseñador vs Funcionario)
- Cómo funciona la jerarquía (Proyectos → Diseños → Modelados)
- Cómo usar el editor visual (drag & drop)
- Qué tipos de nodos existen
- Cómo funcionan los swimlanes (carriles)
- Qué son formularios dinámicos
- Cómo funciona la colaboración en tiempo real
- Cómo se ejecutan procesos
```

#### **Responder con Contexto**
- Mantiene historial conversacional (max 20 mensajes)
- Proporciona respuestas contextualizadas
- Auto-trim de historial antiguo

#### **Ser Amigable y Accesible**
- Responde siempre en español
- Usa lenguaje claro y accesible
- Para consultas técnicas avanzadas: proporciona pasos accionables y ejemplos
- Puede usar emojis para ser más amigable
- Admite cuando no sabe algo y sugiere documentación

#### **No Genera Comandos de Diagrama**
- Diferencia de IaService
- Es "soporte educativo", no "ejecutor de comandos"
- Si el usuario pide manipular diagrama directamente, sugiere usar IA o comandos

**Conversación típica:**
```
Usuario: "¿Qué es una decisión en BPMN?"
Assistant: "Una decisión (Decision Gateway en BPMN) es un nodo en forma de rombo 
que representa un punto de bifurcación en el flujo. Según una condición, el 
proceso toma diferentes caminos. Por ejemplo, '¿Aprobado?' podría llevar al 
camino 'Procesar' si es Sí, o 'Rechazar' si es No."

Usuario: "¿Cómo creo una decisión?"
Assistant: "En el modelador, hay dos formas:
1. Arrastra el nodo 'Decisión' desde el panel izquierdo al canvas
2. Usa la IA: di 'agrega una decisión ¿Aprobado?'
¿Necesitas ayuda con alguno de estos pasos?"
```

---

### 3️⃣ **TONNY-AI SERVICE** (Asistente Inteligente Multimodal)

**Ubicación:** `Frontend/src/app/Services/IA/gemini-live.service.ts`

**Propósito:** Asistente en vivo con soporte de voz/texto, experto en BPMN y ayuda contextual del diagrama.

**Entrada:** Voz o texto  
**Salida:** Voz o texto (respuestas multimodales)

**Ejemplo:**
```
Usuario habla: "Tonny, analiza mi diagrama y dime si hay errores"
↓
Tonny-AI (Gemini WebSocket):
- Recibe contexto del diagrama actual
- Analiza nodos, conexiones, carriles
- Identifica: nodo huérfano, decisión sin guardas, ciclo infinito
- Responde por voz (ElevenLabs TTS):
  "Encontré 2 problemas en tu diagrama. 
   1. La actividad 'Espera' no tiene conexión de salida.
   2. La decisión '¿Válido?' necesita etiquetas en los flujos [Sí] y [No].
   ¿Quieres que te ayude a arreglarlos?"
```

**Carácter/Personalidad:**
> "Eres Tonny-AI, el asistente virtual inteligente de BPMNFlow. 
> Tu nombre es Tonny y eres experto en modelado de procesos de negocio."

**Lo que sabe hacer:**

#### **Análisis del Diagrama Actual**
- Recibe contexto: nodos, conexiones, carriles
- Identifica errores lógicos:
  - Nodos huérfanos (sin conexión)
  - Bucles infinitos
  - Caminos sin salida (dead-ends)
  - Decisiones sin guardas
  - Bifurcaciones paralelas desbalanceadas

#### **Sugerir Mejoras de Modelado**
```
Ejemplos:
- "Este flujo es muy largo, considera usar un subproceso aquí"
- "Esta decisión debería tener 3 caminos, no 2"
- "El carril 'Sistema' está vacío, ¿debería haber una integración ahí?"
```

#### **Guiar Paso a Paso**
- Proporciona instrucciones detalladas para crear diagramas
- Explica concepto + paso a paso + validación

#### **Explicar Conceptos UML/BPMN**
- Fork vs Join
- XOR vs AND vs OR gateways
- Símbolos BPMN
- Mejores prácticas

#### **Multimodal (Voz + Texto)**
- **Entrada:** 
  - Voz (micrófono → Web Speech API → texto)
  - Texto (chat directo)
- **Salida:**
  - Voz (Gemini genera audio → ElevenLabs TTS para síntesis)
  - Texto (respuesta en chat)

#### **Gemini WebSocket (Primario)**
```
Conexión en vivo con Google Gemini 2.0 Flash:
- Baja latencia
- Respuestas rápidas
- Audio en tiempo real
- Modelo: models/gemini-2.0-flash-exp
```

#### **Fallback a Groq (Si Gemini falla)**
```
Si WebSocket Gemini cae:
1. Usa Groq llama-3.3-70b-versatile para generar texto
2. Usa ElevenLabs para convertir a voz
3. Mantiene conversación funcional
```

**Conversación típica:**
```
Usuario: "Hola Tonny"
Tonny: "¡Hola! Soy Tonny, tu asistente de BPMNFlow. 
       ¿En qué puedo ayudarte hoy?"

Usuario: "Necesito hacer un flujo para aprobación de documentos"
Tonny: "Perfecto, te ayudaré. Un flujo típico de aprobación tiene:
       1. Inicio
       2. Envío de documento
       3. Revisión (en el carril de Revisor)
       4. Decisión: ¿Aprobado?
       5. Si Sí → Finalizar
       6. Si No → Correcciones → Vuelta a Revisión
       
       ¿Comenzamos? Primero crea dos carriles: Solicitante y Revisor."

Usuario: (crea los carriles)
Tonny: "¡Excelente! Ahora arrastra un nodo de Inicio en el carril Solicitante..."
```

---

## 🔄 FLUJOS DE TRABAJO

### Flujo 1: Usuario Usa IA para Crear Diagrama

```
1. Usuario abre Modelador en modo DISEÑADOR

2. Usuario hace clic en botón "🤖 IA" o "🎤" (micrófono)

3. Usuario dice/escribe comando:
   "Agrega una actividad Validación en el carril Usuario"

4. IaService.processCommand() se ejecuta:
   a) Envía comando a Groq API
   b) Groq interpreta y genera JSON
   c) IaService normaliza respuesta (valida, corrige)
   d) Si falla Groq, usa fallback local
   e) Retorna IaResponse con commands array

5. Modelador (modeler.ts) recibe commands:
   a) Itera cada comando
   b) Ejecuta acción correspondiente (addNode, addEdge, etc.)
   c) Actualiza estado local this.nodes[], this.edges[]
   d) Re-renderiza SVG en pantalla
   e) Emite cambios a WebSocket para otros usuarios

6. Usuario ve cambios en tiempo real en canvas

7. Modelador valida integridad UML:
   - Si hay errores, muestra alertas
   - IaService indicó en umlValidation si había problemas

8. Usuario continúa creando/refinando diagrama con más comandos IA
```

### Flujo 2: Usuario Hace Pregunta sobre Plataforma

```
1. Usuario hace clic en botón "💬 Chat" o "Asistente"

2. Usuario escribe pregunta:
   "¿Cómo funcionan los swimlanes?"

3. ChatAssistantService.chat() se ejecuta:
   a) Agrega pregunta a historial conversacional
   b) Envía [systemPrompt + historial] a Groq API
   c) Groq genera respuesta educativa
   d) ChatAssistant agrega respuesta a historial
   e) Retorna string de respuesta

4. UI muestra respuesta en chat panel

5. Usuario puede hacer follow-up:
   "¿Y cómo muevo una actividad entre carriles?"

6. ChatAssistant responde con historial previo (contexto)

7. Conversación continúa hasta que usuario cierre chat
```

### Flujo 3: Usuario Usa Tonny-AI (Voz)

```
1. Usuario hace clic en botón "🎤 Tonny-AI" o dice "Tonny"

2. GeminiLiveService.connect() intenta WebSocket:
   a) Si éxito: conecta a Gemini 2.0 Flash
   b) Si fallo: usa Groq como fallback

3. Usuario habla (micrófono):
   - Web Speech API captura audio
   - Convierte a texto con STT

4. GeminiLiveService.sendText() envía texto a Gemini:
   a) Gemini recibe: [systemPrompt + contexto diagrama + texto usuario]
   b) Gemini genera respuesta
   c) Gemini genera audio simultáneamente (prebuilt voice Aoede)

5. UI muestra:
   - Transcript del usuario (STT)
   - Respuesta de Tonny en chat
   - Audio de voz de Tonny reproduciéndose

6. Usuario escucha y puede responder
   - Dice siguiente comando/pregunta
   - Micrófono captura nuevamente
   - Ciclo continúa

7. Si Gemini WebSocket falla:
   a) Fallback a fallbackQuery() (Groq + ElevenLabs)
   b) Groq genera texto
   c) ElevenLabs sintetiza voz (Rachel voice)
   d) Experiencia degradada pero funcional
```

### Flujo 4: Usuario Ejecuta Proceso (Rol Funcionario)

```
1. Funcionario abre proyecto → selecciona Diseño → ve diagrama validado

2. Funcionario hace clic "Iniciar Proceso"

3. Backend crea Instancia de Proceso:
   - Estado: PENDIENTE
   - Copia nodos/conexiones del diseño
   - Identifica nodos de inicio (start)
   - Marca como actividades pendientes

4. Funcionario accede a "Mi Bandeja de Trabajo"
   - Ve actividades asignadas a su rol

5. Funcionario selecciona actividad "Completar Solicitud"
   - Se muestra formulario dinámico
   - Rellena campos (texto, número, fecha, select, archivo)

6. Funcionario hace clic "Completar Actividad"

7. Backend:
   a) Valida datos del formulario
   b) Marca actividad como COMPLETADA
   c) Analiza flujo saliente (decision si hay, next activity)
   d) Si hay decisión: backend usa IA (GeminiLive fallback) para evaluar condición
   e) Activa siguiente actividad
   f) Emite notificación WebSocket a otros usuarios
   g) Si proceso termina: genera estado FINALIZADO

8. Funcionario ve progreso en tiempo real
```

---

## 🔧 COMANDOS DE DIAGRAMA

Todos los 12 comandos que IA puede generar:

### 1. ADD_NODE - Agregar Nodo

```json
{
  "action": "add_node",
  "nodeType": "activity",          // Tipo (activity, decision, swimlane, etc.)
  "label": "Revisar Solicitud",   // Nombre del nodo
  "x": 320,                        // Posición X en canvas
  "y": 150,                        // Posición Y en canvas
  "width": 180,                    // Ancho (opcional, toma default)
  "height": 80,                    // Alto (opcional, toma default)
  "fontSize": 14,                  // Tamaño fuente (opcional)
  "responsible": "Usuario"         // Para swimlanes: responsable
}
```

### 2. DELETE_NODE - Eliminar Nodo

```json
{
  "action": "delete_node",
  "nodeId": "node-123"             // O usar label
  // O
  "label": "Revisar Solicitud"     // Busca por nombre
}
```
*También elimina automáticamente todas las conexiones del nodo*

### 3. UPDATE_NODE - Modificar Nodo

```json
{
  "action": "update_node",
  "nodeId": "node-123",            // O label
  "newLabel": "Revisar y Aprobar",  // Cambiar nombre
  "x": 400,                        // Nueva posición X
  "y": 200,                        // Nueva posición Y
  "width": 200,                    // Nuevo ancho
  "fontSize": 16,                  // Nuevo tamaño fuente
  "policy": "Auto-approved"        // Para decisiones: política
}
```

### 4. ADD_EDGE - Agregar Conexión/Flujo

```json
{
  "action": "add_edge",
  "sourceId": "node-123",          // De (nodeId o label)
  "targetId": "node-456",          // Hacia (nodeId o label)
  "edgeLabel": "[Sí]",             // Etiqueta del flujo (para decisiones)
  "edgeStyle": "solid",            // solid (control) o dashed (datos)
  "edgeColor": "#000000"           // Color hexadecimal (opcional)
}
```

### 5. DELETE_EDGE - Eliminar Conexión

```json
{
  "action": "delete_edge",
  "edgeId": "edge-789"             // O usar sourceId+targetId
  // O
  "sourceId": "node-123",
  "targetId": "node-456"
}
```

### 6. UPDATE_EDGE - Modificar Conexión

```json
{
  "action": "update_edge",
  "edgeId": "edge-789",            // O sourceId+targetId
  "edgeLabel": "[Aprobado]",       // Cambiar etiqueta
  "edgeStyle": "dashed",           // Cambiar tipo
  "edgeColor": "#FF0000"           // Cambiar color
}
```

### 7. MOVE_NODE_TO_LANE - Mover a Carril

```json
{
  "action": "move_node_to_lane",
  "nodeId": "node-123",            // O label
  "targetLaneName": "Administrador" // Nombre del carril destino
}
```
*Preserva todas las conexiones*

### 8. RECONNECT_EDGE - Redirigir Flujo

```json
{
  "action": "reconnect_edge",
  "edgeId": "edge-789",            // O sourceId+targetId actual
  "newSourceId": "node-999",       // Nuevo origen
  "newTargetId": "node-888"        // Nuevo destino
}
```

### 9. REORDER_LANES - Reorganizar Carriles

```json
{
  "action": "reorder_lanes",
  "laneOrder": ["Secretario", "Administrador", "Sistema"]
}
```
*Reorganiza orden horizontal de carriles*

### 10. BATCH_UPDATE_STYLE - Cambio en Lote

```json
{
  "action": "batch_update_style",
  "targetType": "decision",        // Tipo de nodo a cambiar
  "fontSize": 16,                  // Nuevo tamaño (todos los de ese tipo)
  "width": 100,                    // Nuevo ancho
  "height": 100                    // Nuevo alto
}
```

### 11. AUTO_LAYOUT - Reorganización Automática

```json
{
  "action": "auto_layout"
  // Sin parámetros adicionales
  // Frontend optimiza posiciones para mejor legibilidad
}
```

### 12. CLEAR_ALL - Limpiar Todo

```json
{
  "action": "clear_all"
  // Sin parámetros
  // Elimina todos los nodos y conexiones
}
```

---

## 📦 TIPOS DE NODOS

BPMNFlow soporta 15 tipos de nodos BPMN/UML estándar:

### **Eventos**
- **start** - Nodo Inicial (círculo sólido)  
  *Punto de comienzo del proceso*
  
- **end** - Nodo Final (círculo con borde)  
  *Fin normal del proceso*
  
- **activity_final** - Actividad Nodo Final (círculo bullseye)  
  *Fin dentro de una actividad*
  
- **flow_final** - Nodo Final del Flujo (círculo con X)  
  *Fin de rama específica*

### **Tareas/Actividades**
- **activity** - Tarea / Actividad (rectángulo redondeado)  
  *Acción que realiza alguien o algo*
  
- **subprocess** - Subproceso (rectángulo con ícono +)  
  *Actividad que contiene un sub-flujo desglosado*

### **Compuertas/Decisiones**
- **decision** - Compuerta Exclusiva XOR (rombo)  
  *Un solo camino se ejecuta (Sí/No, Opción A/B/C)*
  
- **parallel** - Compuerta Paralela AND (rombo con +)  
  *Todos los caminos se ejecutan en paralelo*

### **Control de Flujo**
- **fork** - Tenedor (barra vertical fina)  
  *Bifurca 1 flujo en múltiples flujos paralelos*
  
- **join** - Unión / Merge (barra vertical fina)  
  *Unifica múltiples flujos paralelos en 1*

### **Señales**
- **signal_send** - Envío de Señales (pentágono derecha)  
  *Emite señal a otro proceso/componente*
  
- **signal_receive** - Recepción de Señal (pentágono izquierda)  
  *Espera y recibe señal de otro proceso*

### **Datos/Documentación**
- **note** - Nota o Comentario (rectángulo esquina doblada)  
  *Anotación para documentar el diagrama*
  
- **datastore** - Almacén de Datos (cilindro)  
  *Base de datos, archivo, o sistema externo*

### **Contenedores**
- **swimlane** - Carril / Calle (columna vertical)  
  *Agrupa actividades por actor/departamento/sistema*
  
  **Propiedades especiales:**
  - `label`: Nombre del carril
  - `x, y`: Posición (siempre y=0)
  - `width`: 300 (default)
  - `height`: Se expande con contenido
  - `responsible`: Actor/departamento

---

## ✅ REGLAS UML/BPMN

### Regla 1: Un Solo Nodo de Inicio

```
❌ INVÁLIDO:
[Inicio 1] → Actividad A
[Inicio 2] → Actividad B

✅ VÁLIDO:
[Inicio] → {fork} → Actividad A
         → Actividad B
```

### Regla 2: Decisiones Deben Tener Guardas

```
❌ INVÁLIDO:
        ┌─→ Procesar
    {?} → Rechazar
        └─→ Esperar

✅ VÁLIDO:
        ┌─→ Procesar    [Sí]
    {?} → Rechazar      [No]
        └─→ Esperar     [Pendiente]
```

### Regla 3: Sin Nodos Huérfanos

```
❌ INVÁLIDO:
[Inicio] → Actividad A → [Fin]
          (desconectada) Actividad B

✅ VÁLIDO:
[Inicio] → Actividad A → [Fin]
          Actividad B   → [Fin]
```

### Regla 4: Bifurcaciones Paralelas Balanceadas

```
❌ INVÁLIDO:
     ┌─→ Actividad A
{fork} ─→ Actividad B    → {join} ✗ (3 entradas, 1 salida)
     ├─→ Actividad C

✅ VÁLIDO:
     ┌─→ Actividad A
{fork} ─→ Actividad B    → {join}
     └─→ Actividad C
```

### Regla 5: Diferencia Flujos Solid vs Dashed

- **Solid (━━)**: Flujo de Control (secuencia, decisión)
- **Dashed (- - -)**: Flujo de Datos (objeto de datos enviado)

```
Activity A ━━━━→ Activity B    (Control: B ejecuta después de A)
Activity A - - - → Data Store  (Datos: A envía datos a almacén)
```

---

## 💡 EJEMPLOS PRÁCTICOS

### Ejemplo 1: Proceso Simple de Aprobación

**Usuario dice:** "Crea un flujo de aprobación de solicitud"

**IA genera:**
```json
{
  "commands": [
    {
      "action": "add_node",
      "nodeType": "swimlane",
      "label": "Solicitante",
      "x": 0,
      "y": 0,
      "width": 300,
      "height": 520
    },
    {
      "action": "add_node",
      "nodeType": "swimlane",
      "label": "Gerente",
      "x": 300,
      "y": 0,
      "width": 300,
      "height": 520
    },
    {
      "action": "add_node",
      "nodeType": "start",
      "label": "Inicio",
      "x": 80,
      "y": 50
    },
    {
      "action": "add_node",
      "nodeType": "activity",
      "label": "Enviar Solicitud",
      "x": 80,
      "y": 150
    },
    {
      "action": "add_node",
      "nodeType": "activity",
      "label": "Revisar Solicitud",
      "x": 380,
      "y": 150
    },
    {
      "action": "add_node",
      "nodeType": "decision",
      "label": "¿Aprobado?",
      "x": 380,
      "y": 280
    },
    {
      "action": "add_node",
      "nodeType": "activity",
      "label": "Procesar",
      "x": 80,
      "y": 380
    },
    {
      "action": "add_node",
      "nodeType": "activity",
      "label": "Rechazar",
      "x": 580,
      "y": 380
    },
    {
      "action": "add_node",
      "nodeType": "end",
      "label": "Fin",
      "x": 80,
      "y": 480
    },
    {
      "action": "add_edge",
      "sourceId": "Inicio",
      "targetId": "Enviar Solicitud",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "Enviar Solicitud",
      "targetId": "Revisar Solicitud",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "Revisar Solicitud",
      "targetId": "¿Aprobado?",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "¿Aprobado?",
      "targetId": "Procesar",
      "edgeLabel": "[Sí]",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "¿Aprobado?",
      "targetId": "Rechazar",
      "edgeLabel": "[No]",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "Procesar",
      "targetId": "Fin",
      "edgeStyle": "solid"
    },
    {
      "action": "add_edge",
      "sourceId": "Rechazar",
      "targetId": "Fin",
      "edgeStyle": "solid"
    }
  ],
  "explanation": "Creé un flujo de aprobación de solicitud con dos carriles: Solicitante y Gerente. El solicitante envía la solicitud, el gerente la revisa y decide si aprobar o rechazar. Ambos caminos terminan en el nodo Fin.",
  "umlValidation": null
}
```

**Resultado Visual:**
```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│      SOLICITANTE                │  │        GERENTE                  │
│                                 │  │                                 │
│  ◯ Inicio                        │  │                                 │
│   │                              │  │                                 │
│   ▼                              │  │                                 │
│ ┌─────────────────┐              │  │                                 │
│ │ Enviar Solicitud│──────────────┼──┼─→ ┌──────────────────┐          │
│ └─────────────────┘              │  │   │ Revisar Solicitud│          │
│                                 │  │   └──────────────────┘          │
│                                 │  │      │                          │
│                                 │  │      ▼                          │
│                                 │  │     ◇ ¿Aprobado?                │
│                                 │  │    ╱  ╲                         │
│                                 │  │  [Sí][No]                      │
│                                 │  │  /        \                     │
│   ┌────────────┐                │  │ ▼          ▼                    │
│   │  Procesar  │←───────────────┼──┼─────────────────────→ Rechazar  │
│   └────────────┘                │  │                        │        │
│      │                          │  │                        │        │
│      └────────────────┐         │  │                        │        │
│                       ▼         │  │                        ▼        │
│                      ◯ Fin      │  │                      ◯ Fin      │
│                                 │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Ejemplo 2: Usuario Corrige Error

**Usuario dice:** "La decisión necesita una tercera opción: Pendiente"

**IA genera:**
```json
{
  "commands": [
    {
      "action": "add_edge",
      "sourceId": "¿Aprobado?",
      "targetId": "Revisar Solicitud",
      "edgeLabel": "[Pendiente]",
      "edgeStyle": "solid"
    }
  ],
  "explanation": "Agregué una tercera opción a la decisión. Ahora si es [Pendiente], el flujo vuelve a Revisar Solicitud.",
  "umlValidation": null
}
```

### Ejemplo 3: Usuario Pide Análisis

**Usuario (hablando a Tonny):** "Analiza este diagrama, ¿tiene problemas?"

**Tonny-AI responde (por voz):**
```
"He analizado tu diagrama y encontré 2 problemas:

1. La actividad 'Notificar' no tiene conexión de salida. 
   Debe conectarse a algo, como el nodo Fin o volver atrás.

2. La decisión '¿Válido?' tiene dos salidas: [Sí] y [No], 
   pero deberías considerar un tercer caso: [Revisar Después].

¿Quieres que te ayude a arreglar estos problemas?"
```

---

## 📊 RESUMEN DE FUNCIONES POR CONTEXTO

### **Contexto 1: Modelador (Crear Diagrama)**

| Acción | Herramienta | Resultado |
|--------|------------|-----------|
| Arrastra nodo | UI Canvas | Nodo se crea en posición |
| Dice "Agrega actividad X" | IA Service | Nodo se agrega automático |
| Pregunta "¿Cómo hago...?" | Chat Assistant | Explicación educativa |
| "Tonny, analiza mi diagrama" | Tonny-AI | Análisis y sugerencias |
| Conecta dos nodos | UI Canvas | Flujo de secuencia se crea |
| Dice "Auto layout" | IA Service | Nodos se reorganizan |

### **Contexto 2: Preguntas sobre Plataforma**

| Pregunta | Servicio | Respuesta |
|----------|----------|-----------|
| ¿Qué es un swimlane? | Chat Assistant | Explicación + ejemplo |
| ¿Cómo muevo un nodo? | Chat Assistant | Paso a paso |
| ¿Cuáles son los roles? | Chat Assistant | Descripción de Diseñador y Funcionario |

### **Contexto 3: Ejecución (Usuario Funcionario)**

| Acción | Proceso |
|--------|---------|
| Inicia proceso | Backend crea instancia, marca inicio como pendiente |
| Rellena formulario | Validación, almacena datos |
| Completa actividad | Backend evalúa siguiente paso, emite notificaciones |
| Ve diagrama en ejecución | Muestra estado actual (en progreso, completada, etc.) |

---

## 🔐 SEGURIDAD Y VALIDACIÓN

### Validación en IaService
1. IA genera JSON
2. Sistema valida estructura
3. Sistema verifica referencias (¿existen nodos/carriles?)
4. Sistema normaliza coordenadas
5. Sistema ejecuta comando si es válido
6. Si hay error: muestra advertencia UML

### Validación en Ejecución (Backend)
1. Verifica permisos de usuario
2. Valida datos de formulario
3. Verifica transiciones de estado válidas
4. Registra cambios en audit log
5. Notifica a usuarios afectados

---

## 📝 NOTAS FINALES

**Lo que hace BPMNFlow:**
- ✅ Modelado visual intuitivo de procesos
- ✅ IA para acelerar creación
- ✅ Asistentes expertos (educación + análisis)
- ✅ Ejecución automatizada
- ✅ Colaboración en tiempo real
- ✅ Formularios dinámicos
- ✅ Validación BPMN/UML

**Lo que hace la IA:**
- ✅ Interpreta comandos naturales
- ✅ Genera diagramas automáticamente
- ✅ Analiza diagrama para errores
- ✅ Sugiere mejoras
- ✅ Educa sobre BPMN/UML
- ✅ Responde preguntas de la plataforma
- ✅ Multimodal (voz + texto)

---

**Documento generado:** 17 de abril de 2026  
**Versión:** 1.0  
**Autor:** Equipo BPMNFlow
