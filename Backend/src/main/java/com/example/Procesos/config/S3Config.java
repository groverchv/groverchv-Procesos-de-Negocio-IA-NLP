package com.example.Procesos.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import java.net.URI;

@Configuration
public class S3Config {

    static {
        // Cargar variables de .env a System Properties al iniciar la clase
        try {
            java.io.File envFile = new java.io.File("../.env");
            if (!envFile.exists()) {
                envFile = new java.io.File(".env");
            }
            if (envFile.exists()) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(envFile))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.startsWith("#") || !line.contains("=")) {
                            continue;
                        }
                        int eqIdx = line.indexOf("=");
                        String envKey = line.substring(0, eqIdx).trim();
                        String envVal = line.substring(eqIdx + 1).trim();
                        // Remover comillas si existen
                        if (envVal.startsWith("\"") && envVal.endsWith("\"")) {
                            envVal = envVal.substring(1, envVal.length() - 1);
                        } else if (envVal.startsWith("'") && envVal.endsWith("'")) {
                            envVal = envVal.substring(1, envVal.length() - 1);
                        }
                        if (System.getProperty(envKey) == null) {
                            System.setProperty(envKey, envVal);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[S3Config] Error cargando archivo .env: " + e.getMessage());
        }
    }

    private String getEnvOrProperty(String key) {
        String val = System.getenv(key);
        if (val == null || val.trim().isEmpty()) {
            val = System.getProperty(key);
        }
        return val;
    }

    private String getS3Endpoint() {
        return getEnvOrProperty("S3_ENDPOINT");
    }

    private Region getS3Region() {
        String region = getEnvOrProperty("AWS_REGION");
        if (region == null || region.trim().isEmpty()) {
            return Region.US_EAST_2; // Región por defecto si no está en .env
        }
        return Region.of(region);
    }

    @Bean
    public S3Client s3Client() {
        var builder = S3Client.builder()
                .region(getS3Region());
                
        String endpoint = getS3Endpoint();
        String accessKey = getEnvOrProperty("AWS_ACCESS_KEY_ID");
        String secretKey = getEnvOrProperty("AWS_SECRET_ACCESS_KEY");

        if (accessKey != null && !accessKey.trim().isEmpty() && secretKey != null && !secretKey.trim().isEmpty()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey)
            ));
        } else {
            if (endpoint != null && !endpoint.trim().isEmpty()) {
                builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("awsaccesskey", "awssecretkey")
                ));
            } else {
                builder.credentialsProvider(DefaultCredentialsProvider.create());
            }
        }

        if (endpoint != null && !endpoint.trim().isEmpty()) {
            builder.endpointOverride(URI.create(endpoint))
                   .forcePathStyle(true);
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        var builder = S3Presigner.builder()
                .region(getS3Region());
                
        String endpoint = getS3Endpoint();
        String accessKey = getEnvOrProperty("AWS_ACCESS_KEY_ID");
        String secretKey = getEnvOrProperty("AWS_SECRET_ACCESS_KEY");

        if (accessKey != null && !accessKey.trim().isEmpty() && secretKey != null && !secretKey.trim().isEmpty()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey)
            ));
        } else {
            if (endpoint != null && !endpoint.trim().isEmpty()) {
                builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("awsaccesskey", "awssecretkey")
                ));
            } else {
                builder.credentialsProvider(DefaultCredentialsProvider.create());
            }
        }

        if (endpoint != null && !endpoint.trim().isEmpty()) {
            builder.endpointOverride(URI.create(endpoint));
        }
        return builder.build();
    }
}
