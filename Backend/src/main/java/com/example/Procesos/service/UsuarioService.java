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
    private final S3DocumentService s3DocumentService;

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

            Usuario carlos = Usuario.builder()
                    .nombre("Carlos Cliente (Acme Corp)")
                    .email("carlos@acme.com")
                    .password("password")
                    .rol("CLIENTE")
                    .tenantId("tenant_acme")
                    .build();
            usuarioRepository.save(carlos);

            // Crear carpeta S3 para Carlos
            try {
                String content = "Repositorio de " + carlos.getNombre() + "\n===============================================\nNo hay proyectos registrados en el sistema aún.";
                byte[] welcomeBytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(welcomeBytes);
                s3DocumentService.uploadDocument("tenant_acme", "bienvenida.txt", inputStream, welcomeBytes.length, "text/plain");
            } catch (Exception e) {
                System.err.println("Advertencia S3 al seedear Carlos: " + e.getMessage());
            }
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
        if (usuario.getRol() == null) {
            usuario.setRol("CLIENTE");
        }
        if (usuario.getTenantId() == null || usuario.getTenantId().trim().isEmpty() || "tenant_default".equals(usuario.getTenantId())) {
            if (usuario.getEmail() != null && !usuario.getEmail().trim().isEmpty()) {
                String prefix = usuario.getEmail().split("@")[0].replaceAll("[^a-zA-Z0-9]", "");
                usuario.setTenantId("tenant_" + prefix);
            } else {
                usuario.setTenantId("tenant_" + System.currentTimeMillis());
            }
        }
        
        Usuario saved = usuarioRepository.save(usuario);

        // Crear carpeta S3 automáticamente para el nuevo usuario cliente
        if ("CLIENTE".equals(saved.getRol())) {
            try {
                String content = "Repositorio de " + saved.getNombre() + "\n===============================================\nNo hay proyectos registrados en el sistema aún.";
                byte[] welcomeBytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(welcomeBytes);
                s3DocumentService.uploadDocument(saved.getTenantId(), "bienvenida.txt", inputStream, welcomeBytes.length, "text/plain");
            } catch (Exception e) {
                System.err.println("Advertencia S3 al crear usuario: " + e.getMessage());
            }
        }

        return saved;
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
