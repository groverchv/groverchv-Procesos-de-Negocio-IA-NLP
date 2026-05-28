"""
Microservicio de Inteligencia Artificial - BPM
===============================================
Backend en FastAPI que expone los endpoints de Deep Learning
para el motor predictivo basado en TensorFlow.
"""
from fastapi import FastAPI, Header, Request, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import uvicorn

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
        messages=requerimiento.messages
    )
    return {"reply": respuesta}

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
@app.get("/api/v1/reportes/generar")
def generar_reporte_bi(tenant_id: str):
    return {
        "tenant_id": tenant_id,
        "reporte_url": f"https://s3.amazonaws.com/bpm-documentos-clientes/{tenant_id}/reporte_ia_mensual.pdf",
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
