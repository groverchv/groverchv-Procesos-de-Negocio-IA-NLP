package com.example.Procesos.repository;

import com.example.Procesos.model.AsignacionProceso;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;


public interface AsignacionProcesoRepository extends MongoRepository<AsignacionProceso, String> {

    /** Todas las asignaciones de un cliente (habilitadas o no) */
    List<AsignacionProceso> findByClienteId(String clienteId);

    /** Solo los procesos habilitados para un cliente → para la app móvil */
    List<AsignacionProceso> findByClienteIdAndHabilitadoTrue(String clienteId);

    /** Buscar una asignación específica cliente+diseño para actualizar su estado */
    Optional<AsignacionProceso> findByClienteIdAndDesignId(String clienteId, String designId);

    /** Todas las asignaciones de un proyecto a un cliente */
    List<AsignacionProceso> findByClienteIdAndProjectId(String clienteId, String projectId);
}
