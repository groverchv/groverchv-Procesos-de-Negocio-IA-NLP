# 🚀 INICIO RÁPIDO - Procesos Móvil

## ¿Qué se creó?

Una **app móvil completa en Flutter** que:
- 📱 Visualiza diagrama BPMN en tiempo real
- 🔌 Se conecta por WebSocket al Backend
- 📊 Muestra estado de procesos y actividades
- 🔒 Es solo lectura (no modifica nada)
- ⚡ Actualizaciones instantáneas

---

## ⚡ 5 Pasos para Ejecutar

### 1️⃣ Instalar Flutter (si no lo tienes)
```bash
flutter doctor
```

### 2️⃣ Entrar a la carpeta
```bash
cd Movil
```

### 3️⃣ Obtener dependencias
```bash
flutter pub get
flutter pub run build_runner build
```

### 4️⃣ Configurar IP del Backend
Edita dos archivos y reemplaza `10.0.2.2` con tu IP:

**Archivo 1: `lib/services/api_service.dart` (línea ~8)**
```dart
static const String baseUrl = 'http://TU_IP:8080/api';
```

**Archivo 2: `lib/services/websocket_service.dart` (línea ~7)**
```dart
static const String baseUrl = 'ws://TU_IP:8080/ws-bpmn';
```

ℹ️ Obtén tu IP:
- **Windows**: `ipconfig` → busca IPv4
- **Mac/Linux**: `ifconfig` → busca inet

### 5️⃣ Ejecutar
```bash
flutter run
```

---

## 📁 Estructura Creada

```
Movil/
├── lib/
│   ├── main.dart .......................... Punto de entrada
│   ├── models/types.dart ................. Modelos de datos
│   ├── screens/ .......................... 5 pantallas
│   └── services/ ......................... API + WebSocket
├── test/ ................................. Tests
├── pubspec.yaml .......................... Dependencias
└── Documentación ......................... 6 archivos MD
    ├── README.md ......................... Descripción
    ├── INSTALLATION.md ................... Instalación
    ├── ARCHITECTURE.md ................... Arquitectura
    ├── USAGE_EXAMPLES.md ................. Ejemplos
    └── DEVELOPMENT.md .................... Para desarrolladores
```

---

## 🎯 Funcionalidades

| Panel | Función | WebSocket |
|-------|---------|-----------|
| **Proyectos** | Lista todos los proyectos | ❌ |
| **Diseños** | Diseños dentro de proyecto | ❌ |
| **Diagrama** | Visualiza BPMN + procesos | ✅ |
| **Procesos Activos** | Todos los procesos del sistema | ❌ |

---

## 🔌 WebSocket

**Automático**: Al entrar a un diagrama:
- ✅ Se conecta a `ws://TU_IP:8080/ws-bpmn`
- ✅ Se suscribe a `/topic/modeler/{designId}`
- ✅ Recibe cambios en tiempo real
- ✅ Actualiza UI sin recargar

---

## 🎨 Estados Visuales

```
⚪ Gris    = PENDING (Espera inicio)
🔵 Azul    = IN_PROCESS (Siendo ejecutada)
🟠 Naranja = IN_REVIEW (Revisión/Aprobación)
🟢 Verde   = FINISHED (Completada)
🔴 Rojo    = CANCELED (Cancelada)
🟣 Púrpura = SKIPPED (Omitida)
```

---

## 👤 Roles

| Usuario | Puede Ver | Puede Modificar |
|---------|-----------|-----------------|
| **Diseñador** (App Web) | Proyectos, Diseños | ✅ Crear/editar diagramas |
| **Funcionario** (App Web) | Procesos | ✅ Ejecutar/cambiar estado |
| **Monitor** (App Móvil) | Procesos en RT | ❌ Solo lectura |

---

## ⚠️ Requisitos

- ✅ Flutter 3.0+
- ✅ Backend corriendo en puerto 8080
- ✅ Emulador Android O dispositivo

---

## 📞 Contacto Rápido

| Problema | Solución |
|----------|----------|
| "Connection refused" | Backend no está corriendo |
| "Timeout al conectar" | IP incorrecta en archivos |
| "No se ve diagrama" | Run con `flutter run --clean` |
| "WebSocket no conecta" | Verifica firewall del puerto 8080 |

---

## 📚 Documentación Completa

Ver estos archivos:
- 📖 **INSTALLATION.md** - Instalación paso a paso
- 📖 **ARCHITECTURE.md** - Cómo funciona internamente
- 📖 **USAGE_EXAMPLES.md** - Ejemplos reales de uso
- 📖 **DEVELOPMENT.md** - Para agregar funcionalidades

---

## ✨ Tips

```bash
# Ejecutar con logs detallados
flutter run -v

# Limpiar caché
flutter clean

# Generar nuevamente modelos (si editas types.dart)
flutter pub run build_runner build --delete-conflicting-outputs

# Ver en otro dispositivo
flutter run -d TU_DISPOSITIVO
```

---

## 🎬 Primer Uso

1. Abre app → **Proyectos**
2. Toca un proyecto → **Diseños**
3. Toca un diseño → **Diagrama** (WebSocket activo)
4. Selecciona proceso → Ve actualizaciones en tiempo real
5. ¡Listo! Ya estás monitoreando 📊

---

¿Questions? Ver los archivos documentación en `Movil/` 📚

**¡A disfrutar Procesos Móvil! 🚀**
