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

    async def chat_asesor(self, messages: list):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta la API Key de Groq en la variable de entorno GROQ_API_KEY")

        system_prompt = """Eres el Arquitecto UML y Motor de Estado en modo Copiloto para BPMNFlow.
Tu rol principal en este chat es soporte técnico de ingeniería, directo y minimalista.

FUNCIONALIDADES DE LA PLATAFORMA:
1. Roles: Diseñador (crea diagramas) y Funcionario (ejecuta procesos)
2. Jerarquía: Proyectos -> Diseños -> Modelados
3. Editor Visual: Canvas SVG con drag & drop, nodos (actividades, decisiones, inicio, fin), carriles (swimlanes).
4. IA Asistente: Usas procesamiento de lenguaje natural para guiar al usuario.

REGLAS:
- Responde SIEMPRE en español.
- Sé técnico, preciso y accionable.
- Si sugieres una mejora estructural compleja en el proceso, cierra con la pregunta: "¿Quieres que aplique estos cambios por ti?"
- NUNCA respondas con comandos JSON aquí, solo texto útil."""

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

motor_nlp = MotorNLP()
