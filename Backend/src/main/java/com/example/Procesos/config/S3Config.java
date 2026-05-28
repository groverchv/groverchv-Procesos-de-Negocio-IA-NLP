package com.example.Procesos.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Bean
    public S3Client s3Client() {
        // En producción las credenciales se leen automáticamente del entorno
        // (Variables de entorno AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY o roles IAM)
        return S3Client.builder()
                .region(Region.US_EAST_1) // Ajusta a tu región
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
