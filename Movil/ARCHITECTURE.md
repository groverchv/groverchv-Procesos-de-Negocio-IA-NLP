# Documentación de Arquitectura - App Móvil

## Descripción General

La aplicación móvil **Procesos Móvil** es una herramienta de **visualización en tiempo real** de diagramas de procesos BPMN y el estado de sus actividades. La aplicación se conecta al Backend mediante WebSockets para recibir actualizaciones automáticas sin necesidad de recargar.

## Características Principales

### ✅ Funcionalidades Implementadas

1. **Navegación por Proyectos y Diseños**
   - Obtiene la lista de proyectos del Backend
   - Muestra diseños disponibles dentro de cada proyecto
   - Estados visuales de cada diseño (Borrador, Activo, Archivado)

2. **Visualización de Diagramas**
   - Descarga la estructura del diagrama BPMN
   - Muestra todos los nodos (actividades, decisiones, etc.)
   - Visualiza las conexiones entre elementos

3. **Monitoreo de Procesos en Tiempo Real**
   - WebSocket conectado al `/topic/modeler/{designId}`
   - Recibe actualizaciones de estado de actividades
   - Muestra estado actual con colores indicativos

4. **Procesos Activos**
   - Lista todos los procesos en ejecución
   - Expandible para ver detalles de actividades
   - Estado de cada actividad con indicadores visuales

### ❌ Restricciones (Solo Lectura)

- No puede modificar ningún diagrama
- No puede cambiar estado de actividades
- No puede crear nuevos proyectos o diseños
- No puede ejecutar acciones que afecten procesos
- El funcionario realiza todas las acciones en la aplicación web

## Arquitectura Técnica

### Capas de la Aplicación

```
┌─────────────────────────────────────┐
│       User Interface (UI)            │  Screens, Widgets
├─────────────────────────────────────┤
│    Service Layer (Servicios)         │  API Service, WebSocket
├─────────────────────────────────────┤
│  Repository Layer (Modelos)          │  Types, Data Models
├─────────────────────────────────────┤
│   Backend REST + WebSocket           │  HTTP + STOMP
└─────────────────────────────────────┘
```

### Estructura de Carpetas

```
lib/
├── main.dart                          # Configuración principal
├── models/
│   └── types.dart                    # Modelos de datos (Project, Design, etc)
├── screens/                          # Pantallas de la aplicación
│   ├── home_screen.dart              # Inicio con navegación
│   ├── projects_list_screen.dart     # Lista de proyectos
│   ├── designs_list_screen.dart      # Lista de diseños
│   ├── diagram_viewer_screen.dart    # Visor de diagrama + procesos
│   ├── active_processes_screen.dart  # Procesos activos globales
│   └── process_details_screen.dart   # Detalles específicos
└── services/
    ├── api_service.dart              # Llamadas REST API
    └── websocket_service.dart        # Conexión STOMP
```

## Flujo de Datos

### 1. Inicio de la Aplicación
```
┌──────────────┐
│  HomeScreen  │  Muestra 3 tabs
└──────────────┘
      │
      ├→ ProjectsListScreen    (API: GET /projects)
      ├→ ActiveProcessesScreen (API: GET /instances/active)
      └→ InfoScreen            (Información estática)
```

### 2. Navegación a Diagrama
```
ProjectsListScreen
      ↓ (tap proyecto)
DesignsListScreen  (API: GET /designs/project/{id})
      ↓ (tap diseño)
DiagramViewerScreen (API: GET /modeling/{designId})
      ↓
Conectar WebSocket  (ws: /topic/modeler/{designId})
      ↓
Recibir actualizaciones en tiempo real
```

### 3. Visualización de Proceso
```
DiagramViewerScreen
      ├─ Obtiene: Modeling (nodos + aristas)
      ├─ Obtiene: Procesos activos de este diseño
      │
      └─ Al seleccionar proceso:
         ├─ Conecta WebSocket
         ├─ Muestra estado de cada actividad
         └─ Actualiza en tiempo real
```

## Modelos de Datos

### Project
```dart
class Project {
  String id;
  String nombre;
  String descripcion;
  List<String> designIds;
  DateTime fechaCreacion;
}
```

### Design
```dart
class Design {
  String id;
  String nombre;
  String projectId;
  String estado; // 'draft', 'active', 'archived'
  String modelingId;
}
```

### Modeling
```dart
class Modeling {
  String id;
  List<NodeData> nodes;    // Actividades, decisiones, etc
  List<EdgeData> edges;    // Conexiones
}
```

### ProcessInstance
```dart
class ProcessInstance {
  String id;
  String designId;
  String startedBy;
  String status; // 'active', 'completed', 'canceled'
  List<ActivityInstance> activities;
}
```

### ActivityInstance
```dart
class ActivityInstance {
  String nodeId;
  String nodeLabel;
  String status; // 'PENDING', 'IN_PROCESS', 'FINISHED', etc
  DateTime startedAt;
  DateTime completedAt;
}
```

## Servicios

### ApiService

Realiza llamadas REST al Backend:

```dart
// Obtener proyectos
getProjects() → List<Project>

// Obtener diseños de un proyecto
getDesignsByProject(projectId) → List<Design>

// Obtener diagrama BPMN
getModeling(designId) → Modeling

// Obtener procesos activos
getProcessInstances(designId) → List<ProcessInstance>
getActiveInstances() → List<ProcessInstance>
```

**Configuración:**
- Base URL: `http://10.0.2.2:8080/api` (emulador)
- Cambiar para dispositivos físicos/iOS

### WebSocketService

Gestiona conexión STOMP para actualizaciones en tiempo real:

```dart
// Conectar a un diagrama
connect(designId) → Stream<ProcessUpdate>

// Recibe actualizaciones de diagrama
diagramUpdates → Stream<DiagramUpdate>

// Recibe actualizaciones de proceso
processUpdates → Stream<ProcessUpdate>

// Cierra conexión
disconnect()
```

**Configuración:**
- WebSocket URL: `ws://10.0.2.2:8080/ws-bpmn`
- Canal diagrama: `/topic/modeler/{designId}`
- Canal presencia: `/topic/presence/{designId}`

## Estados de Actividades

| Estado | Color | Significado |
|--------|-------|-------------|
| PENDING | Gris | No iniciada |
| IN_PROCESS | Azul | Siendo ejecutada |
| IN_REVIEW | Naranja | En revisión |
| FINISHED | Verde | Completada |
| CANCELED | Rojo | Cancelada |
| SKIPPED | Púrpura | Omitida |

## Estados de Proceso

| Estado | Color | Significado |
|--------|-------|-------------|
| ACTIVE | Verde | En ejecución |
| COMPLETED | Azul | Finalizado |
| CANCELED | Rojo | Cancelado |

## Integración con Backend

### Endpoints REST Utilizados

```
GET  /api/projects
GET  /api/projects/{id}
GET  /api/designs/project/{projectId}
GET  /api/designs/{id}
GET  /api/modeling/{designId}
GET  /api/instances
GET  /api/instances/active
GET  /api/instances/{id}
GET  /api/instances/design/{designId}
```

### Conexión WebSocket (STOMP)

```
Protocolo: STOMP sobre WebSocket
URL: ws://localhost:8080/ws-bpmn

Canales de Suscripción:
- /topic/modeler/{designId}    → Actualizaciones del diagrama
- /topic/presence/{designId}   → Información de usuarios conectados

Canales de Publicación:
- /app/modeler/{designId}      → Cambios (bloqueado en cliente)
- /app/presence/{designId}     → Usuario unida/salida
- /app/presence/cursor/{id}    → Posición del cursor
```

## Configuración de Desarrollo

### Requisitos
- Flutter 3.0+
- Dart 3.0+
- Android SDK (para emulador)
- Xcode (para iOS)

### Obtener Dependencias
```bash
flutter pub get
flutter pub run build_runner build  # Generar tipos serializables
```

### Ejecutar
```bash
# En emulador Android
flutter run

# En dispositivo físico
flutter run -v

# En web (experimental)
flutter run -d chrome
```

## Consideraciones de Seguridad

1. **Solo Lectura**: No hay permisos para modificar datos
2. **Validación de Datos**: Los tipos se validan automáticamente
3. **Conexión WebSocket**: Usa SockJS fallback para compatibilidad
4. **Error Handling**: Manejo de errores de conexión y timeouts

## Próximas Mejoras

- [ ] Gráficos del diagrama BPMN renderizados visualmente
- [ ] Animación de transiciones de estado
- [ ] Sistema de notificaciones push
- [ ] Búsqueda y filtros avanzados
- [ ] Caché offline de datos
- [ ] Interfaz responsiva mejorada

