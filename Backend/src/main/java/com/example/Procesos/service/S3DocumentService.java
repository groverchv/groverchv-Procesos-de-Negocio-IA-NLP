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
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import java.io.InputStream;
import java.time.Duration;

@Service
public class S3DocumentService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String BUCKET_NAME = getS3BucketName();

    private String getS3BucketName() {
        String bucket = System.getenv("AWS_S3_BUCKET");
        if (bucket == null || bucket.trim().isEmpty()) {
            bucket = System.getProperty("AWS_S3_BUCKET");
        }
        return (bucket != null && !bucket.trim().isEmpty()) ? bucket : "procesodegestion";
    }

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

    /**
     * Crea una carpeta virtual en S3 subiendo un archivo marcador vacío (.keep).
     * Las "carpetas" en S3 son objetos cuya clave termina en "/".
     * @param tenantId El ID del tenant raíz.
     * @param folderPath La ruta de la carpeta relativa al tenant (e.g. "ProyectoA/Instancia1").
     */
    public void createFolder(String tenantId, String folderPath) {
        try {
            String cleanPath = folderPath.endsWith("/") ? folderPath : folderPath + "/";
            String s3Key = tenantId + "/" + cleanPath + ".keep";

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(BUCKET_NAME)
                    .key(s3Key)
                    .contentType("application/x-directory")
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.empty());
        } catch (Exception e) {
            System.err.println("[S3] Advertencia al crear carpeta '" + folderPath + "': " + e.getMessage());
        }
    }

    /**
     * Genera una URL pre-firmada para subir archivos directamente a S3 con PUT.
     */
    public String generatePresignedUploadUrl(String tenantId, String fileName, String contentType, int expirationMinutes) {
        String s3Key = tenantId + "/" + fileName;

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(expirationMinutes))
                .putObjectRequest(putRequest)
                .build();

        PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(presignRequest);
        return presignedPutObjectRequest.url().toString();
    }

    /**
     * Renombra un archivo o carpeta (prefijo) en S3 copiando y eliminando.
     */
    public void renameDocument(String tenantId, String oldName, String newName) {
        String oldS3Key = tenantId + "/" + oldName;
        String newS3Key = tenantId + "/" + newName;

        // Intentar ver si es una carpeta
        boolean isFolder = oldName.endsWith("/") || listObjects(oldS3Key + "/").size() > 0 || listObjects(oldS3Key).stream().anyMatch(obj -> obj.key().startsWith(oldS3Key + "/"));

        if (isFolder) {
            String cleanOldPath = oldS3Key.endsWith("/") ? oldS3Key : oldS3Key + "/";
            String cleanNewPath = newS3Key.endsWith("/") ? newS3Key : newS3Key + "/";

            java.util.List<software.amazon.awssdk.services.s3.model.S3Object> objects = listObjects(cleanOldPath);
            for (software.amazon.awssdk.services.s3.model.S3Object obj : objects) {
                String oldKey = obj.key();
                String relativePath = oldKey.substring(cleanOldPath.length());
                String newKey = cleanNewPath + relativePath;

                // Copiar
                software.amazon.awssdk.services.s3.model.CopyObjectRequest copyRequest = 
                    software.amazon.awssdk.services.s3.model.CopyObjectRequest.builder()
                        .sourceBucket(BUCKET_NAME)
                        .sourceKey(oldKey)
                        .destinationBucket(BUCKET_NAME)
                        .destinationKey(newKey)
                        .build();
                s3Client.copyObject(copyRequest);

                // Eliminar original
                software.amazon.awssdk.services.s3.model.DeleteObjectRequest deleteRequest = 
                    software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder()
                        .bucket(BUCKET_NAME)
                        .key(oldKey)
                        .build();
                s3Client.deleteObject(deleteRequest);
            }
        } else {
            // Es un archivo individual
            software.amazon.awssdk.services.s3.model.CopyObjectRequest copyRequest = 
                software.amazon.awssdk.services.s3.model.CopyObjectRequest.builder()
                    .sourceBucket(BUCKET_NAME)
                    .sourceKey(oldS3Key)
                    .destinationBucket(BUCKET_NAME)
                    .destinationKey(newS3Key)
                    .build();
            s3Client.copyObject(copyRequest);

            software.amazon.awssdk.services.s3.model.DeleteObjectRequest deleteRequest = 
                software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder()
                    .bucket(BUCKET_NAME)
                    .key(oldS3Key)
                    .build();
            s3Client.deleteObject(deleteRequest);
        }
    }
}
