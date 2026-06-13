package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "telemetria_procesos")
public class TelemetriaProceso {
    @Id
    private String id;
    private String procesoId;
    private String tramiteId;
    private String estadoActual;
    private Date tiempoInicio;
    private Date tiempoFin;
    private long duracionMilisegundos;
    private boolean huboCuelloDeBotella;
}

