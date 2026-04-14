import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { ProjectService } from '../../Services/project.service';
import { DesignService } from '../../Services/design.service';
import { Project, Design } from '../../Services/types';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, NzCardModule, NzGridModule, NzTypographyModule,
    NzIconModule, NzButtonModule, NzTagModule, NzStatisticModule, NzBadgeModule
  ],
  template: `
    <div class="staff-layout">
      <!-- Header -->
      <div class="staff-header">
        <div class="header-inner">
          <div class="header-brand">
            <div class="brand-icon">⚙️</div>
            <div>
              <h2>Panel del Funcionario</h2>
              <p>Gestión y seguimiento de procesos activos</p>
            </div>
          </div>
          <button class="back-btn" routerLink="/">← Cambiar Rol</button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-num">{{ projects.length }}</span>
          <span class="stat-label">Proyectos</span>
        </div>
        <div class="stat-sep"></div>
        <div class="stat-item">
          <span class="stat-num">{{ totalDesigns }}</span>
          <span class="stat-label">Procesos Activos</span>
        </div>
        <div class="stat-sep"></div>
        <div class="stat-item">
          <span class="stat-num">🟢</span>
          <span class="stat-label">Sistema Operativo</span>
        </div>
      </div>

      <!-- Content -->
      <div class="staff-content">
        <h3 class="section-title">📁 Proyectos Disponibles</h3>
        
        <div class="loading-state" *ngIf="loading">
          <div class="spinner"></div>
          <p>Cargando procesos...</p>
        </div>

        <div class="projects-grid" *ngIf="!loading">
          <div class="project-card" *ngFor="let project of projects" (click)="viewProject(project)">
            <!-- Project Preview SVG -->
            <div class="project-cover">
              <svg viewBox="0 0 200 120" class="preview-svg">
                <rect x="10" y="50" width="40" height="20" rx="10" fill="#6366f1" opacity="0.8"/>
                <rect x="80" y="40" width="50" height="30" rx="4" fill="#8b5cf6" opacity="0.7"/>
                <polygon points="155,50 175,60 155,70 135,60" fill="#10b981" opacity="0.7"/>
                <circle cx="185" cy="60" r="12" fill="#ef4444" opacity="0.7"/>
                <line x1="50" y1="60" x2="80" y2="60" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)"/>
                <line x1="130" y1="60" x2="135" y2="60" stroke="#94a3b8" stroke-width="2"/>
                <line x1="175" y1="60" x2="173" y2="60" stroke="#94a3b8" stroke-width="2"/>
                <defs>
                  <marker id="arr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#94a3b8"/>
                  </marker>
                </defs>
              </svg>
              <div class="cover-badge">
                <span class="badge-dot"></span>Activo
              </div>
            </div>
            
            <div class="project-body">
              <h4>{{ project.nombre }}</h4>
              <p>{{ project.descripcion || 'Proceso de negocio' }}</p>
              <div class="project-actions">
                <span class="action-chip view">👁 Ver Procesos</span>
              </div>
            </div>
          </div>

          <div class="empty-state" *ngIf="projects.length === 0">
            <div class="empty-icon">📋</div>
            <h4>No hay procesos disponibles</h4>
            <p>El diseñador aún no ha publicado ningún proceso.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * { font-family: 'Inter', sans-serif; box-sizing: border-box; }

    .staff-layout { min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }

    .staff-header { 
      background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 40px;
    }
    .header-inner {
      max-width: 1400px; margin: 0 auto; padding: 24px 0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .header-brand { display: flex; align-items: center; gap: 16px; }
    .brand-icon { font-size: 36px; }
    .header-brand h2 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; }
    .header-brand p { margin: 0; color: #64748b; font-size: 13px; }

    .back-btn {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      color: #94a3b8; padding: 10px 20px; border-radius: 10px; cursor: pointer;
      font-size: 14px; transition: all 0.2s;
    }
    .back-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }

    .stats-bar {
      max-width: 1400px; margin: 32px auto; padding: 0 40px;
      display: flex; align-items: center; gap: 0;
      background: rgba(255,255,255,0.04); border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.06); overflow: hidden;
    }
    .stat-item { padding: 24px 40px; text-align: center; flex: 1; }
    .stat-num { display: block; font-size: 28px; font-weight: 800; color: #fff; }
    .stat-label { display: block; font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-sep { width: 1px; height: 60px; background: rgba(255,255,255,0.08); }

    .staff-content { max-width: 1400px; margin: 0 auto; padding: 0 40px 60px; }
    .section-title { color: #cbd5e1; font-size: 18px; font-weight: 600; margin-bottom: 24px; }

    .loading-state { text-align: center; padding: 80px; color: #64748b; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }

    .project-card {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px; overflow: hidden; cursor: pointer;
      transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    }
    .project-card:hover { 
      transform: translateY(-6px); 
      border-color: rgba(99,102,241,0.4);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.2); 
    }

    .project-cover { 
      height: 160px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      position: relative; overflow: hidden;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .preview-svg { width: 100%; height: 100%; }
    .cover-badge {
      position: absolute; top: 12px; right: 12px;
      background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3);
      color: #10b981; font-size: 11px; font-weight: 600; padding: 4px 10px;
      border-radius: 20px; display: flex; align-items: center; gap: 5px;
    }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    .project-body { padding: 20px; }
    .project-body h4 { margin: 0 0 6px; color: #f1f5f9; font-size: 16px; font-weight: 700; }
    .project-body p { margin: 0 0 16px; color: #64748b; font-size: 13px; line-height: 1.5; }

    .project-actions { display: flex; gap: 8px; }
    .action-chip { 
      padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .action-chip.view { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
    .action-chip.view:hover { background: rgba(99,102,241,0.25); }

    .empty-state { 
      text-align: center; padding: 80px; color: #475569; 
      grid-column: 1 / -1;
    }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-state h4 { color: #64748b; font-size: 18px; }
    .empty-state p { font-size: 14px; }
  `]
})
export class StaffDashboardComponent implements OnInit {
  projects: Project[] = [];
  totalDesigns = 0;
  loading = true;

  constructor(
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects() {
    this.projectService.getAllProjects().subscribe({
      next: (data: Project[]) => {
        this.projects = data;
        this.totalDesigns = data.length * 3; // Placeholder estimate
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  viewProject(project: Project) {
    this.router.navigate(['/staff/projects', project.id, 'processes']);
  }
}
