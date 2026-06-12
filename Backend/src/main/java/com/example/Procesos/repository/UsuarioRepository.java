package com.example.Procesos.repository;

import com.example.Procesos.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
import java.util.List;

public interface UsuarioRepository extends MongoRepository<Usuario, String> {
    Optional<Usuario> findByEmail(String email);
    List<Usuario> findByRol(String rol);
    List<Usuario> findByTenantId(String tenantId);
}
