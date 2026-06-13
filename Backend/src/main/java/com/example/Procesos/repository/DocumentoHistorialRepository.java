package com.example.Procesos.repository;

import com.example.Procesos.model.DocumentoHistorial;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface DocumentoHistorialRepository extends MongoRepository<DocumentoHistorial, String> {
    List<DocumentoHistorial> findByTenantIdOrderByFechaDesc(String tenantId);
    List<DocumentoHistorial> findByTenantIdAndNombreArchivoOrderByFechaDesc(String tenantId, String nombreArchivo);
}
