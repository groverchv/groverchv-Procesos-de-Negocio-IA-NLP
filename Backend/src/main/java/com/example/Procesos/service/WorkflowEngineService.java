package com.example.Procesos.service;

import com.example.Procesos.model.Design;
import com.example.Procesos.model.Modeling;
import com.example.Procesos.model.Notification;
import com.example.Procesos.model.ProcessInstance;
import com.example.Procesos.model.ProcessInstance.ActivityInstance;
import com.example.Procesos.repository.DesignRepository;
import com.example.Procesos.repository.ModelingRepository;
import com.example.Procesos.repository.NotificationRepository;
import com.example.Procesos.repository.ProcessInstanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

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
    private final SimpMessagingTemplate messagingTemplate;

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

        // Auto-advance from start node
        ActivityInstance startActivity = activities.stream()
                .filter(a -> "start".equals(a.getNodeType()))
                .findFirst().orElse(null);

        if (startActivity != null) {
            autoAdvanceFromNode(instance, startActivity.getNodeId(), modeling);
            instance = instanceRepository.save(instance);
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

        // Check if all activities are FINISHED or SKIPPED → complete process
        boolean allDone = instance.getActivities().stream()
                .allMatch(a -> "FINISHED".equals(a.getStatus())
                        || "SKIPPED".equals(a.getStatus())
                        || "CANCELED".equals(a.getStatus()));
        if (allDone) {
            instance.setStatus("COMPLETED");
            instance.setCompletedAt(LocalDateTime.now());
            unlockDesign(instance.getDesignId());
        }

        instance = instanceRepository.save(instance);

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
            else if ("PENDING".equals(targetActivity.getStatus())) {
                targetActivity.setStatus("IN_PROCESS");
                targetActivity.setStartedAt(LocalDateTime.now());
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

    public List<ProcessInstance> getAllInstances() {
        return instanceRepository.findAll();
    }

    // ═══ HELPERS ═══
    private void unlockDesign(String designId) {
        designRepository.findById(designId).ifPresent(d -> {
            d.setLocked(false);
            d.setLockedBy(null);
            designRepository.save(d);
            messagingTemplate.convertAndSend("/topic/design-lock/" + designId,
                    Map.of("locked", false));
        });
    }

    private void createNotification(String userId, String title, String message,
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
}
