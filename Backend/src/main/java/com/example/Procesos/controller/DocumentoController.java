package com.example.Procesos.controller;

import com.example.Procesos.service.S3DocumentService;
import com.example.Procesos.repository.DocumentoHistorialRepository;
import com.example.Procesos.model.DocumentoHistorial;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;

// Apache POI – Word (.docx)
import org.apache.poi.xwpf.usermodel.*;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
// Apache POI – Excel (.xlsx)
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.List;
import java.util.Date;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

/**
 * Controlador REST para gestionar la interacción directa de documentos con Amazon S3.
 * Expone endpoints para subir archivos y solicitar enlaces pre-firmados (Pre-signed URLs).
 */
@RestController
@RequestMapping("/api/documentos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DocumentoController {

    private final S3DocumentService s3DocumentService;
    private final com.example.Procesos.service.FastApiClientService iaClient;
    private final DocumentoHistorialRepository documentoHistorialRepository;
    private final com.example.Procesos.repository.UsuarioRepository usuarioRepository;
    private final com.example.Procesos.repository.ProjectRepository projectRepository;
    private final com.example.Procesos.repository.DesignRepository designRepository;
    private final com.example.Procesos.repository.ProcessInstanceRepository processInstanceRepository;

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    /**
     * Endpoint para crear la estructura de carpetas físicas y archivos predeterminados en S3.
     * Recrea en S3 la estructura exacta: [tenantId]/[Proyecto]/[Diseño]/[Instancia]/[archivos].
     */
    @PostMapping("/sincronizar-estructura")
    public ResponseEntity<?> sincronizarEstructuraS3() {
        try {
            List<com.example.Procesos.model.Usuario> clientes = usuarioRepository.findByRol("CLIENTE");
            List<com.example.Procesos.model.Project> proyectos = projectRepository.findAll();
            List<com.example.Procesos.model.Design> disenos = designRepository.findAll();
            List<com.example.Procesos.model.ProcessInstance> instancias = processInstanceRepository.findAll();

            for (com.example.Procesos.model.Usuario cliente : clientes) {
                String tenantId = cliente.getTenantId();
                if (tenantId == null || tenantId.trim().isEmpty()) {
                    tenantId = "tenant_default";
                }

                // 1. Crear carpeta del tenant
                s3DocumentService.createFolder(tenantId, "");

                // info.txt
                String infoContent = "Tenant: " + tenantId + "\nUsuario: " + cliente.getNombre() + "\nEmail: " + cliente.getEmail() + "\nRol: CLIENTE";
                byte[] infoBytes = infoContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                s3DocumentService.uploadDocument(tenantId, "info.txt", new java.io.ByteArrayInputStream(infoBytes), infoBytes.length, "text/plain");

                // 2. Proyectos
                for (com.example.Procesos.model.Project proyecto : proyectos) {
                    String sanitizedProjectName = proyecto.getNombre().replaceAll("[^a-zA-Z0-9_.-]", "_");
                    String projectPath = sanitizedProjectName;
                    s3DocumentService.createFolder(tenantId, projectPath);

                    // Filtrar instancias de este proyecto y cliente
                    List<com.example.Procesos.model.ProcessInstance> instsProyecto = instancias.stream()
                        .filter(i -> proyecto.getId().equals(i.getProjectId()) && cliente.getId().equals(i.getStartedBy()))
                        .collect(java.util.stream.Collectors.toList());

                    if (instsProyecto.isEmpty()) {
                        // Subir README.txt
                        String readmeContent = "Repositorio de " + proyecto.getNombre() + "\n===============================================\nEste proyecto aún no registra ejecuciones o solicitudes iniciadas para el cliente " + cliente.getNombre() + ".";
                        byte[] readmeBytes = readmeContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                        s3DocumentService.uploadDocument(tenantId, projectPath + "/README.txt", new java.io.ByteArrayInputStream(readmeBytes), readmeBytes.length, "text/plain");
                    } else {
                        // 3. Diseños / Flujos
                        java.util.Map<String, List<com.example.Procesos.model.ProcessInstance>> instsPorDiseno = instsProyecto.stream()
                            .filter(i -> i.getDesignId() != null)
                            .collect(java.util.stream.Collectors.groupingBy(com.example.Procesos.model.ProcessInstance::getDesignId));

                        for (com.example.Procesos.model.Design diseno : disenos) {
                            if (!proyecto.getId().equals(diseno.getProjectId())) {
                                continue;
                            }
                            List<com.example.Procesos.model.ProcessInstance> instsDiseno = instsPorDiseno.get(diseno.getId());
                            if (instsDiseno == null || instsDiseno.isEmpty()) {
                                continue;
                            }

                            String sanitizedDesignName = diseno.getNombre().replaceAll("[^a-zA-Z0-9_.-]", "_");
                            String designPath = projectPath + "/" + sanitizedDesignName;
                            s3DocumentService.createFolder(tenantId, designPath);

                            // 4. Instancias
                            for (com.example.Procesos.model.ProcessInstance inst : instsDiseno) {
                                String instPath = designPath + "/" + inst.getId();
                                s3DocumentService.createFolder(tenantId, instPath);

                                // Crear process_info.docx
                                String fechaInicio = inst.getStartedAt() != null ? inst.getStartedAt().toString() : "N/A";
                                String variablesJson = "{}";
                                try {
                                    variablesJson = new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(inst.getVariables());
                                } catch (Exception e) {}

                                StringBuilder activitiesStr = new StringBuilder();
                                if (inst.getActivities() != null) {
                                    for (var act : inst.getActivities()) {
                                        activitiesStr.append("  • ").append(act.getNodeLabel()).append(" (").append(act.getNodeType()).append(") -> [").append(act.getStatus()).append("]\n");
                                    }
                                }

                                String processInfoContent = "BPMNFLOW - REPORTE DE PROCESO EN DRIVE\n===============================================\n"
                                        + "Cliente: " + cliente.getNombre() + "\n"
                                        + "Diseño/Flujo: " + diseno.getNombre() + "\n"
                                        + "ID de Instancia: " + inst.getId() + "\n"
                                        + "Proyecto: " + proyecto.getNombre() + "\n"
                                        + "Iniciado por: " + inst.getStartedBy() + "\n"
                                        + "Fecha de Inicio: " + fechaInicio + "\n"
                                        + "Estado: " + inst.getStatus() + "\n\n"
                                        + "VARIABLES DEL PROCESO:\n" + variablesJson + "\n\n"
                                        + "HOJA DE RUTA / ACTIVIDADES:\n" + activitiesStr.toString();

                                byte[] docxBytes;
                                try (XWPFDocument doc = new XWPFDocument();
                                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                                    for (String line : processInfoContent.split("\n")) {
                                        XWPFParagraph para = doc.createParagraph();
                                        XWPFRun run = para.createRun();
                                        run.setText(line.trim());
                                    }
                                    doc.write(out);
                                    docxBytes = out.toByteArray();
                                }
                                s3DocumentService.uploadDocument(tenantId, instPath + "/process_info.docx", new java.io.ByteArrayInputStream(docxBytes), docxBytes.length, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                            }
                        }
                    }
                }
            }
            return ResponseEntity.ok(java.util.Map.of("message", "Estructura de carpetas y archivos en S3 sincronizada exitosamente."));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para generar una URL temporal firmada para descarga segura.
     * GET /api/documentos/presigned-url?tenantId=tenant_123&fileName=reporte.pdf
     */
    @GetMapping("/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam(required = false, defaultValue = "Desconocido") String usuario,
            @RequestParam(required = false, defaultValue = "CLIENTE") String rol,
            HttpServletRequest request) {
        try {
            // Genera la URL con validez de 15 minutos
            String url = s3DocumentService.generatePresignedUrl(tenantId, fileName, 15);

            // Log access to history
            if (!fileName.contains("historial_bitacora.txt") && !fileName.contains("bitacora.txt") && !fileName.contains("bienvenida.txt")) {
                documentoHistorialRepository.save(DocumentoHistorial.builder()
                        .tenantId(tenantId)
                        .nombreArchivo(fileName)
                        .usuario(usuario)
                        .rol(rol)
                        .ip(getClientIp(request))
                        .accion("LECTURA")
                        .detalle("Obtuvo enlace de visualización o descarga del archivo")
                        .fecha(new Date())
                        .build());
            }

            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para obtener una URL pre-firmada para subir archivos directamente a S3.
     * GET /api/documentos/presigned-upload-url?tenantId=...&fileName=...&contentType=...
     */
    @GetMapping("/presigned-upload-url")
    public ResponseEntity<?> getPresignedUploadUrl(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam String contentType) {
        try {
            String url = s3DocumentService.generatePresignedUploadUrl(tenantId, fileName, contentType, 15);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para crear una carpeta virtual en S3.
     * POST /api/documentos/folder
     */
    @PostMapping("/folder")
    public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body) {
        String tenantId = body.get("tenantId");
        String folderPath = body.get("folderPath");
        try {
            s3DocumentService.createFolder(tenantId, folderPath);
            return ResponseEntity.ok(Map.of("message", "Carpeta creada exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para crear un archivo nuevo (.docx, .xlsx, .txt) vacío en S3.
     * POST /api/documentos/create-file
     */
    @PostMapping("/create-file")
    public ResponseEntity<?> createFile(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String tenantId = body.get("tenantId");
        String fileName = body.get("fileName");
        String usuario = body.getOrDefault("usuario", "Desconocido");
        String rol = body.getOrDefault("rol", "CLIENTE");

        try {
            byte[] bytes;
            String contentType;
            if (fileName.endsWith(".docx")) {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                try (XWPFDocument doc = new XWPFDocument();
                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    XWPFParagraph para = doc.createParagraph();
                    XWPFRun run = para.createRun();
                    run.setText("BPMNFLOW - NUEVO DOCUMENTO WORD COLABORATIVO\n\nComienza a escribir aquí...");
                    doc.write(out);
                    bytes = out.toByteArray();
                }
            } else if (fileName.endsWith(".xlsx")) {
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                try (XSSFWorkbook wb = new XSSFWorkbook();
                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    wb.createSheet("Hoja 1");
                    wb.write(out);
                    bytes = out.toByteArray();
                }
            } else {
                contentType = "text/plain";
                bytes = "Nuevo archivo de texto colaborativo".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            }

            s3DocumentService.uploadDocument(tenantId, fileName, new java.io.ByteArrayInputStream(bytes), bytes.length, contentType);

            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("CREACION")
                    .detalle("Creó un nuevo archivo " + fileName)
                    .fecha(new Date())
                    .build());

            return ResponseEntity.ok(Map.of("message", "Archivo creado exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para renombrar un archivo o carpeta en S3.
     * POST /api/documentos/rename
     */
    @PostMapping("/rename")
    public ResponseEntity<?> renameDocument(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String tenantId = body.get("tenantId");
        String oldName = body.get("oldName");
        String newName = body.get("newName");
        String usuario = body.getOrDefault("usuario", "Cliente/Funcionario");
        String rol = body.getOrDefault("rol", "CLIENTE");
        try {
            s3DocumentService.renameDocument(tenantId, oldName, newName);
            
            // Log rename to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(newName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("EDICION")
                    .detalle("Renombró archivo/carpeta de " + oldName + " a " + newName)
                    .fecha(new Date())
                    .build());
                    
            return ResponseEntity.ok(Map.of("message", "Renombrado exitoso"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint para confirmar que un archivo ha sido subido directamente a S3 con éxito.
     * Registra el historial de base de datos e indexa en RAG si corresponde.
     * POST /api/documentos/confirm-upload
     */
    @PostMapping("/confirm-upload")
    public ResponseEntity<?> confirmUpload(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String tenantId = body.get("tenantId");
        String fileName = body.get("fileName");
        String usuario = body.getOrDefault("usuario", "Cliente/Funcionario");
        String rol = body.getOrDefault("rol", "CLIENTE");
        String contentType = body.get("contentType");
        String policy = body.get("policy");

        try {
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("CREACION")
                    .detalle("Subió archivo " + fileName + " directamente a S3")
                    .fecha(new Date())
                    .build());

            String textContent = null;
            if (fileName.endsWith(".txt") || fileName.endsWith(".json") || "text/plain".equals(contentType)) {
                try {
                    byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
                    textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                    String docId = "doc-" + System.currentTimeMillis();
                    iaClient.indexarDocumento(tenantId, docId, fileName, textContent).subscribe(
                        null,
                        err -> System.err.println("[SPRING S3 RAG] Error al indexar documento confirmado: " + err.getMessage())
                    );
                } catch (Exception e) {
                    System.err.println("[SPRING S3 RAG] Error al descargar/indexar documento: " + e.getMessage());
                }
            }

            java.util.Map<String, Object> validationResult = new java.util.HashMap<>();
            if (policy != null && !policy.trim().isEmpty()) {
                if (textContent == null) {
                    try {
                        byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
                        textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                    } catch (Exception e) {
                        textContent = "";
                    }
                }
                validationResult = iaClient.validarDocumentoConPolitica(textContent, policy).block();
            } else {
                validationResult.put("valido", true);
                validationResult.put("mensaje", "No hay reglas de negocio definidas para este paso. El archivo se acepta automáticamente.");
                validationResult.put("sugerencia", "");
            }

            return ResponseEntity.ok(Map.of(
                "message", "Archivo confirmado e indexado exitosamente",
                "fileName", fileName,
                "validation", validationResult
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Genera un reporte de telemetría dinámica por IA, lo sube a S3 y retorna una URL pre-firmada.
     * POST /api/documentos/reporte-ia
     */
    @PostMapping("/reporte-ia")
    public ResponseEntity<?> generarReporteYSubirS3(@RequestBody Map<String, String> request) {
        String query = request.get("query");
        String tenantId = request.getOrDefault("tenantId", "tenant_default");

        try {
            // 1. Obtener reporte de FastAPI
            Map<String, Object> reporte = iaClient.generarReporteDinamico(query, tenantId).block();
            
            // 2. Subir reporte en formato JSON a S3
            String reportJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(reporte);
            byte[] reportBytes = reportJson.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(reportBytes);
            
            String fileName = "reporte_ia_" + System.currentTimeMillis() + ".json";
            s3DocumentService.uploadDocument(tenantId, fileName, inputStream, reportBytes.length, "application/json");
            
            // 3. Generar URL pre-firmada para descargar el reporte
            String presignedUrl = s3DocumentService.generatePresignedUrl(tenantId, fileName, 30); // 30 minutos

            // 4. Retornar el reporte y la URL pre-firmada
            return ResponseEntity.ok(Map.of(
                "reporte", reporte,
                "presignedUrl", presignedUrl
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Endpoint proxy tradicional para subida directa desde el cliente si no se desea hacer directo a S3.
     * POST /api/documentos/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadDocument(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam MultipartFile file,
            @RequestParam(required = false, defaultValue = "Cliente/Funcionario") String usuario,
            @RequestParam(required = false, defaultValue = "CLIENTE") String rol,
            HttpServletRequest request) {
        try {
            byte[] bytes = file.getBytes();
            s3DocumentService.uploadDocument(
                    tenantId,
                    fileName,
                    new java.io.ByteArrayInputStream(bytes),
                    file.getSize(),
                    file.getContentType()
            );

            String textContent = null;
            if (fileName.endsWith(".txt") || fileName.endsWith(".json") || "text/plain".equals(file.getContentType())) {
                textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            }
            // Log upload/creation to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("CREACION")
                    .detalle("Subió archivo " + fileName + " a S3")
                    .contenido(textContent)
                    .fecha(new Date())
                    .build());
            
            // Si el archivo es de texto plano, indexarlo para RAG automáticamente en FastAPI
            if (fileName.endsWith(".txt") || fileName.endsWith(".json") || "text/plain".equals(file.getContentType())) {
                String content = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                String docId = "doc-" + System.currentTimeMillis();
                iaClient.indexarDocumento(tenantId, docId, fileName, content).subscribe(
                    null,
                    err -> System.err.println("[SPRING S3 RAG] Error al indexar documento: " + err.getMessage())
                );
            }
            
            return ResponseEntity.ok(Map.of(
                "message", "Archivo subido exitosamente a S3",
                "fileName", fileName
            ));
        } catch (IOException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Sube un archivo a S3 y lo valida contra la regla de negocio (policy) de la actividad.
     * POST /api/documentos/upload-and-validate
     */
    @PostMapping("/upload-and-validate")
    public ResponseEntity<?> uploadAndValidateDocument(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam(required = false) String policy,
            @RequestParam MultipartFile file,
            @RequestParam(required = false, defaultValue = "Cliente") String usuario,
            @RequestParam(required = false, defaultValue = "CLIENTE") String rol,
            HttpServletRequest request) {
        try {
            byte[] bytes = file.getBytes();
            
            // 1. Subir a S3
            s3DocumentService.uploadDocument(
                    tenantId,
                    fileName,
                    new java.io.ByteArrayInputStream(bytes),
                    file.getSize(),
                    file.getContentType()
            );

            String textContent = null;
            if (fileName.endsWith(".txt") || fileName.endsWith(".json") || "text/plain".equals(file.getContentType())) {
                textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            }
            // Log upload/creation to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("CREACION")
                    .detalle("Subió y validó archivo " + fileName + " en S3")
                    .contenido(textContent)
                    .fecha(new Date())
                    .build());

            // 2. Indexar en RAG si es un archivo de texto
            String content = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            if (fileName.endsWith(".txt") || fileName.endsWith(".json") || "text/plain".equals(file.getContentType())) {
                String docId = "doc-" + System.currentTimeMillis();
                iaClient.indexarDocumento(tenantId, docId, fileName, content).subscribe(
                    null,
                    err -> System.err.println("[SPRING S3 RAG] Error al indexar documento: " + err.getMessage())
                );
            }

            // 3. Validar contra política
            java.util.Map<String, Object> validationResult = new java.util.HashMap<>();
            if (policy != null && !policy.trim().isEmpty()) {
                validationResult = iaClient.validarDocumentoConPolitica(content, policy).block();
            } else {
                validationResult.put("valido", true);
                validationResult.put("mensaje", "No hay reglas de negocio definidas para este paso. El archivo se acepta automáticamente.");
                validationResult.put("sugerencia", "");
            }

            return ResponseEntity.ok(java.util.Map.of(
                "message", "Archivo subido exitosamente a S3 y validado.",
                "fileName", fileName,
                "validation", validationResult
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    /**
     * Recupera el contenido de un archivo de texto de S3.
     * GET /api/documentos/content?tenantId=tenant_123&fileName=reporte.txt&usuario=NombreUser
     */
    @GetMapping("/content")
    public ResponseEntity<?> getDocumentContent(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam(required = false, defaultValue = "Desconocido") String usuario,
            @RequestParam(required = false, defaultValue = "CLIENTE") String rol,
            HttpServletRequest request) {
        try {
            if ("historial_bitacora.txt".equals(fileName) || "bitacora.txt".equals(fileName) || "bienvenida.txt".equals(fileName)) {
                // Generar bitácora de actividad dinámica desde MongoDB
                List<DocumentoHistorial> logs = documentoHistorialRepository.findByTenantIdOrderByFechaDesc(tenantId);
                StringBuilder sb = new StringBuilder();
                sb.append("=========================================================================\n");
                sb.append("            BITACORA DE HISTORIAL Y AUDITORIA DE ACTIVIDAD DEL SISTEMA   \n");
                sb.append("=========================================================================\n");
                sb.append("Cliente/Tenant ID: ").append(tenantId).append("\n");
                sb.append("Generado en: ").append(new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date())).append("\n");
                sb.append("Total registros: ").append(logs.size()).append("\n\n");
                
                if (logs.isEmpty()) {
                    sb.append("No se registran eventos en la bitácora aún.\n");
                } else {
                    for (DocumentoHistorial log : logs) {
                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                        sb.append("[").append(sdf.format(log.getFecha())).append("] ")
                          .append("ACCION: ").append(log.getAccion()).append("\n")
                          .append("  • Usuario: ").append(log.getUsuario() != null ? log.getUsuario() : "Desconocido").append("\n")
                          .append("  • Rol/Permisos: ").append(log.getRol() != null ? log.getRol() : "N/A").append("\n")
                          .append("  • IP Origen: ").append(log.getIp() != null ? log.getIp() : "Localhost/Desconocido").append("\n")
                          .append("  • Archivo/Recurso: ").append(log.getNombreArchivo()).append("\n")
                          .append("  • Detalle: ").append(log.getDetalle()).append("\n")
                          .append("-------------------------------------------------------------------------\n");
                    }
                }
                
                return ResponseEntity.ok(Map.of("content", sb.toString()));
            }

            byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
            String content = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);

            // Log access to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("LECTURA")
                    .detalle("Abrió el documento en el editor")
                    .fecha(new Date())
                    .build());

            return ResponseEntity.ok(Map.of("content", content));
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "Archivo no encontrado: " + e.getMessage()));
        }
    }

    /**
     * Guarda el contenido de un archivo de texto de vuelta en S3.
     * POST /api/documentos/save-content
     */
    @PostMapping("/save-content")
    public ResponseEntity<?> saveDocumentContent(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String tenantId = body.get("tenantId");
        String fileName = body.get("fileName");
        String content = body.get("content");
        String usuario = body.getOrDefault("usuario", "Desconocido");
        String rol = body.getOrDefault("rol", "CLIENTE");

        try {
            byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            s3DocumentService.uploadDocument(
                    tenantId,
                    fileName,
                    new java.io.ByteArrayInputStream(bytes),
                    bytes.length,
                    "text/plain"
            );

            // Log edit to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("EDICION")
                    .detalle("Modificó el contenido del archivo")
                    .contenido(content)
                    .fecha(new Date())
                    .build());

            return ResponseEntity.ok(Map.of("message", "Contenido guardado exitosamente en S3"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Restaura un archivo a partir de un ID de historial de versiones.
     * POST /api/documentos/restaurar
     */
    @PostMapping("/restaurar")
    public ResponseEntity<?> restaurarVersion(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String historyId = body.get("historyId");
        String usuario = body.getOrDefault("usuario", "Desconocido");
        String rol = body.getOrDefault("rol", "CLIENTE");

        try {
            java.util.Optional<DocumentoHistorial> historyOpt = documentoHistorialRepository.findById(historyId);
            if (!historyOpt.isPresent()) {
                return ResponseEntity.status(404).body(Map.of("error", "Registro de historial no encontrado"));
            }

            DocumentoHistorial hist = historyOpt.get();
            String content = hist.getContenido();
            if (content == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "La versión seleccionada no tiene contenido guardado"));
            }

            byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            s3DocumentService.uploadDocument(
                    hist.getTenantId(),
                    hist.getNombreArchivo(),
                    new java.io.ByteArrayInputStream(bytes),
                    bytes.length,
                    "text/plain"
            );

            String fechaOriginal = new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm").format(hist.getFecha());
            String detalle = "Restauró la versión del " + fechaOriginal + " creada por " + hist.getUsuario();

            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(hist.getTenantId())
                    .nombreArchivo(hist.getNombreArchivo())
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("EDICION")
                    .detalle(detalle)
                    .contenido(content)
                    .fecha(new Date())
                    .build());

            return ResponseEntity.ok(Map.of(
                "message", "Versión restaurada exitosamente",
                "content", content,
                "fileName", hist.getNombreArchivo()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Recupera el historial de edición de un archivo o todo el historial si el nombre está vacío.
     * GET /api/documentos/historial?tenantId=tenant_123&fileName=reporte.txt
     */
    @GetMapping("/historial")
    public ResponseEntity<?> getDocumentHistorial(
            @RequestParam String tenantId,
            @RequestParam(required = false) String fileName) {
        try {
            List<DocumentoHistorial> historial;
            if (fileName == null || fileName.trim().isEmpty() || "historial_bitacora.txt".equals(fileName) || "bitacora.txt".equals(fileName) || "bienvenida.txt".equals(fileName)) {
                historial = documentoHistorialRepository.findByTenantIdOrderByFechaDesc(tenantId);
            } else {
                historial = documentoHistorialRepository.findByTenantIdAndNombreArchivoOrderByFechaDesc(tenantId, fileName);
            }
            return ResponseEntity.ok(historial);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lista todos los archivos reales de S3 bajo un tenant y ruta.
     * GET /api/documentos/list-s3?tenantId=tenant_123&folderPath=Proyecto/Diseño/instancia
     */
    @GetMapping("/list-s3")
    public ResponseEntity<?> listS3Files(
            @RequestParam String tenantId,
            @RequestParam(required = false, defaultValue = "") String folderPath) {
        try {
            String prefix = tenantId + "/";
            if (!folderPath.isEmpty()) {
                prefix = prefix + folderPath;
                if (!prefix.endsWith("/")) {
                    prefix = prefix + "/";
                }
            }

            List<software.amazon.awssdk.services.s3.model.S3Object> objects = s3DocumentService.listObjects(prefix);
            java.util.List<Map<String, Object>> files = objects.stream()
                .filter(obj -> !obj.key().endsWith("/")) // Omitir directorios
                .map(obj -> {
                    try {
                        String key = obj.key();
                        String name = key.substring(key.lastIndexOf("/") + 1);
                        long size = obj.size() != null ? obj.size() : 0L;
                        long lastMod = obj.lastModified() != null ? obj.lastModified().toEpochMilli() : System.currentTimeMillis();
                        
                        java.util.HashMap<String, Object> map = new java.util.HashMap<>();
                        map.put("key", key);
                        map.put("name", name);
                        map.put("size", size);
                        map.put("lastModified", lastMod);
                        return map;
                    } catch (Exception e) {
                        java.util.HashMap<String, Object> errMap = new java.util.HashMap<>();
                        errMap.put("key", obj.key());
                        errMap.put("name", "error");
                        errMap.put("size", 0L);
                        errMap.put("lastModified", System.currentTimeMillis());
                        return errMap;
                    }
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(files);
        } catch (Exception e) {
            java.io.StringWriter sw = new java.io.StringWriter();
            e.printStackTrace(new java.io.PrintWriter(sw));
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage(),
                "stacktrace", sw.toString()
            ));
        }
    }

    /**
     * Elimina un archivo de S3.
     * DELETE /api/documentos/delete?tenantId=tenant_123&fileName=reporte.pdf&usuario=NombreUser
     */
    @DeleteMapping("/delete")
    public ResponseEntity<?> deleteDocument(
            @RequestParam String tenantId,
            @RequestParam String fileName,
            @RequestParam(required = false, defaultValue = "Cliente/Funcionario") String usuario,
            @RequestParam(required = false, defaultValue = "CLIENTE") String rol,
            HttpServletRequest request) {
        try {
            s3DocumentService.deleteDocument(tenantId, fileName);

            // Log delete to history
            documentoHistorialRepository.save(DocumentoHistorial.builder()
                    .tenantId(tenantId)
                    .nombreArchivo(fileName)
                    .usuario(usuario)
                    .rol(rol)
                    .ip(getClientIp(request))
                    .accion("ELIMINACION")
                    .detalle("Eliminó el archivo del repositorio S3")
                    .fecha(new Date())
                    .build());

            return ResponseEntity.ok(Map.of("message", "Archivo eliminado exitosamente de S3"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Devuelve los bytes crudos del archivo en S3 con la cabecera Content-Type correcta para que el navegador lo visualice directamente.
     * GET /api/documentos/view?tenantId=tenant_123&fileName=reporte.pdf
     */
    @GetMapping("/view")
    public ResponseEntity<byte[]> viewDocument(
            @RequestParam String tenantId,
            @RequestParam String fileName) {
        try {
            byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
            
            String contentType = "application/octet-stream";
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".pdf")) {
                contentType = "application/pdf";
            } else if (lower.endsWith(".png")) {
                contentType = "image/png";
            } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
                contentType = "image/jpeg";
            } else if (lower.endsWith(".gif")) {
                contentType = "image/gif";
            } else if (lower.endsWith(".txt")) {
                contentType = "text/plain";
            }

            return ResponseEntity.ok()
                    .header("Content-Type", contentType)
                    .header("Content-Disposition", "inline; filename=\"" + fileName.substring(fileName.lastIndexOf("/") + 1) + "\"")
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(null);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ENDPOINTS MULTIFORMATO: Word (.docx) y Excel (.xlsx)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Convierte un archivo .docx de S3 a HTML editable para el editor WYSIWYG.
     * GET /api/documentos/docx-to-html?tenantId=...&fileName=...
     */
    @GetMapping("/docx-to-html")
    public ResponseEntity<?> docxToHtml(
            @RequestParam String tenantId,
            @RequestParam String fileName) {
        try {
            byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
            try (XWPFDocument doc = new XWPFDocument(new java.io.ByteArrayInputStream(bytes))) {
                StringBuilder html = new StringBuilder();
                html.append("<div class=\"docx-content\">");
                for (XWPFParagraph para : doc.getParagraphs()) {
                    if (para.getText().isBlank()) {
                        html.append("<p>&nbsp;</p>");
                        continue;
                    }
                    String style = para.getStyle() != null ? para.getStyle().toLowerCase() : "";
                    String tag = style.startsWith("heading") || style.startsWith("t") ? "h" + (style.contains("1") ? "2" : style.contains("2") ? "3" : "4") : "p";
                    html.append("<").append(tag).append(">");
                    for (XWPFRun run : para.getRuns()) {
                        String text = run.getText(0);
                        if (text == null) continue;
                        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
                        if (run.isBold()) text = "<strong>" + text + "</strong>";
                        if (run.isItalic()) text = "<em>" + text + "</em>";
                        if (run.getUnderline() != UnderlinePatterns.NONE) text = "<u>" + text + "</u>";
                        html.append(text);
                    }
                    html.append("</").append(tag).append(">");
                }
                html.append("</div>");
                return ResponseEntity.ok(Map.of("html", html.toString()));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Convierte HTML (del editor WYSIWYG) a .docx y lo guarda en S3.
     * POST /api/documentos/html-to-docx  { tenantId, fileName, html, usuario, rol }
     */
    @PostMapping("/html-to-docx")
    public ResponseEntity<?> htmlToDocx(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String tenantId = body.get("tenantId");
        String fileName = body.get("fileName");
        String html = body.getOrDefault("html", "");
        String usuario = body.getOrDefault("usuario", "Desconocido");
        String rol = body.getOrDefault("rol", "CLIENTE");

        try {
            // Strip HTML tags into plain-text paragraphs and write to a new XWPFDocument
            String plainText = html.replaceAll("<[^>]+>", "\n").replaceAll("&nbsp;", " ")
                    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
                    .replaceAll("\n{3,}", "\n\n").trim();

            try (XWPFDocument doc = new XWPFDocument();
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                for (String line : plainText.split("\n")) {
                    XWPFParagraph para = doc.createParagraph();
                    XWPFRun run = para.createRun();
                    run.setText(line.trim());
                }
                doc.write(out);
                byte[] docxBytes = out.toByteArray();
                s3DocumentService.uploadDocument(tenantId, fileName,
                        new java.io.ByteArrayInputStream(docxBytes), docxBytes.length,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

                documentoHistorialRepository.save(DocumentoHistorial.builder()
                        .tenantId(tenantId).nombreArchivo(fileName).usuario(usuario).rol(rol)
                        .ip(getClientIp(request)).accion("EDICION")
                        .detalle("Guardó el archivo Word desde el editor WYSIWYG").fecha(new Date()).build());

                return ResponseEntity.ok(Map.of("message", "Documento Word guardado exitosamente en S3", "fileName", fileName));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Convierte un archivo .xlsx de S3 a JSON con estructura de hojas/celdas para visualización.
     * GET /api/documentos/xlsx-to-json?tenantId=...&fileName=...
     */
    @GetMapping("/xlsx-to-json")
    public ResponseEntity<?> xlsxToJson(
            @RequestParam String tenantId,
            @RequestParam String fileName) {
        try {
            byte[] bytes = s3DocumentService.downloadDocument(tenantId, fileName);
            try (XSSFWorkbook workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(bytes))) {
                List<Map<String, Object>> sheets = new ArrayList<>();
                for (int si = 0; si < workbook.getNumberOfSheets(); si++) {
                    XSSFSheet sheet = workbook.getSheetAt(si);
                    List<List<String>> rows = new ArrayList<>();
                    for (int ri = 0; ri <= sheet.getLastRowNum(); ri++) {
                        XSSFRow row = sheet.getRow(ri);
                        List<String> cells = new ArrayList<>();
                        if (row != null) {
                            for (int ci = 0; ci < row.getLastCellNum(); ci++) {
                                XSSFCell cell = row.getCell(ci);
                                if (cell == null) { cells.add(""); continue; }
                                switch (cell.getCellType()) {
                                    case NUMERIC -> cells.add(DateUtil.isCellDateFormatted(cell)
                                            ? cell.getLocalDateTimeCellValue().toLocalDate().toString()
                                            : String.valueOf(cell.getNumericCellValue()));
                                    case BOOLEAN -> cells.add(String.valueOf(cell.getBooleanCellValue()));
                                    case FORMULA -> cells.add(cell.getCachedFormulaResultType() == CellType.NUMERIC
                                            ? String.valueOf(cell.getNumericCellValue()) : cell.getStringCellValue());
                                    default -> cells.add(cell.getStringCellValue());
                                }
                            }
                        }
                        rows.add(cells);
                    }
                    Map<String, Object> sheetData = new LinkedHashMap<>();
                    sheetData.put("name", workbook.getSheetName(si));
                    sheetData.put("rows", rows);
                    sheets.add(sheetData);
                }
                return ResponseEntity.ok(Map.of("sheets", sheets));
            }
    /**
     * Endpoint para exportar un reporte dinámico de tabla a formato Word (.docx).
     * POST /api/documentos/exportar-reporte-docx
     */
    @PostMapping("/exportar-reporte-docx")
    public ResponseEntity<byte[]> exportarReporteDocx(@RequestBody Map<String, Object> body) {
        String title = (String) body.getOrDefault("title", "Reporte de Sistema");
        List<String> headers = (List<String>) body.get("headers");
        List<List<String>> rows = (List<List<String>>) body.get("rows");

        try (XWPFDocument doc = new XWPFDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            
            // Título principal
            XWPFParagraph titlePara = doc.createParagraph();
            titlePara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun titleRun = titlePara.createRun();
            titleRun.setText(title.toUpperCase());
            titleRun.setBold(true);
            titleRun.setFontSize(16);
            titleRun.setFontFamily("Arial");
            
            // Espacio
            XWPFParagraph spacePara = doc.createParagraph();
            spacePara.createRun().setText("\n");

            // Tabla
            int numRows = rows.size() + 1;
            int numCols = headers.size();
            XWPFTable table = doc.createTable(numRows, numCols);

            // Cabeceras
            XWPFTableRow headerRow = table.getRow(0);
            for (int i = 0; i < numCols; i++) {
                XWPFTableCell cell = headerRow.getCell(i);
                cell.setColor("4F46E5"); // Color azul/índigo premium
                XWPFParagraph p = cell.getParagraphs().get(0);
                p.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun r = p.createRun();
                r.setText(headers.get(i).toUpperCase());
                r.setBold(true);
                r.setColor("FFFFFF");
                r.setFontFamily("Arial");
            }

            // Filas de datos
            for (int rIndex = 0; rIndex < rows.size(); rIndex++) {
                XWPFTableRow row = table.getRow(rIndex + 1);
                List<String> rowData = (List<String>) (Object) rows.get(rIndex);
                for (int cIndex = 0; cIndex < numCols; cIndex++) {
                    XWPFTableCell cell = row.getCell(cIndex);
                    String val = cIndex < rowData.size() ? String.valueOf(rowData.get(cIndex)) : "";
                    XWPFParagraph p = cell.getParagraphs().get(0);
                    p.setAlignment(ParagraphAlignment.LEFT);
                    XWPFRun r = p.createRun();
                    r.setText(val);
                    r.setFontFamily("Arial");
                }
            }

            doc.write(out);
            byte[] bytes = out.toByteArray();

            org.springframework.http.HttpHeaders responseHeaders = new org.springframework.http.HttpHeaders();
            responseHeaders.setContentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM);
            responseHeaders.setContentDispositionFormData("attachment", "reporte.docx");

            return new ResponseEntity<>(bytes, responseHeaders, org.springframework.http.HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
