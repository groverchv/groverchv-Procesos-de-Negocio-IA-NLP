package com.example.Procesos.controller;

import com.example.Procesos.model.Usuario;
import com.example.Procesos.service.UsuarioService;
import com.example.Procesos.service.S3DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {
    private final UsuarioService usuarioService;
    private final S3DocumentService s3DocumentService;

    @GetMapping
    public List<Usuario> getAll() {
        return usuarioService.getAllUsuarios();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> getById(@PathVariable String id) {
        return usuarioService.getUsuarioById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<Usuario> getByEmail(@PathVariable String email) {
        return usuarioService.getUsuarioByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/rol/{rol}")
    public List<Usuario> getByRol(@PathVariable String rol) {
        return usuarioService.getUsuariosByRol(rol);
    }

    @GetMapping("/tenant/{tenantId}")
    public List<Usuario> getByTenant(@PathVariable String tenantId) {
        return usuarioService.getUsuariosByTenantId(tenantId);
    }

    @PostMapping
    public Usuario create(@RequestBody Usuario usuario) {
        return usuarioService.createUsuario(usuario);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Usuario usuario) {
        if (usuario.getEmail() == null || usuario.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El correo es requerido"));
        }
        if (usuarioService.getUsuarioByEmail(usuario.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El correo ya está registrado"));
        }
        usuario.setRol("CLIENTE");
        String prefix = usuario.getEmail().split("@")[0].replaceAll("[^a-zA-Z0-9]", "");
        String tenantId = "tenant_" + prefix;
        usuario.setTenantId(tenantId);
        
        // Crear carpeta de repositorio (S3) para el usuario
        try {
            String content = "Repositorio de " + usuario.getNombre() + "\n===============================================\nNo hay proyectos registrados en el sistema aún.";
            byte[] welcomeBytes = content.getBytes(StandardCharsets.UTF_8);
            ByteArrayInputStream inputStream = new ByteArrayInputStream(welcomeBytes);
            s3DocumentService.uploadDocument(tenantId, "bienvenida.txt", inputStream, welcomeBytes.length, "text/plain");
        } catch (Exception e) {
            System.err.println("Advertencia S3 al registrar: " + e.getMessage());
        }
        
        Usuario nuevo = usuarioService.createUsuario(usuario);
        return ResponseEntity.ok(nuevo);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        
        return usuarioService.getUsuarioByEmail(email)
                .map(user -> {
                    if (password != null && password.equals(user.getPassword())) {
                        return ResponseEntity.ok(user);
                    } else {
                        return ResponseEntity.status(401).body(Map.of("message", "Contraseña incorrecta"));
                    }
                })
                .orElse(ResponseEntity.status(401).body(Map.of("message", "Usuario no encontrado")));
    }

    @PutMapping("/{id}/fcm-token")
    public ResponseEntity<Usuario> updateFcmToken(@PathVariable String id, @RequestBody Map<String, String> body) {
        String token = body.get("fcmToken");
        return usuarioService.updateFcmToken(id, token)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        usuarioService.deleteUsuario(id);
        return ResponseEntity.noContent().build();
    }
}
