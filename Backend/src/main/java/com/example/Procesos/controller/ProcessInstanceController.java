package com.example.Procesos.controller;

import com.example.Procesos.model.ProcessInstance;
import com.example.Procesos.service.WorkflowEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProcessInstanceController {

    private final WorkflowEngineService workflowEngine;

    @PostMapping("/start")
    public ProcessInstance startProcess(@RequestBody Map<String, String> body) {
        String designId = body.get("designId");
        String userId = body.getOrDefault("userId", "anonymous");
        return workflowEngine.startProcess(designId, userId);
    }

    @GetMapping
    public List<ProcessInstance> getAllInstances() {
        return workflowEngine.getAllInstances();
    }

    @GetMapping("/active")
    public List<ProcessInstance> getActiveInstances() {
        return workflowEngine.getActiveInstances();
    }

    @GetMapping("/project/{projectId}")
    public List<ProcessInstance> getByProject(@PathVariable String projectId) {
        return workflowEngine.getInstancesByProject(projectId);
    }

    @GetMapping("/design/{designId}")
    public List<ProcessInstance> getByDesign(@PathVariable String designId) {
        return workflowEngine.getInstancesByDesign(designId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProcessInstance> getById(@PathVariable String id) {
        return workflowEngine.getInstance(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/advance")
    public ProcessInstance advanceActivity(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        String nodeId = (String) body.get("nodeId");
        String newStatus = (String) body.get("status");
        String userId = (String) body.getOrDefault("userId", "anonymous");
        @SuppressWarnings("unchecked")
        Map<String, Object> formData = (Map<String, Object>) body.getOrDefault("formData", Map.of());
        return workflowEngine.advanceActivity(id, nodeId, newStatus, formData, userId);
    }

    @PutMapping("/{id}/decide")
    public ProcessInstance resolveDecision(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String decisionNodeId = body.get("decisionNodeId");
        String chosenEdgeId = body.get("chosenEdgeId");
        String userId = body.getOrDefault("userId", "anonymous");
        return workflowEngine.resolveDecision(id, decisionNodeId, chosenEdgeId, userId);
    }

    @PutMapping("/{id}/cancel")
    public ProcessInstance cancelProcess(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String userId = body.getOrDefault("userId", "anonymous");
        return workflowEngine.cancelProcess(id, userId);
    }

    @GetMapping("/design/{designId}/validate")
    public Map<String, Object> validateDiagram(@PathVariable String designId) {
        return workflowEngine.validateDiagram(designId);
    }
}
