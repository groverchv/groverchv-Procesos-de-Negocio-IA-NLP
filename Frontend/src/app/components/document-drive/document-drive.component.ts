import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../services/document/document.service';
import { DocumentSocketService } from '../../services/document/document-socket.service';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { API_GLOBAL } from '../../services/api.global';
import { ApiGlobalService } from '../../services/api-global.service';

interface DriveItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  size?: string;
  date: Date;
  content?: string;
  tenantId: string;
  s3Path?: string;
}

@Component({
  selector: 'app-document-drive',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, NzButtonModule, NzSpaceModule],
  templateUrl: './document-drive.component.html',
  styleUrls: ['./document-drive.component.css']
})
export class DocumentDriveComponent implements OnInit, OnDestroy {
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

  // WebSockets & Colaboración
  private docSocketSubscription: any = null;
  savingStatus: 'saved' | 'saving' | 'offline' = 'saved';
  private autoSaveTimer: any = null;

  // Visualización y restauración del historial
  previewingHistoryItem: any = null;
  isPreviewingHistory: boolean = false;
  historyPreviewContent: string = '';

  // Parseo de process_info.txt para una UX mejorada
  isProcessInfoFile: boolean = false;
  processInfoParsed: {
    cliente?: string;
    flujo?: string;
    instanciaId?: string;
    proyecto?: string;
    iniciadoPor?: string;
    fechaInicio?: string;
    estado?: string;
    variables?: any;
    actividades?: { label: string; type: string; status: string }[];
  } | null = null;

  // Historial de cambios
  historialDocumento: any[] = [];

  // Modal de previsualización
  isPreviewVisible: boolean = false;
  previewItem: DriveItem | null = null;
  previewUrl: string = '';
  previewPdfUrl: SafeResourceUrl | null = null;

  // Modal de confirmación de eliminación
  isDeleteModalVisible: boolean = false;
  deletingItem: DriveItem | null = null;

  constructor(
    private http: HttpClient, 
    public documentService: DocumentService,
    private documentSocketService: DocumentSocketService,
    private sanitizer: DomSanitizer,
    private apiGlobalService: ApiGlobalService
  ) {}

  ngOnInit() {
    this.cargarRepositorioDinamico();
  }

  ngOnDestroy() {
    if (this.docSocketSubscription) {
      this.docSocketSubscription.unsubscribe();
    }
    this.documentSocketService.disconnect();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
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
    const users$ = this.http.get<any[]>(this.apiGlobalService.getEndpointUrl('usuarios'));
    const projects$ = this.http.get<any[]>(this.apiGlobalService.getEndpointUrl('projects'));
    const instances$ = this.http.get<any[]>(this.apiGlobalService.getEndpointUrl('instances'));

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
        tenantId,
        s3Path: ''
      });

      // Level 2 - Project Folders under this client
      proyectos.forEach(proyecto => {
        const projectFolderId = `project_${cliente.id}_${proyecto.id}`;
        const sanitizedProjectName = proyecto.nombre.replace(/[^a-zA-Z0-9_.-]/g, "_");

        this.allItems.push({
          id: projectFolderId,
          name: `${proyecto.nombre}`,
          type: 'folder',
          parentId: tenantFolderId,
          date: new Date(proyecto.fechaCreacion || Date.now()),
          tenantId,
          s3Path: sanitizedProjectName
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
          const sanitizedDesignName = designName.replace(/[^a-zA-Z0-9_.-]/g, "_");

          this.allItems.push({
            id: designFolderId,
            name: `${designName}`,
            type: 'folder',
            parentId: projectFolderId,
            date: new Date(),
            tenantId,
            s3Path: `${sanitizedProjectName}/${sanitizedDesignName}`
          });

          // Level 4 - Process Instance Folders (one per execution run)
          list.forEach(inst => {
            const instFolderId = `instance_${inst.id}`;
            const fechaInicio = inst.startedAt ? new Date(inst.startedAt).toLocaleDateString() : 'N/A';
            const instS3Path = `${sanitizedProjectName}/${sanitizedDesignName}/${inst.id}`;

            this.allItems.push({
              id: instFolderId,
              name: `Instancia ${inst.id.substring(0, 8)} [${inst.status}]`,
              type: 'folder',
              parentId: designFolderId,
              date: new Date(inst.startedAt || Date.now()),
              tenantId,
              s3Path: instS3Path
            });

            // process_info.txt containing details and form variables
            const s3PathVal = `${instS3Path}/process_info.txt`;

            this.allItems.push({
              id: `file_info_${inst.id}`,
              name: 'process_info.txt',
              type: 'file',
              parentId: instFolderId,
              size: '< 1 KB',
              date: new Date(inst.startedAt || Date.now()),
              content: `BPMNFLOW - REPORTE DE PROCESO EN DRIVE\n===============================================\nCliente: ${cliente.nombre}\nDiseño/Flujo: ${designName}\nID de Instancia: ${inst.id}\nProyecto: ${proyecto.nombre}\nIniciado por: ${inst.startedBy}\nFecha de Inicio: ${fechaInicio}\nEstado: ${inst.status}\n\nVARIABLES DEL PROCESO:\n${JSON.stringify(inst.variables || {}, null, 2)}\n\nHOJA DE RUTA / ACTIVIDADES:\n${(inst.activities || []).map((a: any) => `  • ${a.nodeLabel} (${a.nodeType}) -> [${a.status}]`).join('\n')}`,
              tenantId,
              s3Path: s3PathVal
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

      // Unconditionally add "historial_bitacora.txt" at the root level of the client/tenant
      this.allItems.push({
        id: `file_bitacora_${cliente.id}`,
        name: 'historial_bitacora.txt',
        type: 'file',
        parentId: tenantFolderId,
        size: '1.5 KB',
        date: new Date(),
        content: `Cargando bitácora de actividad en tiempo real...`,
        tenantId,
        s3Path: 'historial_bitacora.txt'
      });
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

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  actualizarRepositorio() {
    const localItems = this.allItems.filter(item => item.parentId === this.currentFolderId);
    const currentFolder = this.allItems.find(item => item.id === this.currentFolderId);

    if (currentFolder) {
      const s3Path = this.resolverS3Path(currentFolder);
      this.documentService.listS3Files(currentFolder.tenantId, s3Path).subscribe({
        next: (s3Files) => {
          const folders = localItems.filter(item => item.type === 'folder');
          const virtualFiles = localItems.filter(item => 
            item.type === 'file' && 
            (item.id.startsWith('file_bitacora_') || item.id.startsWith('file_placeholder_') || item.id.startsWith('file_empty_'))
          );
          const mappedS3Files = s3Files
            .filter(file => {
              // Filtrar para mostrar solo los archivos en el directorio actual
              const relativeKey = file.key.substring(currentFolder.tenantId.length + 1);
              if (s3Path === '') {
                return !relativeKey.includes('/');
              } else {
                if (relativeKey.startsWith(s3Path + '/')) {
                  const subPath = relativeKey.substring(s3Path.length + 1);
                  return !subPath.includes('/');
                }
                return false;
              }
            })
            .map(file => {
              const localFile = localItems.find(item => item.name === file.name && item.type === 'file');
              return {
                id: localFile?.id || `s3_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: file.name,
                type: 'file',
                parentId: this.currentFolderId,
                size: this.formatBytes(file.size),
                date: new Date(file.lastModified),
                tenantId: currentFolder.tenantId,
                s3Path: file.key.substring(file.key.indexOf('/') + 1),
                content: localFile?.content || ''
              } as DriveItem;
            });
          this.visibleItems = [...folders, ...virtualFiles, ...mappedS3Files];
        },
        error: (err) => {
          console.error('Error al listar archivos de S3:', err);
          this.visibleItems = localItems;
        }
      });
    } else {
      this.visibleItems = localItems;
    }
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
      this.visualizarElemento(item);
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

  getCurrentUser(): string {
    const isStaff = window.location.href.includes('/staff') || window.location.href.includes('/funcionario');
    return isStaff ? 'Maria Funcionario' : 'Juan Diseñador';
  }

  resolverS3Path(item: DriveItem): string {
    if (item.s3Path) return item.s3Path;
    
    const pathParts: string[] = [];
    let current: DriveItem | undefined = item;
    
    while (current && current.parentId !== null) {
      if (!current.id.startsWith('tenant_')) {
        const cleanName = current.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        pathParts.unshift(cleanName);
      }
      current = this.allItems.find(x => x.id === current!.parentId);
    }
    
    return pathParts.join('/');
  }

  cargarHistorial() {
    if (!this.editingFile) return;
    const s3Path = this.resolverS3Path(this.editingFile);
    this.documentService.getFileHistorial(this.editingFile.tenantId, s3Path).subscribe({
      next: (data) => {
        this.historialDocumento = data;
      },
      error: (err) => {
        console.error('Error al cargar historial:', err);
      }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const activeParent = this.allItems.find(item => item.id === this.currentFolderId);
      const tenantId = activeParent ? activeParent.tenantId : 'tenant_default';
      
      const parentPath = activeParent ? this.resolverS3Path(activeParent) : '';
      const s3Path = parentPath ? `${parentPath}/${file.name}` : file.name;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', tenantId);
      formData.append('fileName', s3Path);
      formData.append('usuario', this.getCurrentUser());

      this.http.post(this.apiGlobalService.getEndpointUrl('documentos/upload'), formData).subscribe({
        next: () => {
          const nuevoDocumento: DriveItem = {
            id: `file_${Date.now()}`,
            name: file.name,
            type: 'file',
            parentId: this.currentFolderId,
            size: (file.size / 1024).toFixed(1) + ' KB',
            date: new Date(),
            content: `DOCUMENTO CARGADO EN S3: ${file.name}\n==============================================\nContenido del archivo subido localmente por el usuario.`,
            tenantId: tenantId,
            s3Path: s3Path
          };

          this.allItems.push(nuevoDocumento);
          this.actualizarRepositorio();
        },
        error: (err) => {
          console.error('Error al subir archivo a S3:', err);
        }
      });
    }
  }

  // EDITOR INLINE
  abrirEditor(file: DriveItem) {
    if (!file.name.endsWith('.txt')) {
      this.visualizarElemento(file);
      return;
    }

    this.isEditing = true;
    this.editingFile = file;
    this.fileContent = 'Cargando contenido desde S3...';
    this.historialDocumento = [];
    this.savingStatus = 'saved';

    // Verificar si es process_info.txt
    this.isProcessInfoFile = file.name === 'process_info.txt';
    this.processInfoParsed = null;

    const s3Path = this.resolverS3Path(file);
    this.documentService.getFileContent(file.tenantId, s3Path, this.getCurrentUser()).subscribe({
      next: (res) => {
        this.fileContent = res.content;
        file.content = res.content;
        this.cargarHistorial();
        if (this.isProcessInfoFile) {
          this.parseProcessInfo(res.content);
        }
      },
      error: (err) => {
        console.error('Error al cargar contenido de S3, usando copia local:', err);
        this.fileContent = file.content || '';
        this.cargarHistorial();
        if (this.isProcessInfoFile) {
          this.parseProcessInfo(this.fileContent);
        }
      }
    });

    // Conectar WebSocket para colaboración en tiempo real
    if (file.name !== 'historial_bitacora.txt') {
      this.docSocketSubscription = this.documentSocketService.connect(s3Path).subscribe({
        next: (update) => {
          this.fileContent = update.content;
          file.content = update.content;
          if (this.isProcessInfoFile) {
            this.parseProcessInfo(update.content);
          }
        }
      });
    }

    // Simular colaboradores en línea en tiempo real para co-edición activa
    const todosColaboradores = [
      { nombre: 'Juan Diseñador', iniciales: 'JD', rol: 'Diseñador', color: '#4f46e5' },
      { nombre: 'Maria Funcionario', iniciales: 'MF', rol: 'Funcionario', color: '#10b981' },
      { nombre: 'Carlos Cliente', iniciales: 'CC', rol: 'Cliente (Acme Corp)', color: '#f59e0b' }
    ];

    const miNombre = this.getCurrentUser();
    this.colaboradoresActivos = todosColaboradores.filter(c => c.nombre !== miNombre);
  }

  onContentChange(newVal: string) {
    this.fileContent = newVal;

    if (this.editingFile && this.editingFile.name !== 'historial_bitacora.txt') {
      const s3Path = this.resolverS3Path(this.editingFile);
      this.documentSocketService.sendUpdate(s3Path, this.getCurrentUser(), newVal);
    }

    this.triggerAutoSave();

    if (this.isProcessInfoFile) {
      this.parseProcessInfo(newVal);
    }
  }

  triggerAutoSave() {
    this.savingStatus = 'saving';
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveSilently();
    }, 2000);
  }

  autoSaveSilently() {
    if (!this.editingFile || this.editingFile.name === 'historial_bitacora.txt') {
      this.savingStatus = 'saved';
      return;
    }

    const s3Path = this.resolverS3Path(this.editingFile);
    this.documentService.saveFileContent(
      this.editingFile.tenantId, 
      s3Path, 
      this.fileContent, 
      this.getCurrentUser()
    ).subscribe({
      next: () => {
        this.savingStatus = 'saved';
        this.editingFile!.content = this.fileContent;
        this.editingFile!.size = `${(this.fileContent.length / 1024).toFixed(1)} KB`;
        this.editingFile!.date = new Date();
        this.cargarHistorial();
      },
      error: (err) => {
        console.error('Error al guardar automáticamente:', err);
        this.savingStatus = 'offline';
      }
    });
  }

  guardarDocumento() {
    if (this.editingFile) {
      this.cargandoIA = true;
      const s3Path = this.resolverS3Path(this.editingFile);
      
      this.documentService.saveFileContent(
        this.editingFile.tenantId, 
        s3Path, 
        this.fileContent, 
        this.getCurrentUser()
      ).subscribe({
        next: () => {
          this.editingFile!.content = this.fileContent;
          this.editingFile!.size = `${(this.fileContent.length / 1024).toFixed(1)} KB`;
          this.editingFile!.date = new Date();
          this.cargandoIA = false;
          this.cerrarEditor();
        },
        error: (err) => {
          console.error('Error al guardar documento en S3:', err);
          this.cargandoIA = false;
          this.editingFile!.content = this.fileContent;
          this.editingFile!.size = `${(this.fileContent.length / 1024).toFixed(1)} KB`;
          this.editingFile!.date = new Date();
          this.cerrarEditor();
        }
      });
    }
  }

  cerrarEditor() {
    if (this.docSocketSubscription) {
      this.docSocketSubscription.unsubscribe();
      this.docSocketSubscription = null;
    }
    this.documentSocketService.disconnect();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.isEditing = false;
    this.editingFile = null;
    this.fileContent = '';
    this.isProcessInfoFile = false;
    this.processInfoParsed = null;
    this.actualizarRepositorio();
  }

  parseProcessInfo(content: string) {
    this.isProcessInfoFile = true;
    const parsed: any = {
      cliente: '',
      flujo: '',
      instanciaId: '',
      proyecto: '',
      iniciadoPor: '',
      fechaInicio: '',
      estado: '',
      variables: {},
      actividades: []
    };

    const lines = content.split('\n');
    let inVariables = false;
    let variablesJson = '';
    let inActividades = false;

    for (let line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('Cliente:')) {
        parsed.cliente = trimmed.replace('Cliente:', '').trim();
      } else if (trimmed.startsWith('Diseño/Flujo:')) {
        parsed.flujo = trimmed.replace('Diseño/Flujo:', '').trim();
      } else if (trimmed.startsWith('ID de Instancia:')) {
        parsed.instanciaId = trimmed.replace('ID de Instancia:', '').trim();
      } else if (trimmed.startsWith('Proyecto:')) {
        parsed.proyecto = trimmed.replace('Proyecto:', '').trim();
      } else if (trimmed.startsWith('Iniciado por:')) {
        parsed.iniciadoPor = trimmed.replace('Iniciado por:', '').trim();
      } else if (trimmed.startsWith('Fecha de Inicio:')) {
        parsed.fechaInicio = trimmed.replace('Fecha de Inicio:', '').trim();
      } else if (trimmed.startsWith('Estado:')) {
        parsed.estado = trimmed.replace('Estado:', '').trim();
      } else if (trimmed === 'VARIABLES DEL PROCESO:') {
        inVariables = true;
        inActividades = false;
        continue;
      } else if (trimmed === 'HOJA DE RUTA / ACTIVIDADES:') {
        inVariables = false;
        inActividades = true;
        continue;
      }

      if (inVariables) {
        variablesJson += line + '\n';
      }

      if (inActividades && trimmed.startsWith('•')) {
        const match = trimmed.match(/•\s*(.+?)\s*(?:\((.+?)\))?\s*->\s*\[(.+?)\]/);
        if (match) {
          parsed.actividades.push({
            label: match[1].trim(),
            type: match[2] ? match[2].trim() : 'activity',
            status: match[3].trim()
          });
        } else {
          const parts = trimmed.substring(1).split('->');
          if (parts.length >= 2) {
            parsed.actividades.push({
              label: parts[0].trim(),
              type: 'activity',
              status: parts[1].replace('[', '').replace(']', '').trim()
            });
          }
        }
      }
    }

    if (variablesJson.trim()) {
      try {
        parsed.variables = JSON.parse(variablesJson.trim());
      } catch (e) {
        parsed.variables = {};
      }
    }

    this.processInfoParsed = parsed;
  }

  seleccionarHistorial(h: any) {
    if (!h.contenido) {
      this.historyPreviewContent = '(Esta versión no tiene captura de contenido registrada)';
    } else {
      this.historyPreviewContent = h.contenido;
    }
    this.previewingHistoryItem = h;
    this.isPreviewingHistory = true;
  }

  cerrarPreviewHistorial() {
    this.isPreviewingHistory = false;
    this.previewingHistoryItem = null;
    this.historyPreviewContent = '';
  }

  restaurarHistorial(h: any) {
    if (!this.editingFile) return;

    this.documentService.restaurarVersion(
      h.id, 
      this.getCurrentUser(), 
      this.getCurrentUser().includes('Funcionario') ? 'FUNCIONARIO' : 'DISENADOR'
    ).subscribe({
      next: (res) => {
        this.fileContent = res.content;
        this.editingFile!.content = res.content;
        this.editingFile!.size = `${(res.content.length / 1024).toFixed(1)} KB`;
        this.editingFile!.date = new Date();
        
        const s3Path = this.resolverS3Path(this.editingFile!);
        this.documentSocketService.sendUpdate(s3Path, this.getCurrentUser(), res.content);

        this.cargarHistorial();
        this.cerrarPreviewHistorial();
        
        if (this.isProcessInfoFile) {
          this.parseProcessInfo(res.content);
        }
      },
      error: (err) => {
        console.error('Error al restaurar versión:', err);
      }
    });
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

  downloadFile(item: DriveItem) {
    const s3Path = this.resolverS3Path(item);
    
    // Log download/read access to history
    this.documentService.getFileContent(item.tenantId, s3Path, this.getCurrentUser()).subscribe({
      next: () => {
        this.documentService.downloadFile(item.tenantId, s3Path).subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", item.name);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          },
          error: (err) => console.error('Error downloading from S3:', err)
        });
      },
      error: () => {
        // Fallback for mock items
        const content = item.content || 'Documento vacío';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", item.name);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  visualizarElemento(item: DriveItem) {
    if (item.name.endsWith('.txt')) {
      this.abrirEditor(item);
      return;
    }

    const s3Path = this.resolverS3Path(item);
    const viewUrl = `${this.apiGlobalService.getEndpointUrl('documentos/view')}?tenantId=${item.tenantId}&fileName=${s3Path}`;
    
    this.documentService.getPresignedUrl(item.tenantId, s3Path, this.getCurrentUser()).subscribe({
      next: () => {
        this.previewItem = item;
        this.previewUrl = viewUrl;
        if (item.name.toLowerCase().endsWith('.pdf')) {
          this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
        } else {
          this.previewPdfUrl = null;
        }
        this.isPreviewVisible = true;
      },
      error: (err) => {
        console.error('Error al registrar lectura en el historial:', err);
        this.previewItem = item;
        this.previewUrl = viewUrl;
        if (item.name.toLowerCase().endsWith('.pdf')) {
          this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
        } else {
          this.previewPdfUrl = null;
        }
        this.isPreviewVisible = true;
      }
    });
  }

  cerrarPreview() {
    this.isPreviewVisible = false;
    this.previewItem = null;
    this.previewUrl = '';
    this.previewPdfUrl = null;
  }

  solicitarEliminar(item: DriveItem) {
    this.deletingItem = item;
    this.isDeleteModalVisible = true;
  }

  cerrarDeleteModal() {
    this.isDeleteModalVisible = false;
    this.deletingItem = null;
  }

  confirmarEliminar() {
    if (!this.deletingItem) return;

    const s3Path = this.resolverS3Path(this.deletingItem);
    this.documentService.deleteFile(this.deletingItem.tenantId, s3Path, this.getCurrentUser()).subscribe({
      next: () => {
        // Remove from local list
        this.allItems = this.allItems.filter(i => i.id !== this.deletingItem!.id);
        this.actualizarRepositorio();
        this.cerrarDeleteModal();
      },
      error: (err) => {
        console.error('Error al eliminar archivo de S3:', err);
        // Fallback for mocked items
        this.allItems = this.allItems.filter(i => i.id !== this.deletingItem!.id);
        this.actualizarRepositorio();
        this.cerrarDeleteModal();
      }
    });
  }
}
