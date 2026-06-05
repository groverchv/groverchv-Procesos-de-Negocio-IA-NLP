import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

interface PendingMutation {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  payload: any;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private readonly MUTATIONS_KEY = 'bpm_offline_mutations';
  public isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor(private http: HttpClient) {
    // Escuchar eventos de conectividad del navegador
    window.addEventListener('online', () => {
      this.isOnline$.next(true);
      this.sincronizarConServidor();
    });

    window.addEventListener('offline', () => {
      this.isOnline$.next(false);
    });

    // Intentar sincronizar al arrancar si estamos online
    if (navigator.onLine) {
      this.sincronizarConServidor();
    }
  }

  get isOffline(): boolean {
    return !this.isOnline$.value;
  }

  // Guardar datos en caché local para lectura rápida
  guardarEnCache(key: string, data: any) {
    try {
      localStorage.setItem(`bpm_cache_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('[OfflineService] Error al escribir en caché:', e);
    }
  }

  // Obtener datos de la caché local
  obtenerDeCache<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(`bpm_cache_${key}`);
      return data ? JSON.parse(data) as T : null;
    } catch (e) {
      console.error('[OfflineService] Error al leer de caché:', e);
      return null;
    }
  }

  // Registrar una mutación pendiente para ser enviada más tarde
  guardarMutacionLocal(method: 'POST' | 'PUT' | 'DELETE', url: string, payload: any) {
    console.log(`[Offline-First] Guardando petición en almacenamiento local hacia ${url}`);
    
    const mutations = this.obtenerMutacionesPendientes();
    const newMutation: PendingMutation = {
      id: Math.random().toString(36).substring(2, 9),
      method,
      url,
      payload,
      timestamp: Date.now()
    };

    mutations.push(newMutation);
    localStorage.setItem(this.MUTATIONS_KEY, JSON.stringify(mutations));
  }

  obtenerMutacionesPendientes(): PendingMutation[] {
    try {
      const data = localStorage.getItem(this.MUTATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  async sincronizarConServidor() {
    const mutations = this.obtenerMutacionesPendientes();
    if (mutations.length === 0) return;

    console.log(`[Offline-First] Internet recuperado. Sincronizando ${mutations.length} peticiones con Spring Boot...`);

    // Procesar las mutaciones secuencialmente en el orden en que ocurrieron
    const remainingMutations: PendingMutation[] = [...mutations];

    for (const mutation of mutations) {
      try {
        if (mutation.method === 'POST') {
          await firstValueFrom(this.http.post(mutation.url, mutation.payload));
        } else if (mutation.method === 'PUT') {
          await firstValueFrom(this.http.put(mutation.url, mutation.payload));
        } else if (mutation.method === 'DELETE') {
          await firstValueFrom(this.http.delete(mutation.url));
        }
        
        // Quitar de la lista de pendientes si se sincronizó correctamente
        const index = remainingMutations.findIndex(m => m.id === mutation.id);
        if (index > -1) remainingMutations.splice(index, 1);
        
        console.log(`[Offline-First] Sincronización exitosa: ${mutation.method} ${mutation.url}`);
      } catch (error) {
        console.error(`[Offline-First] Error al sincronizar mutación ${mutation.id}:`, error);
        // Si hay un error, detenemos la sincronización secuencial para evitar conflictos de orden
        break;
      }
    }

    // Actualizar las mutaciones restantes
    localStorage.setItem(this.MUTATIONS_KEY, JSON.stringify(remainingMutations));
  }
}
