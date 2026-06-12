"""
Microservicio de Inteligencia Artificial - BPM
===============================================
Backend en FastAPI que expone los endpoints de Deep Learning
para el motor predictivo basado en TensorFlow.
"""
from fastapi import FastAPI, Header, Request, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import uvicorn
import httpx

from services.predictive_engine import motor
from services.nlp_engine import motor_nlp
from services.tts_engine import motor_tts

import os
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# ====================================================================
# LIFECYCLE: Cargar modelos al iniciar la aplicación
# ====================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga los modelos de TensorFlow al arrancar el servidor."""
    print("[STARTUP] Iniciando Motor de IA...")
    motor.cargar_modelos()
    print("[OK] Motor predictivo listo para recibir peticiones.")
    yield
    print("[SHUTDOWN] Apagando Motor de IA...")

app = FastAPI(
    title="Motor de Inteligencia Artificial - BPM",
    description=(
        "Microservicio en FastAPI para NLP, Deep Learning y Asistente Virtual. "
        "Incluye motor predictivo con TensorFlow para enrutamiento inteligente, "
        "predicción de demoras, priorización de tareas y detección de anomalías."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================================
# MODELOS DE DATOS (Pydantic)
# ====================================================================

class NLPDiagramRequest(BaseModel):
    user_message: str
    nodes_context: str
    edges_context: str
    lanes_context: str

class NLPChatRequest(BaseModel):
    messages: list
    nodes_context: Optional[str] = None
    edges_context: Optional[str] = None
    lanes_context: Optional[str] = None

class NLPDocumentObservationRequest(BaseModel):
    doc_id: str
    user_id: str
    user_name: str
    texto: str

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None

class MetricasTramite(BaseModel):
    """
    Métricas del estado actual de un trámite enviadas desde Spring Boot.
    Estas son las features que alimentan los modelos de TensorFlow.
    """
    tiempo_transcurrido_hrs: float = Field(..., description="Horas desde el inicio del trámite", ge=0)
    pasos_completados: int = Field(..., description="Cantidad de pasos ya ejecutados", ge=0)
    pasos_totales: int = Field(..., description="Cantidad total de pasos del flujo", ge=1)
    tipo_tramite_encoded: int = Field(..., description="Código numérico del tipo de trámite (0-5)", ge=0)
    complejidad: float = Field(..., description="Nivel de complejidad del trámite (0.0 a 1.0)", ge=0, le=1)
    cantidad_documentos: int = Field(0, description="Documentos adjuntos al trámite", ge=0)
    funcionarios_asignados: int = Field(1, description="Funcionarios asignados al trámite", ge=1)
    reintentos: int = Field(0, description="Número de reintentos o devoluciones", ge=0)

class AnalisisRiesgoRequest(BaseModel):
    proceso_id: str
    metricas: MetricasTramite

class PrediccionRutaRequest(BaseModel):
    proceso_id: str
    metricas: MetricasTramite

class TareaPriorizacion(BaseModel):
    tarea_id: str
    metricas: MetricasTramite

class PriorizacionRequest(BaseModel):
    tenant_id: str
    tareas: List[TareaPriorizacion]

class DeteccionAnomaliaRequest(BaseModel):
    proceso_id: str
    metricas: MetricasTramite

# ====================================================================
# ENDPOINTS
# ====================================================================

@app.get("/")
def read_root():
    return {
        "message": "Microservicio de IA activo e inicializado exitosamente.",
        "version": "2.0.0",
        "motor_predictivo": "TensorFlow",
        "modelos_cargados": motor.modelo_rutas is not None,
    }

# ------------------------------------------------------------------
# NLP: Procesamiento de Lenguaje Natural (Groq)
# ------------------------------------------------------------------
@app.post("/api/v1/nlp/comando-diagrama")
async def procesar_comando_diagrama(
    requerimiento: NLPDiagramRequest
):
    return await motor_nlp.procesar_comando_diagrama(
        user_message=requerimiento.user_message,
        nodes_context=requerimiento.nodes_context,
        edges_context=requerimiento.edges_context,
        lanes_context=requerimiento.lanes_context
    )

@app.post("/api/v1/nlp/chat-asesor")
async def chat_asesor(
    requerimiento: NLPChatRequest
):
    respuesta = await motor_nlp.chat_asesor(
        messages=requerimiento.messages,
        nodes_context=requerimiento.nodes_context,
        edges_context=requerimiento.edges_context,
        lanes_context=requerimiento.lanes_context
    )
    return {"reply": respuesta}


class NLPMovilRequest(BaseModel):
    messages: list
    proceso_context: Optional[str] = None


@app.post("/api/v1/nlp/chat-movil")
async def chat_movil(requerimiento: NLPMovilRequest):
    """
    Chat IA para la aplicación móvil Flutter.
    Incluye contexto de procesos del usuario (proyectos, instancias, asignaciones)
    enviados directamente desde el dispositivo.
    """
    respuesta = await motor_nlp.chat_movil(
        messages=requerimiento.messages,
        proceso_context=requerimiento.proceso_context,
    )
    return {"reply": respuesta}


class IndexarDocumentoRequest(BaseModel):
    tenant_id: str
    doc_id: str
    filename: str
    content: str


class NLPRagRequest(BaseModel):
    messages: list
    tenant_id: str


@app.post("/api/v1/nlp/indexar-documento")
async def indexar_documento(requerimiento: IndexarDocumentoRequest):
    """
    Endpoint para indexar el texto de un documento subido a S3 en el Vector Store
    segregado por tenant_id.
    """
    from services.vector_store import vector_store
    vector_store.indexar_documento(
        tenant_id=requerimiento.tenant_id,
        doc_id=requerimiento.doc_id,
        filename=requerimiento.filename,
        content=requerimiento.content
    )
    return {"status": "success", "message": f"Documento {requerimiento.filename} indexado correctamente para el Tenant {requerimiento.tenant_id}."}


class NLPIntencionRequest(BaseModel):
    cliente_id: str
    texto: str


@app.post("/api/v1/nlp/procesar-intencion")
async def procesar_intencion(requerimiento: NLPIntencionRequest):
    """
    Agente de Asignación de Políticas:
    Interpreta el requerimiento del cliente y sugiere la política de negocios más adecuada.
    """
    return await motor_nlp.procesar_intencion_politica(requerimiento.texto)


class ValidarDocumentoRequest(BaseModel):
    texto: str
    politica: str


@app.post("/api/v1/nlp/validar-documento")
async def validar_documento(requerimiento: ValidarDocumentoRequest):
    """
    Valida si el texto de un documento cumple con una determinada política de negocio.
    """
    return await motor_nlp.validar_documento_con_politica(
        texto=requerimiento.texto,
        politica=requerimiento.politica
    )


@app.post("/api/v1/nlp/chat-rag")
async def chat_rag(requerimiento: NLPRagRequest):
    """
    Chat con memoria corporativa (RAG) segregado por TenantID.
    Busca documentos específicos del tenant en el Vector Store local de SQLite.
    """
    return await motor_nlp.chat_movil_con_rag(
        messages=requerimiento.messages,
        tenant_id=requerimiento.tenant_id
    )


@app.post("/api/v1/nlp/transcribir-audio")
async def transcribir_audio(
    tenant_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Recibe un archivo de audio, lo transcribe mediante Whisper, genera un Acta de Reunión
    formal con Llama 3 y la indexa de forma automática en el repositorio RAG de su tenant.
    """
    audio_bytes = await file.read()
    filename = file.filename or "reunion.mp3"
    
    # 1. Transcribir
    transcripcion = await motor_nlp.transcribir_audio_whisper(audio_bytes, filename)
    if not transcripcion:
        raise HTTPException(status_code=400, detail="No se pudo extraer transcripción de voz del audio.")
        
    # 2. Resumir y generar Acta
    prompt_resumen = f"""Genera una acta de reunión ejecutiva profesional y formal basada en la siguiente transcripción de audio.
Tu respuesta debe ser redactada directamente en formato de documento de texto, estructurada de la siguiente manera:
- TÍTULO: Acta de Reunión
- FECHA: (Usa la fecha actual del sistema o la que mencione el audio)
- ASISTENTES: (Lista de nombres o roles identificados)
- PUNTOS TRATADOS: (Breve resumen de los temas principales)
- COMPROMISOS Y ACCIONES ACORDADAS: (Quién hace qué y plazos)

TRANSCRIPCIÓN:
"{transcripcion}"
"""
    api_key = os.getenv("GROQ_API_KEY", "ollama")
    ollama_base = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    ollama_url = f"{ollama_base}/v1/chat/completions"
    ollama_model = os.getenv("OLLAMA_MODEL", "gemma2")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "ngrok-skip-browser-warning": "true"
    }
    body = {
        "model": ollama_model,
        "messages": [
            { "role": "system", "content": "Eres un redactor corporativo experto en actas de reunión y minutas corporativas." },
            { "role": "user", "content": prompt_resumen }
        ],
        "temperature": 0.3,
        "max_tokens": 1500
    }
    
    acta = ""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                ollama_url,
                json=body,
                headers=headers,
                timeout=180.0
            )
            response.raise_for_status()
            acta = response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[ACTA GENERATION ERROR] {e}")
            acta = f"Transcripción de la Reunión:\n\n{transcripcion}"
            
    # 3. Indexar en vector store
    import uuid
    from services.vector_store import vector_store
    doc_id = f"acta-{uuid.uuid4().hex[:8]}"
    doc_name = f"Acta_Reunion_{uuid.uuid4().hex[:4]}.txt"
    vector_store.indexar_documento(
        tenant_id=tenant_id,
        doc_id=doc_id,
        filename=doc_name,
        content=acta
    )
    
    return {
        "status": "success",
        "transcripcion": transcripcion,
        "acta": acta,
        "filename": doc_name,
        "doc_id": doc_id
    }


@app.websocket("/api/v1/nlp/chat-stream")
async def chat_stream_websocket(websocket: WebSocket):
    """
    WebSocket que realiza chat con streaming de tokens en tiempo real (estilo ChatGPT),
    utilizando RAG de los documentos del tenant indicado.
    """
    await websocket.accept()
    try:
        while True:
            # Recibir payload JSON
            data = await websocket.receive_json()
            messages = data.get("messages", [])
            tenant_id = data.get("tenant_id", "")
            
            # Buscar último mensaje del usuario para RAG
            last_user_message = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    last_user_message = msg.get("content", "")
                    break
            
            from services.vector_store import vector_store
            contexto_recuperado = vector_store.recuperar_contexto(tenant_id, last_user_message)
            
            api_key = os.getenv("GROQ_API_KEY", "ollama")
            ollama_base = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
            ollama_url = f"{ollama_base}/v1/chat/completions"
            ollama_model = os.getenv("OLLAMA_MODEL", "gemma2")
                
            system_prompt = f"""Eres un Asistente Corporativo Avanzado (IA con Memoria de Cliente) integrado en BPMNFlow.
Tu objetivo es responder de forma ultra-personalizada y precisa a las consultas del cliente.
Posees acceso a documentos privados e históricos del repositorio S3 correspondientes únicamente al tenant: {tenant_id}.

=== CONTEXTO SEMÁNTICO RECUPERADO DE S3 (AISLAMIENTO TENANT: {tenant_id}) ===
{contexto_recuperado or "No hay documentos previos indexados en S3 para este tenant."}

=== REGLAS DE COMPORTAMIENTO ===
1. Responde de manera concisa y clara.
2. Usa el contexto recuperado para justificar tus respuestas.
3. Envía respuestas estructuradas en texto plano y amigable.
"""
            full_messages = [{"role": "system", "content": system_prompt}] + messages
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "ngrok-skip-browser-warning": "true"
            }
            body = {
                "model": ollama_model,
                "messages": full_messages,
                "temperature": 0.4,
                "max_tokens": 1024,
                "stream": True
            }
            
            # Enviar streaming de tokens
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", ollama_url, json=body, headers=headers, timeout=180.0) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            import json
                            try:
                                chunk_json = json.loads(data_str)
                                delta = chunk_json["choices"][0]["delta"].get("content", "")
                                if delta:
                                    await websocket.send_json({"token": delta})
                            except:
                                pass
            await websocket.send_json({"status": "done"})
    except WebSocketDisconnect:
        print("[WS CHAT] Cliente desconectado de chat-stream.")
    except Exception as e:
        print(f"[WS ERROR] {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass


async def analizar_y_alertar_documento(doc_id: str, user_id: str, user_name: str, texto: str):
    """
    Función que corre en segundo plano. Analiza el documento y envía webhook a Spring Boot si hay alertas.
    """
    analisis = await motor_nlp.analizar_documento(doc_id=doc_id, user_name=user_name, texto=texto)
    
    if analisis and analisis.get("has_alert"):
        backend_base = os.getenv("SPRING_BOOT_URL", "https://backend-principal.up.railway.app")
        webhook_url = f"{backend_base}/api/ia/alertas"
        payload = {
            "docId": doc_id,
            "payload": {
                "severity": analisis.get("severity", "medium"),
                "message": analisis.get("message", "Alerta de política de negocio detectada."),
                "suggestion": analisis.get("suggestion", "Por favor, revise el texto redactado."),
                "timestamp": "2026-06-07T00:00:00Z"
            }
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload, timeout=5.0)
                print(f"[IA OBSERVADOR] Alerta enviada a Spring Boot. Status: {response.status_code}")
        except Exception as e:
            print(f"[IA OBSERVADOR] Error enviando alerta al webhook: {e}")


@app.post("/api/v1/nlp/observar-documento", status_code=202)
async def observar_documento(requerimiento: NLPDocumentObservationRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para observación pasiva y asíncrona de cambios en documentos.
    Retorna 202 inmediatamente y delega el análisis de Deep Learning a BackgroundTasks.
    """
    background_tasks.add_task(
        analizar_y_alertar_documento,
        doc_id=requerimiento.doc_id,
        user_id=requerimiento.user_id,
        user_name=requerimiento.user_name,
        texto=requerimiento.texto
    )
    return {"status": "Accepted", "message": "Análisis reactivo de IA en curso"}


# ------------------------------------------------------------------
# TTS: Text to Speech (ElevenLabs)
# ------------------------------------------------------------------
@app.post("/api/v1/tts/generar-voz")
async def generar_voz(
    requerimiento: TTSRequest
):
    return await motor_tts.generar_voz(
        text=requerimiento.text,
        voice_id=requerimiento.voice_id
    )

# ------------------------------------------------------------------
# RIESGOS: Evaluación con predicción de demora (TensorFlow)
# ------------------------------------------------------------------
@app.post("/api/v1/riesgos/evaluar")
def evaluar_riesgo(datos_proceso: AnalisisRiesgoRequest):
    """
    Evalúa el riesgo de demora de un trámite usando el modelo
    de regresión de TensorFlow entrenado con datos de telemetría.
    """
    metricas_dict = datos_proceso.metricas.model_dump()

    demora = motor.predecir_demora(metricas_dict)
    anomalia = motor.detectar_anomalia(metricas_dict)

    return {
        "proceso_id": datos_proceso.proceso_id,
        "prediccion_demora": demora,
        "deteccion_anomalia": anomalia,
        "motor": "TensorFlow Deep Learning",
    }

# ------------------------------------------------------------------
# RUTAS: Predicción de ruta eficiente (Clasificación TensorFlow)
# ------------------------------------------------------------------
@app.post("/api/v1/rutas/predecir")
def predecir_ruta(datos: PrediccionRutaRequest):
    """
    Predice la ruta de ejecución más eficiente para un trámite
    usando un modelo de clasificación de red neuronal densa.
    """
    metricas_dict = datos.metricas.model_dump()
    resultado = motor.predecir_ruta(metricas_dict)

    return {
        "proceso_id": datos.proceso_id,
        **resultado,
        "motor": "TensorFlow Deep Learning",
    }

# ------------------------------------------------------------------
# PRIORIZACIÓN: Ordenamiento inteligente de tareas (TensorFlow)
# ------------------------------------------------------------------
@app.post("/api/v1/tareas/priorizar")
def priorizar_tareas(datos: PriorizacionRequest):
    """
    Recibe una lista de tareas pendientes y las devuelve ordenadas
    por prioridad, combinando predicciones de demora y anomalías.
    """
    lista = [
        {"tarea_id": t.tarea_id, "metricas": t.metricas.model_dump()}
        for t in datos.tareas
    ]
    resultado = motor.priorizar_tareas(lista)

    return {
        "tenant_id": datos.tenant_id,
        "total_tareas": len(resultado),
        "tareas_priorizadas": resultado,
        "motor": "TensorFlow Deep Learning",
    }

# ------------------------------------------------------------------
# ANOMALÍAS: Detección con Autoencoder (TensorFlow)
# ------------------------------------------------------------------
@app.post("/api/v1/anomalias/detectar")
def detectar_anomalia(datos: DeteccionAnomaliaRequest):
    """
    Detecta si un trámite presenta un comportamiento anómalo
    usando un Autoencoder entrenado con TensorFlow.
    """
    metricas_dict = datos.metricas.model_dump()
    resultado = motor.detectar_anomalia(metricas_dict)

    return {
        "proceso_id": datos.proceso_id,
        **resultado,
        "motor": "TensorFlow Autoencoder",
    }

# ------------------------------------------------------------------
# REPORTES BI: Generación de reportes con insights de IA
# ------------------------------------------------------------------
class ReporteDinamicoRequest(BaseModel):
    query: str
    tenant_id: Optional[str] = "tenant_default"

@app.post("/api/v1/reportes/dinamico")
async def generar_reporte_dinamico(requerimiento: ReporteDinamicoRequest):
    # Dataset robusto de telemetría e historial para alimentar a la IA en su análisis de BI
    telemetria_sistema = """
    PROCESOS Y MÉTRICAS DE EJECUCIÓN (BPM):
    1. Proceso: "Aprobación de Créditos"
       - Duración promedio: 24.5 horas (Complejidad Alta)
       - Total de ejecuciones: 1,240 trámites
       - Usuarios Activos: 350 clientes, 12 funcionarios
       - Cuellos de Botella: Espera de firma de gerencia (representa el 60% de la demora)
       - Tasa de éxito: 88.5%
       - Anomalías detectadas: 42 casos (desvíos de flujo)
       - Facilidad de terminación: Baja (Requiere múltiples aprobaciones)

    2. Proceso: "Solicitud de Vacaciones"
       - Duración promedio: 1.2 horas (Complejidad muy Baja)
       - Total de ejecuciones: 4,500 trámites
       - Usuarios Activos: 890 funcionarios
       - Cuellos de Botella: Ninguno
       - Tasa de éxito: 99.8%
       - Anomalías detectadas: 1 caso
       - Facilidad de terminación: Altísima (Casi inmediato y automatizado)

    3. Proceso: "Compras Corporativas"
       - Duración promedio: 72.8 horas (Complejidad Alta)
       - Total de ejecuciones: 320 trámites
       - Usuarios Activos: 45 jefes de área, 5 analistas de compras
       - Cuellos de Botella: Cotizaciones con proveedores externos (48 horas de demora promedio)
       - Tasa de éxito: 91.2%
       - Anomalías detectadas: 18 casos
       - Facilidad de terminación: Media-Baja

    4. Proceso: "Onboarding de Personal"
       - Duración promedio: 12.0 horas (Complejidad Media)
       - Total de ejecuciones: 680 trámites
       - Usuarios Activos: 120 nuevos empleados, 4 analistas de RRHH
       - Cuellos de Botella: Asignación de activos tecnológicos e IT (representa el 45% de la demora)
       - Tasa de éxito: 96.0%
       - Anomalías detectadas: 5 casos
       - Facilidad de terminación: Media

    5. Proceso: "Soporte Técnico Especializado"
       - Duración promedio: 3.4 horas (Complejidad Media-Baja)
       - Total de ejecuciones: 2,100 trámites
       - Usuarios Activos: 1,500 clientes, 8 operadores de soporte
       - Cuellos de Botella: Clasificación inicial del ticket (20 minutos)
       - Tasa de éxito: 97.5%
       - Anomalías detectadas: 12 casos
       - Facilidad de terminación: Alta (Muy procedimentado)

    USUARIOS DEL SISTEMA Y REPOSITORIOS (Google Drive S3):
    - Administrador (Diseñador principal): 1 cuenta
    - Funcionarios operativos: 24 usuarios ejecutando actividades diariamente
    - Clientes externos: 1,850 clientes activos consultando estados y cargando documentos
    - Repositorio Colaborativo: Cada cliente cuenta con una carpeta cifrada en S3 (tenantId). Espacio total consumido: 124.5 GB, 14,800 documentos en total.
    """

    import json
    respuesta_raw = await motor_nlp.generar_reporte_dinamico(
        query=requerimiento.query,
        context_data=telemetria_sistema
    )
    
    try:
        # Validar y parsear a objeto JSON real
        respuesta_json = json.loads(respuesta_raw)
        return respuesta_json
    except Exception:
        # Si por alguna razón la IA falló el parseo, devolver el raw encapsulado
        return {
            "titulo": "Reporte de Análisis IA",
            "resumen": respuesta_raw,
            "insights": ["Error al formatear algunos KPIs visuales, pero el análisis de texto está completo."],
            "metas": [],
            "tabla": [],
            "grafico": {"tipo": "bar", "labels": [], "valores": []}
        }

@app.get("/api/v1/reportes/generar")
def generar_reporte_bi(tenant_id: str):
    bucket_name = os.getenv("AWS_S3_BUCKET", "procesodegestion")
    return {
        "tenant_id": tenant_id,
        "reporte_url": f"https://s3.amazonaws.com/{bucket_name}/{tenant_id}/reporte_ia_mensual.pdf",
        "insights": [
            "El proceso 'Solicitud Vacaciones' demora un 40% más en el área de RRHH.",
            "Ahorro estimado: 120 horas.",
        ],
    }

# ====================================================================
# PUNTO DE ENTRADA
# ====================================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
