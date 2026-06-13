package com.example.Procesos.service;

import com.example.Procesos.model.Design;
import com.example.Procesos.model.Modeling;
import com.example.Procesos.model.Notification;
import com.example.Procesos.model.ProcessInstance;
import com.example.Procesos.model.ProcessInstance.ActivityInstance;
import com.example.Procesos.model.Usuario;
import com.example.Procesos.model.Project;
import com.example.Procesos.repository.DesignRepository;
import com.example.Procesos.repository.ModelingRepository;
import com.example.Procesos.repository.NotificationRepository;
import com.example.Procesos.repository.ProcessInstanceRepository;
import com.example.Procesos.repository.UsuarioRepository;
import com.example.Procesos.repository.ProjectRepository;
import com.example.Procesos.repository.DocumentoHistorialRepository;
import com.example.Procesos.model.DocumentoHistorial;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.example.Procesos.service.push.FirebasePushService;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowEngineService {

    private final ProcessInstanceRepository instanceRepository;
    private final DesignRepository designRepository;
    private final ModelingRepository modelingRepository;
    private final NotificationRepository notificationRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProjectRepository projectRepository;
    private final S3DocumentService s3DocumentService;
    private final SimpMessagingTemplate messagingTemplate;
    private final FirebasePushService firebasePushService;
    private final DocumentoHistorialRepository documentoHistorialRepository;

    // ═══ INSTANTIATE PROCESS ═══
    public ProcessInstance startProcess(String designId, String userId) {
        Design design = designRepository.findById(designId)
                .orElseThrow(() -> new RuntimeException("Design not found: " + designId));

        Modeling modeling = modelingRepository.findById(design.getModelingId())
                .orElseThrow(() -> new RuntimeException("Modeling not found for design: " + designId));

        // Lock the design so Designers cannot modify it
        design.setLocked(true);
        design.setLockedBy(userId);
        designRepository.save(design);

        // Buscar el inquilino (tenant) del usuario para aislamiento en S3
        Optional<Usuario> userOpt = usuarioRepository.findById(userId);
        if (!userOpt.isPresent()) {
            userOpt = usuarioRepository.findByEmail(userId);
        }
        if (userOpt.isPresent()) {
            // tenantId resolved but only needed within updateProcessReportInS3
        }

        // Build activity instances from modeling nodes
        List<ActivityInstance> activities = new ArrayList<>();
        for (Modeling.NodeData node : modeling.getNodes()) {
            if ("swimlane".equals(node.getType()) || "note".equals(node.getType())) continue;

            String initialStatus;
            if ("start".equals(node.getType())) {
                initialStatus = "FINISHED"; // Start node is auto-completed
            } else {
                initialStatus = "PENDING";
            }

            activities.add(ActivityInstance.builder()
                    .nodeId(node.getId())
                    .nodeLabel(node.getLabel())
                    .nodeType(node.getType())
                    .status(initialStatus)
                    .formData(new HashMap<>())
                    .build());
        }

        ProcessInstance instance = ProcessInstance.builder()
                .designId(designId)
                .modelingId(design.getModelingId())
                .projectId(design.getProjectId())
                .designName(design.getNombre())
                .startedBy(userId)
                .status("ACTIVE")
                .activities(activities)
                .variables(new HashMap<>())
                .startedAt(LocalDateTime.now())
                .build();

        instance = instanceRepository.save(instance);
        updateProcessReportInS3(instance);

        ActivityInstance startActivity = activities.stream()
                .filter(a -> "start".equals(a.getNodeType()))
                .findFirst().orElse(null);

        if (startActivity != null) {
            autoAdvanceFromNode(instance, startActivity.getNodeId(), modeling);
            instance = instanceRepository.save(instance);
            updateProcessReportInS3(instance);
        }

        // Send notification
        createNotification(userId, "Proceso Iniciado",
                "Has iniciado el proceso: " + design.getNombre(),
                "SUCCESS", instance.getId(), "PROCESS_INSTANCE");

        // Broadcast to designers that design is locked
        messagingTemplate.convertAndSend("/topic/design-lock/" + designId,
                Map.of("locked", true, "lockedBy", userId));

        return instance;
    }

    // ═══ ADVANCE ACTIVITY ═══
    public ProcessInstance advanceActivity(String instanceId, String nodeId,
                                           String newStatus, Map<String, Object> formData, String userId) {
        ProcessInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("Instance not found"));

        Modeling modeling = modelingRepository.findById(instance.getModelingId())
                .orElseThrow(() -> new RuntimeException("Modeling not found"));

        ActivityInstance activity = instance.getActivities().stream()
                .filter(a -> a.getNodeId().equals(nodeId))
                .findFirst().orElseThrow(() -> new RuntimeException("Activity not found: " + nodeId));

        // Update status
        activity.setStatus(newStatus);
        activity.setAssignedTo(userId);
        if (formData != null && !formData.isEmpty()) {
            activity.setFormData(formData);
            // Merge into process-level variables
            instance.getVariables().putAll(formData);
        }

        if ("IN_PROCESS".equals(newStatus) && activity.getStartedAt() == null) {
            activity.setStartedAt(LocalDateTime.now());
        }
        if ("FINISHED".equals(newStatus)) {
            activity.setCompletedAt(LocalDateTime.now());
            // Auto-advance to next nodes
            autoAdvanceFromNode(instance, nodeId, modeling);
        }

        instance = instanceRepository.save(instance);
        updateProcessReportInS3(instance);

        // Notificar al usuario que avanzó de actividad
        createNotification(instance.getStartedBy(), "Actividad Actualizada",
                "La actividad '" + activity.getNodeLabel() + "' ha cambiado a estado: " + newStatus,
                "INFO", instance.getId(), "PROCESS_INSTANCE");

        boolean allDone = instance.getActivities().stream()
                .allMatch(a -> "FINISHED".equals(a.getStatus())
                        || "SKIPPED".equals(a.getStatus())
                        || "CANCELED".equals(a.getStatus()));
        if (allDone) {
            instance.setStatus("COMPLETED");
            instance.setCompletedAt(LocalDateTime.now());
            unlockDesign(instance.getDesignId());
            
            // Notificar al usuario que el proceso terminó
            createNotification(instance.getStartedBy(), "Proceso Completado",
                    "Tu proceso del diseño '" + instance.getDesignName() + "' se ha completado con éxito.",
                    "SUCCESS", instance.getId(), "PROCESS_INSTANCE");
        }

        // Broadcast real-time update
        messagingTemplate.convertAndSend("/topic/instance/" + instanceId, instance);

        return instance;
    }

    // ═══ AUTO-ADVANCE LOGIC ═══
    private void autoAdvanceFromNode(ProcessInstance instance, String nodeId, Modeling modeling) {
        // Find outgoing edges from this node
        List<Modeling.EdgeData> outgoing = modeling.getEdges().stream()
                .filter(e -> e.getSource().equals(nodeId))
                .collect(Collectors.toList());

        for (Modeling.EdgeData edge : outgoing) {
            String targetId = edge.getTarget();
            ActivityInstance targetActivity = instance.getActivities().stream()
                    .filter(a -> a.getNodeId().equals(targetId))
                    .findFirst().orElse(null);

            if (targetActivity == null) continue;

            Modeling.NodeData targetNode = modeling.getNodes().stream()
                    .filter(n -> n.getId().equals(targetId))
                    .findFirst().orElse(null);

            if (targetNode == null) continue;

            String targetType = targetNode.getType();

            // Decision nodes: mark as needing manual evaluation unless policy exists
            if ("decision".equals(targetType)) {
                targetActivity.setStatus("IN_REVIEW");
                // Decision will be resolved by the Official choosing a path
            }
            // Parallel gateway (fork): activate ALL outgoing paths
            else if ("fork".equals(targetType) || "parallel".equals(targetType)) {
                targetActivity.setStatus("FINISHED");
                targetActivity.setCompletedAt(LocalDateTime.now());
                autoAdvanceFromNode(instance, targetId, modeling);
            }
            // Join node: only activate if ALL incoming are FINISHED
            else if ("join".equals(targetType)) {
                List<String> incomingSources = modeling.getEdges().stream()
                        .filter(e -> e.getTarget().equals(targetId))
                        .map(Modeling.EdgeData::getSource)
                        .collect(Collectors.toList());

                boolean allIncomingDone = incomingSources.stream().allMatch(srcId ->
                        instance.getActivities().stream()
                                .filter(a -> a.getNodeId().equals(srcId))
                                .findFirst()
                                .map(a -> "FINISHED".equals(a.getStatus()) || "SKIPPED".equals(a.getStatus()))
                                .orElse(false));

                if (allIncomingDone) {
                    targetActivity.setStatus("FINISHED");
                    targetActivity.setCompletedAt(LocalDateTime.now());
                    autoAdvanceFromNode(instance, targetId, modeling);
                }
            }
            // End nodes: auto-finish
            else if ("end".equals(targetType) || "activity_final".equals(targetType) || "flow_final".equals(targetType)) {
                targetActivity.setStatus("FINISHED");
                targetActivity.setCompletedAt(LocalDateTime.now());
            }
            // Regular activity: mark as IN_PROCESS (ready for the Official)
            else {
                if ("FINISHED".equals(targetActivity.getStatus()) || "SKIPPED".equals(targetActivity.getStatus()) || "CANCELED".equals(targetActivity.getStatus())) {
                    resetDownstreamNodes(instance, modeling, targetId);
                }
                if ("PENDING".equals(targetActivity.getStatus())) {
                    targetActivity.setStatus("IN_PROCESS");
                    targetActivity.setStartedAt(LocalDateTime.now());
                }
            }
        }
    }

    // ═══ RESOLVE DECISION ═══
    public ProcessInstance resolveDecision(String instanceId, String decisionNodeId,
                                           String chosenEdgeId, String userId) {
        ProcessInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("Instance not found"));

        Modeling modeling = modelingRepository.findById(instance.getModelingId())
                .orElseThrow(() -> new RuntimeException("Modeling not found"));

        // Mark decision as FINISHED
        ActivityInstance decisionActivity = instance.getActivities().stream()
                .filter(a -> a.getNodeId().equals(decisionNodeId))
                .findFirst().orElseThrow();
        decisionActivity.setStatus("FINISHED");
        decisionActivity.setCompletedAt(LocalDateTime.now());

        // Find all outgoing edges from decision
        List<Modeling.EdgeData> outgoing = modeling.getEdges().stream()
                .filter(e -> e.getSource().equals(decisionNodeId))
                .collect(Collectors.toList());

        // Activate chosen path, SKIP others
        for (Modeling.EdgeData edge : outgoing) {
            ActivityInstance targetAct = instance.getActivities().stream()
                    .filter(a -> a.getNodeId().equals(edge.getTarget()))
                    .findFirst().orElse(null);
            if (targetAct == null) continue;

            if (edge.getId().equals(chosenEdgeId)) {
                if ("FINISHED".equals(targetAct.getStatus()) || "SKIPPED".equals(targetAct.getStatus()) || "CANCELED".equals(targetAct.getStatus())) {
                    resetDownstreamNodes(instance, modeling, edge.getTarget());
                }

                if ("PENDING".equals(targetAct.getStatus()) || "IN_REVIEW".equals(targetAct.getStatus())) {
                    targetAct.setStatus("IN_PROCESS");
                    targetAct.setStartedAt(LocalDateTime.now());
                }
                // If target is also a gateway, auto-advance
                Modeling.NodeData targetNode = modeling.getNodes().stream()
                        .filter(n -> n.getId().equals(edge.getTarget())).findFirst().orElse(null);
                if (targetNode != null && ("fork".equals(targetNode.getType()) || "parallel".equals(targetNode.getType()))) {
                    targetAct.setStatus("FINISHED");
                    autoAdvanceFromNode(instance, edge.getTarget(), modeling);
                }
            } else {
                // Skip non-chosen paths
                targetAct.setStatus("SKIPPED");
            }
        }

        instance = instanceRepository.save(instance);
        updateProcessReportInS3(instance);
        messagingTemplate.convertAndSend("/topic/instance/" + instanceId, instance);
        return instance;
    }

    // ═══ CANCEL PROCESS ═══
    public ProcessInstance cancelProcess(String instanceId, String userId) {
        ProcessInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("Instance not found"));

        instance.setStatus("CANCELED");
        instance.setCompletedAt(LocalDateTime.now());
        instance.getActivities().forEach(a -> {
            if (!"FINISHED".equals(a.getStatus())) {
                a.setStatus("CANCELED");
            }
        });

        unlockDesign(instance.getDesignId());
        instance = instanceRepository.save(instance);
        updateProcessReportInS3(instance);
        messagingTemplate.convertAndSend("/topic/instance/" + instanceId, instance);
        return instance;
    }

    // ═══ QUERIES ═══
    public List<ProcessInstance> getInstancesByDesign(String designId) {
        return instanceRepository.findByDesignId(designId);
    }

    public List<ProcessInstance> getActiveInstances() {
        return instanceRepository.findByStatus("ACTIVE");
    }

    public List<ProcessInstance> getInstancesByProject(String projectId) {
        return instanceRepository.findByProjectId(projectId);
    }

    public Optional<ProcessInstance> getInstance(String instanceId) {
        return instanceRepository.findById(instanceId);
    }

    public List<ProcessInstance> getInstancesByStartedBy(String userId) {
        return instanceRepository.findByStartedBy(userId);
    }

    public List<ProcessInstance> getAllInstances() {
        return instanceRepository.findAll();
    }

    // ═══ HELPERS ═══
    private void resetDownstreamNodes(ProcessInstance instance, Modeling modeling, String startNodeId) {
        Set<String> visited = new HashSet<>();
        Queue<String> queue = new LinkedList<>();
        queue.add(startNodeId);

        while (!queue.isEmpty()) {
            String curr = queue.poll();
            if (!visited.add(curr)) continue;

            // Reset this node
            instance.getActivities().stream()
                .filter(a -> a.getNodeId().equals(curr))
                .forEach(a -> {
                    a.setStatus("PENDING");
                    a.setStartedAt(null);
                    a.setCompletedAt(null);
                });

            // Add all targets of outgoing edges
            modeling.getEdges().stream()
                .filter(e -> e.getSource().equals(curr))
                .forEach(e -> queue.add(e.getTarget()));
        }
    }

    private void unlockDesign(String designId) {
        designRepository.findById(designId).ifPresent(d -> {
            d.setLocked(false);
            d.setLockedBy(null);
            designRepository.save(d);
            messagingTemplate.convertAndSend("/topic/design-lock/" + designId,
                    Map.of("locked", false));
        });
    }

    public void createNotification(String userId, String title, String message,
                                     String type, String refId, String refType) {
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .type(type)
                .referenceId(refId)
                .referenceType(refType)
                .read(false)
                .createdAt(LocalDateTime.now())
                .build();
        notificationRepository.save(notification);
        messagingTemplate.convertAndSend("/topic/notifications/" + userId, notification);

        // Envío de Notificación Push a dispositivo móvil si tiene token registrado
        try {
            Optional<Usuario> userOpt = usuarioRepository.findById(userId);
            if (!userOpt.isPresent()) {
                userOpt = usuarioRepository.findByEmail(userId);
            }
            if (userOpt.isPresent()) {
                Usuario user = userOpt.get();
                if (user.getFcmToken() != null && !user.getFcmToken().isBlank()) {
                    firebasePushService.enviarNotificacionACliente(user.getFcmToken(), title, message);
                }
            }
        } catch (Exception e) {
            System.err.println("Advertencia al enviar notificación push: " + e.getMessage());
        }
    }

    // ═══ VALIDATION (RF-9) ═══
    public Map<String, Object> validateDiagram(String designId) {
        Design design = designRepository.findById(designId)
                .orElseThrow(() -> new RuntimeException("Design not found"));
        Modeling modeling = modelingRepository.findById(design.getModelingId())
                .orElseThrow(() -> new RuntimeException("Modeling not found"));

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        List<Modeling.NodeData> nodes = modeling.getNodes();
        List<Modeling.EdgeData> edges = modeling.getEdges();

        // Filter out swimlanes and notes for connection checks
        List<Modeling.NodeData> processNodes = nodes.stream()
                .filter(n -> !"swimlane".equals(n.getType()) && !"note".equals(n.getType()))
                .collect(Collectors.toList());

        // Check: at least one start node
        long startCount = processNodes.stream().filter(n -> "start".equals(n.getType())).count();
        if (startCount == 0) errors.add("No hay nodo de inicio. Se requiere exactamente uno.");
        if (startCount > 1) errors.add("Hay " + startCount + " nodos de inicio. Solo se permite uno.");

        // Check: at least one end node
        long endCount = processNodes.stream()
                .filter(n -> "end".equals(n.getType()) || "activity_final".equals(n.getType()) || "flow_final".equals(n.getType()))
                .count();
        if (endCount == 0) warnings.add("No hay nodo de fin. Se recomienda al menos uno.");

        // Check: orphan nodes (no connections)
        for (Modeling.NodeData node : processNodes) {
            if ("start".equals(node.getType()) || "end".equals(node.getType())
                    || "activity_final".equals(node.getType()) || "flow_final".equals(node.getType())) continue;

            boolean hasIncoming = edges.stream().anyMatch(e -> e.getTarget().equals(node.getId()));
            boolean hasOutgoing = edges.stream().anyMatch(e -> e.getSource().equals(node.getId()));

            if (!hasIncoming && !hasOutgoing) {
                errors.add("Nodo aislado: \"" + node.getLabel() + "\" no tiene conexiones.");
            } else if (!hasIncoming) {
                warnings.add("\"" + node.getLabel() + "\" no tiene conexiones de entrada.");
            } else if (!hasOutgoing && !"end".equals(node.getType())) {
                warnings.add("\"" + node.getLabel() + "\" no tiene conexiones de salida.");
            }
        }

        // Check: decision nodes must have labeled outgoing edges
        processNodes.stream()
                .filter(n -> "decision".equals(n.getType()))
                .forEach(decision -> {
                    List<Modeling.EdgeData> decisionEdges = edges.stream()
                            .filter(e -> e.getSource().equals(decision.getId()))
                            .collect(Collectors.toList());
                    if (decisionEdges.size() < 2) {
                        warnings.add("Decisión \"" + decision.getLabel() + "\" debe tener al menos 2 salidas.");
                    }
                    for (Modeling.EdgeData edge : decisionEdges) {
                        if (edge.getLabel() == null || edge.getLabel().isBlank()) {
                            warnings.add("Decisión \"" + decision.getLabel() + "\": flujo sin etiqueta/guarda.");
                        }
                    }
                });

        boolean valid = errors.isEmpty();
        return Map.of(
                "valid", valid,
                "errors", errors,
                "warnings", warnings,
                "nodeCount", processNodes.size(),
                "edgeCount", edges.size()
        );
    }

    public void updateProcessReportInS3(ProcessInstance instance) {
        try {
            String tenantId = "tenant_default";
            String clientName = instance.getStartedBy();
            Optional<Usuario> userOpt = usuarioRepository.findById(instance.getStartedBy());
            if (!userOpt.isPresent()) {
                userOpt = usuarioRepository.findByEmail(instance.getStartedBy());
            }
            if (userOpt.isPresent()) {
                tenantId = userOpt.get().getTenantId();
                clientName = userOpt.get().getNombre();
            }

            String projectName = "proyecto_desconocido";
            if (instance.getProjectId() != null) {
                projectName = projectRepository.findById(instance.getProjectId())
                        .map(Project::getNombre)
                        .orElse("proyecto_desconocido");
            }

            String sanitizedProjectName = projectName.replaceAll("[^a-zA-Z0-9_.-]", "_");
            String sanitizedDesignName = instance.getDesignName().replaceAll("[^a-zA-Z0-9_.-]", "_");
            String instanceId = instance.getId();
            String path = sanitizedProjectName + "/" + sanitizedDesignName + "/" + instanceId + "/process_info.docx";

            // Reconstruct the text report
            StringBuilder sb = new StringBuilder();
            sb.append("BPMNFLOW - REPORTE DE PROCESO EN DRIVE\n");
            sb.append("===============================================\n");
            sb.append("Cliente: ").append(clientName).append("\n");
            sb.append("Diseño/Flujo: ").append(instance.getDesignName()).append("\n");
            sb.append("ID de Instancia: ").append(instanceId).append("\n");
            sb.append("Proyecto: ").append(projectName).append("\n");
            sb.append("Iniciado por: ").append(instance.getStartedBy()).append("\n");
            sb.append("Fecha de Inicio: ").append(instance.getStartedAt() != null ? instance.getStartedAt().toLocalDate() : "N/A").append("\n");
            sb.append("Estado: ").append(instance.getStatus()).append("\n\n");

            sb.append("VARIABLES DEL PROCESO:\n");
            try {
                String varsJson = new com.fasterxml.jackson.databind.ObjectMapper()
                        .writerWithDefaultPrettyPrinter()
                        .writeValueAsString(instance.getVariables() != null ? instance.getVariables() : Map.of());
                sb.append(varsJson).append("\n\n");
            } catch (Exception ex) {
                sb.append("{}\n\n");
            }

            sb.append("HOJA DE RUTA / ACTIVIDADES:\n");
            if (instance.getActivities() != null) {
                for (ProcessInstance.ActivityInstance a : instance.getActivities()) {
                    sb.append("  • ").append(a.getNodeLabel()).append(" (").append(a.getNodeType()).append(") -> [").append(a.getStatus()).append("]\n");
                }
            }

            byte[] docxBytes;
            try (XWPFDocument doc = new XWPFDocument();
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                for (String line : sb.toString().split("\n")) {
                    XWPFParagraph para = doc.createParagraph();
                    XWPFRun run = para.createRun();
                    run.setText(line.trim());
                }
                doc.write(out);
                docxBytes = out.toByteArray();
            }

            // Crear carpetas virtuales S3 para la jerarquía Proyecto > Diseño > Instancia
            s3DocumentService.createFolder(tenantId, sanitizedProjectName);
            s3DocumentService.createFolder(tenantId, sanitizedProjectName + "/" + sanitizedDesignName);
            s3DocumentService.createFolder(tenantId, sanitizedProjectName + "/" + sanitizedDesignName + "/" + instanceId);

            s3DocumentService.uploadDocument(tenantId, path, new ByteArrayInputStream(docxBytes), docxBytes.length, 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            
            // Log to history
            logHistory(tenantId, path, "SISTEMA", "CREACION", "Actualización automática de telemetría del proceso en S3", sb.toString());
        } catch (Exception e) {
            System.err.println("Error actualizando reporte en S3: " + e.getMessage());
        }
    }

    private void logHistory(String tenantId, String fileName, String usuario, String accion, String detalle, String contenido) {
        try {
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .accion(accion)
                    .detalle(detalle)
                    .contenido(contenido)
                    .fecha(new Date())
                    .build());
        } catch (Exception e) {
            System.err.println("Error guardando historial: " + e.getMessage());
        }
    }
}
