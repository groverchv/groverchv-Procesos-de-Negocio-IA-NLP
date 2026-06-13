package com.example.Procesos.repository;

import com.example.Procesos.model.Design;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;


public interface DesignRepository extends MongoRepository<Design, String> {
    List<Design> findByProjectId(String projectId);
    Optional<Design> findByModelingId(String modelingId);
}

