package com.example.Procesos.repository;

import com.example.Procesos.model.Modeling;
import org.springframework.data.mongodb.repository.MongoRepository;
public interface ModelingRepository extends MongoRepository<Modeling, String> {
}
