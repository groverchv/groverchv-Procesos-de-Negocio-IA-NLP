package com.example.Procesos.controller;

import com.example.Procesos.model.DocumentoMetadata;
import com.example.Procesos.repository.DocumentoMetadataRepository;
import com.example.Procesos.service.FastApiClientService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Date;
import java.util.Optional;

/**
 * Controlador de WebSocket (STOMP) para gestionar salas de co-edición y colaboración en tiempo real.
 * Transmite deltas de Yjs a todos los clientes suscritos al canal del documento.
 */
@Controller
@RequiredArgsConstructor
public class ColaboracionController {

    private final SimpMessagingTemplate messagingTemplate;
    private final DocumentoMetadataRepository documentoRepository;
    private final FastApiClientService iaClient;

    @MessageMapping("/colaboracion/{docId}")
    public void handleDocUpdate(@DestinationVariable String docId, ColaboracionUpdate payload) {
        // Broadcast a todos los usuarios suscritos a la sala
        messagingTemplate.convertAndSend("/topic/colaboracion/" + docId, payload);

        // Si se provee contenido de texto plano y el tipo es UPDATE, disparar análisis reactivo de IA asíncronamente
        if ("UPDATE".equals(payload.getType()) && payload.getContent() != null && !payload.getContent().trim().isEmpty()) {
            iaClient.observarDocumento(docId, payload.getUserId(), payload.getUserName(), payload.getContent())
                    .subscribe(
                            success -> {},
                            error -> System.err.println("Error enviando documento a IA: " + error.getMessage())
                    );
        }

        // Actualizar la última fecha de modificación en la base de datos de forma asíncrona
        if ("UPDATE".equals(payload.getType())) {
            Optional<DocumentoMetadata> metadataOpt = documentoRepository.findById(docId);
            if (metadataOpt.isPresent()) {
                DocumentoMetadata metadata = metadataOpt.get();
                metadata.setUltimaModificacion(new Date());
                documentoRepository.save(metadata);
            }
        }
    }

    /**
     * Objeto de transferencia de datos (DTO) para cambios de colaboración
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ColaboracionUpdate {
        private String userId;
        private String userName;
        private String update;      // Delta de Yjs codificado en Base64/Yjs state update
        private String content;     // Texto plano actual del documento para NLP/Deep Learning
        private long timestamp;
        private String type;        // Tipo de mensaje: JOIN, SYNC, UPDATE
    }
}
