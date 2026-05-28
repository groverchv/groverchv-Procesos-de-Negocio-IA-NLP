import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:8080/api/v1/documents'; // Apunta a Spring Boot

  constructor(private http: HttpClient) {}

  uploadFile(tenantId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', tenantId);

    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  getFiles(tenantId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/list/${tenantId}`);
  }

  downloadFile(tenantId: string, fileName: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download/${tenantId}/${fileName}`, {
      responseType: 'blob'
    });
  }
}
