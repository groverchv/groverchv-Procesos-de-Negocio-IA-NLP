import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzSpaceModule } from 'ng-zorro-antd/space';

import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, NzLayoutModule, NzButtonModule, NzIconModule, NzAvatarModule, NzSpaceModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  @Input() sidebarCollapsed: boolean = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  constructor(private router: Router) {}

  get isStaff(): boolean {
    return this.router.url.includes('/staff');
  }

  get showToggle(): boolean {
    // No mostrar el botón de colapsado en la pantalla de inicio o modelador (donde no hay sidebar)
    const url = this.router.url;
    return url !== '/' && !url.includes('designs');
  }

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }
}
