import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Usuario, Project, Design, AsignacionProceso } from '../../services/types';

@Component({
  selector: 'app-funcionario-portal',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    NzIconModule, NzButtonModule, NzTagModule,
    NzSwitchModule, NzTooltipModule
  ],
  templateUrl: './funcionario-portal.html',
  styleUrls: ['./funcionario-portal.css']
})
export class FuncionarioPortalComponent implements OnInit {

  // ─── Stepper state ──────────────────────────────────────────────────────────
  currentStep = 0; // 0=cliente, 1=proyecto, 2=diseño, 3=habilitar

  // ─── Data ───────────────────────────────────────────────────────────────────
  clientes: Usuario[] = [];
  proyectos: Project[] = [];
  disenos: Design[] = [];
  asignaciones: AsignacionProceso[] = [];

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

  readonly BASE = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private router: Router,
    private message: NzMessageService
  ) {}

  ngOnInit() {
    this.cargarClientes();
    this.cargarProyectos();
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
  }

  // ─── Step 4 ─────────────────────────────────────────────────────────────────
  cargarAsignacionesProyecto() {
    if (!this.clienteSeleccionado || !this.proyectoSeleccionado) return;
    this.cargandoAsignaciones = true;

    this.http.get<AsignacionProceso[]>(
      `${this.BASE}/asignaciones/cliente/${this.clienteSeleccionado.id}/proyecto/${this.proyectoSeleccionado.id}`
    ).subscribe({
      next: data => {
        // Merge: add entries for designs that have no assignment yet (defaulting to disabled)
        const asignacionMap = new Map(data.map(a => [a.designId, a]));
        this.asignaciones = this.disenos.map(d => {
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
      },
      error: () => {
        // Si no hay asignaciones, crear entradas vacías para todos los diseños
        this.asignaciones = this.disenos.map(d => ({
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
        this.message.success(`Solicitud aprobada: "${saved.designNombre}" ahora está habilitado`);
        this.guardando = false;
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
        const accion = saved.habilitado ? 'habilitado' : 'deshabilitado';
        this.message.success(`Proceso "${saved.designNombre}" ${accion} para ${this.clienteSeleccionado?.nombre}`);
        this.guardando = false;
      },
      error: () => {
        // Revert optimistic update on error
        asignacion.habilitado = !asignacion.habilitado;
        this.message.error('Error al guardar la asignación');
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
    }
  }

  get habilitadosCount(): number {
    return this.asignaciones.filter(a => a.habilitado).length;
  }

  get solicitadosCount(): number {
    return this.asignaciones.filter(a => a.solicitado && !a.habilitado).length;
  }

  get disenoParaAsignacion(): Design | null {
    return this.disenos.find(d => d.id === this.disenoSeleccionado?.id) ?? null;
  }

  volverAlInicio() {
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
}
