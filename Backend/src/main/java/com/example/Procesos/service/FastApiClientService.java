package com.example.Procesos.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
public class FastApiClientService {

    private final WebClient iaWebClient;

    public FastApiClientService(WebClient iaWebClient) {
        this.iaWebClient = iaWebClient;
    }

    /**
     * Envía un texto de un cliente al motor de IA en Python para procesar su intención
     * e identificar la política de negocio.
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> procesarIntencionNlp(String clienteId, String texto) {
        return iaWebClient.post()
                .uri("/api/v1/nlp/procesar-intencion")
                .bodyValue(Map.of(
                        "cliente_id", clienteId,
                        "texto", texto
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map);
    }

    /**
     * Envía las métricas de un proceso para que la IA prediga riesgos de demora.
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> evaluarRiesgoProceso(String procesoId, Map<String, Object> metricas) {
        return iaWebClient.post()
                .uri("/api/v1/riesgos/evaluar")
                .bodyValue(Map.of(
                        "proceso_id", procesoId,
                        "metricas", metricas
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map);
    }

    /**
     * Envía de forma asíncrona un cambio en un documento colaborativo a la IA para su análisis reactivo.
     */
    public Mono<Void> observarDocumento(String docId, String userId, String userName, String texto) {
        return iaWebClient.post()
                .uri("/api/v1/nlp/observar-documento")
                .bodyValue(Map.of(
                        "doc_id", docId,
                        "user_id", userId,
                        "user_name", userName,
                        "texto", texto
                ))
                .retrieve()
                .bodyToMono(Void.class);
    }

    /**
     * Solicita a FastAPI generar el reporte de telemetría de IA.
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> generarReporteDinamico(String query, String tenantId) {
        return iaWebClient.post()
                .uri("/api/v1/reportes/dinamico")
                .bodyValue(Map.of(
                        "query", query,
                        "tenant_id", tenantId
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map);
    }

    /**
     * Indexa el texto de un archivo subido a S3 en la base de datos de RAG del tenant.
     */
    public Mono<Void> indexarDocumento(String tenantId, String docId, String filename, String content) {
        return iaWebClient.post()
                .uri("/api/v1/nlp/indexar-documento")
                .bodyValue(Map.of(
                        "tenant_id", tenantId,
                        "doc_id", docId,
                        "filename", filename,
                        "content", content
                ))
                .retrieve()
                .bodyToMono(Void.class);
    }

    /**
     * Valida el texto de un documento contra una política de negocio específica.
     */
    @SuppressWarnings("unchecked")
    public Mono<Map<String, Object>> validarDocumentoConPolitica(String texto, String politica) {
        return iaWebClient.post()
                .uri("/api/v1/nlp/validar-documento")
                .bodyValue(Map.of(
                        "texto", texto,
                        "politica", politica
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map);
    }
}
