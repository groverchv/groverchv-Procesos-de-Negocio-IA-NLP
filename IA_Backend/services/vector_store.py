import sqlite3
import os
import datetime
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "modelos", "rag_store.db")

class VectorStoreSQLite:
    def __init__(self):
        # Asegurarse de que exista el directorio de modelos
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.init_db()

    def init_db(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents_rag (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    def indexar_documento(self, tenant_id: str, doc_id: str, filename: str, content: str):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Verificar si ya existe el doc_id para actualizarlo
        cursor.execute("SELECT id FROM documents_rag WHERE doc_id = ?", (doc_id,))
        row = cursor.fetchone()
        if row:
            cursor.execute("""
                UPDATE documents_rag 
                SET content = ?, filename = ?, created_at = CURRENT_TIMESTAMP 
                WHERE doc_id = ?
            """, (content, filename, doc_id))
        else:
            cursor.execute("""
                INSERT INTO documents_rag (tenant_id, doc_id, filename, content)
                VALUES (?, ?, ?, ?)
            """, (tenant_id, doc_id, filename, content))
        conn.commit()
        conn.close()
        print(f"[VECTOR STORE] Documento '{filename}' del Tenant '{tenant_id}' indexado exitosamente.")

    def recuperar_contexto(self, tenant_id: str, query: str, top_k: int = 3) -> str:
        """
        Recupera los fragmentos de documentos más relevantes para el tenant especificado
        utilizando TF-IDF + Similitud de Coseno.
        """
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT filename, content FROM documents_rag 
            WHERE tenant_id = ?
        """, (tenant_id,))
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return ""

        # Dividir los documentos en fragmentos (párrafos/líneas) para una búsqueda semántica más granular
        fragments = []
        metadata = [] # Guardará de qué archivo proviene cada fragmento

        for filename, content in rows:
            # Dividir por párrafos (doble salto de línea) o por líneas con contenido sustancial
            paragraphs = [p.strip() for p in content.split("\n") if len(p.strip()) > 10]
            for p in paragraphs:
                fragments.append(p)
                metadata.append(filename)

        if not fragments:
            return ""

        # Agregar la consulta (query) al final para la vectorización
        corpus = fragments + [query]

        try:
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf_matrix = vectorizer.fit_transform(corpus)
            
            # Las representaciones vectoriales de los fragmentos y de la consulta
            fragments_vectors = tfidf_matrix[:-1]
            query_vector = tfidf_matrix[-1]

            # Calcular similitud de coseno
            similarities = cosine_similarity(query_vector, fragments_vectors).flatten()
            
            # Obtener los índices de los top_k más similares
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            retrieved_contexts = []
            for idx in top_indices:
                score = similarities[idx]
                if score > 0.05: # Umbral de relevancia
                    retrieved_contexts.append(
                        f" (De documento '{metadata[idx]}'): {fragments[idx]}"
                    )
            
            if retrieved_contexts:
                return "\n".join(retrieved_contexts)
        except Exception as e:
            print(f"[RAG ERROR] Error al vectorizar y buscar similitudes: {e}")
            # Fallback a búsqueda simple por texto/palabras clave
            pass

        # Fallback: concatenar los primeros documentos completos hasta cierto límite
        fallback_content = []
        for filename, content in rows[:2]:
            fallback_content.append(f"Documento '{filename}': {content[:500]}...")
        return "\n\n".join(fallback_content)

# Instancia global del vector store
vector_store = VectorStoreSQLite()
