package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "usuarios")
public class Usuario {
    @Id
    private String id;
    private String nombre;
    private String email;
    private String password;
    private String rol; // ej. "CLIENTE", "DISENADOR", "FUNCIONARIO"
    private String tenantId; // cada cliente tiene su propio repositorio/tenant
    private String fcmToken; // Token FCM del dispositivo móvil
}
