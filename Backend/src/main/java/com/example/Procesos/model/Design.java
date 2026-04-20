package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "disenos")
public class Design {
    @Id
    private String id;
    private String nombre;
    private String projectId;
    private String modelingId;
    
    @CreatedDate
    private LocalDateTime fechaCreacion;
    
    @LastModifiedDate
    private LocalDateTime ultimaActualizacion;
    
    private String estado; // e.g. "Draft", "Active", "Retired"
    @Default
    private String layoutType = "vertical"; // "horizontal" or "vertical" swimlanes
    private boolean locked; // true when an Official is executing an instance
    private String lockedBy; // userId that locked the design
}
