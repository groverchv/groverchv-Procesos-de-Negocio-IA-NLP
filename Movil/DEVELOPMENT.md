# Guía de Desarrollo - Procesos Móvil

## Entorno de Desarrollo

### Herramientas Recomendadas

1. **Editor**: Visual Studio Code o Android Studio
2. **Extensions** (VS Code):
   - Flutter
   - Dart
   - Awesome Flutter Snippets

### Setup Inicial

```bash
# Instalar Flutter SDK si no está
flutter doctor

# Crear proyecto nuevo (si no usas este)
flutter create procesos_movil --platforms android,ios

# Entrar al directorio
cd procesos_movil

# Obtener dependencias
flutter pub get
```

## Estructura del Proyecto Explicada

```
lib/
├── main.dart
│   └─ Punto de entrada, configura MultiProvider con servicios
│
├── models/
│   └── types.dart
│       └─ Modelos de datos (Project, Design, ProcessInstance, etc)
│       └─ Decoradores @JsonSerializable para serialización
│
├── screens/
│   ├── home_screen.dart
│   │   └─ MyApp + HomeScreen con navegación por tabs (Proyectos, Procesos Activos, Info)
│   │
│   ├── projects_list_screen.dart
│   │   └─ Obtiene proyectos, muestra en ListView
│   │   └─ Navega a DesignsListScreen al seleccionar
│   │
│   ├── designs_list_screen.dart
│   │   └─ Muestra diseños de un proyecto
│   │   └─ Navega a DiagramViewerScreen
│   │
│   ├── diagram_viewer_screen.dart
│   │   ├─ Lado izquierdo: Historia del diagrama BPMN (nodos)
│   │   ├─ Lado derecho: Lista de procesos activos
│   │   └─ WebSocket conectado al diagrama seleccionado
│   │
│   ├── active_processes_screen.dart
│   │   └─ Muestra todos los procesos activos del sistema
│   │   └─ Expandible para ver detalles de actividades
│   │
│   └── process_details_screen.dart
│       └─ Placeholder para expandir con más detalles
│
└── services/
    ├── api_service.dart
    │   ├─ getProjects()
    │   ├─ getDesignsByProject(projectId)
    │   ├─ getModeling(designId)
    │   ├─ getProcessInstances(designId)
    │   └─ getActiveInstances()
    │
    └── websocket_service.dart
        ├─ Conexión STOMP/WebSocket
        ├─ Streams: processUpdates, diagramUpdates, connectedCount
        └─ Escucha /topic/modeler/{designId}
```

## Flujo de Estados (Provider Pattern)

La app usa **Provider** para manageestado:

```dart
// main.dart
MultiProvider(
  providers: [
    Provider<ApiService>(...),      // Singleton para API
    Provider<WebSocketService>(...), // Singleton para WebSocket
  ],
  child: MyApp(),
)
```

### Acceder a Servicios

```dart
// En una pantalla
final apiService = Provider.of<ApiService>(context, listen: false);
final wsService = Provider.of<WebSocketService>(context, listen: false);

// Usar
List<Project> projects = await apiService.getProjects();
wsService.connect(designId);
```

## Desarrollo de Nuevas Pantallas

### Plantilla Básica

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class NuevaScreen extends StatefulWidget {
  const NuevaScreen({Key? key}) : super(key: key);

  @override
  State<NuevaScreen> createState() => _NuevaScreenState();
}

class _NuevaScreenState extends State<NuevaScreen> {
  late Future<Object> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = Provider.of<ApiService>(context, listen: false)
        .miMetodo();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva')),
      body: FutureBuilder<Object>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }
          
          // Tu UI aquí
          return Center(child: Text('Contenido'));
        },
      ),
    );
  }
}
```

## Agregar un Nuevo Endpoint

### 1. Agregar método en ApiService

```dart
// lib/services/api_service.dart
Future<MiTipo> miMetodo(String parametro) async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/ruta/$parametro'),
    );

    if (response.statusCode == 200) {
      return MiTipo.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Error: ${response.statusCode}');
    }
  } catch (e) {
    rethrow;
  }
}
```

### 2. Crear Modelo (si no existe)

```dart
// lib/models/types.dart
@JsonSerializable()
class MiTipo {
  final String id;
  final String nombre;

  MiTipo({required this.id, required this.nombre});

  factory MiTipo.fromJson(Map<String, dynamic> json) => _$MiTipoFromJson(json);
  Map<String, dynamic> toJson() => _$MiTipoToJson(this);
}
```

### 3. Regenerar Serializadores

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### 4. Usar en Pantalla

```dart
_dataFuture = Provider.of<ApiService>(context, listen: false)
    .miMetodo("parametro");
```

## Trabajar con WebSocket

### Conectar a un Diagrama

```dart
void _connectWebSocket(String designId) {
  final wsService = Provider.of<WebSocketService>(context, listen: false);
  wsService.connect(designId);
  
  // Escuchar actualizaciones
  wsService.processUpdates.listen((update) {
    print('Actualización: ${update.id}');
    setState(() {
      // Actualizar UI
    });
  });
}
```

### Escuchar Streams

```dart
StreamBuilder<ProcessUpdate>(
  stream: wsService.processUpdates,
  builder: (context, snapshot) {
    if (snapshot.hasData) {
      final update = snapshot.data!;
      return Text('Proceso: ${update.id}');
    }
    return const CircularProgressIndicator();
  },
)
```

## Testing

### Test Unitario

```dart
// test/services/api_service_test.dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ApiService.getProjects returns list', () async {
    final apiService = ApiService();
    // Mock HTTP o usa un servidor de prueba
    final projects = await apiService.getProjects();
    expect(projects, isA<List<Project>>());
  });
}
```

### Test de Widget

```bash
flutter test
```

## debugging

### Logs

```dart
debugPrint('Mi mensaje');
print('Mensaje simple');
// Ver en terminal: flutter run -v
```

### Debugger

```bash
# Pausar ejecución en breakpoints
flutter run
# Luego usar 'l' para logs, 'd' para debugger
```

## Optimizaciones

### Caché de Datos

```dart
class ApiService {
  final Map<String, dynamic> _cache = {};

  Future<List<Project>> getProjects() async {
    if (_cache.containsKey('projects')) {
      return _cache['projects'];
    }
    
    final projects = await http.get(...);
    _cache['projects'] = projects;
    return projects;
  }
}
```

### Lazy Loading

```dart
ListView.builder(
  itemCount: 100,
  itemBuilder: (context, index) {
    return ProjectCard(project: projects[index]);
  },
)
```

### Evitar Builds Innecesarios

```dart
// ❌ MAL
FutureBuilder<>(
  future: myFuture, // Se llama en cada build!
)

// ✅ BIEN
FutureBuilder<>(
  future: _myFuture, // Variable de instancia
)
```

## Configuración de Producción

### Variables de Entorno

```bash
# Crear archivo .env
API_URL=https://api.miapp.com
WS_URL=wss://api.miapp.com/ws

# Usar con flutter_dotenv
flutter pub add flutter_dotenv
```

### Seguridad

- Usar HTTPS/WSS en producción
- No commitear URLs de desarrollo
- Validar tokens de autenticación

## Documentación de la API

### Comentarios en Código

```dart
/// Obtiene la lista de proyectos del servidor.
/// 
/// Lanza una excepción si hay error en la conexión.
/// 
/// Retorna: Lista de [Project]
Future<List<Project>> getProjects() async {
  // ...
}
```

## Publishing en App Store

### Android (Google Play)

```bash
# Crear key.properties
cd android/
keytool -genkey -v -keystore ./key.jks -keyalg RSA -keysize 2048

# Build APK/AAB
flutter build aab --release

# Subir a Google Play Console
```

### iOS (App Store)

```bash
# Actualiza version en pubspec.yaml
version: 1.0.0+1

# Build IPA
flutter build ios --release

# Subir con Transporter
```

## Recursos

- [Flutter Docs](https://flutter.dev/docs)
- [Dart Language](https://dart.dev)
- [Provider Pattern](https://pub.dev/packages/provider)
- [HTTP Package](https://pub.dev/packages/http)
- [WebSocket Channel](https://pub.dev/packages/web_socket_channel)

---

¡Felicidades, estás listo para desarrollar! 🚀
