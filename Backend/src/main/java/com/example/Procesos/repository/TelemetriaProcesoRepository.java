package com.example.Procesos.repository;

import com.example.Procesos.model.TelemetriaProceso;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio MongoDB para TelemetriaProceso.
 * Colección: telemetria_procesos
 * Permite registrar y consultar métricas de telemetría de procesos BPM.
 */
@Repository
public interface TelemetriaProcesoRepository extends MongoRepository<TelemetriaProceso, String> {

    /** Obtiene toda la telemetría de un proceso específico. */
    List<TelemetriaProceso> findByProcesoId(String procesoId);

    /** Obtiene telemetría de un trámite específico. */
    List<TelemetriaProceso> findByTramiteId(String tramiteId);

    /** Obtiene telemetría con cuellos de botella detectados. */
    List<TelemetriaProceso> findByHuboCuelloDeBotella(boolean huboCuelloDeBotella);
}
