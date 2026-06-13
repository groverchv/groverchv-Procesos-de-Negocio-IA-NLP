package com.example.Procesos.service;

import org.springframework.stereotype.Service;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class BPMTelemetryService {
    
    private final FastApiClientService fastApiClientService;

    public BPMTelemetryService(FastApiClientService fastApiClientService) {
        this.fastApiClientService = fastApiClientService;
    }

    public void registrarInicioTarea(String tramiteId, String procesoId) {
        // Lógica para guardar inicio en MongoDB
    }

    public void registrarFinTarea(String tramiteId, String procesoId, Date inicio) {
        long duracion = new Date().getTime() - inicio.getTime();
        
        // Enviar a FastAPI para detectar anomalías/cuellos de botella
        Map<String, Object> metricas = new HashMap<>();
        metricas.put("duracion", duracion);
        
        fastApiClientService.evaluarRiesgoProceso(procesoId, metricas).subscribe(resultadoIA -> {
            System.out.println("Riesgo evaluado por IA: " + resultadoIA);
            // Si la IA dice que es "Alto", se reasigna la tarea o se sube la prioridad
        });
    }
}
