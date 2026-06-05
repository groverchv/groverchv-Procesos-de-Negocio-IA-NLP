package com.example.Procesos.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;
import java.io.IOException;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void init() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.getApplicationDefault())
                        .build();
                FirebaseApp.initializeApp(options);
                System.out.println("FirebaseApp inicializado con éxito usando credenciales predeterminadas.");
            }
        } catch (IOException e) {
            System.err.println("Advertencia: No se pudo inicializar FirebaseApp con credenciales por defecto: " + e.getMessage());
            System.err.println("Las notificaciones push fallarán si no se configuran las credenciales correctas.");
        } catch (Exception e) {
            System.err.println("Error general al inicializar FirebaseApp: " + e.getMessage());
        }
    }
}
