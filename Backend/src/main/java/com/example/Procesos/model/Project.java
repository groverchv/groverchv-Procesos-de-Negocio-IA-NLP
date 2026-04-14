package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "proyectos")
public class Project {
    @Id
    private String id;
    private String nombre;
    private String descripcion;
    
    @CreatedDate
    private LocalDateTime fechaCreacion;
    
    @LastModifiedDate
    private LocalDateTime ultimaActualizacion;

    @Builder.Default
    private List<String> designIds = new ArrayList<>();
}
