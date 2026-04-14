import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiGlobalService } from './api-global.service';
import { Design, Modeling } from './types';

@Injectable({
  providedIn: 'root'
})
export class DesignService {
  private readonly endpoint = 'designs';

  constructor(
    private http: HttpClient,
    private apiGlobal: ApiGlobalService
  ) { }

  getDesignsByProject(projectId: string): Observable<Design[]> {
    return this.http.get<Design[]>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/project/${projectId}`));
  }

  getDesignById(id: string): Observable<Design> {
    return this.http.get<Design>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`));
  }

  createDesign(design: Design): Observable<Design> {
    return this.http.post<Design>(this.apiGlobal.getEndpointUrl(this.endpoint), design);
  }

  getModelingByDesignId(designId: string): Observable<Modeling> {
    return this.http.get<Modeling>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${designId}/modeling`));
  }

  updateModeling(modelingId: string, modeling: Modeling): Observable<Modeling> {
    return this.http.put<Modeling>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/modeling/${modelingId}`), modeling);
  }

  deleteDesign(id: string): Observable<void> {
    return this.http.delete<void>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`));
  }
}

