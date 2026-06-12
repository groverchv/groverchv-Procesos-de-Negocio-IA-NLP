import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header';
import { filter } from 'rxjs/operators';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, RouterLink, RouterLinkActive, NzIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  showTitle = signal(true);
  sidebarCollapsed = signal(false);

  constructor(private router: Router) {
    this.checkVisibility();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.checkVisibility());
  }

  get isStaff(): boolean {
    return this.router.url.includes('/staff') || this.router.url.includes('/funcionario');
  }

  showSidebar(): boolean {
    const url = this.router.url;
    // Ocultar solo en el modelador de diseño
    return !url.includes('designs');
  }

  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  private checkVisibility() {
    const url = this.router.url;
    this.showTitle.set(!url.includes('designs'));
  }
}
