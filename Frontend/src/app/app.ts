import { Component, signal, HostListener, OnInit } from '@angular/core';
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
export class App implements OnInit {
  showTitle = signal(true);
  sidebarCollapsed = signal(false);
  isMobile = false;

  constructor(private router: Router) {
    this.checkVisibility();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkVisibility();
      // Auto-close sidebar on navigation on mobile
      if (this.isMobile) {
        this.sidebarCollapsed.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.checkMobile();
    // On mobile, start with sidebar closed
    if (this.isMobile) {
      this.sidebarCollapsed.set(true);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.isMobile;
    this.checkMobile();
    // When switching from mobile to desktop, reset sidebar
    if (wasMobile && !this.isMobile) {
      this.sidebarCollapsed.set(false);
    }
    // When switching from desktop to mobile, close sidebar
    if (!wasMobile && this.isMobile) {
      this.sidebarCollapsed.set(true);
    }
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  get isStaff(): boolean {
    return this.router.url.includes('/staff') || this.router.url.includes('/funcionario');
  }

  showSidebar(): boolean {
    const url = this.router.url;
    return !url.includes('designs');
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile) {
      this.sidebarCollapsed.set(true);
    }
  }

  private checkVisibility(): void {
    const url = this.router.url;
    this.showTitle.set(!url.includes('designs'));
  }
}
