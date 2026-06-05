package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Representa la asignación/habilitación de un diseño de proceso a un cliente específico.
 * El Funcionario gestiona qué procesos puede ver y ejecutar cada cliente.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "asignaciones_proceso")
public class AsignacionProceso {

    @Id
    private String id;

    /** ID del usuario con rol CLIENTE */
    private String clienteId;

    /** ID del diseño (proceso) asignado */
    private String designId;

    /** Nombre del diseño (desnormalizado para respuestas rápidas) */
    private String designNombre;

    /** ID del proyecto al que pertenece el diseño */
    private String projectId;

    /** Nombre del proyecto (desnormalizado) */
    private String projectNombre;

    /** true = el cliente puede ver y ejecutar este proceso; false = bloqueado */
    @Builder.Default
    private boolean habilitado = false;

    /** true = el cliente ha solicitado acceso a este proceso */
    @Builder.Default
    private boolean solicitado = false;

    /** Fecha en que el cliente realizó la solicitud */
    private LocalDateTime fechaSolicitud;

    /** Email o ID del funcionario que realizó la asignación */
    private String asignadoPor;

    /** Fecha en que se realizó o actualizó la asignación */
    @Builder.Default
    private LocalDateTime fechaAsignacion = LocalDateTime.now();
}
