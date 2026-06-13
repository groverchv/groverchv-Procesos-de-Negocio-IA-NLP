package com.example.Procesos.controller;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Receptor de Webhooks de IA para recibir sugerencias y alertas de forma asíncrona
 * y retransmitirlas en tiempo real a las salas de co-edición de los clientes.
 */
@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IaWebhookController {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Recibe una alerta procesada por FastAPI y la difunde vía WebSocket a la sala.
     * POST /api/ia/alertas
     */
    @PostMapping("/alertas")
    public ResponseEntity<?> recibirAlertaIa(@RequestBody IaAlertPayload payload) {
        // Enviar evento de alerta a todos los editores suscritos a la sala del documento
        messagingTemplate.convertAndSend("/topic/colaboracion/" + payload.getDocId(), Map.of(
                "type", "IA_ALERT",
                "docId", payload.getDocId(),
                "payload", payload.getPayload()
        ));

        // Enviar evento de alerta predictiva también al dashboard general de BI
        messagingTemplate.convertAndSend("/topic/dashboard/alertas-ia", Map.of(
                "type", "PREDICTIVE_ALERT",
                "docId", payload.getDocId(),
                "payload", payload.getPayload()
        ));
        return ResponseEntity.ok(Map.of("message", "Alerta de IA difundida con éxito"));
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IaAlertPayload {
        private String docId;
        private Map<String, Object> payload; // severity, message, suggestion, timestamp
    }
}
