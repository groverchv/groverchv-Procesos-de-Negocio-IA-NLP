package com.example.Procesos.repository;

import com.example.Procesos.model.DocumentoMetadata;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface DocumentoMetadataRepository extends MongoRepository<DocumentoMetadata, String> {
    List<DocumentoMetadata> findByTenantId(String tenantId);
    List<DocumentoMetadata> findByPropietarioId(String propietarioId);
}
