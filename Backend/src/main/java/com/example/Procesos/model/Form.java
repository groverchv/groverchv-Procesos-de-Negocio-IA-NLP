package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "formularios")
public class Form {
    @Id
    private String id;
    private String modelingId;
    private String label;
    private String type; // e.g. "text", "number", "date"
    private String defaultValue;
    private boolean required;
    private String estado;
}
