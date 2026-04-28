import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiGlobalService } from './api-global.service';
import { Project } from './types';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly endpoint = 'projects';

  constructor(
    private http: HttpClient,
    private apiGlobal: ApiGlobalService
  ) { }

  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiGlobal.getEndpointUrl(this.endpoint));
  }

  getProjectById(id: string): Observable<Project> {
    return this.http.get<Project>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`));
  }

  createProject(project: Project): Observable<Project> {
    return this.http.post<Project>(this.apiGlobal.getEndpointUrl(this.endpoint), project);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`));
  }

  getCurrentBaseUrl(): string {
    return this.apiGlobal.baseUrl;
  }
}
