package com.example.Procesos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Registers custom properties under the "ia" namespace so that Spring Boot
 * tooling (and IDE inspections) recognize them as known properties.
 * This eliminates the PROP_UNKNOWN_PROPERTY warning for 'ia.backend.url'.
 */
@Configuration
@ConfigurationProperties(prefix = "ia.backend")
public class IaBackendProperties {

    /** URL of the FastAPI IA microservice. Defaults to http://localhost:8000. */
    private String url = "http://localhost:8000";

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
}
