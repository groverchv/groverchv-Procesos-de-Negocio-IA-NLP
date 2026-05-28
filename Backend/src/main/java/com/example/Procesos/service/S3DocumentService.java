package com.example.Procesos.service;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;

@Service
public class S3DocumentService {

    private final S3Client s3Client;
    private final String BUCKET_NAME = "bpm-documentos-clientes";

    public S3DocumentService(S3Client s3Client) {
        this.s3Client = s3Client;
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
}
