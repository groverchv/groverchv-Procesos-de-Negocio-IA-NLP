package com.example.Procesos.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${ia.backend.url:http://localhost:8000}")
    private String iaBackendUrl;

    @Bean
    public WebClient iaWebClient() {
        return WebClient.builder()
                .baseUrl(iaBackendUrl)
                .build();
    }
}
