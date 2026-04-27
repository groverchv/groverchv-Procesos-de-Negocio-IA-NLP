import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-role-selection',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzGridModule, NzTypographyModule, NzIconModule],
  templateUrl: './role-selection.html',
  styles: [`
    .role-grid { padding: 100px 20px; text-align: center; max-width: 1000px; margin: 0 auto; }
    .role-card { border-radius: 24px; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.03); background: white; }
    .role-card:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border-color: var(--primary-color); }
    .icon-container { height: 180px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
    .designer-bg { background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%); }
    .staff-bg { background: linear-gradient(135deg, #34d399 0%, #10b981 100%); }
    .role-icon { font-size: 64px; color: white; }
    .role-title { font-size: 22px; font-weight: 600; margin-top: 10px; color: var(--text-main); }
    .role-desc { color: var(--text-muted); font-size: 14px; padding: 0 24px 24px; }
  `]
})
export class RoleSelectionComponent {
  constructor(private router: Router) {}

  selectRole(role: string) {
    if (role === 'designer') {
      this.router.navigate(['/designer/projects']);
    } else if (role === 'staff') {
      this.router.navigate(['/staff/projects']);
    }
  }
}
