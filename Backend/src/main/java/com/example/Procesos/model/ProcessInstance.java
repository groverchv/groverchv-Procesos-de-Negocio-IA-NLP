package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "instancias_proceso")
public class ProcessInstance {
    @Id
    private String id;
    private String designId;
    private String modelingId;        // Snapshot reference of the diagram
    private String projectId;
    private String designName;        // Cached name for display
    private String startedBy;         // userId who started this instance

    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, COMPLETED, CANCELED

    @Builder.Default
    private List<ActivityInstance> activities = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> variables = new HashMap<>(); // Process-level variables (form data)

    @CreatedDate
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActivityInstance {
        private String nodeId;
        private String nodeLabel;
        private String nodeType;
        private String status; // PENDING, IN_PROCESS, IN_REVIEW, FINISHED, CANCELED, SKIPPED
        private String assignedTo;

        @Builder.Default
        private Map<String, Object> formData = new HashMap<>();

        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
    }
}
