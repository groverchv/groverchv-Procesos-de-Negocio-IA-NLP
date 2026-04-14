package com.example.Procesos.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.Procesos.model.Modeling;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
public class ModelingSocketController {
    
    private final com.example.Procesos.service.DesignService designService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    // Cache para evitar lecturas constantes a DB
    private final Map<String, Long> lastSaveTime = new ConcurrentHashMap<>();

    @MessageMapping("/modeler/{designId}")
    public void handleModelingUpdate(@DestinationVariable String designId, Map<String, Object> payload) {
        // 1. FORWARD INMEDIATO (Cero latencia)
        // Re-enviamos el payload tal cual llega, sin procesar nada en este hilo
        messagingTemplate.convertAndSend("/topic/modeler/" + designId, payload);

        // 2. PERSISTENCIA INTELIGENTE (Fuera del hilo de mensajería)
        boolean isDragPulse = Boolean.TRUE.equals(payload.get("isDragPulse"));
        
        if (!isDragPulse) {
            CompletableFuture.runAsync(() -> {
                try {
                    Modeling modelingUpdate = objectMapper.convertValue(payload, Modeling.class);
                    com.example.Procesos.model.Modeling modeling = designService.getModelingByDesignId(designId).orElse(null);
                    if (modeling != null) {
                        modelingUpdate.setId(modeling.getId());
                        designService.updateModeling(modeling.getId(), modelingUpdate);
                    }
                } catch (Exception e) {
                    // Ignorar errores de persistencia menores
                }
            });
        }
    }
}
