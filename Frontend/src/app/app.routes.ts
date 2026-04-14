import { Routes } from '@angular/router';
import { RoleSelectionComponent } from './pages/home/role-selection/role-selection';
import { ProjectListComponent } from './pages/designer/project-list/project-list';
import { DesignListComponent } from './pages/designer/design-list/design-list';
import { ModelerComponent } from './pages/designer/modeler/modeler';
import { StaffDashboardComponent } from './pages/staff/staff-dashboard';

export const routes: Routes = [
  { path: '', component: RoleSelectionComponent },
  // Designer routes
  { path: 'designer/projects', component: ProjectListComponent },
  { path: 'designer/projects/:projectId/designs', component: DesignListComponent },
  { path: 'designer/designs/:designId', component: ModelerComponent },
  // Staff routes
  { path: 'staff', component: StaffDashboardComponent },
  { path: '**', redirectTo: '' }
];

