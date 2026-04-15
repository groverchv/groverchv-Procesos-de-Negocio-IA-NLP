package com.example.Procesos.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notificaciones")
public class Notification {
    @Id
    private String id;
    private String userId;
    private String title;
    private String message;
    private String type;         // INFO, WARNING, SUCCESS, TASK_ASSIGNED, STATUS_CHANGE
    private String referenceId;  // processInstanceId or designId
    private String referenceType; // PROCESS_INSTANCE, DESIGN
    private boolean read;
    private LocalDateTime createdAt;
}
