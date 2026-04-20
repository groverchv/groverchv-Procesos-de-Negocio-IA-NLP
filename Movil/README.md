# Procesos Móvil

Aplicación móvil Flutter para visualizar en tiempo real diagramas de procesos BPMN y el estado de las actividades mediante WebSockets.

## Características

✓ **Visualización de Proyectos y Diseños**: Navega por los proyectos y diseños disponibles  
✓ **Visor de Diagramas**: Visualiza los diagramas BPMN diseñados  
✓ **Monitoreo en Tiempo Real**: Conecta por WebSocket para recibir actualizaciones del estado de procesos  
✓ **Lista de Procesos Activos**: Observa todos los procesos en ejecución  
✓ **Solo Lectura**: La aplicación móvil solo visualiza información, el funcionario realiza las acciones en el sistema principal

## Requisitos

- Flutter 3.0+
- Dart 3.0+
- Backend ejecutándose en http://localhost:8080
- WebSocket disponible en ws://localhost:8080/ws-bpmn

## Instalación

```bash
# Clonar el proyecto
git clone <repo>
cd Movil

# Obtener dependencias
flutter pub get

# Ejecutar la aplicación
flutter run
```

## Configuración de Servidor

La aplicación se conecta al servidor en:

- **API REST**: `http://10.0.2.2:8080/api` (emulador Android)
- **WebSocket**: `ws://10.0.2.2:8080/ws-bpmn` (emulador Android)

Para dispositivos físicos o iOS, cambiar en:
- `lib/services/api_service.dart`
- `lib/services/websocket_service.dart`

## Estructura del Proyecto

```
lib/
├── main.dart                          # Punto de entrada
├── models/
│   └── types.dart                    # Modelos de datos
├── screens/
│   ├── home_screen.dart              # Pantalla principal
│   ├── projects_list_screen.dart    # Lista de proyectos
│   ├── designs_list_screen.dart     # Lista de diseños
│   ├── diagram_viewer_screen.dart   # Visor de diagrama
│   ├── active_processes_screen.dart # Procesos activos
│   └── process_details_screen.dart  # Detalles del proceso
└── services/
    ├── api_service.dart              # Servicio REST API
    └── websocket_service.dart        # Servicio WebSocket
```

## Flujo de la Aplicación

1. **Inicio**: Pantalla principal con opciones de navación
2. **Proyectos**: Lista todos los proyectos disponibles
3. **Diseños**: Lista los diseños dentro de un proyecto
4. **Diagrama**: Visualiza el diagrama BPMN con actividades
5. **Procesos**: Selecciona un proceso activo para monitorear
6. **WebSocket**: Se conecta automáticamente para recibir actualizaciones en tiempo real

## Modelos de Datos

### Project
- id: String
- nombre: String
- descripcion: String
- fechaCreacion: String (opcional)
- ultimaActualizacion: String (opcional)

### Design
- id: String
- nombre: String
- projectId: String
- estado: String (draft, active, archived)

### ProcessInstance
- id: String
- designId: String
- designName: String
- startedBy: String
- status: String (active, completed, canceled)
- activities: List<ActivityInstance>

### ActivityInstance
- nodeId: String
- nodeLabel: String
- nodeType: String
- status: String (PENDING, IN_PROCESS, IN_REVIEW, FINISHED, CANCELED, SKIPPED)
- assignedTo: String (opcional)
- startedAt: String (opcional)

## WebSocket

La aplicación se conecta al WebSocket para recibir actualizaciones en tiempo real:

- **Canal de Diagrama**: `/topic/modeler/{designId}`
- **Canal de Presencia**: `/topic/presence/{designId}`
- **Actualizaciones de Procesos**: Se reciben automáticamente cuando se selecciona uno

## Desarrollo

### Generar modelos serializables

```bash
flutter pub run build_runner build
```

### Ejecutar en desarrollo

```bash
flutter run -v
```

## Notas Importantes

- Esta es una aplicación de **solo lectura**
- Los cambios de estado los realiza el **funcionario** en la aplicación web
- El **diseñador** diseña los diagramas
- La aplicación móvil **solo visualiza** la información en tiempo real

## Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.
