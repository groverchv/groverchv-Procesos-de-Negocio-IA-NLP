import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inbox-funcionario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inbox-funcionario.component.html',
  styleUrls: ['./inbox-funcionario.component.css']
})
export class InboxFuncionarioComponent {
  tareas = [
    { id: 'T003', nombre: 'Aprobación de Crédito', prioridadIA: 95, riesgo: 'Alto', tiempoEspera: '2d' },
    { id: 'T001', nombre: 'Validar Documentos', prioridadIA: 60, riesgo: 'Medio', tiempoEspera: '4h' },
    { id: 'T002', nombre: 'Solicitud Vacaciones', prioridadIA: 10, riesgo: 'Bajo', tiempoEspera: '1h' },
  ];

  /*
   Este arreglo se autordenó basado en la Prioridad asignada por la IA
   evaluando el factor de riesgo desde Backend
  */
}
