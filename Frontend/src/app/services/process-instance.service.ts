import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiGlobalService } from './api-global.service';
import { ProcessInstance, ValidationResult } from './types';

@Injectable({
  providedIn: 'root'
})
export class ProcessInstanceService {
  private readonly endpoint = 'instances';

  constructor(
    private http: HttpClient,
    private apiGlobal: ApiGlobalService
  ) {}

  startProcess(designId: string, userId: string): Observable<ProcessInstance> {
    return this.http.post<ProcessInstance>(
      this.apiGlobal.getEndpointUrl(`${this.endpoint}/start`),
      { designId, userId }
    );
  }

  getAllInstances(): Observable<ProcessInstance[]> {
    return this.http.get<ProcessInstance[]>(this.apiGlobal.getEndpointUrl(this.endpoint));
  }

  getActiveInstances(): Observable<ProcessInstance[]> {
    return this.http.get<ProcessInstance[]>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/active`));
  }

  getByProject(projectId: string): Observable<ProcessInstance[]> {
    return this.http.get<ProcessInstance[]>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/project/${projectId}`));
  }

  getByDesign(designId: string): Observable<ProcessInstance[]> {
    return this.http.get<ProcessInstance[]>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/design/${designId}`));
  }

  getInstance(id: string): Observable<ProcessInstance> {
    return this.http.get<ProcessInstance>(this.apiGlobal.getEndpointUrl(`${this.endpoint}/${id}`));
  }

  advanceActivity(instanceId: string, nodeId: string, status: string, formData: Record<string, any> = {}, userId: string = 'anonymous'): Observable<ProcessInstance> {
    return this.http.put<ProcessInstance>(
      this.apiGlobal.getEndpointUrl(`${this.endpoint}/${instanceId}/advance`),
      { nodeId, status, formData, userId }
    );
  }

  resolveDecision(instanceId: string, decisionNodeId: string, chosenEdgeId: string, userId: string = 'anonymous'): Observable<ProcessInstance> {
    return this.http.put<ProcessInstance>(
      this.apiGlobal.getEndpointUrl(`${this.endpoint}/${instanceId}/decide`),
      { decisionNodeId, chosenEdgeId, userId }
    );
  }

  cancelProcess(instanceId: string, userId: string = 'anonymous'): Observable<ProcessInstance> {
    return this.http.put<ProcessInstance>(
      this.apiGlobal.getEndpointUrl(`${this.endpoint}/${instanceId}/cancel`),
      { userId }
    );
  }

  validateDiagram(designId: string): Observable<ValidationResult> {
    return this.http.get<ValidationResult>(
      this.apiGlobal.getEndpointUrl(`${this.endpoint}/design/${designId}/validate`)
    );
  }
}
