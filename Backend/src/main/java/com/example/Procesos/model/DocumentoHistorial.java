package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "documentos_historial")
public class DocumentoHistorial {
    @Id
    private String id;
    private String tenantId;
    private String nombreArchivo; // El path completo del archivo en S3 (ej. Proyecto/Diseño/instancia/process_info.txt o archivos subidos)
    private String usuario; // Email o nombre del usuario que realizó la acción
    private String rol; // Rol del usuario (ej. CLIENTE, FUNCIONARIO, etc.)
    private String ip; // Dirección IP desde la que se realizó la acción
    private String accion; // "CREACION", "LECTURA", "EDICION", "ELIMINACION"
    private String detalle; // Descripción de los cambios o del acceso
    private String contenido; // Snapshot del contenido del archivo (si es texto plano)
    private Date fecha;
}
