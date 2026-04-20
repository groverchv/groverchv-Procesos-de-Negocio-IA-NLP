# Ejemplos de Uso - Procesos Móvil

## Flujo Básico de la Aplicación

### 1. Iniciar la App

```bash
flutter run
```

Verás la pantalla principal con 3 opciones:
- 📁 **Proyectos** - Ver todos los proyectos
- ▶️ **Procesos Activos** - Ver procesos en ejecución
- ℹ️ **Información** - Detalles de la app

---

## Ejemplo 1: Ver un Diagrama

### Paso 1: Navegar a Proyectos

1. Toca el tab **"Proyectos"**
2. La app carga los proyectos del Backend
3. Verás una lista de proyectos disponibles

**Código involucrado:**
```dart
// lib/screens/projects_list_screen.dart
_projectsFuture = Provider.of<ApiService>(context, listen: false).getProjects();
```

### Paso 2: Seleccionar un Proyecto

1. Toca en un proyecto (ej: "Sistema de Pedidos")
2. Se abre `DesignsListScreen`
3. Muestra todos los diseños de ese proyecto

**Modelos:**
```dart
Project(
  id: "proj_123",
  nombre: "Sistema de Pedidos",
  descripcion: "Gestión de pedidos de clientes",
)
```

### Paso 3: Seleccionar un Diseño

1. Toca en un diseño (ej: "Proceso de Aprobación")
2. Se abre `DiagramViewerScreen`
3. Descarga el diagrama BPMN

**Respuesta del Backend:**
```json
{
  "id": "des_456",
  "nombre": "Proceso de Aprobación",
  "projectId": "proj_123",
  "estado": "active",
  "modelingId": "mod_789"
}
```

### Paso 4: Ver el Diagrama

En `DiagramViewerScreen` ves:

**Lado izquierdo**: Actividades del diagrama
```
┌─────────────────────────────────┐
│ 1. Crear Pedido                 │
│    Tipo: Task                   │
│    Responsable: Vendedor        │
│                                 │
│ 2. Validar Stock               │
│    Tipo: Task                   │
│                                 │
│ 3. ¿Stock Disponible?          │
│    Tipo: Decision               │
│                                 │
│ 4. Procesar Pago               │
│    Tipo: Task                   │
│    Responsable: Tesorera       │
└─────────────────────────────────┘
```

**Lado derecho**: Procesos Activos
```
┌──────────────────────────────┐
│ Procesos Activos             │
├──────────────────────────────┤
│ proc_001 (Activo)            │
│ Iniciado por: juan@mail.com  │
│                              │
│ proc_002 (Activo)            │
│ Iniciado por: maria@mail.com │
└──────────────────────────────┘
```

**API llamada:**
```dart
// Obtener diagrama BPMN
Modeling modeling = await apiService.getModeling("des_456");

// Obtener procesos activos
List<ProcessInstance> processes = 
    await apiService.getProcessInstances("des_456");
```

---

## Ejemplo 2: Monitorear un Proceso en Tiempo Real

### Paso 1: Seleccionar un Proceso Activo

En el panel derecho, toca un proceso activo:

```
[✓] proc_001 → Se selecciona y conecta WebSocket
```

**Código:**
```dart
void _connectWebSocket(String processId) {
  final wsService = Provider.of<WebSocketService>(context, listen: false);
  wsService.connect(widget.designId);  // Conectar a /topic/modeler/{designId}
}
```

### Paso 2: Ver Estado de Actividades

Ahora el lado izquierdo muestra el estado de cada actividad:

```
Actividades del Diagrama
=======================

🟢 1. Crear Pedido
    Tipo: Task
    Estado: ✓ Finalizado
    Iniciado: 2024-04-15 09:30:15
    
🔵 2. Validar Stock
    Tipo: Task
    Estado: ⏳ En Proceso
    Responsable: juan.garcia

⚪ 3. ¿Stock Disponible?
    Tipo: Decision
    Estado: ⏳ En Proceso
    
⚪ 4. Procesar Pago
    Tipo: Task
    Estado: ⏳ Pendiente
```

### Paso 3: Ver Actualizaciones en Tiempo Real

Mientras visualizas, el funcionario hace cambios en la web:

**En la web**: El funcionario marca "Validar Stock" como completado
**En la móvil**: ¡INSTANTÁNEAMENTE! aparece:

```
🟢 2. Validar Stock           ← Cambió a GREEN/Finalizado
    Iniciado: 2024-04-15 09:45:30
    Completado: 2024-04-15 10:00:45
```

**WebSocket message recibido:**
```json
{
  "command": "UPDATE",
  "data": {
    "activities": [
      {
        "nodeId": "node_2",
        "nodeLabel": "Validar Stock",
        "nodetype": "Task",
        "status": "FINISHED",
        "startedAt": "2024-04-15T09:45:30Z",
        "completedAt": "2024-04-15T10:00:45Z"
      }
    ]
  }
}
```

---

## Ejemplo 3: Ver Procesos Activos Globales

### Paso 1: Ir a "Procesos Activos"

1. Toca el tab **"Procesos Activos"**
2. La app obtiene TODOS los procesos activos en el sistema

```dart
List<ProcessInstance> processes = 
    await apiService.getActiveInstances();
```

### Paso 2: Ver Lista de Procesos

```
Procesos Activos
================

────────────────────────────────────
🟢 ID: proc_001...
   Iniciado por: juan@mail.com
   Estado: Activo
   
   Exander ▼
   └─ 1. Crear Pedido ..................... FINALIZADO
   └─ 2. Validar Stock .................... EN PROCESO
   └─ 3. Stock Disponible ................. EN PROCESO
   └─ 4. Procesar Pago .................... PENDIENTE

────────────────────────────────────
🟢 ID: proc_002...
   Iniciado por: maria@mail.com
   Estado: Activo
   
   Expandir ▼
   └─ 1. Crear Pedido ..................... FINALIZADO
   └─ 2. Validar Stock .................... FINALIZADO
   └─ 3. Stock Disponible ................. FINALIZADO
   └─ 4. Procesar Pago .................... EN PROCESO
```

### Paso 3: Expandir Detalles

Toca en un proceso para ver detalles de actividades:

```
Proceso ID: proc_001
====================

📋 Estado de Actividades

1. Crear Pedido
   Tipo: Task
   🟢 Finalizado
   Asignado a: vendedor_1
   Iniciado: 2024-04-15 09:30
   
2. Validar Stock
   Tipo: Task
   🔵 En Proceso
   Asignado a: juan.garcia
   Iniciado: 2024-04-15 09:45
   
3. ¿Stock Disponible?
   Tipo: Decision
   🔵 En Proceso
   
4. Procesar Pago
   Tipo: Task
   ⚪ Pendiente
   Asignado a: tesorera_1
```

---

## Ejemplo 4: Colores y Estados

### Estados de Actividades

| Color | Estado | Significado |
|-------|--------|-------------|
| 🟢 Verde | FINISHED | Completada con éxito |
| 🔵 Azul | IN_PROCESS | Siendo ejecutada ahora |
| 🟠 Naranja | IN_REVIEW | En revisión/aprobación |
| ⚪ Gris | PENDING | Esperando para ejecutarse |
| 🔴 Rojo | CANCELED | Cancelada |
| 🟣 Púrpura | SKIPPED | Omitida según lógica |

### Estados de Procesos

| Color | Estado | Significado |
|-------|--------|-------------|
| 🟢 Verde | ACTIVE | En ejecución |
| 🔵 Azul | COMPLETED | Finalizado |
| 🔴 Rojo | CANCELED | Cancelado |

---

## Ejemplo 5: Actualización en Tiempo Real en Detalle

### Escenario Completo

1. **Abre la app**: Ves proceso "proc_001" con actividad "Validar Stock" en PENDING (gris)

2. **En la web**: El funcionario selecciona la actividad y presiona "Validar"

3. **En el Backend**: Se ejecuta
   ```java
   workflowEngine.advanceActivity(
       "proc_001",
       "node_2",
       "IN_PROCESS",
       formData
   );
   ```

4. **Sin actualizar la app**: La actividad cambia a AZUL (IN_PROCESS)

5. **Unos segundos después**: El funcionario presiona "Completar"

6. **Automáticamente**: La actividad cambia a VERDE (FINISHED)

```
┌─────────────────────────────────────┐
│  SIN HACER NADA EN LA MÓVIL         │
│                                     │
│  ⚪ PENDING  →  🔵 IN_PROCESS  →    │
│  (gris)     (azul)           (verde)
│                     🟢 FINISHED      │
│                                     │
│  TODO INSTANTÁNEAMENTE MEDIANTE    │
│  WEBSOCKET                          │
└─────────────────────────────────────┘
```

---

## Ejemplo 6: Manejo de Errores

### Error: Sin conexión al Backend

```
┌──────────────────────────────────┐
│  ❌ Error: Connection refused    │
│                                  │
│  Verifica:                       │
│  • Backend está corriendo        │
│  • IP correcta en settings      │
│                                  │
│  [Reintentar]  [Información]    │
└──────────────────────────────────┘
```

### Error: WebSocket desconectado

Mientras ves un proceso, si se desconecta el WebSocket:
- La pantalla sigue mostrando el última estado conocido
- No recibe nuevas actualizaciones
- Puedes hacer pull-to-refresh para obtener datos nuevos

---

## Casos de Uso Reales

### Caso 1: Gerente supervisando aprobaciones

1. Abre la app
2. Va a "Procesos Activos"
3. Identifica procesos atrasados
4. Abre uno específico
5. Ve qué actividad está bloqueada
6. Hace una nota para seguimiento

✅ **Ventaja**: Monitoreo real sin recargar

### Caso 2: Usuario esperando por su solicitud

1. Abre la app
2. Navega a su proyecto "Solicitudes"
3. Abre elemento "Mi Solicitud"
4. Ve en qué paso está
5. Sabe quién y cuándo se completará

✅ **Ventaja**: Transparencia en proceso

### Caso 3: Auditor revisando cumplimiento

1. Abre la app
2. Va a "Procesos Activos"
3. Observa historial de actividades
4. Toma nota de tiempos y responsables
5. Genera reporte

✅ **Ventaja**: Solo lectura garantiza integridad

---

## Tips y Trucos

### 🔄 Refrescar Datos

Haz **deslizar hacia abajo** en cualquier lista para obtener datos frescos:

```
Proyectos
├─ [Pull down to refresh] ↻
├─ Proyecto 1
├─ Proyecto 2
└─ Proyecto 3
```

### 🔗 URLs Directas (implementación futura)

Podrías compartir un link que abre directamente un diagrama:
```
procesos://design/des_456
```

### 📱 Widget Responsive

La app se adapta automaticamente a:
- 📱 Teléfono (portrait/landscape)
- 📲 Tablet
- 💻 Desktop (no recomendado)

### 🔒 Seguridad

- No puedes modificar nada (excepto ver)
- No puedes ver procesos privados si no tienes acceso
- Backend valida todos los permisos

---

¡Ahora estás listo para usar Procesos Móvil! 🚀
