import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard-bi',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-bi.component.html',
  styleUrls: ['./dashboard-bi.component.css']
})
export class DashboardBiComponent {
  reporteGenerado: any = null;

  constructor(private http: HttpClient) {}

  generarReporteIA() {
    this.reporteGenerado = { cargando: true };
    // Conecta con SpringBoot/FastAPI para generar BI
    this.http.get('http://localhost:8000/api/v1/reportes/generar?tenant_id=cliente-001').subscribe({
      next: (res) => this.reporteGenerado = res,
      error: (err) => console.log(err)
    });
  }
}
