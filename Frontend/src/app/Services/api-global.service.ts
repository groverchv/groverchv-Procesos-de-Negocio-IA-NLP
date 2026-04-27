import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiGlobalService {
  get baseUrl(): string {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    // En producción, asumimos que el backend está en el mismo dominio o se configura aquí
    return window.location.origin.replace(':4200', ':8080'); 
  }

  readonly apiUrl = `${this.baseUrl}/api`;
  readonly wsUrl = `${this.baseUrl}/ws-bpmn`;

  constructor() { }

  /**
   * Genera una URL completa para un endpoint específico
   * @param endpoint El endpoint (ej. '/projects' o 'projects')
   */
  getEndpointUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.apiUrl}${cleanEndpoint}`;
  }
}
