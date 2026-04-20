# Guía de Instalación - Procesos Móvil

## Requisitos Previos

### Software Necesario
1. **Flutter SDK** (3.0 o superior)
   - [Descargar Flutter](https://flutter.dev/docs/get-started/install)
   
2. **Dart** (viene con Flutter)
   
3. **Android Studio** o **Xcode** (según tu sistema operativo)
   - Android: Android Studio con Android SDK 21+
   - iOS: Xcode 12+

4. **Backend Procesos** ejecutándose
   - Java 11+
   - Spring Boot 3.x
   - Accesible en http://localhost:8080

### Verificar Instalación

```bash
# Verificar Flutter
flutter --version

# Verificar Dart
dart --version

# Verificar dependencias
flutter doctor
```

## Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
cd /ruta/del/proyecto
cd Movil
```

### 2. Obtener Dependencias

```bash
# Descargar todas las dependencias definidas en pubspec.yaml
flutter pub get

# Generar archivos serializables (modelos JSON)
flutter pub run build_runner build
```

### 3. Configurar la Conexión al Backend

**Archivo: `lib/services/api_service.dart`**

Para **emulador Android** (predeterminado):
```dart
static const String baseUrl = 'http://10.0.2.2:8080/api';
```

Para **dispositivo físico** o **iOS**:
```dart
static const String baseUrl = 'http://[TU_IP_LOCAL]:8080/api';
```

Ejemplo: `http://192.168.1.100:8080/api`

**Archivo: `lib/services/websocket_service.dart`**

Para **emulador Android**:
```dart
static const String baseUrl = 'ws://10.0.2.2:8080/ws-bpmn';
```

Para **dispositivo físico** o **iOS**:
```dart
static const String baseUrl = 'ws://[TU_IP_LOCAL]:8080/ws-bpmn';
```

### 4. Obtener tu IP Local

**En Windows:**
```cmd
ipconfig
```
Busca "IPv4 Address" en la sección de tu red activa.

**En Mac/Linux:**
```bash
ifconfig
```
Busca la sección "inet" de tu interfaz de red.

### 5. Ejecutar la Aplicación

#### En Emulador Android

```bash
# Iniciar emulador (si no está corriendo)
emulator -avd [nombre_del_emulador] &

# Esperar a que el emulador inicie completamente
flutter devices  # Verificar que aparezca

# Ejecutar la app
flutter run
```

#### En Dispositivo Físico Android

```bash
# Conectar dispositivo por USB
# Habilitar "Depuración USB" en opciones de desarrollador

# Verificar que el dispositivo está conectado
flutter devices

# Ejecutar la app
flutter run
```

#### En Simulador/Dispositivo iOS

```bash
# En Mac con Xcode instalado
flutter run -d macos

# En simulador iOS
flutter run -d ios

# En dispositivo iOS físico
flutter run -d [device_id]
```

#### En Modo Debug con Logs

```bash
flutter run -v
```

## Verificación de Conectividad

### 1. Probar Conexión a Backend

```bash
# Desde tu computadora
curl http://localhost:8080/api/projects

# Desde emulador Android
ping 10.0.2.2
```

### 2. Verificar WebSocket

```bash
# Usar una herramienta como wscat (instalar con npm)
npm install -g wscat

# Conectar al WebSocket
wscat -c ws://10.0.2.2:8080/ws-bpmn
```

## Troubleshooting

### Error: "Connection refused"

**Causa**: El Backend no está corriendo o no es accesible

**Solución**:
```bash
# Verificar que el Backend está corriendo
curl http://localhost:8080/api/projects

# Si no funciona, inicia el Backend
cd Backend
./mvnw spring-boot:run
```

### Error: "Unable to connect to emulator"

**Solución**:
```bash
# Listar emuladores disponibles
emulator -list-avds

# Iniciar un emulador específico
emulator -avd [nombre] &

# Esperar 30 segundos a que inicie completamente
```

### Error: "Connection timeout to WebSocket"

**Causa**: IP local incorrecta

**Solución**:
1. Obtén tu IP local
2. Actualiza en `api_service.dart` y `websocket_service.dart`
3. Reinicia la app: `flutter run --clean`

### El Backend no se conecta desde el emulador

**Verificar**:
```bash
# Desde el emulador (adb shell)
adb shell ping 10.0.2.2

# Desde la computadora
netstat -an | grep 8080  # En Windows: Get-NetTCPConnection -LocalPort 8080
```

**Si no funciona**:
- Backend podría estar escuchando solo en localhost
- Cambiar en `application.properties`:
  ```properties
  server.address=0.0.0.0
  ```

## Estructura de Carpetas Creada

```
Movil/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   └── types.dart
│   ├── screens/
│   │   ├── home_screen.dart
│   │   ├── projects_list_screen.dart
│   │   ├── designs_list_screen.dart
│   │   ├── diagram_viewer_screen.dart
│   │   ├── active_processes_screen.dart
│   │   └── process_details_screen.dart
│   └── services/
│       ├── api_service.dart
│       └── websocket_service.dart
├── test/
│   └── widget_test.dart
├── pubspec.yaml          # Dependencias
├── pubspec.lock
├── README.md
├── ARCHITECTURE.md
├── INSTALLATION.md       # Este archivo
└── .gitignore
```

## Desarrollo

### Comandos Útiles

```bash
# Compilar modelos JSON
flutter pub run build_runner build

# Ejecutar con hot reload
flutter run

# Ejecutar tests
flutter test

# Limpiar caché
flutter clean

# Obtener dependencias frescas
flutter pub get

# Verificar análisis de código
flutter analyze

# Compilar para release
flutter build apk   # Android
flutter build aab   # Android App Bundle
flutter build ios   # iOS
```

### Editar Modelos

Si modificas los modelos en `lib/models/types.dart`:

```bash
# Regenerar los serializadores
flutter pub run build_runner build --delete-conflicting-outputs
```

## Configuración para Producción

### Build Android Release

```bash
flutter build apk --release
# Output: build/app/outputs/apk/release/app-release.apk
```

### Build iOS Release

```bash
flutter build ios --release
# Luego distribuir a través de App Store Connect
```

## Soporte y Contacto

- **Documentación**: Ver `README.md` y `ARCHITECTURE.md`
- **Errores**: Ejecutar `flutter doctor -v` para diagnóstico
- **Logs detallados**: Ejecutar con `flutter run -v`

---

¡Listo! Deberías poder ver la app funcionando con acceso a todos tus proyectos y procesos en tiempo real.
