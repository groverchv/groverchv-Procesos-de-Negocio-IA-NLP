import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiGlobalService {
  readonly apiUrl = 'http://localhost:8080/api';

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
