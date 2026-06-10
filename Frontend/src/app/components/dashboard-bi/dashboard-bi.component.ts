import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_GLOBAL } from '../../services/api.global';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ApiGlobalService } from '../../services/api-global.service';


import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTagModule } from 'ng-zorro-antd/tag';

@Component({
  selector: 'app-dashboard-bi',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    NzIconModule, 
    NzButtonModule, 
    NzInputModule, 
    NzSpaceModule, 
    NzTagModule
  ],
  templateUrl: './dashboard-bi.component.html',
  styleUrls: ['./dashboard-bi.component.css']
})
export class DashboardBiComponent implements OnInit, OnDestroy {
  activeTab: 'kpis' | 'usuarios' | 'ia-reports' = 'kpis';
  
  // Datos del Sistema (Cargados desde el Spring Boot Backend)
  usuarios: any[] = [];
  cargandoUsuarios: boolean = false;
  
  // Custom IA Reports
  promptQuery: string = '';
  reporteGenerado: any = null;
  presignedReportUrl: string | null = null;
  cargandoReporte: boolean = false;
  errorReporte: string | null = null;

  // Alertas IA en tiempo real
  alertasIa: any[] = [];
  private stompClient: Client | null = null;

  // Sugerencias rápidas para el Administrador
  sugerencias: string[] = [
    "Procesos más fáciles de terminar",
    "Procesos con mayor índice de anomalías",
    "Uso y espacio total de los repositorios S3",
    "Procesos más utilizados por los usuarios",
    "Identificación de cuellos de botella en créditos"
  ];

  // Datos dinámicos calculados en tiempo real
  kpisLocales = {
    eficienciaGeneral: '92.4%',
    anomaliasPromedio: '1.8%',
    tiempoPromedioEjecucion: '8.5 hrs',
    totalUsuariosActivos: '3'
  };

  tiemposEjecucion: any[] = [];
  exitoFlujos: any[] = [];

  constructor(private http: HttpClient, private apiGlobal: ApiGlobalService) {}

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarDatosRealesBPM();
    this.conectarWebSocket();
  }

  ngOnDestroy() {
    this.desconectarWebSocket();
  }

  conectarWebSocket() {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${this.apiGlobal.baseUrl}/ws-bpmn`),
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      reconnectDelay: 2000,
    });

    this.stompClient.onConnect = () => {
      this.stompClient?.subscribe('/topic/dashboard/alertas-ia', (message: IMessage) => {
        if (message.body) {
          try {
            const alert = JSON.parse(message.body);
            this.alertasIa.unshift(alert); // Agregar al inicio
            if (this.alertasIa.length > 5) {
              this.alertasIa.pop(); // Mantener solo las últimas 5
            }
          } catch (e) {
            console.error('Error al decodificar alerta de IA en el dashboard:', e);
          }
        }
      });
    };

    this.stompClient.activate();
  }

  desconectarWebSocket() {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }
  }

  cambiarTab(tab: 'kpis' | 'usuarios' | 'ia-reports') {
    this.activeTab = tab;
  }

  cargarUsuarios() {
    this.cargandoUsuarios = true;
    this.http.get<any[]>(this.apiGlobal.getEndpointUrl('/usuarios')).subscribe({
      next: (data) => {
        this.usuarios = data;
        this.kpisLocales.totalUsuariosActivos = data.length.toString();
        this.cargandoUsuarios = false;
      },
      error: (err) => {
        console.error('Error al conectar con la base de datos de usuarios local:', err);
        this.usuarios = [
          { id: '1', username: 'juan_disenador', nombre: 'Juan Diseñador', email: 'juan@bpmflow.com', rol: 'DISENADOR', tenantId: 'tenant_default' },
          { id: '2', username: 'maria_funcionario', nombre: 'Maria Funcionario', email: 'maria@bpmflow.com', rol: 'FUNCIONARIO', tenantId: 'tenant_default' },
          { id: '3', username: 'carlos_cliente', nombre: 'Carlos Cliente (Acme Corp)', email: 'carlos@acme.com', rol: 'CLIENTE', tenantId: 'tenant_acme' }
        ];
        this.kpisLocales.totalUsuariosActivos = '3';
        this.cargandoUsuarios = false;
      }
    });
  }

  cargarDatosRealesBPM() {
    // Consumir el endpoint real de instancias de procesos de Spring Boot para calcular métricas
    this.http.get<any[]>(this.apiGlobal.getEndpointUrl('/instances')).subscribe({
      next: (instances) => {
        const total = instances ? instances.length : 0;
        if (total > 0) {
          // 1. Calcular KPI de eficiencia y anomalías basados en datos reales de MongoDB
          const completados = instances.filter(i => i.status === 'COMPLETED' || i.status === 'FINISHED').length;
          const activos = instances.filter(i => i.status === 'ACTIVE' || i.status === 'IN_PROCESS' || i.status === 'PENDING').length;
          const anomalias = instances.filter(i => i.status === 'ANOMALY' || i.hasAnomalies === true || i.anomalias > 0).length;
          
          const tasaEficiencia = total > 0 ? (((completados + (activos * 0.8)) / total) * 100).toFixed(1) : '0.0';
          const tasaAnomalias = total > 0 ? ((anomalias / total) * 100).toFixed(1) : '0.0';
          
          this.kpisLocales.eficienciaGeneral = `${tasaEficiencia}%`;
          this.kpisLocales.anomaliasPromedio = `${tasaAnomalias}%`;
          
          // Calcular promedio real de tiempos
          let tiempoTotalHrs = 0;
          let countConTiempo = 0;
          instances.forEach(ins => {
            if (ins.tiempoTranscurridoHrs || ins.duracion) {
              tiempoTotalHrs += ins.tiempoTranscurridoHrs || ins.duracion || 0;
              countConTiempo++;
            }
          });
          const avgTiempo = countConTiempo > 0 ? (tiempoTotalHrs / countConTiempo).toFixed(1) : '1.5';
          this.kpisLocales.tiempoPromedioEjecucion = `${avgTiempo} hrs`;

          // 2. Agrupar dinámicamente por flujo/diseño
          const agrupados: { [key: string]: any } = {};
          instances.forEach(ins => {
            const name = ins.designNombre || ins.designName || 'Proceso de Negocio';
            if (!agrupados[name]) {
              agrupados[name] = { total: 0, completados: 0, anomalias: 0, tiempoTotal: 0, countTiempo: 0 };
            }
            agrupados[name].total += 1;
            if (ins.status === 'COMPLETED' || ins.status === 'FINISHED') agrupados[name].completados += 1;
            if (ins.status === 'ANOMALY' || ins.hasAnomalies || ins.anomalias > 0) agrupados[name].anomalias += 1;
            if (ins.tiempoTranscurridoHrs || ins.duracion) {
              agrupados[name].tiempoTotal += ins.tiempoTranscurridoHrs || ins.duracion || 0;
              agrupados[name].countTiempo += 1;
            }
          });

          // Convertir en listas dinámicas
          this.tiemposEjecucion = [];
          this.exitoFlujos = [];
          
          Object.keys(agrupados).forEach(key => {
            const data = agrupados[key];
            const pctExito = data.total > 0 ? ((data.completados / data.total) * 100).toFixed(1) : '0.0';
            const avgTime = data.countTiempo > 0 ? (data.tiempoTotal / data.countTiempo).toFixed(1) : '2.0';
            
            this.tiemposEjecucion.push({
              nombre: key,
              duracion: `${avgTime} hrs`,
              anomalias: data.anomalias,
              porcentajeBarra: Math.min(100, Math.max(10, data.total * 25))
            });

            this.exitoFlujos.push({
              nombre: key,
              porcentajeExito: `${pctExito}% Éxito`,
              porcentajeBarra: parseFloat(pctExito)
            });
          });
        } else {
          // Si no hay instancias en MongoDB, mostrar KPIs en cero
          this.mostrarKpisVacios();
        }
      },
      error: (err) => {
        console.warn('Conexión con base de datos de instancias en espera, mostrando KPIs vacíos...');
        this.mostrarKpisVacios();
      }
    });
  }

  mostrarKpisVacios() {
    this.kpisLocales.eficienciaGeneral = '0.0%';
    this.kpisLocales.anomaliasPromedio = '0.0%';
    this.kpisLocales.tiempoPromedioEjecucion = '0.0 hrs';
    this.tiemposEjecucion = [];
    this.exitoFlujos = [];
  }

  aplicarSugerencia(sug: string) {
    this.promptQuery = sug;
    this.generarReporteIA();
  }

  generarReporteIA() {
    if (!this.promptQuery.trim()) return;

    this.cargandoReporte = true;
    this.errorReporte = null;
    this.reporteGenerado = null;
    this.presignedReportUrl = null;
    this.activeTab = 'ia-reports';

    this.http.post<any>(this.apiGlobal.getEndpointUrl('/documentos/reporte-ia'), {
      query: this.promptQuery,
      tenantId: 'tenant_default'
    }).subscribe({
      next: (res) => {
        this.reporteGenerado = res.reporte;
        this.presignedReportUrl = res.presignedUrl;
        this.cargandoReporte = false;
      },
      error: (err) => {
        console.error('Error al generar reporte de IA dinámica:', err);
        this.errorReporte = 'No se pudo conectar con el servidor Spring Boot para generar el reporte de IA.';
        this.cargandoReporte = false;
      }
    });
  }

  exportarTXT() {
    if (!this.reporteGenerado) return;
    
    let content = `====================================================\n`;
    content += `         BPMNFlow - REPORTE INTELIGENTE IA\n`;
    content += `====================================================\n\n`;
    content += `Título: ${this.reporteGenerado.titulo}\n`;
    content += `Fecha de Emisión: ${new Date().toLocaleDateString()}\n\n`;
    content += `RESUMEN EJECUTIVO:\n${this.reporteGenerado.resumen}\n\n`;
    
    if (this.reporteGenerado.insights && this.reporteGenerado.insights.length > 0) {
      content += `INSIGHTS DE IA:\n`;
      this.reporteGenerado.insights.forEach((insight: string, idx: number) => {
        content += `- [${idx + 1}] ${insight}\n`;
      });
      content += `\n`;
    }
    
    if (this.reporteGenerado.tabla && this.reporteGenerado.tabla.length > 0) {
      content += `TABLA DE DATOS DE TELEMETRÍA:\n`;
      content += `Proceso | Métrica Clave | Duración | Estado\n`;
      content += `----------------------------------------------------\n`;
      this.reporteGenerado.tabla.forEach((row: any) => {
        content += `${row.proceso} | ${row.valor_clave || 'N/A'} | ${row.duracion || 'N/A'} | ${row.estado || 'N/A'}\n`;
      });
    }

    this.descargarArchivo(content, `${this.reporteGenerado.titulo.replace(/\s+/g, '_')}.txt`, 'text/plain');
  }

  exportarExcel() {
    if (!this.reporteGenerado || !this.reporteGenerado.tabla) return;
    
    let csvContent = "\ufeff"; 
    csvContent += "Proceso,Metrica Clave,Duracion,Anomalias,Estado\n";
    
    this.reporteGenerado.tabla.forEach((row: any) => {
      const p = `"${row.proceso || ''}"`;
      const val = `"${row.valor_clave || ''}"`;
      const dur = `"${row.duracion || ''}"`;
      const anom = `"${row.anomalias || '0'}"`;
      const est = `"${row.estado || ''}"`;
      csvContent += `${p},${val},${dur},${anom},${est}\n`;
    });

    this.descargarArchivo(csvContent, `${this.reporteGenerado.titulo.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');
  }

  exportarPDF() {
    window.print();
  }

  private descargarArchivo(content: string, filename: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
