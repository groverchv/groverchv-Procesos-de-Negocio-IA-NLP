package com.example.Procesos.repository;

import com.example.Procesos.model.ProcessInstance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessInstanceRepository extends MongoRepository<ProcessInstance, String> {
    List<ProcessInstance> findByDesignId(String designId);
    List<ProcessInstance> findByStartedBy(String userId);
    List<ProcessInstance> findByStatus(String status);
    List<ProcessInstance> findByProjectId(String projectId);
}
