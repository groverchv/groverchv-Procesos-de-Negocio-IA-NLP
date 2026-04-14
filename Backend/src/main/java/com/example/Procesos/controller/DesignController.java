package com.example.Procesos.controller;

import com.example.Procesos.model.Design;
import com.example.Procesos.model.Modeling;
import com.example.Procesos.service.DesignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/designs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DesignController {
    private final DesignService designService;

    @GetMapping("/project/{projectId}")
    public List<Design> getByProject(@PathVariable String projectId) {
        return designService.getDesignsByProject(projectId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Design> getById(@PathVariable String id) {
        return designService.getDesignById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Design create(@RequestBody Design design) {
        return designService.createDesign(design);
    }

    @GetMapping("/{id}/modeling")
    public ResponseEntity<Modeling> getModeling(@PathVariable String id) {
        return designService.getModelingByDesignId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/modeling/{modelingId}")
    public Modeling updateModeling(@PathVariable String modelingId, @RequestBody Modeling modeling) {
        return designService.updateModeling(modelingId, modeling);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        designService.deleteDesign(id);
        return ResponseEntity.ok().build();
    }
}

