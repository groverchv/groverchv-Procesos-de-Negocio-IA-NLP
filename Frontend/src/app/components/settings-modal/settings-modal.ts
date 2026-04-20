import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzTagModule } from 'ng-zorro-antd/tag';

export interface ApiKeysConfig {
  groqKey: string;
  geminiKey: string;
  elevenLabsKey: string;
  elevenLabsVoice: string;
  enableTTS: boolean;
  enableVoiceInput: boolean;
  language: string;
}

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzModalModule, NzInputModule,
    NzButtonModule, NzIconModule, NzSwitchModule,
    NzDividerModule, NzTagModule
  ],
  template: `
    <nz-modal [(nzVisible)]="visible" [nzTitle]="titleTpl"
              [nzWidth]="580" (nzOnCancel)="close()" [nzFooter]="footerTpl" nzCentered
              nzClassName="settings-modal">
      <ng-template #titleTpl>
        <span nz-icon nzType="setting" nzTheme="outline" style="margin-right: 8px;"></span>Configuración de la Plataforma
      </ng-template>
      <div *nzModalContent>
        <div class="settings-section">

          <h4 style="margin:0 0 16px; font-weight:700; color:#1e293b;"><span nz-icon nzType="key" nzTheme="outline" style="margin-right: 8px; color: #d4b106;"></span>Claves API</h4>
            <div class="settings-section">
              <div class="key-group">
                <label>
                  <span class="key-label">Groq API Key</span>
                  <nz-tag nzColor="cyan">Llama 3.3</nz-tag>
                </label>
                <nz-input-group [nzSuffix]="groqSuffix">
                  <input nz-input [(ngModel)]="config.groqKey"
                         [type]="showGroq ? 'text' : 'password'"
                         placeholder="gsk_..." />
                </nz-input-group>
                <ng-template #groqSuffix>
                  <span class="toggle-eye" (click)="showGroq = !showGroq">
                    <span nz-icon [nzType]="showGroq ? 'eye-invisible' : 'eye'" nzTheme="outline"></span>
                  </span>
                </ng-template>
                <span class="key-hint">Motor rápido para comandos de diagrama y auditoría</span>
              </div>

              <div class="key-group">
                <label>
                  <span class="key-label">Gemini API Key</span>
                  <nz-tag nzColor="purple">Multimodal Live</nz-tag>
                </label>
                <nz-input-group [nzSuffix]="geminiSuffix">
                  <input nz-input [(ngModel)]="config.geminiKey"
                         [type]="showGemini ? 'text' : 'password'"
                         placeholder="AIzaSy..." />
                </nz-input-group>
                <ng-template #geminiSuffix>
                  <span class="toggle-eye" (click)="showGemini = !showGemini">
                    <span nz-icon [nzType]="showGemini ? 'eye-invisible' : 'eye'" nzTheme="outline"></span>
                  </span>
                </ng-template>
                <span class="key-hint">Asistente conversacional Tonny-AI (voz bidireccional)</span>
              </div>

              <div class="key-group">
                <label>
                  <span class="key-label">ElevenLabs API Key</span>
                  <nz-tag nzColor="volcano">TTS Premium</nz-tag>
                </label>
                <nz-input-group [nzSuffix]="elevenSuffix">
                  <input nz-input [(ngModel)]="config.elevenLabsKey"
                         [type]="showEleven ? 'text' : 'password'"
                         placeholder="sk_..." />
                </nz-input-group>
                <ng-template #elevenSuffix>
                  <span class="toggle-eye" (click)="showEleven = !showEleven">
                    <span nz-icon [nzType]="showEleven ? 'eye-invisible' : 'eye'" nzTheme="outline"></span>
                  </span>
                </ng-template>
                <span class="key-hint">Síntesis de voz natural y humanizada para Tonny</span>
              </div>

              <div class="key-group">
                <label><span class="key-label">ID de Voz (ElevenLabs)</span></label>
                <input nz-input [(ngModel)]="config.elevenLabsVoice"
                       placeholder="21m00Tcm4TlvDq8ikWAM" />
                <span class="key-hint">Voz masculina recomendada: Daniel, Josh o Antoni</span>
              </div>
            </div>

          <nz-divider></nz-divider>
          <h4 style="margin:0 0 16px; font-weight:700; color:#1e293b;"><span nz-icon nzType="appstore" nzTheme="outline" style="margin-right: 8px;"></span>Preferencias</h4>
            <div class="settings-section">
              <div class="pref-row">
                <div class="pref-info">
                  <span class="pref-label"><span nz-icon nzType="sound" nzTheme="outline" style="margin-right: 6px;"></span>Síntesis de Voz (TTS)</span>
                  <span class="pref-desc">Tonny responde con audio</span>
                </div>
                <nz-switch [(ngModel)]="config.enableTTS"></nz-switch>
              </div>

              <nz-divider></nz-divider>

              <div class="pref-row">
                <div class="pref-info">
                  <span class="pref-label"><span nz-icon nzType="audio" nzTheme="outline" style="margin-right: 6px;"></span>Entrada de Voz</span>
                  <span class="pref-desc">Reconocimiento de voz para comandos</span>
                </div>
                <nz-switch [(ngModel)]="config.enableVoiceInput"></nz-switch>
              </div>

              <nz-divider></nz-divider>

              <div class="pref-row">
                <div class="pref-info">
                  <span class="pref-label"><span nz-icon nzType="global" nzTheme="outline" style="margin-right: 6px;"></span>Idioma</span>
                  <span class="pref-desc">Idioma del reconocimiento de voz</span>
                </div>
                <select nz-input [(ngModel)]="config.language" style="width: 140px;">
                  <option value="es-ES">Español (ES)</option>
                  <option value="es-MX">Español (MX)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>
            </div>
        </div>
      </div>

      <ng-template #footerTpl>
        <button nz-button nzType="default" (click)="close()">Cancelar</button>
        <button nz-button nzType="primary" (click)="save()">
          <span nz-icon nzType="save" nzTheme="outline" style="margin-right: 6px;"></span>Guardar Configuración
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: [`
    .settings-section { padding: 16px 4px; }
    .key-group { margin-bottom: 20px; }
    .key-group label {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 6px;
    }
    .key-label {
      font-weight: 600; font-size: 13px; color: #1e293b;
    }
    .key-hint {
      display: block; font-size: 11px; color: #94a3b8; margin-top: 4px;
    }
    .toggle-eye { cursor: pointer; font-size: 16px; user-select: none; }

    .pref-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0;
    }
    .pref-info { display: flex; flex-direction: column; }
    .pref-label { font-weight: 600; font-size: 13px; color: #1e293b; }
    .pref-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    .about-section { text-align: center; padding: 30px 20px; }
    .about-logo { font-size: 48px; margin-bottom: 12px; }
    .about-section h3 { font-weight: 800; font-size: 20px; color: #1e293b; margin: 0; }
    .about-section p { color: #64748b; font-size: 13px; margin: 4px 0 0; }
    .about-stack { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  `]
})
export class SettingsModalComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() configSaved = new EventEmitter<ApiKeysConfig>();

  showGroq = false;
  showGemini = false;
  showEleven = false;

  config: ApiKeysConfig = {
    groqKey: '',
    geminiKey: '',
    elevenLabsKey: '',
    elevenLabsVoice: '21m00Tcm4TlvDq8ikWAM',
    enableTTS: true,
    enableVoiceInput: true,
    language: 'es-ES'
  };

  constructor(private message: NzMessageService) {
    this.loadConfig();
  }

  private loadConfig() {
    const saved = localStorage.getItem('bpmnflow_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch {}
    }
  }

  save() {
    localStorage.setItem('bpmnflow_config', JSON.stringify(this.config));
    this.configSaved.emit(this.config);
    this.message.success('✅ Configuración guardada correctamente');
    this.close();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
