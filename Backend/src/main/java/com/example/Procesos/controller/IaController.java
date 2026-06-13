package com.example.Procesos.controller;

import com.example.Procesos.service.FastApiClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Controlador REST para el Agente Inteligente de Asignación de Políticas.
 * Intercepta los comandos y requerimientos del usuario en lenguaje natural
 * y los delega a FastAPI para retornar la política corporativa correspondiente.
 */
@RestController
@RequestMapping("/api/v1/ia")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IaController {

    private final FastApiClientService iaClient;

    /**
     * POST /api/v1/ia/procesar-intencion
     * Recibe la intención o descripción del usuario y devuelve la política de negocio recomendada.
     */
    @PostMapping("/procesar-intencion")
    public Mono<ResponseEntity<Map<String, Object>>> procesarIntencion(@RequestBody Map<String, String> request) {
        String clienteId = request.getOrDefault("cliente_id", "cliente_default");
        String texto = request.get("texto");

        if (texto == null || texto.trim().isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "El campo 'texto' es obligatorio.")));
        }

        return iaClient.procesarIntencionNlp(clienteId, texto)
                .map(ResponseEntity::ok)
                .onErrorResume(err -> Mono.just(ResponseEntity.internalServerError().body(Map.of(
                        "politica_recomendada", "Política General de BPMNFlow",
                        "tipo", "Fallback",
                        "descripcion", "Error al contactar con el agente inteligente: " + err.getMessage()
                ))));
    }
}
