package com.example.Procesos.controller;

import com.example.Procesos.model.AsignacionProceso;
import com.example.Procesos.repository.AsignacionProcesoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * API para que los Funcionarios gestionen qué procesos/diseños
 * están habilitados para cada cliente.
 */
@RestController
@RequestMapping("/api/asignaciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AsignacionProcesoController {

    private final AsignacionProcesoRepository repository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.example.Procesos.service.WorkflowEngineService workflowEngineService;

    // ─── GET: Todas las asignaciones de un cliente ───────────────────────────────
    @GetMapping("/cliente/{clienteId}")
    public List<AsignacionProceso> getByCliente(@PathVariable String clienteId) {
        return repository.findByClienteId(clienteId);
    }

    // ─── GET: Solo los habilitados → app móvil ────────────────────────────────────
    @GetMapping("/cliente/{clienteId}/habilitados")
    public List<AsignacionProceso> getHabilitados(@PathVariable String clienteId) {
        return repository.findByClienteIdAndHabilitadoTrue(clienteId);
    }

    // ─── GET: Asignaciones por proyecto para un cliente ──────────────────────────
    @GetMapping("/cliente/{clienteId}/proyecto/{projectId}")
    public List<AsignacionProceso> getByClienteYProyecto(
            @PathVariable String clienteId,
            @PathVariable String projectId) {
        return repository.findByClienteIdAndProjectId(clienteId, projectId);
    }

    @PostMapping
    public ResponseEntity<AsignacionProceso> crearOActualizar(
            @RequestBody AsignacionProceso request) {

        // Buscar si ya existe una asignación para este par cliente+diseño
        AsignacionProceso asignacion = repository
                .findByClienteIdAndDesignId(request.getClienteId(), request.getDesignId())
                .orElse(AsignacionProceso.builder()
                        .clienteId(request.getClienteId())
                        .designId(request.getDesignId())
                        .build());

        // Actualizar campos
        asignacion.setDesignNombre(request.getDesignNombre());
        asignacion.setProjectId(request.getProjectId());
        asignacion.setProjectNombre(request.getProjectNombre());
        asignacion.setHabilitado(request.isHabilitado());
        if (request.isHabilitado()) {
            asignacion.setSolicitado(false);
        }
        asignacion.setAsignadoPor(request.getAsignadoPor());
        asignacion.setFechaAsignacion(LocalDateTime.now());

        AsignacionProceso saved = repository.save(asignacion);
        broadcastUpdate(saved.getClienteId());

        if (saved.isHabilitado()) {
            workflowEngineService.createNotification(saved.getClienteId(), "Acceso Habilitado",
                    "Se ha habilitado el acceso al proceso: " + saved.getDesignNombre(),
                    "SUCCESS", saved.getId(), "ASSIGNMENT");
        } else {
            workflowEngineService.createNotification(saved.getClienteId(), "Acceso Revocado",
                    "Se ha inhabilitado el acceso al proceso: " + saved.getDesignNombre(),
                    "WARNING", saved.getId(), "ASSIGNMENT");
        }

        return ResponseEntity.ok(saved);
    }

    // ─── POST: Solicitar acceso a un diseño ──────────────────────────────────────
    @PostMapping("/solicitar")
    public ResponseEntity<AsignacionProceso> solicitar(
            @RequestBody AsignacionProceso request) {
        AsignacionProceso asignacion = repository
                .findByClienteIdAndDesignId(request.getClienteId(), request.getDesignId())
                .orElse(AsignacionProceso.builder()
                        .clienteId(request.getClienteId())
                        .designId(request.getDesignId())
                        .build());

        asignacion.setDesignNombre(request.getDesignNombre());
        asignacion.setProjectId(request.getProjectId());
        asignacion.setProjectNombre(request.getProjectNombre());
        asignacion.setSolicitado(true);
        asignacion.setHabilitado(false);
        asignacion.setFechaSolicitud(LocalDateTime.now());

        AsignacionProceso saved = repository.save(asignacion);
        broadcastUpdate(saved.getClienteId());
        return ResponseEntity.ok(saved);
    }

    // ─── POST: Aprobar una solicitud ─────────────────────────────────────────────
    @PostMapping("/aprobar")
    public ResponseEntity<AsignacionProceso> aprobar(
            @RequestBody Map<String, String> body) {
        String clienteId = body.get("clienteId");
        String designId = body.get("designId");
        String funcionarioEmail = body.getOrDefault("funcionarioEmail", "funcionario");

        AsignacionProceso asignacion = repository
                .findByClienteIdAndDesignId(clienteId, designId)
                .orElseThrow(() -> new IllegalArgumentException("No existe una solicitud para este diseño y cliente"));

        asignacion.setHabilitado(true);
        asignacion.setSolicitado(false);
        asignacion.setAsignadoPor(funcionarioEmail);
        asignacion.setFechaAsignacion(LocalDateTime.now());

        AsignacionProceso saved = repository.save(asignacion);
        broadcastUpdate(saved.getClienteId());

        workflowEngineService.createNotification(saved.getClienteId(), "Solicitud Aprobada",
                "Tu solicitud para el proceso '" + saved.getDesignNombre() + "' ha sido aprobada.",
                "SUCCESS", saved.getId(), "ASSIGNMENT");

        return ResponseEntity.ok(saved);
    }

    // ─── POST: Deshabilitar acceso (resetear tras iniciar proceso) ───────────────
    /**
     * Llamado por el cliente después de iniciar una instancia de proceso.
     * Resetea habilitado=false y solicitado=false, obligando a una nueva solicitud
     * para la siguiente ejecución.
     *
     * Body esperado: { "clienteId": "...", "designId": "..." }
     */
    @PostMapping("/deshabilitar")
    public ResponseEntity<AsignacionProceso> deshabilitar(
            @RequestBody Map<String, String> body) {
        String clienteId = body.get("clienteId");
        String designId  = body.get("designId");

        return repository.findByClienteIdAndDesignId(clienteId, designId)
                .map(asignacion -> {
                    asignacion.setHabilitado(false);
                    asignacion.setSolicitado(false);
                    asignacion.setFechaAsignacion(LocalDateTime.now());
                    AsignacionProceso saved = repository.save(asignacion);
                    broadcastUpdate(saved.getClienteId());

                    workflowEngineService.createNotification(saved.getClienteId(), "Acceso Deshabilitado",
                            "Se ha deshabilitado el acceso al proceso: " + saved.getDesignNombre(),
                            "INFO", saved.getId(), "ASSIGNMENT");

                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─── DELETE: Eliminar una asignación por ID ───────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        repository.findById(id).ifPresent(asignacion -> {
            repository.delete(asignacion);
            broadcastUpdate(asignacion.getClienteId());
        });
        return ResponseEntity.noContent().build();
    }

    private void broadcastUpdate(String clienteId) {
        try {
            messagingTemplate.convertAndSend("/topic/asignaciones/" + clienteId, Map.of(
                    "type", "ASSIGNMENTS_UPDATED",
                    "clienteId", clienteId
            ));
        } catch (Exception e) {
            System.err.println("Error enviando websocket de asignaciones: " + e.getMessage());
        }
    }

    @GetMapping("/cliente/{clienteId}/design/{designId}")
    public ResponseEntity<AsignacionProceso> getEstado(
            @PathVariable String clienteId,
            @PathVariable String designId) {
        return repository.findByClienteIdAndDesignId(clienteId, designId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
