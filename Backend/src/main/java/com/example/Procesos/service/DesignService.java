package com.example.Procesos.service;

import com.example.Procesos.model.Design;
import com.example.Procesos.model.Modeling;
import com.example.Procesos.repository.DesignRepository;
import com.example.Procesos.repository.ModelingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DesignService {
    private final DesignRepository designRepository;
    private final ModelingRepository modelingRepository;

    public List<Design> getDesignsByProject(String projectId) {
        return designRepository.findByProjectId(projectId);
    }

    public Optional<Design> getDesignById(String id) {
        System.out.println(">>> [BPMN] Buscando Diseño por ID: " + id);
        Optional<Design> d = designRepository.findById(id);
        if (d.isEmpty()) System.err.println(">>> [BPMN] ADVERTENCIA: Diseño NO encontrado para ID: " + id);
        else System.out.println(">>> [BPMN] Diseño encontrado: " + d.get().getNombre() + " (ModelingId: " + d.get().getModelingId() + ")");
        return d;
    }


    public Design createDesign(Design design) {
        // Create initial empty modeling
        Modeling modeling = Modeling.builder()
                .version("1.0")
                .estado("Draft")
                .build();
        modeling = modelingRepository.save(modeling);
        
        design.setModelingId(modeling.getId());
        return designRepository.save(design);
    }

    public Optional<Modeling> getModelingByDesignId(String designId) {
        return designRepository.findById(designId).map(design -> {
            if (design.getModelingId() != null) {
                Optional<Modeling> modeling = modelingRepository.findById(design.getModelingId());
                if (modeling.isPresent()) return modeling.get();
            }
            
            // Repair: Create missing modeling
            Modeling newModeling = Modeling.builder()
                    .version("1.0")
                    .estado("Draft")
                    .build();
            newModeling = modelingRepository.save(newModeling);
            
            design.setModelingId(newModeling.getId());
            designRepository.save(design);
            
            System.out.println(">>> [BPMN] Reparando diseño " + designId + " con nuevo modelado " + newModeling.getId());
            return newModeling;
        });
    }


    public Modeling updateModeling(String modelingId, Modeling modeling) {
        modeling.setId(modelingId);
        Modeling saved = modelingRepository.save(modeling);
        
        // Update Design timestamp
        designRepository.findByModelingId(modelingId).ifPresent(design -> {
            design.setUltimaActualizacion(java.time.LocalDateTime.now());
            designRepository.save(design);
        });
        
        return saved;
    }

    public void deleteDesign(String id) {
        designRepository.findById(id).ifPresent(design -> {
            modelingRepository.deleteById(design.getModelingId());
            designRepository.deleteById(id);
        });
    }
}

