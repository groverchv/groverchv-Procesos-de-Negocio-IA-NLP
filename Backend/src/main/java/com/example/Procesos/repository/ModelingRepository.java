package com.example.Procesos.repository;

import com.example.Procesos.model.Modeling;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ModelingRepository extends MongoRepository<Modeling, String> {
}
