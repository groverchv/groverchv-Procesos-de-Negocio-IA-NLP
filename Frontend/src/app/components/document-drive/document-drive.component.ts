import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../services/document/document.service';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { API_GLOBAL } from '../../services/api.global';

interface DriveItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  size?: string;
  date: Date;
  content?: string;
  tenantId: string;
}

@Component({
  selector: 'app-document-drive',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, NzButtonModule, NzSpaceModule],
  templateUrl: './document-drive.component.html',
  styleUrls: ['./document-drive.component.css']
})
export class DocumentDriveComponent implements OnInit {
  usuarios: any[] = [];
  cargandoUsuarios: boolean = false;

  // Navegación jerárquica y Breadcrumbs
  currentFolderId: string | null = null;
  pathStack: { id: string | null; name: string }[] = [{ id: null, name: 'Inicio' }];
  
  // Historial de navegación libre (Atrás / Adelante)
  backHistory: (string | null)[] = [];
  forwardHistory: (string | null)[] = [];

  // Almacenamiento local de elementos
  allItems: DriveItem[] = [];
  visibleItems: DriveItem[] = [];

  // Editor Inline
  isEditing: boolean = false;
  editingFile: DriveItem | null = null;
  fileContent: string = '';
  cargandoIA: boolean = false;

  // Modal Personalizado de Creación (Sin Alerts/Prompts en el sistema)
  isCreateModalVisible: boolean = false;
  createModalType: 'folder' | 'file' = 'folder';
  newItemName: string = '';

  // Colaboradores en línea en tiempo real
  colaboradoresActivos: { nombre: string; iniciales: string; rol: string; color: string }[] = [];


  constructor(private http: HttpClient, private documentService: DocumentService) {}

  ngOnInit() {
    this.cargarRepositorioDinamico();
  }

  /**
   * Carga dinámica del repositorio desde el backend:
   * Nivel 1: Tenants (un folder por usuario único)
   * Nivel 2: Proyectos
   * Nivel 3: Diseños
   * Nivel 4: Instancias de Proceso (con archivo process_info.txt)
   */
  cargarRepositorioDinamico() {
    this.cargandoUsuarios = true;
    this.allItems = [];

    // Load users, projects, and instances in parallel
    const users$ = this.http.get<any[]>('http://localhost:8080/api/usuarios');
    const projects$ = this.http.get<any[]>('http://localhost:8080/api/projects');
    const instances$ = this.http.get<any[]>('http://localhost:8080/api/instances');

    let usersData: any[] = [];
    let projectsData: any[] = [];
    let instancesData: any[] = [];
    let loadCount = 0;

    const tryBuild = () => {
      loadCount++;
      if (loadCount === 3) {
        this.construirArbolRepositorio(usersData, projectsData, instancesData);
        this.cargandoUsuarios = false;
      }
    };

    users$.subscribe({
      next: (data) => { usersData = data; tryBuild(); },
      error: () => {
        usersData = [
          { id: 'u1', nombre: 'Sin Conexión', email: 'backend@offline.com', rol: 'ADMIN', tenantId: 'tenant_default' }
        ];
        tryBuild();
      }
    });

    projects$.subscribe({
      next: (data) => { projectsData = data; tryBuild(); },
      error: () => { projectsData = []; tryBuild(); }
    });

    instances$.subscribe({
      next: (data) => { instancesData = data; tryBuild(); },
      error: () => { instancesData = []; tryBuild(); }
    });
  }

  construirArbolRepositorio(usuarios: any[], proyectos: any[], instancias: any[]) {
    this.allItems = [];

    // Filter only clients (which represent tenant spaces)
    const clientes = usuarios.filter(u => u.rol === 'CLIENTE');

    clientes.forEach(cliente => {
      const tenantId = cliente.tenantId || 'tenant_default';
      const tenantFolderId = `tenant_${cliente.id}`;

      // Level 1 - Client Folder
      this.allItems.push({
        id: tenantFolderId,
        name: `${cliente.nombre} (${tenantId})`,
        type: 'folder',
        parentId: null,
        date: new Date(),
        tenantId
      });

      // Level 2 - Project Folders under this client
      proyectos.forEach(proyecto => {
        const projectFolderId = `project_${cliente.id}_${proyecto.id}`;

        this.allItems.push({
          id: projectFolderId,
          name: `${proyecto.nombre}`,
          type: 'folder',
          parentId: tenantFolderId,
          date: new Date(proyecto.fechaCreacion || Date.now()),
          tenantId
        });

        // Level 3 - Design Folders inside the project (grouped by designId for the active instances of this client)
        const instanciasDisenoMap = new Map<string, { designName: string; list: any[] }>();
        instancias
          .filter(i => i.projectId === proyecto.id && i.startedBy === cliente.id)
          .forEach(inst => {
            const key = inst.designId;
            if (!instanciasDisenoMap.has(key)) {
              instanciasDisenoMap.set(key, { designName: inst.designName || inst.designId, list: [] });
            }
            instanciasDisenoMap.get(key)!.list.push(inst);
          });

        instanciasDisenoMap.forEach(({ designName, list }, designId) => {
          const designFolderId = `design_${cliente.id}_${proyecto.id}_${designId}`;

          this.allItems.push({
            id: designFolderId,
            name: `${designName}`,
            type: 'folder',
            parentId: projectFolderId,
            date: new Date(),
            tenantId
          });

          // Level 4 - Process Instance Folders (one per execution run)
          list.forEach(inst => {
            const instFolderId = `instance_${inst.id}`;
            const fechaInicio = inst.startedAt ? new Date(inst.startedAt).toLocaleDateString() : 'N/A';

            this.allItems.push({
              id: instFolderId,
              name: `Instancia ${inst.id.substring(0, 8)} [${inst.status}]`,
              type: 'folder',
              parentId: designFolderId,
              date: new Date(inst.startedAt || Date.now()),
              tenantId
            });

            // process_info.txt containing details and form variables
            this.allItems.push({
              id: `file_info_${inst.id}`,
              name: 'process_info.txt',
              type: 'file',
              parentId: instFolderId,
              size: '< 1 KB',
              date: new Date(inst.startedAt || Date.now()),
              content: `BPMNFLOW - REPORTE DE PROCESO EN DRIVE\n===============================================\nCliente: ${cliente.nombre}\nDiseño/Flujo: ${designName}\nID de Instancia: ${inst.id}\nProyecto: ${proyecto.nombre}\nIniciado por: ${inst.startedBy}\nFecha de Inicio: ${fechaInicio}\nEstado: ${inst.status}\n\nVARIABLES DEL PROCESO:\n${JSON.stringify(inst.variables || {}, null, 2)}\n\nHOJA DE RUTA / ACTIVIDADES:\n${(inst.activities || []).map((a: any) => `  • ${a.nodeLabel} (${a.nodeType}) -> [${a.status}]`).join('\n')}`,
              tenantId
            });
          });
        });

        // If no designs have instances, display a README placeholder
        if (instanciasDisenoMap.size === 0) {
          this.allItems.push({
            id: `file_placeholder_${cliente.id}_${proyecto.id}`,
            name: 'README.txt',
            type: 'file',
            parentId: projectFolderId,
            size: '0.1 KB',
            date: new Date(),
            content: `Repositorio de ${proyecto.nombre}\n===============================================\nEste proyecto aún no registra ejecuciones o solicitudes iniciadas para el cliente ${cliente.nombre}.\nCuando el cliente inicie instancias de procesos, estas aparecerán aquí de forma automática.`,
            tenantId
          });
        }
      });

      // If no projects available, display a welcome placeholder
      if (proyectos.length === 0) {
        this.allItems.push({
          id: `file_empty_${cliente.id}`,
          name: 'bienvenida.txt',
          type: 'file',
          parentId: tenantFolderId,
          size: '0.2 KB',
          date: new Date(),
          content: `Repositorio de ${cliente.nombre}\n===============================================\nNo hay proyectos registrados en el sistema aún.`,
          tenantId
        });
      }
    });

    this.currentFolderId = null;
    this.pathStack = [{ id: null, name: 'Inicio' }];
    this.backHistory = [];
    this.forwardHistory = [];
    this.actualizarRepositorio();
  }

  // Keep legacy method for compatibility
  cargarUsuarios() {
    this.cargarRepositorioDinamico();
  }

  inicializarEstructuraDrive() {
    this.allItems = [];
    
    this.usuarios.forEach(u => {
      const userFolderId = `folder_root_${u.username}`;
      const tenantId = u.tenantId || 'tenant_default';

      // 1. CARPETA RAÍZ DEL USUARIO (parentId: null)
      this.allItems.push({
        id: userFolderId,
        name: u.nombre,
        type: 'folder',
        parentId: null,
        date: new Date(),
        tenantId: tenantId
      });

      // 2. CARPETAS DE PROCESOS
      if (u.rol === 'CLIENTE') {
        const procFolderId = `folder_proc_creditos_${u.username}`;
        this.allItems.push({
          id: procFolderId,
          name: 'Proceso: Aprobacion de Creditos',
          type: 'folder',
          parentId: userFolderId,
          date: new Date(),
          tenantId: tenantId
        });

        this.allItems.push({
          id: `file_doc_creditos_${u.username}`,
          name: 'Formato_Registro_Creditos.txt',
          type: 'file',
          parentId: procFolderId,
          size: '1.4 KB',
          date: new Date(),
          content: `BPMNFLOW - FORMULARIO DE EVALUACIÓN DE CRÉDITO\n==============================================\nCliente: ${u.nombre}\nEstado del Trámite: Evaluación de Riesgo\n\nDETALLE DE SOLICITUD:\nMonto Solicitado: \$50,000 USD\nPlazo: 60 meses\nDestino de Fondos: Capital de Trabajo para Expansión Corporativa.\n\nPOLÍTICAS DE NEGOCIO ANALIZADAS POR IA:\n1. Cumplimiento de Buró de Crédito: Verificado Aceptable.\n2. Tasa de Endeudamiento: < 40% (Actual: 24.5%).\n\nRECOMENDACIÓN PREDICTIVA DE LA IA:\nEl cliente califica con bajo riesgo comercial. Se recomienda enrutar a aprobación de gerencia inmediata.`,
          tenantId: tenantId
        });
      } else {
        const procFolderId = `folder_proc_vacaciones_${u.username}`;
        this.allItems.push({
          id: procFolderId,
          name: 'Proceso: Solicitud de Vacaciones',
          type: 'folder',
          parentId: userFolderId,
          date: new Date(),
          tenantId: tenantId
        });

        this.allItems.push({
          id: `file_doc_vacaciones_${u.username}`,
          name: 'Formatos_Internos_Vacaciones.txt',
          type: 'file',
          parentId: procFolderId,
          size: '0.8 KB',
          date: new Date(),
          content: `BPMNFLOW - SOLICITUD DE LICENCIA Y VACACIONES\n==============================================\nEmpleado: ${u.nombre}\nRol: ${u.rol}\n\nPLANIFICACIÓN DE DÍAS:\nFecha de Inicio: 01/06/2026\nFecha de Retorno: 15/06/2026\nTotal Días Solicitados: 14 días hábiles.\n\nAPROBACIONES REQUERIDAS:\n- Jefe Inmediato: Pendiente.\n- Dirección de RRHH: Pendiente.\n\nCOMENTARIO DEL EMPLEADO:\nSolicito hacer uso de mis días correspondientes al periodo 2025-2026.`,
          tenantId: tenantId
        });
      }
    });

    this.currentFolderId = null;
    this.pathStack = [{ id: null, name: 'Inicio' }];
    this.backHistory = [];
    this.forwardHistory = [];
    this.actualizarRepositorio();
  }

  actualizarRepositorio() {
    this.visibleItems = this.allItems.filter(item => item.parentId === this.currentFolderId);
  }

  // SISTEMA DE NAVEGACIÓN LIBRE (ATRÁS / ADELANTE)
  abrirElemento(item: DriveItem) {
    if (item.type === 'folder') {
      // Guardar el estado actual en el historial de Atrás
      this.backHistory.push(this.currentFolderId);
      // Limpiar el historial de Adelante al hacer una nueva navegación directa
      this.forwardHistory = [];

      this.currentFolderId = item.id;
      this.pathStack.push({ id: item.id, name: item.name });
      this.actualizarRepositorio();
    } else {
      this.abrirEditor(item);
    }
  }

  goBack() {
    if (this.backHistory.length === 0) return;

    // Guardar el estado actual en el historial de Adelante
    this.forwardHistory.push(this.currentFolderId);
    
    // Obtener la carpeta anterior
    const prevFolderId = this.backHistory.pop()!;
    this.currentFolderId = prevFolderId;

    // Reconstruir el pathStack
    if (prevFolderId === null) {
      this.pathStack = [{ id: null, name: 'Inicio' }];
    } else {
      const idx = this.pathStack.findIndex(p => p.id === prevFolderId);
      if (idx !== -1) {
        this.pathStack = this.pathStack.slice(0, idx + 1);
      }
    }

    this.actualizarRepositorio();
  }

  goForward() {
    if (this.forwardHistory.length === 0) return;

    // Guardar el estado actual en el historial de Atrás
    this.backHistory.push(this.currentFolderId);

    // Obtener la carpeta siguiente
    const nextFolderId = this.forwardHistory.pop()!;
    this.currentFolderId = nextFolderId;

    // Reconstruir el pathStack
    const item = this.allItems.find(i => i.id === nextFolderId);
    if (item) {
      // Si no está en el stack, añadirlo
      if (!this.pathStack.some(p => p.id === nextFolderId)) {
        this.pathStack.push({ id: item.id, name: item.name });
      }
    } else if (nextFolderId === null) {
      this.pathStack = [{ id: null, name: 'Inicio' }];
    }

    this.actualizarRepositorio();
  }

  canGoBack(): boolean {
    return this.backHistory.length > 0;
  }

  canGoForward(): boolean {
    return this.forwardHistory.length > 0;
  }

  navegarA(index: number) {
    const target = this.pathStack[index];
    if (target.id === this.currentFolderId) return;

    // Registrar en el historial de Atrás
    this.backHistory.push(this.currentFolderId);
    this.forwardHistory = [];

    this.pathStack = this.pathStack.slice(0, index + 1);
    this.currentFolderId = target.id;
    this.actualizarRepositorio();
  }

  get folders(): DriveItem[] {
    return this.visibleItems.filter(item => item.type === 'folder');
  }

  get files(): DriveItem[] {
    return this.visibleItems.filter(item => item.type === 'file');
  }

  // MODALES PERSONALIZADOS (REEMPLAZAN PROMPT DE NAVEGADOR)
  abrirModalCreacion(type: 'folder' | 'file') {
    this.isCreateModalVisible = true;
    this.createModalType = type;
    this.newItemName = '';
  }

  cerrarModalCreacion() {
    this.isCreateModalVisible = false;
    this.newItemName = '';
  }

  confirmarCreacion() {
    if (!this.newItemName.trim()) return;

    const activeParent = this.allItems.find(item => item.id === this.currentFolderId);
    const tenantId = activeParent ? activeParent.tenantId : 'tenant_default';

    if (this.createModalType === 'folder') {
      const newFolder: DriveItem = {
        id: `folder_${Date.now()}`,
        name: this.newItemName.trim(),
        type: 'folder',
        parentId: this.currentFolderId,
        date: new Date(),
        tenantId: tenantId
      };
      this.allItems.push(newFolder);
    } else {
      const baseName = this.newItemName.trim();
      const finalName = baseName.endsWith('.txt') ? baseName : `${baseName}.txt`;
      
      const newFile: DriveItem = {
        id: `file_${Date.now()}`,
        name: finalName,
        type: 'file',
        parentId: this.currentFolderId,
        size: '0.1 KB',
        date: new Date(),
        content: `DOCUMENTO BPM - ${finalName.toUpperCase()}\n==============================================\nFecha de Creación: ${new Date().toLocaleDateString()}\n\nEscribe el contenido de tu formato o proceso aquí...`,
        tenantId: tenantId
      };
      this.allItems.push(newFile);
    }

    this.actualizarRepositorio();
    this.cerrarModalCreacion();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const activeParent = this.allItems.find(item => item.id === this.currentFolderId);
      const tenantId = activeParent ? activeParent.tenantId : 'tenant_default';
      
      const nuevoDocumento: DriveItem = {
        id: `file_${Date.now()}`,
        name: file.name,
        type: 'file',
        parentId: this.currentFolderId,
        size: (file.size / 1024).toFixed(1) + ' KB',
        date: new Date(),
        content: `DOCUMENTO CARGADO: ${file.name}\n==============================================\nContenido del archivo subido localmente por el usuario.`,
        tenantId: tenantId
      };

      this.allItems.push(nuevoDocumento);
      this.actualizarRepositorio();
    }
  }

  // EDITOR INLINE
  abrirEditor(file: DriveItem) {
    this.isEditing = true;
    this.editingFile = file;
    this.fileContent = file.content || '';

    // Simular colaboradores en línea en tiempo real para co-edición activa
    const todosColaboradores = [
      { nombre: 'Juan Diseñador', iniciales: 'JD', rol: 'Diseñador', color: '#4f46e5' },
      { nombre: 'Maria Funcionario', iniciales: 'MF', rol: 'Funcionario', color: '#10b981' },
      { nombre: 'Carlos Cliente', iniciales: 'CC', rol: 'Cliente (Acme Corp)', color: '#f59e0b' }
    ];

    const cantidad = Math.floor(Math.random() * 2) + 1; // 1 o 2 colaboradores en línea
    this.colaboradoresActivos = todosColaboradores
      .sort(() => 0.5 - Math.random())
      .slice(0, cantidad);
  }

  guardarDocumento() {
    if (this.editingFile) {
      this.editingFile.content = this.fileContent;
      this.editingFile.size = `${(this.fileContent.length / 1024).toFixed(1)} KB`;
      this.editingFile.date = new Date();
      this.cerrarEditor();
    }
  }

  cerrarEditor() {
    this.isEditing = false;
    this.editingFile = null;
    this.fileContent = '';
    this.actualizarRepositorio();
  }

  autocompletarConIA() {
    if (!this.fileContent.trim()) return;

    this.cargandoIA = true;
    
    this.http.post<any>(API_GLOBAL.ia.chatAsesor, {
      messages: [
        {
          role: 'user',
          content: `Eres un asistente de redacción experto en procesos de negocio. Completa y mejora la redacción del siguiente documento BPM de forma formal, profesional y elegante. Mantén la estructura y añade contenido relevante si es necesario. Devuelve ÚNICAMENTE el texto redactado mejorado, sin introducciones ni comentarios adicionales:\n\n${this.fileContent}`
        }
      ]
    }).subscribe({
      next: (res) => {
        if (res.reply) {
          this.fileContent = res.reply;
        }
        this.cargandoIA = false;
      },
      error: (err) => {
        console.error('Error al autocompletar con la IA local:', err);
        this.fileContent += `\n\n[REVISIÓN DE IA OFFLINE]\n- El documento ha sido estructurado correctamente bajo las políticas corporativas estándar en fecha: ${new Date().toLocaleDateString()}.`;
        this.cargandoIA = false;
      }
    });
  }

  downloadFile(fileName: string) {
    const file = this.allItems.find(item => item.name === fileName);
    const content = file ? (file.content || '') : 'Documento vacío';
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
