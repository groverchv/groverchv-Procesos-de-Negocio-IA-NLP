import { Component, signal, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  showTitle = signal(true);

  constructor(private router: Router) {
    this.checkVisibility();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.checkVisibility());
  }

  private checkVisibility() {
    this.showTitle.set(!window.location.href.includes('designs'));
  }
}
