import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ApiGlobalService } from '../../services/api-global.service';
import { Usuario, Project, Design, AsignacionProceso } from '../../services/types';

interface InstanciaResumen {
  id: string;
  status: string;
  startedBy: string;
  startedAt: string;
}

@Component({
  selector: 'app-funcionario-portal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    NzIconModule, NzButtonModule, NzTagModule,
    NzSwitchModule, NzTooltipModule, NzSpinModule
  ],
  templateUrl: './funcionario-portal.html',
  styleUrls: ['./funcionario-portal.css']
})
export class FuncionarioPortalComponent implements OnInit, OnDestroy {

  // ─── Stepper state ──────────────────────────────────────────────────────────
  currentStep = 0; // 0=cliente, 1=proyecto, 2=diseño, 3=habilitar

  // ─── Data ───────────────────────────────────────────────────────────────────
  clientes: Usuario[] = [];
  proyectos: Project[] = [];
  disenos: Design[] = [];
  asignaciones: AsignacionProceso[] = [];
  instanciasMap: Map<string, InstanciaResumen[]> = new Map();

  // ─── Selections ─────────────────────────────────────────────────────────────
  clienteSeleccionado: Usuario | null = null;
  proyectoSeleccionado: Project | null = null;
  disenoSeleccionado: Design | null = null;

  // ─── Loading flags ──────────────────────────────────────────────────────────
  cargandoClientes = false;
  cargandoProyectos = false;
  cargandoDisenos = false;
  cargandoAsignaciones = false;
  guardando = false;

  get BASE() {
    return this.apiGlobal.apiUrl;
  }

  // WebSockets for Real-time updates
  private stompClient: Client | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private message: NzMessageService,
    private apiGlobal: ApiGlobalService
  ) {}

  ngOnInit() {
    this.cargarClientes();
    this.cargarProyectos();
    this.restaurarEstado();
  }

  ngOnDestroy() {
    this.disconnectWebSocket();
  }

  // ─── WebSocket connection management ─────────────────────────────────────────
  connectWebSocket() {
    this.disconnectWebSocket();

    if (!this.clienteSeleccionado?.id) return;

    const wsUrl = this.apiGlobal.wsUrl;
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      reconnectDelay: 2000,
    });

    this.stompClient.onConnect = () => {
      const topic = `/topic/asignaciones/${this.clienteSeleccionado!.id}`;
      this.stompClient?.subscribe(topic, (message) => {
        if (message.body) {
          try {
            const data = JSON.parse(message.body);
            if (data.type === 'ASSIGNMENTS_UPDATED') {
              this.cargarAsignacionesProyecto();
            }
          } catch (e) {}
        }
      });
    };

    this.stompClient.activate();
  }

  disconnectWebSocket() {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }

  // ─── Persistencia de estado en sessionStorage ────────────────────────────────
  private restaurarEstado() {
    try {
      const raw = sessionStorage.getItem('fp_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.clienteSeleccionado) {
        this.clienteSeleccionado = state.clienteSeleccionado;
        this.connectWebSocket();
      }
      if (state.proyectoSeleccionado) this.proyectoSeleccionado = state.proyectoSeleccionado;
      if (state.disenoSeleccionado) this.disenoSeleccionado = state.disenoSeleccionado;
      if (state.currentStep) {
        this.currentStep = state.currentStep;
        // Reload data for the current step
        if (this.currentStep >= 2 && this.proyectoSeleccionado) {
          this.cargarDisenos(this.proyectoSeleccionado.id!);
        }
        if (this.currentStep >= 3) {
          this.cargarAsignacionesProyecto();
        }
      }
    } catch (e) {}
  }

  private guardarEstado() {
    sessionStorage.setItem('fp_state', JSON.stringify({
      currentStep: this.currentStep,
      clienteSeleccionado: this.clienteSeleccionado,
      proyectoSeleccionado: this.proyectoSeleccionado,
      disenoSeleccionado: this.disenoSeleccionado,
    }));
  }

  // ─── Step 1 ─────────────────────────────────────────────────────────────────
  cargarClientes() {
    this.cargandoClientes = true;
    this.http.get<Usuario[]>(`${this.BASE}/usuarios/rol/CLIENTE`).subscribe({
      next: data => { this.clientes = data; this.cargandoClientes = false; },
      error: () => { this.message.error('Error al cargar clientes'); this.cargandoClientes = false; }
    });
  }

  seleccionarCliente(c: Usuario) {
    this.clienteSeleccionado = c;
    this.currentStep = 1;
    this.proyectoSeleccionado = null;
    this.disenoSeleccionado = null;
    this.asignaciones = [];
    this.guardarEstado();
    this.connectWebSocket();
  }

  // ─── Step 2 ─────────────────────────────────────────────────────────────────
  cargarProyectos() {
    this.cargandoProyectos = true;
    this.http.get<Project[]>(`${this.BASE}/projects`).subscribe({
      next: data => { this.proyectos = data; this.cargandoProyectos = false; },
      error: () => { this.message.error('Error al cargar proyectos'); this.cargandoProyectos = false; }
    });
  }

  seleccionarProyecto(p: Project) {
    this.proyectoSeleccionado = p;
    this.currentStep = 2;
    this.disenoSeleccionado = null;
    this.cargarDisenos(p.id!);
    this.guardarEstado();
  }

  // ─── Step 3 ─────────────────────────────────────────────────────────────────
  cargarDisenos(projectId: string) {
    this.cargandoDisenos = true;
    this.http.get<Design[]>(`${this.BASE}/designs/project/${projectId}`).subscribe({
      next: data => { this.disenos = data; this.cargandoDisenos = false; },
      error: () => { this.message.error('Error al cargar diseños'); this.cargandoDisenos = false; }
    });
  }

  seleccionarDiseno(d: Design) {
    this.disenoSeleccionado = d;
    this.currentStep = 3;
    this.cargarAsignacionesProyecto();
    this.guardarEstado();
  }

  // ─── Step 4 ─────────────────────────────────────────────────────────────────
  cargarAsignacionesProyecto() {
    if (!this.clienteSeleccionado || !this.proyectoSeleccionado) return;
    this.cargandoAsignaciones = true;

    this.http.get<AsignacionProceso[]>(
      `${this.BASE}/asignaciones/cliente/${this.clienteSeleccionado.id}/proyecto/${this.proyectoSeleccionado.id}`
    ).subscribe({
      next: data => {
        const asignacionMap = new Map(data.map(a => [a.designId, a]));
        const filteredDisenos = this.disenoSeleccionado ? [this.disenoSeleccionado] : this.disenos;
        this.asignaciones = filteredDisenos.map(d => {
          return asignacionMap.get(d.id!) ?? {
            clienteId: this.clienteSeleccionado!.id!,
            designId: d.id!,
            designNombre: d.nombre,
            projectId: this.proyectoSeleccionado!.id,
            projectNombre: this.proyectoSeleccionado!.nombre,
            habilitado: false,
            solicitado: false
          } as AsignacionProceso;
        });
        this.cargandoAsignaciones = false;

        // Cargar instancias del cliente para cada diseño
        this.cargarInstanciasCliente();
      },
      error: () => {
        const filteredDisenos = this.disenoSeleccionado ? [this.disenoSeleccionado] : this.disenos;
        this.asignaciones = filteredDisenos.map(d => ({
          clienteId: this.clienteSeleccionado!.id!,
          designId: d.id!,
          designNombre: d.nombre,
          projectId: this.proyectoSeleccionado!.id,
          projectNombre: this.proyectoSeleccionado!.nombre,
          habilitado: false,
          solicitado: false
        } as AsignacionProceso));
        this.cargandoAsignaciones = false;
      }
    });
  }

  /** Carga las instancias de proceso iniciadas por el cliente para ver el seguimiento */
  cargarInstanciasCliente() {
    if (!this.clienteSeleccionado?.id) return;
    this.http.get<any[]>(`${this.BASE}/instances/user/${this.clienteSeleccionado.id}`).subscribe({
      next: instancias => {
        this.instanciasMap.clear();
        for (const inst of instancias) {
          const did = inst.designId;
          if (!this.instanciasMap.has(did)) this.instanciasMap.set(did, []);
          this.instanciasMap.get(did)!.push({
            id: inst.id,
            status: inst.status,
            startedBy: inst.startedBy,
            startedAt: inst.startedAt
          });
        }
      },
      error: () => {}
    });
  }

  getInstanciasDeDiseno(designId: string): InstanciaResumen[] {
    return this.instanciasMap.get(designId) ?? [];
  }

  /** Navega al diseño para ver el flujo del cliente en el frontend del diseñador */
  verFlujo(designId: string, instanceId?: string) {
    if (instanceId) {
      this.router.navigate(['/staff/designs', designId, 'instances', instanceId]);
    } else {
      this.router.navigate(['/staff/designs', designId]);
    }
  }

  toggleAsignacion(asignacion: AsignacionProceso) {
    // Optimistic UI update
    asignacion.habilitado = !asignacion.habilitado;
    this.guardarAsignacion(asignacion);
  }

  aprobarSolicitud(asignacion: AsignacionProceso) {
    this.guardando = true;
    const payload = {
      clienteId: asignacion.clienteId,
      designId: asignacion.designId,
      funcionarioEmail: 'funcionario'
    };

    this.http.post<AsignacionProceso>(`${this.BASE}/asignaciones/aprobar`, payload).subscribe({
      next: saved => {
        asignacion.habilitado = true;
        asignacion.solicitado = false;
        asignacion.id = saved.id;
        this.message.success(`✅ Solicitud aprobada: "${saved.designNombre}" habilitado`);
        this.guardando = false;
        this.cargarInstanciasCliente();
      },
      error: () => {
        this.message.error('Error al aprobar la solicitud');
        this.guardando = false;
      }
    });
  }

  guardarAsignacion(asignacion: AsignacionProceso) {
    this.guardando = true;
    const payload: AsignacionProceso = {
      ...asignacion,
      asignadoPor: 'funcionario',
      projectNombre: this.proyectoSeleccionado?.nombre,
    };

    this.http.post<AsignacionProceso>(`${this.BASE}/asignaciones`, payload).subscribe({
      next: saved => {
        // Update local id if newly created
        asignacion.id = saved.id;
        asignacion.habilitado = saved.habilitado;
        const accion = saved.habilitado ? '✅ habilitado' : '🔒 deshabilitado';
        this.message.success(`Proceso "${saved.designNombre}" ${accion} para ${this.clienteSeleccionado?.nombre}`);
        this.guardando = false;
      },
      error: () => {
        // Revert optimistic update on error
        asignacion.habilitado = !asignacion.habilitado;
        this.message.error('Error al guardar la asignación. Verifica la conexión al backend.');
        this.guardando = false;
      }
    });
  }

  habilitarTodos() {
    this.asignaciones.forEach(a => { a.habilitado = true; this.guardarAsignacion(a); });
  }

  deshabilitarTodos() {
    this.asignaciones.forEach(a => { a.habilitado = false; this.guardarAsignacion(a); });
  }

  // ─── Navigation helpers ──────────────────────────────────────────────────────
  irAPaso(paso: number) {
    if (paso < this.currentStep) {
      this.currentStep = paso;
      this.guardarEstado();
    }
  }

  get habilitadosCount(): number {
    return this.asignaciones.filter(a => a.habilitado).length;
  }

  get solicitadosCount(): number {
    return this.asignaciones.filter(a => a.solicitado && !a.habilitado).length;
  }

  volverAlInicio() {
    this.disconnectWebSocket();
    sessionStorage.removeItem('fp_state');
    this.router.navigate(['/']);
  }

  getInitials(nombre: string): string {
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getAvatarColor(id: string = ''): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
    return colors[hash % colors.length];
  }

  getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'processing';
      case 'COMPLETED': return 'success';
      case 'CANCELED': return 'error';
      default: return 'default';
    }
  }

  getStatusLabel(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'En curso';
      case 'COMPLETED': return 'Terminado';
      case 'CANCELED': return 'Cancelado';
      default: return status;
    }
  }
}
