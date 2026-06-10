import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiGlobalService } from '../api-global.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private get apiUrl() {
    return `${this.apiGlobal.baseUrl}/api/documentos`;
  }

  constructor(private http: HttpClient, private apiGlobal: ApiGlobalService) {}

  uploadFile(tenantId: string, fileName: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', tenantId);
    formData.append('fileName', fileName);

    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  getFiles(tenantId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/list/${tenantId}`);
  }

  downloadFile(tenantId: string, fileName: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/presigned-url?tenantId=${tenantId}&fileName=${fileName}`, {
      responseType: 'blob'
    });
  }

  getFileContent(tenantId: string, fileName: string, usuario: string): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(`${this.apiUrl}/content?tenantId=${tenantId}&fileName=${fileName}&usuario=${usuario}`);
  }

  saveFileContent(tenantId: string, fileName: string, content: string, usuario: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/save-content`, { tenantId, fileName, content, usuario });
  }

  getFileHistorial(tenantId: string, fileName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/historial?tenantId=${tenantId}&fileName=${fileName}`);
  }

  listS3Files(tenantId: string, folderPath: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/list-s3?tenantId=${tenantId}&folderPath=${folderPath}`);
  }

  getPresignedUrl(tenantId: string, fileName: string, usuario: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/presigned-url?tenantId=${tenantId}&fileName=${fileName}&usuario=${usuario}`);
  }

  deleteFile(tenantId: string, fileName: string, usuario: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete?tenantId=${tenantId}&fileName=${fileName}&usuario=${usuario}`);
  }

  restaurarVersion(historyId: string, usuario: string, rol: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/restaurar`, { historyId, usuario, rol });
  }
}
