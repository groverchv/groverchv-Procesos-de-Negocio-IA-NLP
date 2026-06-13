package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "documentos_metadata")
public class DocumentoMetadata {
    @Id
    private String id;
    private String tenantId;
    private String nombreArchivo;
    private String s3Url;
    private long tamanoBytes;
    private String tipoMime;
    private String propietarioId;
    private List<String> rolesConAcceso; // ej. ["ROLE_ADMIN", "ROLE_DISENADOR"]
    private Date fechaCreacion;
    private Date ultimaModificacion;
}
