package com.example.Procesos.service;

import com.example.Procesos.model.Usuario;
import com.example.Procesos.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UsuarioService {
    private final UsuarioRepository usuarioRepository;

    @PostConstruct
    public void seedUsuarios() {
        if (usuarioRepository.count() == 0) {
            usuarioRepository.save(Usuario.builder()
                    .nombre("Juan Diseñador")
                    .email("juan@bpmflow.com")
                    .password("password")
                    .rol("DISENADOR")
                    .tenantId("tenant_default")
                    .build());

            usuarioRepository.save(Usuario.builder()
                    .nombre("Maria Funcionario")
                    .email("maria@bpmflow.com")
                    .password("password")
                    .rol("FUNCIONARIO")
                    .tenantId("tenant_default")
                    .build());

            usuarioRepository.save(Usuario.builder()
                    .nombre("Carlos Cliente (Acme Corp)")
                    .email("carlos@acme.com")
                    .password("password")
                    .rol("CLIENTE")
                    .tenantId("tenant_acme")
                    .build());
        }
    }

    public List<Usuario> getAllUsuarios() {
        return usuarioRepository.findAll();
    }

    public Optional<Usuario> getUsuarioById(String id) {
        return usuarioRepository.findById(id);
    }

    public Optional<Usuario> getUsuarioByEmail(String email) {
        return usuarioRepository.findByEmail(email);
    }

    public List<Usuario> getUsuariosByRol(String rol) {
        return usuarioRepository.findByRol(rol);
    }

    public List<Usuario> getUsuariosByTenantId(String tenantId) {
        return usuarioRepository.findByTenantId(tenantId);
    }

    public Usuario createUsuario(Usuario usuario) {
        return usuarioRepository.save(usuario);
    }

    public void deleteUsuario(String id) {
        usuarioRepository.deleteById(id);
    }

    public Optional<Usuario> updateFcmToken(String id, String fcmToken) {
        return usuarioRepository.findById(id).map(user -> {
            user.setFcmToken(fcmToken);
            return usuarioRepository.save(user);
        });
    }
}
