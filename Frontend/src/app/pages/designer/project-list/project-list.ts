import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../services/types';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, NzCardModule, NzGridModule, NzTypographyModule, 
    NzIconModule, NzButtonModule, NzInputModule, NzSpaceModule, NzTagModule, NzModalModule
  ],
  templateUrl: './project-list.html',
  styles: [`
    .container { padding: 40px; background: #fff; min-height: calc(100vh - 72px); }
    .project-card { border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; transition: all 0.3s; cursor: pointer; position: relative; }
    .project-card:hover { transform: translateY(-5px); box-shadow: 0 12px 20px rgba(0,0,0,0.1); }
    .card-cover { background: #f8fafc; height: 180px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f1f5f9; }
    .folder-icon { font-size: 64px; color: #cbd5e1; }
    .delete-btn { position: absolute; top: 10px; right: 10px; z-index: 10; opacity: 0; transition: opacity 0.3s; }
    .project-card:hover .delete-btn { opacity: 1; }
  `]
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  loading = true;
  isVisible = false;
  isConfirmLoading = false;

  newProject: Project = {
    nombre: '',
    descripcion: ''
  };
  isReadOnly = false;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private message: NzMessageService
  ) {}

  ngOnInit(): void {
    this.isReadOnly = this.router.url.includes('/staff');
    this.loadProjects();
  }

  loadProjects() {
    this.loading = true;
    this.projectService.getAllProjects().subscribe({
      next: (data: Project[]) => {
        this.projects = data;
        this.loading = false;
      },
      error: (err: any) => {
        const currentUrl = this.projectService.getCurrentBaseUrl();
        if (currentUrl.includes('localhost')) {
          this.message.error('Error al conectar con el backend local (localhost:8080).');
        } else {
          this.message.error('Error al cargar proyectos del servidor.');
        }
        this.loading = false;
      }
    });
  }

  switchToProduction() {
    localStorage.setItem('BACKEND_URL', 'https://diagramador-de-actividades.up.railway.app');
    this.message.loading('Cambiando a producción...', { nzDuration: 1000 });
    setTimeout(() => window.location.reload(), 1000);
  }

  showModal(): void {
    this.isVisible = true;
  }

  handleCancel(): void {
    this.isVisible = false;
  }

  handleOk(): void {
    if (!this.newProject.nombre) {
      this.message.warning('El nombre es obligatorio');
      return;
    }

    this.isConfirmLoading = true;
    this.projectService.createProject(this.newProject).subscribe({
      next: () => {
        this.message.success('Proyecto creado correctamente');
        this.isVisible = false;
        this.isConfirmLoading = false;
        this.newProject = { nombre: '', descripcion: '' };
        this.loadProjects();
      },
      error: (err: any) => {
        this.message.error('Error al crear proyecto');
        this.isConfirmLoading = false;
      }
    });
  }

  deleteProject(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.projectService.deleteProject(id).subscribe({
      next: () => {
        this.message.success('Proyecto eliminado');
        this.loadProjects();
      },
      error: () => this.message.error('Error al eliminar')
    });
  }

  viewProject(id: string) {
    const parent = this.isReadOnly ? 'staff' : 'designer';
    this.router.navigate([`/${parent}/projects`, id, 'designs']);
  }
}


