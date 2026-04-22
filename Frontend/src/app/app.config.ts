import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { NZ_I18N, es_ES } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';

// Iconos
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { 
  DeploymentUnitOutline, 
  BellOutline, 
  UserOutline, 
  EditOutline, 
  SearchOutline, 
  PlusOutline, 
  FolderOpenFill,
  DotChartOutline,
  ArrowLeftOutline,
  UndoOutline,
  RedoOutline,
  PlayCircleOutline,
  AppstoreOutline,
  BorderOutline,
  BulbOutline,
  SettingOutline,
  InfoCircleOutline,
  DeleteOutline,
  ProjectOutline,
  DatabaseOutline,
  ArrowRightOutline,
  CloseOutline,
  FormOutline,
  // Missing icons registered below
  SoundOutline,
  SoundFill,
  AudioOutline,
  PauseCircleOutline,
  KeyOutline,
  GlobalOutline,
  EyeOutline,
  EyeInvisibleOutline,
  SaveOutline,
  DashboardOutline,
  RocketOutline,
  BranchesOutline,
  WarningOutline,
  CheckCircleOutline,
  CheckCircleFill,
  BorderOuterOutline,
  FileSearchOutline,
  FileDoneOutline,
  CreditCardOutline,
  ZoomInOutline,
  ZoomOutOutline
} from '@ant-design/icons-angular/icons';

import { routes } from './app.routes';

registerLocaleData(es);

const icons = [
  DeploymentUnitOutline, BellOutline, UserOutline, EditOutline, 
  SearchOutline, PlusOutline, FolderOpenFill, DotChartOutline,
  ArrowLeftOutline, UndoOutline, RedoOutline, PlayCircleOutline,
  AppstoreOutline, BorderOutline, BulbOutline, SettingOutline,
  InfoCircleOutline, DeleteOutline, ProjectOutline, DatabaseOutline,
  ArrowRightOutline, CloseOutline, FormOutline,
  SoundOutline, SoundFill, AudioOutline, PauseCircleOutline,
  KeyOutline, GlobalOutline, EyeOutline, EyeInvisibleOutline,
  SaveOutline, DashboardOutline, RocketOutline, BranchesOutline,
  WarningOutline, CheckCircleOutline, CheckCircleFill,
  BorderOuterOutline, FileSearchOutline, FileDoneOutline,
  CreditCardOutline, ZoomInOutline, ZoomOutOutline
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    { provide: NZ_I18N, useValue: es_ES },
    provideNzIcons(icons)
  ]
};
