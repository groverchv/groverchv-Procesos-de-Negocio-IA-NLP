package com.example.Procesos.repository;

import com.example.Procesos.model.Form;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface FormRepository extends MongoRepository<Form, String> {
    List<Form> findByModelingId(String modelingId);
}
