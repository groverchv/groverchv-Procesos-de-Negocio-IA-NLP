import { Routes } from '@angular/router';
import { RoleSelectionComponent } from './pages/home/role-selection/role-selection';
import { ProjectListComponent } from './pages/designer/project-list/project-list';
import { DesignListComponent } from './pages/designer/design-list/design-list';
import { ModelerComponent } from './pages/designer/modeler/modeler';
import { DashboardBiComponent } from './components/dashboard-bi/dashboard-bi.component';
import { DocumentDriveComponent } from './components/document-drive/document-drive.component';
import { FuncionarioPortalComponent } from './pages/funcionario/funcionario-portal';

export const routes: Routes = [
  { path: '', component: RoleSelectionComponent },

  // ─── Designer routes ───────────────────────────────────────────────────────
  { path: 'designer/projects', component: ProjectListComponent },
  { path: 'designer/projects/:projectId/designs', component: DesignListComponent },
  { path: 'designer/designs/:designId', component: ModelerComponent },
  { path: 'designer/kpis', component: DashboardBiComponent },
  { path: 'designer/documentos', component: DocumentDriveComponent },

  // ─── Funcionario routes ────────────────────────────────────────────────────
  { path: 'funcionario', component: FuncionarioPortalComponent },

  // ─── Staff/legacy routes (readonly) ───────────────────────────────────────
  { path: 'staff', redirectTo: 'funcionario', pathMatch: 'full' },
  { path: 'staff/projects', component: ProjectListComponent },
  { path: 'staff/projects/:projectId/designs', component: DesignListComponent },
  { path: 'staff/designs/:designId', component: ModelerComponent },
  { path: 'staff/designs/:designId/instances/:instanceId', component: ModelerComponent },
  { path: 'staff/kpis', component: DashboardBiComponent },
  { path: 'staff/documentos', component: DocumentDriveComponent },

  // Catch-all
  { path: '**', redirectTo: '' }
];

