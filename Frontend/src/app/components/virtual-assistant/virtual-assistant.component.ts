import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { ApiGlobalService } from '../../services/api-global.service';

interface ChatMessage {
  sender: 'user' | 'ia';
  text: string;
}

@Component({
  selector: 'app-virtual-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './virtual-assistant.component.html',
  styleUrls: ['./virtual-assistant.component.css']
})
export class VirtualAssistantComponent {
  messages: ChatMessage[] = [
    { sender: 'ia', text: '¡Hola! Soy tu asistente virtual de procesos. ¿En qué te puedo ayudar hoy?' }
  ];
  userInput: string = '';

  constructor(private http: HttpClient, private apiGlobal: ApiGlobalService) {}

  sendMessage() {
    if (!this.userInput.trim()) return;

    // Agregar mensaje del usuario
    this.messages.push({ sender: 'user', text: this.userInput });
    const userText = this.userInput;
    this.userInput = '';

    // Enviar a Spring Boot (que a su vez habla con FastAPI)
    // Aquí hacemos un mock temporal hasta encender los backends
    this.http.post(this.apiGlobal.getEndpointUrl('/v1/ia/procesar-intencion'), {
      cliente_id: 'cliente-001',
      texto: userText
    }).subscribe({
      next: (res: any) => {
        this.messages.push({
          sender: 'ia',
          text: `Entendido. Te recomiendo la política: "${res.politica_recomendada}". ¿Deseas aplicarla al flujo actual?`
        });
      },
      error: (err) => {
        console.error(err);
        this.messages.push({
          sender: 'ia',
          text: 'Entendido. Estoy analizando tu requerimiento mediante NLP para asignar reglas (Mock Local).'
        });
      }
    });
  }
}
