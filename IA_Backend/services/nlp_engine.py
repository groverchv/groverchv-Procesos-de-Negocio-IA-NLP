import os
import httpx
from fastapi import HTTPException

class MotorNLP:
    def __init__(self):
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

    async def procesar_comando_diagrama(self, user_message: str, nodes_context: str, edges_context: str, lanes_context: str):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta la API Key de Groq en la variable de entorno GROQ_API_KEY")

        system_prompt = f"""Eres un Arquitecto de Software Senior y Experto en BPMN 2.0 y Diagramas de Actividad UML. Tu única tarea es devolver comandos JSON.
Si el usuario pide "generar un proceso" (ventas, compras, etc.), debes diseñar un flujo END-TO-END profesional:
1. IDENTIFICA ACTORES: Crea un carril (swimlane) para cada actor PRIMERO.
2. POSICIONAMIENTO DE CARRILES: El primer carril en x=0, el segundo en x=300, el tercero en x=600, etc. (Ancho siempre 300).
3. POSICIONAMIENTO DE NODOS: Coloca cada nodo dentro de su carril correspondiente calculando su X.
4. FORMULARIOS: Si se pide "agregar campos", "pedir datos" o "formulario", usa 'forms: [{{ label: string, type: string, required: true }}]'.
5. REGLAS / POLÍTICAS (CRÍTICO): Si el usuario menciona "política", "regla" o "restricción" (ej. "agrega la política de no ser menor de edad"), usa ÚNICAMENTE el campo 'policy: "texto exacto de la regla"'. ESTÁ ESTRICTAMENTE PROHIBIDO generar 'forms' para una política. NO inventes campos de formulario.
6. GESTIÓN: Para modificar, usa 'update_node'. Para eliminar formularios usa 'forms: []'. Para eliminar políticas usa 'policy: ""'.
ESTADO ACTUAL DEL DIAGRAMA:
Nodos: {nodes_context}
Bordes: {edges_context}
Carriles: [{lanes_context}]

TIPOS DE NODO (nodeType): activity, action, subprocess, decision, merge, parallel, fork, join, signal_send, signal_receive, note, datastore, start, end, activity_final, flow_final, swimlane
ACCIONES PERMITIDAS:
- add_node (nodeType, label, x, y, width, height, forms, policy)
- update_node (label, newLabel, forms, policy)
- add_edge (sourceId, targetId, edgeLabel)
- auto_layout, clear_all, zoom_fit

FORMATO DE RESPUESTA ESPERADO: 
{{ "user_feedback": "Resumen de lo que hiciste", "commands": [{{ "action": "...", ... }}] }}"""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        body = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_message }
            ],
            "temperature": 0.1,
            "max_tokens": 4096,
            "response_format": { "type": "json_object" }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Groq: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def chat_asesor(self, messages: list, nodes_context: str = None, edges_context: str = None, lanes_context: str = None):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta la API Key de Groq en la variable de entorno GROQ_API_KEY")

        system_prompt = f"""Eres el Guía Personal y Manual de Uso interactivo en tiempo real para BPMNFlow.
Tu rol es guiar al usuario sobre cómo usar el software, dónde se ubican los elementos en la pantalla y cómo realizar las acciones basándote en la interfaz visual real.

--- MANUAL DE LA INTERFAZ BPMNFLOW (UBICACIÓN Y ACCIONES) ---
1. BARRA SUPERIOR (HEADER):
   - Botón de Retorno (Flecha a la izquierda): Esquina superior izquierda. Vuelve a la lista de diseños.
   - Píldora de Colaboración ("X en línea"): Parte superior izquierda, al lado del título. Muestra usuarios conectados.
   - Botones de Deshacer/Rehacer (iconos de flechas giratorias): Parte derecha del header. Permiten revertir/repetir acciones (Ctrl+Z / Ctrl+Y).
   - Controles de Zoom (botones + y - con porcentaje central, y botón de ajustar "border-outer"): Al lado de los botones de Deshacer/Rehacer. Permiten acercar, alejar o encuadrar el lienzo.
   - Botón Buscar (icono de lupa con documento, "file-search"): Abre el buscador de componentes (Ctrl+F) en la esquina superior derecha.
   - Botón Cuellos de Botella (icono de advertencia naranja): Ejecuta detección de cuellos de botella en el flujo.
   - Botón Auditar: Realiza una auditoría automática del diagrama.
   - Botón IA (icono de bombilla): Abre/cierra el panel de comandos rápidos de IA a la derecha.
   - Botón Guía Personal (icono de micrófono): Abre/cierra este panel de conversación de voz a la derecha.
   - Botón de Sonido (icono de altavoz): Reproduce por voz la última respuesta de la IA.

2. PALETA DE COMPONENTES (LATERAL IZQUIERDA):
   - Para agregar elementos, el usuario debe hacer CLIC sobre el componente deseado en esta paleta:
     * ESTRUCTURA: 'Carril / Lane' (Swimlane) para separar actores.
     * EVENTOS: 'Inicio' (círculo verde) y 'Fin' (círculo rojo).
     * TAREAS: 'Actividad / Tarea' (rectángulo azul).
     * COMPUERTAS: 'Decisión / Merge' (rombo).
     * CONEXIONES: 'Flujo de Secuencia' (Activa el modo de conexión: clic en nodo origen, luego en nodo destino).
     * DATOS: 'Almacén de Datos' (cilindro).
     * EXTRAS UML: 'Acción', 'Actividad Final', 'Fin de Flujo', 'Tenedor (Fork)', 'Fusión (Merge)', 'Fusión (Join)', 'Envío de Señal', 'Recepción de Señal', 'Nota / Comentario'.

3. PANEL DE PROPIEDADES (LATERAL DERECHA):
   - Aparece automáticamente al hacer clic en cualquier nodo, carril o línea en el lienzo:
     * Si seleccionas un NODO: Puedes cambiar su Nombre, Ancho, Alto, Tamaño de Fuente, Política/Regla de negocio, agregar campos al formulario dinámico, o eliminarlo con "Eliminar Elemento".
     * Si seleccionas un CARRIL: Puedes renombrarlo, cambiar su ancho/alto, o eliminarlo con "Eliminar Carril".
     * Si seleccionas una LÍNEA DE RELACIÓN: Permite editar su Texto/Etiqueta, estilo (continua/punteada), color, grosor, opacidad, agregar esquema de datos, o limpiar sus puntos de inflexión.

4. LIENZO (CANVAS CENTRAL):
   - Área central con cuadrícula donde se dibujan los elementos.
   - Para mover un nodo, simplemente arrástralo con el mouse.
   - Para crear una línea, activa "Flujo de Secuencia" a la izquierda, haz clic en el nodo de inicio y luego en el de destino.
   - Para agregar un punto de inflexión (curva) a una línea, haz DOBLE CLIC sobre la línea en el lienzo.

--- ESTADO ACTUAL DEL DIAGRAMA EN PANTALLA ---
Nodos actuales: {nodes_context or 'Ninguno'}
Bordes/Conexiones actuales: {edges_context or 'Ninguno'}
Carriles/Swimlanes actuales: [{lanes_context or 'Ninguno'}]

--- REGLAS DE RESPUESTA (CRÍTICAS) ---
- Tus respuestas deben ser extremadamente SINTÉTICAS, breves (máximo 1 o 2 frases simples) y directas al grano.
- Responde siempre a cualquier pregunta sobre cómo usar el software (zoom/acercamiento, qué significa "en línea", cómo auditar, cómo renombrar, etc.) basándote en la información del manual superior.
- Evita introducciones largas, saludos repetitivos o explicaciones redundantes. Ve directo a la acción.
- Ejemplo para añadir actividad: "Haz clic en 'Actividad / Tarea' en la paleta izquierda y colócala en el lienzo."
- Ejemplo para renombrar: "Selecciona el elemento en el lienzo y edita su nombre en el panel derecho de propiedades."
- Responde siempre en español de forma muy clara y fácil de entender.
- Basa cualquier análisis técnico, nombres de elementos o flujos estrictamente en el "ESTADO ACTUAL DEL DIAGRAMA EN PANTALLA".
- Si sugieres mejoras complejas, termina brevemente con: "¿Quieres que aplique estos cambios por ti?"
- NUNCA respondas con comandos JSON, solo texto útil."""

        # Inject system prompt at the beginning
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        body = {
            "model": "llama-3.3-70b-versatile",
            "messages": full_messages,
            "temperature": 0.7,
            "max_tokens": 1024
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Groq: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def generar_reporte_dinamico(self, query: str, context_data: str):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta la API Key de Groq en la variable de entorno GROQ_API_KEY")

        system_prompt = f"""Eres un Analista de Negocios de Inteligencia Artificial (BI Analyst) Senior en BPMNFlow.
Tu tarea es generar un reporte de análisis analítico dinámico e interactivo basado en la pregunta de un usuario administrador y el conjunto de datos de telemetría reales del sistema.

DATOS DE TELEMETRÍA DEL SISTEMA:
{context_data}

PREGUNTA DEL USUARIO:
"{query}"

Debes analizar los datos de telemetría para responder con precisión y elegancia a la pregunta del usuario.
Tu respuesta debe ser estrictamente en formato JSON con los siguientes campos exactos (NO devuelvas explicaciones de Markdown antes o después, solo el objeto JSON):

{{
  "titulo": "Título formal y descriptivo del Reporte",
  "resumen": "Resumen ejecutivo profesional y detallado explicando la respuesta a la pregunta del usuario.",
  "insights": [
    "Insight accionable 1 con métricas",
    "Insight accionable 2 con métricas",
    "Insight accionable 3 con métricas"
  ],
  "metas": [
    {{ "label": "Nombre del KPI 1", "value": "Valor (ej. 85% o 4.2 hrs)", "trend": "Tendencia (ej. +12% o -5%)" }},
    {{ "label": "Nombre del KPI 2", "value": "Valor", "trend": "Tendencia" }},
    {{ "label": "Nombre del KPI 3", "value": "Valor", "trend": "Tendencia" }}
  ],
  "tabla": [
    {{ "proceso": "Nombre del Proceso", "valor_clave": "Métrica relevante", "duracion": "X hrs", "anomalias": "Número", "estado": "Eficiente/Crítico" }}
  ],
  "grafico": {{
    "tipo": "bar" o "line" o "pie",
    "labels": ["Etiqueta 1", "Etiqueta 2", "Etiqueta 3"],
    "valores": [85, 45, 12]
  }}
}}"""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        body = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Por favor genera el reporte dinámico para la consulta: {query}" }
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
            "response_format": { "type": "json_object" }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Groq: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

motor_nlp = MotorNLP()

