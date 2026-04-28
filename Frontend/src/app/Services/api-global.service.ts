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
const PRODUCTION_BACKEND_URL = 'https://YOUR_RAILWAY_APP.up.railway.app';

@Injectable({
  providedIn: 'root'
})
export class ApiGlobalService {

  get baseUrl(): string {
    const host = window.location.hostname;

    // Local development
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8080';
    }

    // Production: check localStorage override first, then use the constant
    const override = localStorage.getItem('BACKEND_URL');
    if (override && override.trim().length > 0) {
      return override.trim().replace(/\/+$/, '');
    }

    return PRODUCTION_BACKEND_URL;
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
