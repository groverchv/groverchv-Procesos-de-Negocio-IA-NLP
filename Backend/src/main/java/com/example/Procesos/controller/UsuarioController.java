package com.example.Procesos.controller;

import com.example.Procesos.model.Usuario;
import com.example.Procesos.service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {
    private final UsuarioService usuarioService;

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

    @GetMapping("/username/{username}")
    public ResponseEntity<Usuario> getByUsername(@PathVariable String username) {
        return usuarioService.getUsuarioByUsername(username)
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        usuarioService.deleteUsuario(id);
        return ResponseEntity.noContent().build();
    }
}
