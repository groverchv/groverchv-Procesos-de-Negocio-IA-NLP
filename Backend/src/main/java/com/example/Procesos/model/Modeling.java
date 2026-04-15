package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "modelados")
public class Modeling {
    @Id
    private String id;
    @Builder.Default
    private List<NodeData> nodes = new ArrayList<>();
    @Builder.Default
    private List<EdgeData> edges = new ArrayList<>();
    private String version;
    private String estado;
    
    // Collaboration metadata
    private String senderId;
    private Long timestamp;
    private Boolean isDragPulse;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NodeData {
        private String id;
        private String type;
        private double x;
        private double y;
        private String label;
        private String policy;
        private Double width;
        private Double height;
        private Integer fontSize; // Added field
        private String parentId;
        private java.util.List<java.util.Map<String, Object>> forms = new java.util.ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Point {
        private double x;
        private double y;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EdgeData {
        private String id;
        private String source;
        private String target;
        private String label;      // Added field
        private String color;      // Added field
        private String style;      // Added field (solid/dashed)
        private Integer strokeWidth; // Added field
        private Integer opacity;    // Added field
        private java.util.List<Point> waypoints = new java.util.ArrayList<>(); // Added field for routing
    }
}
