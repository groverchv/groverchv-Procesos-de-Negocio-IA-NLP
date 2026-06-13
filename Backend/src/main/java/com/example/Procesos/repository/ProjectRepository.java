package com.example.Procesos.repository;

import com.example.Procesos.model.Project;
import org.springframework.data.mongodb.repository.MongoRepository;
public interface ProjectRepository extends MongoRepository<Project, String> {
}
