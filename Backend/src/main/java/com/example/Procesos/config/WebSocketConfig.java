package com.example.Procesos.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
        config.setPreservePublishOrder(true); // Estilo videojuego: mantiene el orden exacto de los movimientos
    }

    @Override
    public void configureWebSocketTransport(org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(1024 * 1024); // 1MB para diagramas grandes
        registration.setSendBufferSizeLimit(1024 * 1024);
        registration.setSendTimeLimit(20000);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SockJS endpoint for browsers that don't support native WebSockets
        registry.addEndpoint("/ws-bpmn")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setHeartbeatTime(25_000)
                .setDisconnectDelay(5_000);

        // Native WebSocket endpoint
        registry.addEndpoint("/ws-bpmn")
                .setAllowedOriginPatterns("*");
    }
}
