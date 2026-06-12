package com.example.Procesos.service;

import com.example.Procesos.model.Project;
import com.example.Procesos.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final S3DocumentService s3DocumentService;

    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    public Optional<Project> getProjectById(String id) {
        return projectRepository.findById(id);
    }

    public Project createProject(Project project) {
        Project saved = projectRepository.save(project);

        // Crear carpeta del proyecto en S3 si tiene tenantId y nombre
        if (saved.getTenantId() != null && !saved.getTenantId().isEmpty() && saved.getNombre() != null) {
            String safeProjectName = saved.getNombre().replaceAll("[^a-zA-Z0-9_\\-]", "_");
            s3DocumentService.createFolder(saved.getTenantId(), safeProjectName);
        }

        return saved;
    }

    public void deleteProject(String id) {
        projectRepository.deleteById(id);
    }
}
