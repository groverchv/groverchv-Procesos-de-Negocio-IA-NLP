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

    private String getS3Endpoint() {
        String endpoint = System.getenv("S3_ENDPOINT");
        if (endpoint == null || endpoint.trim().isEmpty()) {
            return "http://127.0.0.1:9000";
        }
        if (endpoint.contains("localhost")) {
            return endpoint.replace("localhost", "127.0.0.1");
        }
        return endpoint;
    }

    private Region getS3Region() {
        String region = System.getenv("AWS_REGION");
        if (region == null || region.trim().isEmpty()) {
            return Region.SA_EAST_1; // us-east-1 -> sa-east-1 (São Paulo)
        }
        return Region.of(region);
    }

    @Bean
    public S3Client s3Client() {
        var builder = S3Client.builder()
                .region(getS3Region());
                
        String endpoint = getS3Endpoint();
        if (endpoint != null && !endpoint.isEmpty()) {
            // MinIO Local o LocalStack en Docker
            builder.endpointOverride(URI.create(endpoint))
                   .forcePathStyle(true)
                   .credentialsProvider(StaticCredentialsProvider.create(
                       AwsBasicCredentials.create("awsaccesskey", "awssecretkey")
                   ));
        } else {
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        var builder = S3Presigner.builder()
                .region(getS3Region());
                
        String endpoint = getS3Endpoint();
        if (endpoint != null && !endpoint.isEmpty()) {
            builder.endpointOverride(URI.create(endpoint))
                   .credentialsProvider(StaticCredentialsProvider.create(
                       AwsBasicCredentials.create("awsaccesskey", "awssecretkey")
                   ));
        } else {
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }
        return builder.build();
    }
}
