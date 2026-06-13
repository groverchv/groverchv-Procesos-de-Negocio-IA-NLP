import asyncio
import os
from dotenv import load_dotenv

# Cargar variables de entorno
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

from services.vector_store import vector_store
from services.nlp_engine import motor_nlp

async def main():
    print("=== PROBANDO VECTOR STORE ===")
    tenant_id = "tenant_test_123"
    
    # 1. Indexar algunos documentos de prueba
    vector_store.indexar_documento(
        tenant_id=tenant_id,
        doc_id="doc-1",
        filename="contrato_compraventa.txt",
        content="El contrato de compraventa del terreno de ACME se firmó el martes pasado. El plazo de entrega vence en 48 horas a partir de la firma."
    )
    
    vector_store.indexar_documento(
        tenant_id=tenant_id,
        doc_id="doc-2",
        filename="normas_seguridad.txt",
        content="Las normas de seguridad del edificio indican que el código de acceso general es 9988#."
    )
    
    # 2. Probar recuperación semántica
    print("\n--- Buscando: 'plazo de entrega' ---")
    res_plazo = vector_store.recuperar_contexto(tenant_id, "plazo de entrega")
    print(f"Resultado:\n{res_plazo}")
    
    print("\n--- Buscando: 'código de acceso' ---")
    res_codigo = vector_store.recuperar_contexto(tenant_id, "código de acceso")
    print(f"Resultado:\n{res_codigo}")
    
    # 3. Probar RAG con LLM (si hay API key)
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        print("\n=== PROBANDO INTEGRACIÓN CON LLM (RAG) ===")
        messages = [{"role": "user", "content": "¿Cuándo vence el plazo del contrato de compraventa?"}]
        res_chat = await motor_nlp.chat_movil_con_rag(messages, tenant_id)
        print(f"Respuesta de la IA:\n{res_chat['reply']}")
        print(f"Contexto Recuperado:\n{res_chat['context_retrieved']}")
    else:
        print("\nNo se encontró GROQ_API_KEY en las variables de entorno, omitiendo prueba de LLM.")

if __name__ == "__main__":
    asyncio.run(main())
