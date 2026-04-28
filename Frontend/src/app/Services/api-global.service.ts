import { Injectable } from '@angular/core';

/**
 * Centralized API URL configuration.
 *
 * HOW IT WORKS:
 * 1. In development (localhost): connects to http://localhost:8080
 * 2. In production: reads the Railway backend URL from the
 *    BACKEND_URL key stored in localStorage (set it once via the browser
 *    console or settings page), OR falls back to the PRODUCTION_BACKEND_URL
 *    constant below.
 *
 * DEPLOYMENT STEP:
 *   After deploying the backend to Railway, paste your Railway URL below:
 */
const PRODUCTION_BACKEND_URL = 'https://diagramador-de-actividades.up.railway.app';

@Injectable({
  providedIn: 'root'
})
export class ApiGlobalService {

  get baseUrl(): string {
    const host = window.location.hostname;
    let url = '';

    // 1. Priority: Manual override via localStorage
    const override = localStorage.getItem('BACKEND_URL');
    if (override && override.trim().length > 0) {
      url = override.trim().replace(/\/+$/, '');
    } else if (host === 'localhost' || host === '127.0.0.1') {
      // 2. Local development fallback (pointing to Railway by default to fix the user's connection error)
      url = PRODUCTION_BACKEND_URL;
    } else {
      // 3. Default production URL
      url = PRODUCTION_BACKEND_URL;
    }

    return url;
  }

  get apiUrl(): string {
    return `${this.baseUrl}/api`;
  }

  get wsUrl(): string {
    return `${this.baseUrl}/ws-bpmn`;
  }

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
