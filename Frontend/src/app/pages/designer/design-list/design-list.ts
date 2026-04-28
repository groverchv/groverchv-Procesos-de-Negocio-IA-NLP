import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzMessageService } from 'ng-zorro-antd/message';
import { DesignService } from '../../../services/design.service';
import { Design } from '../../../services/types';

@Component({
  selector: 'app-design-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, NzCardModule, NzGridModule, NzTypographyModule, 
    NzIconModule, NzButtonModule, NzSpaceModule, NzBreadCrumbModule, NzTagModule, NzModalModule, NzRadioModule
  ],
  templateUrl: './design-list.html',
  styles: [`
    .container { padding: 60px 80px; background: #fff; min-height: 100vh; }
    .design-card { 
      border-radius: 20px; overflow: hidden; 
      box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
      border: 1px solid #f1f5f9; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); 
      cursor: pointer; position: relative; background: #fff;
    }
    .design-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(124, 58, 237, 0.12); border-color: #ddd6fe; }
    
    .design-cover { 
      height: 180px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
      display: flex; align-items: center; justify-content: center; position: relative;
      border-bottom: 1px solid #f1f5f9;
    }
    .mini-diagram-preview { width: 100%; height: 100%; position: relative; overflow: hidden; opacity: 0.6; }
    .abstract-box { position: absolute; border: 2px solid #94a3b8; background: #fff; border-radius: 4px; }
    .abstract-line { position: absolute; height: 2px; background: #cbd5e1; }
    .bg-icon { position: absolute; bottom: 10px; right: 10px; font-size: 40px; color: #e2e8f0; }

    .card-info { padding: 20px; }
    .card-dates { margin-top: 15px; border-top: 1px solid #f8fafc; padding-top: 12px; }
    .card-dates p { margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; }
    .date-label { font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }

    .delete-btn { position: absolute; top: 15px; right: 15px; z-index: 20; opacity: 0; transform: scale(0.8); transition: all 0.3s; }
    .design-card:hover .delete-btn { opacity: 1; transform: scale(1); }

  `]
})
export class DesignListComponent implements OnInit {
  projectId: string | null = null;
  designs: Design[] = [];
  loading = true;
  isVisible = false;
  isConfirmLoading = false;

  newDesign: Design = {
    nombre: '',
    projectId: '',
    estado: 'Borrador',
    layoutType: 'vertical'
  };
  isReadOnly = false;

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private designService: DesignService,
    private message: NzMessageService
  ) {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
  }

  ngOnInit(): void {
    this.isReadOnly = this.router.url.includes('/staff');
    if (this.projectId) {
      this.loadDesigns();
      this.newDesign.projectId = this.projectId;
    }
  }

  loadDesigns() {
    this.loading = true;
    this.designService.getDesignsByProject(this.projectId!).subscribe({
      next: (data) => {
        this.designs = data;
        this.loading = false;
      },
      error: (err) => {
        this.message.error('Error al cargar diseños');
        this.loading = false;
      }
    });
  }

  showModal(): void {
    this.isVisible = true;
  }

  handleCancel(): void {
    this.isVisible = false;
  }

  handleOk(): void {
    if (!this.newDesign.nombre) {
      this.message.warning('El nombre es obligatorio');
      return;
    }

    this.isConfirmLoading = true;
    this.designService.createDesign(this.newDesign).subscribe({
      next: () => {
        this.message.success('Diseño creado correctamente');
        this.isVisible = false;
        this.isConfirmLoading = false;
        this.newDesign = { 
          nombre: '', 
          projectId: this.projectId || '', 
          estado: 'Borrador',
          layoutType: 'vertical'
        };

        this.loadDesigns();
      },
      error: () => {
        this.message.error('Error al crear el diseño');
        this.isConfirmLoading = false;
      }
    });
  }

  deleteDesign(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.designService.deleteDesign(id).subscribe({
      next: () => {
        this.message.success('Diseño eliminado');
        this.loadDesigns();
      },
      error: () => this.message.error('Error al eliminar el diseño')
    });
  }


  openModeler(id: string) {
    const parent = this.isReadOnly ? 'staff' : 'designer';
    this.router.navigate([`/${parent}/designs`, id]);
  }
}


