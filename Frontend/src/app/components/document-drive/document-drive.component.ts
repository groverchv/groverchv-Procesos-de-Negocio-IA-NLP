import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../services/document/document.service';

@Component({
  selector: 'app-document-drive',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-drive.component.html',
  styleUrls: ['./document-drive.component.css']
})
export class DocumentDriveComponent {
  files: any[] = [];
  tenantId = 'cliente-001'; // Simulado temporalmente

  constructor(private documentService: DocumentService) {
    this.loadFiles();
  }

  loadFiles() {
    // Aquí cargaríamos de this.documentService.getFiles
    // Por ahora simularemos algunos si el backend aún no está encendido
    this.files = [
      { name: 'Politica_Aprobacion.pdf', size: '2 MB', date: new Date() },
      { name: 'Formato_Solicitud_Vacaciones.docx', size: '1.5 MB', date: new Date() }
    ];
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      console.log('Subiendo archivo:', file.name);
      // this.documentService.uploadFile(this.tenantId, file).subscribe(res => this.loadFiles());
      this.files.push({ name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', date: new Date() });
    }
  }

  downloadFile(fileName: string) {
    console.log('Descargando', fileName);
    // this.documentService.downloadFile(this.tenantId, fileName).subscribe(...)
  }
}
