package com.example.Procesos.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
public class PresenceController {

    private final SimpMessagingTemplate messagingTemplate;

    // sessionID -> designId
    private final Map<String, String> sessionToDesign = new ConcurrentHashMap<>();
    
    // designId -> Set of sessionIDs
    private final Map<String, Set<String>> designToSessions = new ConcurrentHashMap<>();
    
    // designId -> { userId: {x, y} }
    private final Map<String, Map<String, Map<String, Double>>> cursorsMap = new ConcurrentHashMap<>();

    @MessageMapping("/presence/{designId}")
    public void handlePresence(@DestinationVariable String designId, Map<String, String> payload, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String action = payload.getOrDefault("action", "join");

        if ("join".equals(action)) {
            sessionToDesign.put(sessionId, designId);
            designToSessions.computeIfAbsent(designId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        }

        broadcastPresence(designId);
    }

    @MessageMapping("/presence/cursor/{designId}")
    public void handleCursorMove(@DestinationVariable String designId, Map<String, Object> payload) {
        String userId = (String) payload.get("userId");
        if (userId == null) return;

        Double x = Double.valueOf(payload.get("x").toString());
        Double y = Double.valueOf(payload.get("y").toString());

        cursorsMap.computeIfAbsent(designId, k -> new ConcurrentHashMap<>());
        Map<String, Double> coords = new ConcurrentHashMap<>();
        coords.put("x", x);
        coords.put("y", y);
        cursorsMap.get(designId).put(userId, coords);

        broadcastPresence(designId);
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String designId = sessionToDesign.remove(sessionId);
        
        if (designId != null) {
            Set<String> sessions = designToSessions.get(designId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    designToSessions.remove(designId);
                    cursorsMap.remove(designId);
                }
            }
            broadcastPresence(designId);
        }
    }

    private void broadcastPresence(String designId) {
        Set<String> sessions = designToSessions.get(designId);
        int count = (sessions != null) ? sessions.size() : 0;
        Map<String, Map<String, Double>> cursors = cursorsMap.getOrDefault(designId, Map.of());

        messagingTemplate.convertAndSend(
            "/topic/presence/" + designId,
            Map.of(
                "count", count,
                "cursors", cursors
            )
        );
    }
}
