package com.example.Procesos.service;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.InputStream;
import java.time.Duration;

@Service
public class S3DocumentService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String BUCKET_NAME = System.getenv("AWS_S3_BUCKET") != null && !System.getenv("AWS_S3_BUCKET").trim().isEmpty()
            ? System.getenv("AWS_S3_BUCKET")
            : "gestion-procesos-203677519083-sa-east-1-an";

    public S3DocumentService(S3Client s3Client, S3Presigner s3Presigner) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    /**
     * Sube un documento al repositorio aislando por Tenant (Cliente)
     */
    public void uploadDocument(String tenantId, String fileName, InputStream inputStream, long contentLength, String contentType) {
        // Aislamiento por cliente: cada tenant tiene su carpeta lógica
        String s3Key = tenantId + "/" + fileName;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .contentType(contentType)
                .build();

        s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(inputStream, contentLength));
    }

    /**
     * Descarga o recupera un documento del repositorio
     */
    public byte[] downloadDocument(String tenantId, String fileName) {
        String s3Key = tenantId + "/" + fileName;

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

        ResponseBytes<GetObjectResponse> s3Object = s3Client.getObjectAsBytes(getObjectRequest);
        return s3Object.asByteArray();
    }

    /**
     * Genera una URL firmada (Pre-signed URL) de corta duración para descarga segura desde S3
     */
    public String generatePresignedUrl(String tenantId, String fileName, int expirationMinutes) {
        String s3Key = tenantId + "/" + fileName;

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

        GetObjectPresignRequest getObjectPresignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(expirationMinutes))
                .getObjectRequest(getObjectRequest)
                .build();

        PresignedGetObjectRequest presignedGetObjectRequest = s3Presigner.presignGetObject(getObjectPresignRequest);
        return presignedGetObjectRequest.url().toString();
    }

    /**
     * Lista todos los objetos de S3 bajo un prefijo dado
     */
    public java.util.List<software.amazon.awssdk.services.s3.model.S3Object> listObjects(String prefix) {
        software.amazon.awssdk.services.s3.model.ListObjectsV2Request listRequest = 
            software.amazon.awssdk.services.s3.model.ListObjectsV2Request.builder()
                .bucket(BUCKET_NAME)
                .prefix(prefix)
                .build();
        return s3Client.listObjectsV2(listRequest).contents();
    }

    /**
     * Elimina un documento del repositorio
     */
    public void deleteDocument(String tenantId, String fileName) {
        String s3Key = tenantId + "/" + fileName;

        software.amazon.awssdk.services.s3.model.DeleteObjectRequest deleteRequest = 
            software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

        s3Client.deleteObject(deleteRequest);
    }
}
