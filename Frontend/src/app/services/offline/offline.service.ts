import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  /*
   * Simulación del wrapper de IndexedDB (ej. Usando Dexie.js).
   * Web Service Worker se encargará de interceptar llamadas HTTP
   * y delegarlas a esta clase si 'navigator.onLine' es false.
   */
  guardarMutacionLocal(endpoint: string, payload: any) {
    console.log(`[Offline-First] Guardando petición en IndexedDB local hacia ${endpoint}`);
    // localStorage.setItem('offline_mutations', JSON.stringify({endpoint, payload}));
  }

  sincronizarConServidor() {
    if(navigator.onLine) {
       console.log('[Offline-First] Internet recuperado. Enviando ráfaga a Spring Boot...');
       // Lógica background sync vaciando Dexie.js / IndexedDB
    }
  }
}
