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
    .role-grid { padding: 80px 20px; text-align: center; max-width: 1200px; margin: 0 auto; }
    .role-card { border-radius: 20px; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .role-card:hover { transform: translateY(-10px); box-shadow: 0 15px 30px rgba(124, 58, 237, 0.15); }
    .icon-container { height: 200px; display: flex; align-items: center; justify-content: center; }
    .designer-bg { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
    .staff-bg { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .role-icon { font-size: 80px; color: white; }
    .role-title { font-size: 24px; font-weight: 700; margin-top: 15px; }
  `]
})
export class RoleSelectionComponent {
  constructor(private router: Router) {}

  selectRole(role: string) {
    if (role === 'designer') {
      this.router.navigate(['/designer/projects']);
    } else if (role === 'staff') {
      this.router.navigate(['/staff']);
    }
  }
}
