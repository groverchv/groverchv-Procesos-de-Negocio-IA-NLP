import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ApiGlobalService } from './api-global.service';
import { OfflineService } from './offline/offline.service';
import { Design, Modeling } from './types';

@Injectable({
  providedIn: 'root'
})
export class DesignService {
  private readonly endpoint = 'designs';

  constructor(
    private http: HttpClient,
    private apiGlobal: ApiGlobalService,
    private offlineService: OfflineService
  ) { }

  getDesignsByProject(projectId: string): Observable<Design[]> {
    const cacheKey = `designs_project_${projectId}`;
    if (this.offlineService.isOffline) {
      const cached = this.offlineService.obtenerDeCache<Design[]>(cacheKey);
      return of(cached || []);
    }

    return this.http.get<Design[]>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/project/${projectId}`)).pipe(
      tap(data => this.offlineService.guardarEnCache(cacheKey, data)),
      catchError(() => {
        const cached = this.offlineService.obtenerDeCache<Design[]>(cacheKey);
        return of(cached || []);
      })
    );
  }

  getDesignById(id: string): Observable<Design> {
    const cacheKey = `design_${id}`;
    if (this.offlineService.isOffline) {
      const cached = this.offlineService.obtenerDeCache<Design>(cacheKey);
      if (cached) return of(cached);
    }

    return this.http.get<Design>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`)).pipe(
      tap(data => this.offlineService.guardarEnCache(cacheKey, data)),
      catchError((err) => {
        const cached = this.offlineService.obtenerDeCache<Design>(cacheKey);
        if (cached) return of(cached);
        throw err;
      })
    );
  }

  createDesign(design: Design): Observable<Design> {
    const url = this.apiGlobal.getEndpointUrl(this.endpoint);
    if (this.offlineService.isOffline) {
      this.offlineService.guardarMutacionLocal('POST', url, design);
      
      // Guardar en la caché local del proyecto para reflejar el cambio inmediato
      if (design.projectId) {
        const projectCacheKey = `designs_project_${design.projectId}`;
        const cached = this.offlineService.obtenerDeCache<Design[]>(projectCacheKey) || [];
        cached.push(design);
        this.offlineService.guardarEnCache(projectCacheKey, cached);
      }
      return of(design);
    }

    return this.http.post<Design>(url, design).pipe(
      tap(newDesign => {
        if (newDesign.projectId) {
          const projectCacheKey = `designs_project_${newDesign.projectId}`;
          const cached = this.offlineService.obtenerDeCache<Design[]>(projectCacheKey) || [];
          cached.push(newDesign);
          this.offlineService.guardarEnCache(projectCacheKey, cached);
        }
      })
    );
  }

  getModelingByDesignId(designId: string): Observable<Modeling> {
    const cacheKey = `modeling_design_${designId}`;
    if (this.offlineService.isOffline) {
      const cached = this.offlineService.obtenerDeCache<Modeling>(cacheKey);
      if (cached) return of(cached);
    }

    return this.http.get<Modeling>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${designId}/modeling`)).pipe(
      tap(data => this.offlineService.guardarEnCache(cacheKey, data)),
      catchError((err) => {
        const cached = this.offlineService.obtenerDeCache<Modeling>(cacheKey);
        if (cached) return of(cached);
        throw err;
      })
    );
  }

  updateModeling(modelingId: string, modeling: Modeling): Observable<Modeling> {
    const url = this.apiGlobal.getEndpointUrl(`${this.endpoint}/modeling/${modelingId}`);
    
    // Guardar en caché siempre para que las lecturas rápidas tengan lo último
    if (modeling.id) {
      this.offlineService.guardarEnCache(`modeling_design_${modeling.id}`, modeling);
    }

    if (this.offlineService.isOffline) {
      this.offlineService.guardarMutacionLocal('PUT', url, modeling);
      return of(modeling);
    }

    return this.http.put<Modeling>(url, modeling);
  }

  deleteDesign(id: string): Observable<void> {
    const url = this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`);
    if (this.offlineService.isOffline) {
      this.offlineService.guardarMutacionLocal('DELETE', url, null);
      return of(undefined);
    }

    return this.http.delete<void>(url);
  }
}
