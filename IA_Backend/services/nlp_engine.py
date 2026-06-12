import os
import base64
import httpx
from fastapi import HTTPException
import contextvars

provider_var = contextvars.ContextVar("provider", default=None)

class MotorNLP:
    def __init__(self):
        ollama_base = os.getenv("OLLAMA_URL", "").rstrip("/")
        if ollama_base:
            print(f"[MotorNLP] Configurado con soporte local Ollama/LM Studio en: {ollama_base}")
        else:
            print(f"[MotorNLP] Configurado con soporte GROQ CLOUD por defecto.")

    def _get_target(self):
        provider = provider_var.get()
        ollama_base = os.getenv("OLLAMA_URL", "").rstrip("/")
        
        # Si se solicita 'groq' o si no hay ollama local configurado:
        if provider == "groq" or not ollama_base:
            url = "https://api.groq.com/openai/v1/chat/completions"
            local_model = os.getenv("OLLAMA_MODEL", "gemma2")
            if "gemma" in local_model.lower():
                model = "llama3-8b-8192"
            elif "llama" in local_model.lower():
                model = "llama-3.1-8b-instant"
            else:
                model = "llama3-8b-8192"
            return url, model
        else:
            url = f"{ollama_base}/v1/chat/completions"
            model = os.getenv("OLLAMA_MODEL", "gemma-2-2b-it")
            return url, model

    @property
    def groq_url(self) -> str:
        url, model = self._get_target()
        return url

    @property
    def model_name(self) -> str:
        url, model = self._get_target()
        return model

    async def procesar_comando_diagrama(self, user_message: str, nodes_context: str, edges_context: str, lanes_context: str):
        api_key = os.getenv("GROQ_API_KEY", "ollama")

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
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_message }
            ],
            "temperature": 0.1,
            "max_tokens": 4096,
            "stop": ["<unused", "<unused23>", "```"]
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # Limpiar bloques markdown si existen
                import re
                match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                if match:
                    content = match.group(1)
                else:
                    content = content.replace("```json", "").replace("```", "").strip()
                
                # Quitar tokens raros de LM Studio como <unused23>
                content = re.sub(r'<unused\d+>', '', content)
                return content.strip()
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Ollama: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def chat_asesor(self, messages: list, nodes_context: str = None, edges_context: str = None, lanes_context: str = None):
        api_key = os.getenv("GROQ_API_KEY", "ollama")

        system_prompt = f"""Eres el Guía Personal, un asistente virtual muy amigable, simpático y conversacional para BPMNFlow.
Tu rol es actuar como un asistente amigo del usuario: habla con cercanía, calidez y rapidez. Si el usuario te saluda, te saluda de vuelta informalmente, o se despide, debes contestar de manera natural y muy amistosa.
Tu objetivo es guiar al usuario sobre cómo usar el software basándote en la interfaz visual real.

¡IMPORTANTE!: Si el usuario pregunta con quién hablar o cómo solicitar/realizar trámites, explícale de forma muy clara y amistosa que debe hablar con el "Asesor IA" (el botón azul en la barra superior que dice "Asesor IA").

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
- Tus respuestas deben ser sumamente amigables, sintéticas, rápidas y breves (máximo 2 o 3 frases simples).
- Actúa como un asistente amigo del usuario: si te saluda ("hola", "buenas", etc.) o se despide ("adiós", "gracias"), responde con calidez y naturalidad.
- Si te consultan con quién hablar para solicitar trámites, indícales amigablemente que deben usar el 'Asesor IA' (el botón azul arriba a la derecha).
- Basa cualquier respuesta técnica sobre cómo usar el software en el manual de interfaz superior de manera sencilla y clara.
- NUNCA respondas con comandos JSON, solo texto útil y conversacional."""

        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": full_messages,
            "temperature": 0.7,
            "max_tokens": 1024
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Ollama: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def generar_reporte_dinamico(self, query: str, context_data: str):
        api_key = os.getenv("GROQ_API_KEY", "ollama")

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
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Por favor genera el reporte dinámico para la consulta: {query}" }
            ],
            "temperature": 0.3,
            "max_tokens": 2048
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Ollama: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def chat_movil(self, messages: list, proceso_context: str = None):
        api_key = os.getenv("GROQ_API_KEY", "ollama")
        context_section = proceso_context or "No se proporcionó contexto de procesos del usuario."

        system_prompt = f"""Eres BPMN Asesor, el asistente virtual inteligente integrado en la aplicación móvil de BPMNFlow.
Tu función principal es ser el GUÍA DE DECISIONES del proceso BPM activo del usuario.
Cuando el usuario pregunta por su proceso, sus opciones o qué camino tomar, DEBES analizar el flujo y guiarlo con decisiones claras y justificadas.

=== CONTEXTO DE DATOS DEL USUARIO (actualizado en tiempo real) ===
{context_section}

=== CAPACIDAD PRINCIPAL: ANÁLISIS DE DECISIONES EN FLUJOS BPM ===
Cuando el contexto del usuario muestre un proceso ACTIVO con una CONDICIÓN (gateway / punto de decisión / compuerta),
debes actuar como un asesor experto que:

1. IDENTIFICA EL PUNTO DE DECISIÓN: Detecta si hay una condición pendiente (ej. "Condición?", "¿Aprueba?", "¿Requiere revisión?").

2. ANALIZA AMBOS CAMINOS y los describe con claridad:
   - Camino SI (ruta corta/rápida): qué actividades quedan, cuánto tarda aproximadamente, ventajas.
   - Camino NO (ruta larga): qué actividades extra se ejecutan, cuánto tarda más, implicaciones.

3. RECOMIENDA el camino más conveniente con razones específicas:
   - Basándose en el estado actual (pasos completados, tiempo transcurrido, urgencia).
   - Explica POR QUÉ ese camino es mejor para el usuario en su situación concreta.
   - Explica QUÉ PASARÍA si elige la otra opción (consecuencias, pasos adicionales, tiempo extra).

4. Responde a CUALQUIER PREGUNTA del usuario sobre el proceso, las actividades, el flujo, o dudas generales.

=== ESTRUCTURA DEL FLUJO BPM GENÉRICO (para procesos con condición SI/NO) ===
Cuando detectes un proceso con gateway/condición en el contexto, interpreta así:
- CAMINO SI → Ruta corta: menos actividades, termina más rápido. Ideal cuando se cumplen los requisitos base.
- CAMINO NO → Ruta larga: pasa por actividades adicionales de revisión/verificación antes de llegar al fin.
  Activa este camino cuando hay documentación incompleta, aprobaciones pendientes, o se requiere validación extra.

Ejemplo de respuesta para análisis de decisión:
"En este momento estás en la Condición del proceso [Nombre]. 
Te recomiendo elegir SÍ porque [razón concreta basada en tu estado actual].
Si eliges SÍ: el proceso terminará pronto pasando solo por [actividades restantes], en aproximadamente [tiempo estimado].
Si eliges NO: el proceso continuará por [actividades extras], lo que tomará [tiempo adicional] más, porque [explicación del por qué ese camino existe]."

=== INFORMACIÓN DEL SISTEMA BPMNFLOW ===
BPMNFlow es una plataforma de gestión de procesos de negocio. Los usuarios (clientes) pueden:
1. Ver proyectos y sus diseños (procesos).
2. Solicitar acceso a un proceso específico tocando la carpeta y presionando "Solicitar Acceso".
3. Una vez habilitado por un Funcionario, pueden iniciar el proceso.
4. El proceso avanza por actividades (PENDING → IN_PROCESS → FINISHED).
5. El estado de sus trámites se puede ver en la pestaña "Activos" de la app.

=== TIPOS DE PROCESOS COMUNES ===
- Solicitud de Licencia/Vacaciones: Muy rápido (~1.2 horas), tasa de éxito 99.8%
- Solicitud de Crédito/Aprobaciones: Complejo (~24 horas), requiere múltiples aprobaciones
- Onboarding de Personal: Duración media (~12 horas)
- Soporte Técnico: Rápido (~3.4 horas), bien procedimentado
- Compras Corporativas: Lento (~72 horas), depende de proveedores externos

=== REGLAS DE RESPUESTA (MUY IMPORTANTES) ===
- Responde SIEMPRE en español con un tono muy amigable, cercano y cálido (como un asistente amigo).
- Si el usuario te saluda ("hola", "buenas", etc.) o se despide ("adiós", "gracias"), responde de forma natural, atenta y amistosa.
- Mantén tus respuestas sintéticas y concisas (máximo 3 o 4 oraciones cortas).
- Para decisiones (¿sí o no?, ¿qué camino?): Di qué recomiendas de forma directa y amistosa, luego explica el camino SI y el camino NO brevemente en una oración.
- Escribe de forma natural y conversacional, sin viñetas, sin listas, sin código ni JSON."""

        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": full_messages,
            "temperature": 0.5,
            "max_tokens": 400
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Ollama: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def analizar_documento(self, doc_id: str, user_name: str, texto: str):
        api_key = os.getenv("GROQ_API_KEY", "ollama")

        system_prompt = """Analiza el siguiente texto de un documento de BPM o contrato de negocio redactado de forma colaborativa.
Busca cualquier riesgo o conflicto de políticas de negocio (conflictos de interés, cláusulas dudosas, falta de autorización, urgencia inusual, retrasos, etc.).
Debes responder estrictamente en formato JSON con la siguiente estructura. Si NO se detecta ningún riesgo o alerta relevante, establece 'has_alert' en false y deja el resto de campos vacíos.

Estructura JSON esperada:
{
  "has_alert": true o false,
  "severity": "high" o "medium" o "low" o "",
  "message": "Descripción corta del riesgo detectado" o "",
  "suggestion": "Acción correctiva sugerida" o ""
}"""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Usuario editando: {user_name}\nContenido del documento:\n{texto}" }
            ],
            "temperature": 0.1,
            "max_tokens": 512
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                import json
                result = json.loads(data["choices"][0]["message"]["content"])
                return result
            except Exception as e:
                print(f"Error analizando documento con IA local: {e}")
                return {"has_alert": False}

    async def validar_documento_con_politica(self, texto: str, politica: str) -> dict:
        api_key = os.getenv("GROQ_API_KEY", "ollama")

        system_prompt = f"""Analiza el siguiente texto de un documento cargado en el sistema y verifica si cumple estrictamente con la Política de Negocio provista.
Política de Negocio a validar:
"{politica}"

Debes responder estrictamente en formato JSON con la siguiente estructura.
Estructura JSON esperada:
{{
  "valido": true o false,
  "mensaje": "Mensaje detallado explicando si cumple o por qué no cumple la política",
  "sugerencia": "Acción correctiva sugerida si valido es false, o vacío si es true"
}}"""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Texto del documento a validar:\n{texto}" }
            ],
            "temperature": 0.15,
            "max_tokens": 512
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                import json
                result = json.loads(data["choices"][0]["message"]["content"])
                return result
            except Exception as e:
                print(f"Error en validar_documento_con_politica con IA local: {e}")
                return {"valido": False, "mensaje": f"Error del motor de IA local al validar: {str(e)}", "sugerencia": "Reintente la validación."}

    async def transcribir_audio_whisper(self, audio_bytes: bytes, filename: str) -> str:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            # Fallback offline si no hay API Key de Groq para Whisper
            print("[WHISPER LOCAL FALLBACK] Sin API Key para Whisper en la nube. Retornando transcripción local simulada.")
            return "Transcripción simulada local: El cliente solicita revisar las políticas del contrato y autorizar la firma."
        
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        files = {
            "file": (filename, audio_bytes, "audio/mpeg" if filename.endswith(".mp3") else "audio/wav")
        }
        data = {
            "model": "whisper-large-v3",
            "response_format": "json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=60.0
                )
                response.raise_for_status()
                res_json = response.json()
                return res_json.get("text", "")
            except Exception as e:
                print(f"[WHISPER ERROR] {e}. Ejecutando fallback local.")
                return "Transcripción simulada local (debido a error en servicio cloud): El cliente solicita revisar las políticas del contrato y autorizar la firma."

    async def chat_movil_con_rag(self, messages: list, tenant_id: str):
        last_user_message = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                last_user_message = msg.get("content", "")
                break
        
        from services.vector_store import vector_store
        contexto_recuperado = vector_store.recuperar_contexto(tenant_id, last_user_message)
        
        api_key = os.getenv("GROQ_API_KEY", "ollama")

        system_prompt = f"""Eres un Asistente Corporativo Avanzado (IA con Memoria de Cliente) integrado en BPMNFlow.
Tu objetivo es responder de forma ultra-personalizada y precisa a las consultas del cliente.
Posees acceso a documentos privados e históricos del repositorio S3 correspondientes únicamente al tenant: {tenant_id}.

=== CONTEXTO SEMÁNTICO RECUPERADO DE S3 (AISLAMIENTO TENANT: {tenant_id}) ===
{contexto_recuperado or "No hay documentos previos indexados en S3 para este tenant. Responde usando tu conocimiento general del negocio pero aclara que no encontraste archivos específicos del tenant para esta duda."}

=== REGLAS DE COMPORTAMIENTO Y PRIVACIDAD ===
1. Responde de manera sumamente atenta y corporativa.
2. Utiliza el contexto semántico recuperado para personalizar tus respuestas. Si el usuario pregunta por fechas, plazos, responsables o cláusulas de contratos que subió, búscalo en el contexto y dile de qué documento proviene.
3. Si el contexto no contiene la respuesta, explica de forma amable y sugiere qué documentos podría subir a su repositorio S3 para que puedas recordarlo.
4. NUNCA menciones otros TenantID o información de otros clientes. Mantén la confidencialidad de los datos.
5. Responde con un tono proactivo y de agente. Si identificas algún trámite estancado o un documento faltante (ej. Falta el contrato firmado), sugiere redactar un correo recordatorio o generar la plantilla.
6. Mantén tus respuestas claras y profesionales (máximo 4 párrafos cortos).
"""

        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "ngrok-skip-browser-warning": "true"
        }

        body = {
            "model": self.model_name,
            "messages": full_messages,
            "temperature": 0.4,
            "max_tokens": 1024
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=180.0)
                response.raise_for_status()
                data = response.json()
                return {
                    "reply": data["choices"][0]["message"]["content"],
                    "context_retrieved": contexto_recuperado
                }
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de Ollama: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    async def procesar_intencion_politica(self, texto: str) -> dict:
        api_key = os.getenv("GROQ_API_KEY", "ollama")
            
        system_prompt = """Eres un Agente de Asignación de Políticas de Negocio para BPMNFlow.
Tu tarea es interpretar la solicitud en lenguaje natural del usuario y sugerir o formular la política o restricción de negocio correspondiente más adecuada en una sola frase breve y concisa.

Ejemplos:
- Entrada: "Quiero que los menores de edad no puedan firmar contratos"
  Respuesta: { "politica_recomendada": "Restricción de edad: prohibido firmar a menores de 18 años", "tipo": "Restricción", "descripcion": "Validar que la fecha de nacimiento indique mayoría de edad." }
- Entrada: "Si la compra supera los 5000 dólares necesita aprobación del gerente de finanzas"
  Respuesta: { "politica_recomendada": "Aprobación de gerencia para compras > 5000 USD", "tipo": "Aprobación", "descripcion": "Derivar automáticamente al carril del Gerente de Finanzas si el monto es mayor a 5000." }

Debes responder estrictamente en formato JSON con los campos: 'politica_recomendada', 'tipo', y 'descripcion'. No agregues texto markdown antes o después."""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        body = {
            "model": self.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": texto }
            ],
            "temperature": 0.2,
            "max_tokens": 512
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.groq_url, json=body, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                import json
                return json.loads(data["choices"][0]["message"]["content"])
            except Exception as e:
                print(f"[IA POLÍTICAS] Error al procesar intención localmente: {e}")
                return {
                    "politica_recomendada": f"Política estándar para: {texto[:30]}...",
                    "tipo": "General",
                    "descripcion": "Asignado automáticamente por fallback debido a un error de red local."
                }

motor_nlp = MotorNLP()
