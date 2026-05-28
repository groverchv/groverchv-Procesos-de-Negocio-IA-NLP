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
}
