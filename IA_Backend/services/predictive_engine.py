"""
Motor Predictivo basado en Deep Learning (TensorFlow/Keras)
============================================================
Contiene los modelos de IA para:
1. Predicción de ruta más eficiente (Clasificación)
2. Predicción de tiempos de demora (Regresión)
3. Priorización inteligente de tareas (Scoring)
4. Detección de anomalías en flujos de negocio (Autoencoder)

Todos los modelos se entrenan inicialmente con datos sintéticos
y pueden ser reentrenados con telemetría real del BPM.
"""

import os
import numpy as np
import pandas as pd
import joblib
from typing import Dict, List, Any, Optional

import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler, LabelEncoder

# ====================================================================
# CONFIGURACIÓN
# ====================================================================
MODEL_DIR = os.path.join(os.path.dirname(__file__), "modelos")
os.makedirs(MODEL_DIR, exist_ok=True)

RUTA_MODEL_PATH = os.path.join(MODEL_DIR, "modelo_rutas.keras")
DEMORA_MODEL_PATH = os.path.join(MODEL_DIR, "modelo_demoras.keras")
ANOMALIA_MODEL_PATH = os.path.join(MODEL_DIR, "modelo_anomalias.keras")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder_rutas.joblib")

# Nombres de las features que los modelos esperan
FEATURE_NAMES = [
    "tiempo_transcurrido_hrs",
    "pasos_completados",
    "pasos_totales",
    "tipo_tramite_encoded",
    "complejidad",
    "cantidad_documentos",
    "funcionarios_asignados",
    "reintentos",
]

# ====================================================================
# GENERACIÓN DE DATOS SINTÉTICOS
# ====================================================================

def _generar_datos_sinteticos(n_samples: int = 5000) -> pd.DataFrame:
    """
    Genera un dataset sintético que simula la telemetría de ejecución
    de un motor BPM. Usado para entrenar los modelos iniciales.
    """
    np.random.seed(42)
    data = {
        "tiempo_transcurrido_hrs": np.random.exponential(scale=8, size=n_samples),
        "pasos_completados": np.random.randint(1, 20, size=n_samples),
        "pasos_totales": np.random.randint(5, 25, size=n_samples),
        "tipo_tramite_encoded": np.random.randint(0, 6, size=n_samples),
        "complejidad": np.random.uniform(0.1, 1.0, size=n_samples),
        "cantidad_documentos": np.random.randint(0, 15, size=n_samples),
        "funcionarios_asignados": np.random.randint(1, 8, size=n_samples),
        "reintentos": np.random.poisson(lam=1, size=n_samples),
    }
    df = pd.DataFrame(data)

    # Asegurar coherencia: pasos_completados <= pasos_totales
    df["pasos_completados"] = df[["pasos_completados", "pasos_totales"]].min(axis=1)

    # Target para regresión (tiempo estimado de demora)
    df["demora_estimada_hrs"] = (
        df["tiempo_transcurrido_hrs"] * 0.3
        + (df["pasos_totales"] - df["pasos_completados"]) * 2.5
        + df["complejidad"] * 10
        + df["reintentos"] * 3
        + np.random.normal(0, 2, size=n_samples)
    ).clip(lower=0)

    # Target para clasificación de ruta (5 rutas posibles)
    rutas = ["ruta_estandar", "ruta_express", "ruta_revision", "ruta_escalamiento", "ruta_automatica"]
    condiciones = (
        df["complejidad"] * 10
        + df["reintentos"] * 5
        - df["funcionarios_asignados"] * 2
    )
    bins = np.percentile(condiciones, [0, 20, 40, 60, 80, 100])
    bins[0] = -np.inf
    bins[-1] = np.inf
    df["ruta_optima"] = pd.cut(condiciones, bins=bins, labels=rutas)

    return df


# ====================================================================
# CONSTRUCCIÓN DE MODELOS
# ====================================================================

def _build_ruta_model(input_dim: int, num_classes: int) -> keras.Model:
    """
    Red neuronal densa (Feedforward) para clasificar la ruta
    más eficiente para un trámite.
    """
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Dense(128, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(64, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(32, activation="relu"),
        keras.layers.Dense(num_classes, activation="softmax"),
    ], name="modelo_clasificacion_rutas")

    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def _build_demora_model(input_dim: int) -> keras.Model:
    """
    Red neuronal regresiva para predecir el tiempo estimado
    de demora (en horas) de un trámite en progreso.
    """
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Dense(128, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(64, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dense(32, activation="relu"),
        keras.layers.Dense(1, activation="linear"),
    ], name="modelo_prediccion_demoras")

    model.compile(
        optimizer="adam",
        loss="mse",
        metrics=["mae"],
    )
    return model


def _build_anomalia_model(input_dim: int) -> keras.Model:
    """
    Autoencoder para detección de anomalías.
    Si el error de reconstrucción supera un umbral,
    el trámite se clasifica como anómalo.
    """
    # Encoder
    encoder_input = keras.layers.Input(shape=(input_dim,))
    x = keras.layers.Dense(64, activation="relu")(encoder_input)
    x = keras.layers.Dense(32, activation="relu")(x)
    encoded = keras.layers.Dense(16, activation="relu")(x)

    # Decoder
    x = keras.layers.Dense(32, activation="relu")(encoded)
    x = keras.layers.Dense(64, activation="relu")(x)
    decoded = keras.layers.Dense(input_dim, activation="linear")(x)

    model = keras.Model(encoder_input, decoded, name="autoencoder_anomalias")
    model.compile(optimizer="adam", loss="mse")
    return model


# ====================================================================
# ENTRENAMIENTO CON DATOS SINTÉTICOS
# ====================================================================

def train_dummy_models() -> dict:
    """
    Entrena los 3 modelos con datos sintéticos y los guarda en disco.
    Retorna un diccionario con las métricas de entrenamiento.
    """
    print("=" * 60)
    print("  ENTRENAMIENTO DE MODELOS CON DATOS SINTÉTICOS")
    print("=" * 60)

    df = _generar_datos_sinteticos(5000)
    X = df[FEATURE_NAMES].values

    # Escalar features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, SCALER_PATH)

    resultados = {}

    # --- Modelo 1: Clasificación de Rutas ---
    print("\n[1/3] Entrenando modelo de clasificación de rutas...")
    le = LabelEncoder()
    y_rutas = le.fit_transform(df["ruta_optima"].astype(str))
    joblib.dump(le, LABEL_ENCODER_PATH)

    modelo_rutas = _build_ruta_model(X_scaled.shape[1], len(le.classes_))
    history_rutas = modelo_rutas.fit(
        X_scaled, y_rutas,
        epochs=30, batch_size=64,
        validation_split=0.2,
        verbose=0,
    )
    modelo_rutas.save(RUTA_MODEL_PATH)
    resultados["rutas"] = {
        "accuracy": float(history_rutas.history["accuracy"][-1]),
        "val_accuracy": float(history_rutas.history["val_accuracy"][-1]),
    }
    print(f"    -> Accuracy: {resultados['rutas']['accuracy']:.4f}")

    # --- Modelo 2: Predicción de Demoras ---
    print("[2/3] Entrenando modelo de predicción de demoras...")
    y_demoras = df["demora_estimada_hrs"].values

    modelo_demoras = _build_demora_model(X_scaled.shape[1])
    history_demoras = modelo_demoras.fit(
        X_scaled, y_demoras,
        epochs=30, batch_size=64,
        validation_split=0.2,
        verbose=0,
    )
    modelo_demoras.save(DEMORA_MODEL_PATH)
    resultados["demoras"] = {
        "mae": float(history_demoras.history["mae"][-1]),
        "val_mae": float(history_demoras.history["val_mae"][-1]),
    }
    print(f"    -> MAE: {resultados['demoras']['mae']:.4f} horas")

    # --- Modelo 3: Autoencoder de Anomalías ---
    print("[3/3] Entrenando autoencoder para detección de anomalías...")
    modelo_anomalias = _build_anomalia_model(X_scaled.shape[1])
    history_anomalias = modelo_anomalias.fit(
        X_scaled, X_scaled,  # El autoencoder reconstruye la entrada
        epochs=30, batch_size=64,
        validation_split=0.2,
        verbose=0,
    )
    modelo_anomalias.save(ANOMALIA_MODEL_PATH)
    resultados["anomalias"] = {
        "loss": float(history_anomalias.history["loss"][-1]),
        "val_loss": float(history_anomalias.history["val_loss"][-1]),
    }
    print(f"    -> Reconstruction Loss: {resultados['anomalias']['loss']:.6f}")

    print("\n" + "=" * 60)
    print("  TODOS LOS MODELOS ENTRENADOS Y GUARDADOS EXITOSAMENTE")
    print("=" * 60)

    return resultados


# ====================================================================
# CLASE PRINCIPAL DEL MOTOR PREDICTIVO
# ====================================================================

class MotorPredictivo:
    """
    Motor central que carga los modelos entrenados de TensorFlow
    y expone métodos de inferencia para los endpoints de FastAPI.
    """

    def __init__(self):
        self.modelo_rutas: Optional[keras.Model] = None
        self.modelo_demoras: Optional[keras.Model] = None
        self.modelo_anomalias: Optional[keras.Model] = None
        self.scaler: Optional[StandardScaler] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.anomalia_threshold: float = 0.0

    def cargar_modelos(self):
        """
        Carga los modelos desde disco. Si no existen, los entrena primero.
        """
        if not all(os.path.exists(p) for p in [
            RUTA_MODEL_PATH, DEMORA_MODEL_PATH, ANOMALIA_MODEL_PATH,
            SCALER_PATH, LABEL_ENCODER_PATH
        ]):
            print("Modelos no encontrados. Iniciando entrenamiento inicial...")
            train_dummy_models()

        print("Cargando modelos de TensorFlow...")
        self.modelo_rutas = keras.models.load_model(RUTA_MODEL_PATH)
        self.modelo_demoras = keras.models.load_model(DEMORA_MODEL_PATH)
        self.modelo_anomalias = keras.models.load_model(ANOMALIA_MODEL_PATH)
        self.scaler = joblib.load(SCALER_PATH)
        self.label_encoder = joblib.load(LABEL_ENCODER_PATH)

        # Calcular umbral de anomalía usando datos normales
        self._calcular_umbral_anomalias()
        print("Todos los modelos cargados exitosamente.")

    def _calcular_umbral_anomalias(self):
        """
        Calcula el umbral de reconstrucción para decidir si un
        trámite es anómalo. Usa percentil 95 del error de
        reconstrucción sobre datos normales generados.
        """
        df = _generar_datos_sinteticos(1000)
        X = df[FEATURE_NAMES].values
        X_scaled = self.scaler.transform(X)
        reconstrucciones = self.modelo_anomalias.predict(X_scaled, verbose=0)
        errores = np.mean(np.square(X_scaled - reconstrucciones), axis=1)
        self.anomalia_threshold = float(np.percentile(errores, 95))

    def _preparar_features(self, metricas: Dict[str, Any]) -> np.ndarray:
        """
        Extrae y ordena las features desde el diccionario de métricas
        que envía Spring Boot, aplicando el escalado.
        """
        feature_vector = []
        for nombre in FEATURE_NAMES:
            valor = metricas.get(nombre, 0)
            feature_vector.append(float(valor))

        X = np.array([feature_vector])
        X_scaled = self.scaler.transform(X)
        return X_scaled

    # ------------------------------------------------------------------
    # MÉTODO 1: Predicción de Ruta Eficiente
    # ------------------------------------------------------------------
    def predecir_ruta(self, metricas: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predice la ruta más eficiente para un trámite dado su estado actual.
        Retorna la ruta recomendada y las probabilidades de cada opción.
        """
        X_scaled = self._preparar_features(metricas)
        probabilidades = self.modelo_rutas.predict(X_scaled, verbose=0)[0]
        clase_predicha = int(np.argmax(probabilidades))
        ruta_nombre = self.label_encoder.inverse_transform([clase_predicha])[0]

        # Obtener ranking de todas las rutas
        ranking = []
        for i, prob in enumerate(probabilidades):
            ranking.append({
                "ruta": self.label_encoder.inverse_transform([i])[0],
                "probabilidad": round(float(prob), 4),
            })
        ranking.sort(key=lambda x: x["probabilidad"], reverse=True)

        return {
            "ruta_recomendada": ruta_nombre,
            "confianza": round(float(probabilidades[clase_predicha]), 4),
            "ranking_rutas": ranking,
        }

    # ------------------------------------------------------------------
    # MÉTODO 2: Predicción de Tiempo de Demora
    # ------------------------------------------------------------------
    def predecir_demora(self, metricas: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predice el tiempo estimado de demora (en horas) para completar
        el trámite desde su estado actual.
        """
        X_scaled = self._preparar_features(metricas)
        prediccion = self.modelo_demoras.predict(X_scaled, verbose=0)[0][0]
        demora_hrs = max(0, float(prediccion))

        # Clasificar nivel de riesgo de demora
        if demora_hrs < 4:
            nivel_riesgo = "Bajo"
            color = "#22c55e"
        elif demora_hrs < 12:
            nivel_riesgo = "Medio"
            color = "#f59e0b"
        elif demora_hrs < 24:
            nivel_riesgo = "Alto"
            color = "#f97316"
        else:
            nivel_riesgo = "Crítico"
            color = "#ef4444"

        return {
            "demora_estimada_hrs": round(demora_hrs, 2),
            "nivel_riesgo": nivel_riesgo,
            "color_indicador": color,
            "advertencia": f"Se estima una demora de {demora_hrs:.1f} horas. Nivel de riesgo: {nivel_riesgo}.",
        }

    # ------------------------------------------------------------------
    # MÉTODO 3: Priorización de Tareas
    # ------------------------------------------------------------------
    def priorizar_tareas(self, lista_tareas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Recibe una lista de tareas con sus métricas y retorna la misma
        lista ordenada por prioridad (mayor urgencia primero), con un
        puntaje calculado por los modelos de IA.
        """
        tareas_priorizadas = []
        for tarea in lista_tareas:
            metricas = tarea.get("metricas", tarea)

            # Usar la predicción de demora como componente principal
            demora_info = self.predecir_demora(metricas)
            anomalia_info = self.detectar_anomalia(metricas)

            # Puntaje de prioridad: combina demora, anomalía y progreso
            progreso = metricas.get("pasos_completados", 0) / max(metricas.get("pasos_totales", 1), 1)
            puntaje = (
                demora_info["demora_estimada_hrs"] * 3.0
                + (1.0 if anomalia_info["es_anomalia"] else 0.0) * 25.0
                + (1.0 - progreso) * 10.0
                + metricas.get("reintentos", 0) * 5.0
            )

            tareas_priorizadas.append({
                "tarea_id": tarea.get("tarea_id", "desconocido"),
                "puntaje_prioridad": round(float(puntaje), 2),
                "demora_estimada_hrs": demora_info["demora_estimada_hrs"],
                "nivel_riesgo": demora_info["nivel_riesgo"],
                "es_anomalia": anomalia_info["es_anomalia"],
                "recomendacion": self._generar_recomendacion(demora_info, anomalia_info, progreso),
            })

        # Ordenar de mayor a menor prioridad
        tareas_priorizadas.sort(key=lambda x: x["puntaje_prioridad"], reverse=True)

        # Asignar etiqueta de prioridad
        for i, t in enumerate(tareas_priorizadas):
            if i < len(tareas_priorizadas) * 0.15:
                t["prioridad"] = "URGENTE"
            elif i < len(tareas_priorizadas) * 0.40:
                t["prioridad"] = "ALTA"
            elif i < len(tareas_priorizadas) * 0.70:
                t["prioridad"] = "MEDIA"
            else:
                t["prioridad"] = "BAJA"

        return tareas_priorizadas

    # ------------------------------------------------------------------
    # MÉTODO 4: Detección de Anomalías
    # ------------------------------------------------------------------
    def detectar_anomalia(self, metricas: Dict[str, Any]) -> Dict[str, Any]:
        """
        Usa el autoencoder para detectar si las métricas del trámite
        representan un comportamiento anómalo. Compara el error de
        reconstrucción contra un umbral calculado.
        """
        X_scaled = self._preparar_features(metricas)
        reconstruccion = self.modelo_anomalias.predict(X_scaled, verbose=0)
        error = float(np.mean(np.square(X_scaled - reconstruccion)))

        es_anomalia = error > self.anomalia_threshold

        # Identificar qué features contribuyen más a la anomalía
        diferencias = np.abs(X_scaled[0] - reconstruccion[0])
        top_indices = np.argsort(diferencias)[-3:][::-1]
        factores_anomalos = [
            {"feature": FEATURE_NAMES[i], "desviacion": round(float(diferencias[i]), 4)}
            for i in top_indices
        ]

        return {
            "es_anomalia": bool(es_anomalia),
            "error_reconstruccion": round(error, 6),
            "umbral": round(self.anomalia_threshold, 6),
            "factores_principales": factores_anomalos,
            "descripcion": (
                "[ALERTA] ANOMALIA DETECTADA: El comportamiento de este tramite se desvia "
                "significativamente del patron normal. Revisar los factores listados."
                if es_anomalia else
                "[OK] El tramite se encuentra dentro de los parametros normales de operacion."
            ),
        }

    # ------------------------------------------------------------------
    # UTILIDADES
    # ------------------------------------------------------------------
    def _generar_recomendacion(
        self,
        demora_info: Dict,
        anomalia_info: Dict,
        progreso: float,
    ) -> str:
        """Genera una recomendación textual basada en el análisis."""
        if anomalia_info["es_anomalia"]:
            return "ACCIÓN INMEDIATA: Trámite con comportamiento anómalo. Escalar a supervisión para revisión manual."
        if demora_info["nivel_riesgo"] == "Crítico":
            return "CRÍTICO: Reasignar a funcionario con menor carga. El trámite está en riesgo de incumplir el SLA."
        if demora_info["nivel_riesgo"] == "Alto":
            return "ALTO: Considerar activar ruta express o asignar recursos adicionales para acelerar el trámite."
        if progreso < 0.3:
            return "El trámite aún está en etapas iniciales. Monitorear el avance de los próximos pasos."
        return "El trámite avanza dentro de los parámetros esperados. Sin acción requerida."


# ====================================================================
# INSTANCIA GLOBAL (Singleton)
# ====================================================================
motor = MotorPredictivo()
