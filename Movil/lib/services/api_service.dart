import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/types.dart';

class ApiService {
  static const String _apiBaseEnv = String.fromEnvironment('API_BASE_URL');
  static Usuario? currentUser;

  String get baseUrl {
    if (_apiBaseEnv.isNotEmpty) {
      return _apiBaseEnv;
    }

    // Web en localhost y Android emulator usan hosts distintos.
    if (kIsWeb) {
      return 'http://localhost:8080/api';
    } else {
      return 'http://10.0.2.2:8080/api';
    }
  }

  Future<http.Response> _get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    return http.get(uri).timeout(
      const Duration(seconds: 12),
      onTimeout: () => throw Exception('Timeout conectando a $uri'),
    );
  }

  Future<List<Project>> getProjects() async {
    try {
      final response = await _get('/projects');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.map((json) => Project.fromJson(json)).toList();
      } else {
        throw Exception('Error cargando proyectos: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Project> getProjectById(String projectId) async {
    try {
      final response = await _get('/projects/$projectId');

      if (response.statusCode == 200) {
        return Project.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Error cargando proyecto: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Design>> getDesignsByProject(String projectId) async {
    try {
      final response = await _get('/designs/project/$projectId');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.map((json) => Design.fromJson(json)).toList();
      } else {
        throw Exception('Error cargando diseños: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Design> getDesignById(String designId) async {
    try {
      final response = await _get('/designs/$designId');

      if (response.statusCode == 200) {
        return Design.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Error cargando diseño: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Modeling> getModeling(String designId) async {
    try {
      final response = await _get('/designs/$designId/modeling');

      if (response.statusCode == 200) {
        return Modeling.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Error cargando diagrama: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<ProcessInstance>> getProcessInstances(String designId) async {
    try {
      final response = await _get('/instances/design/$designId');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.map((json) => ProcessInstance.fromJson(json)).toList();
      } else {
        throw Exception('Error cargando instancias: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<ProcessInstance> getProcessInstance(String instanceId) async {
    try {
      final response = await _get('/instances/$instanceId');

      if (response.statusCode == 200) {
        return ProcessInstance.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Error cargando instancia: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<ProcessInstance>> getActiveInstances() async {
    try {
      final response = await _get('/instances/active');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.map((json) => ProcessInstance.fromJson(json)).toList();
      } else {
        throw Exception('Error cargando instancias activas: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Obtiene los diseños habilitados para un cliente por el Funcionario.
  /// Retorna la lista de AsignacionProceso con habilitado=true.
  Future<List<Map<String, dynamic>>> getDesignosHabilitados(String clienteId) async {
    try {
      final response = await _get('/asignaciones/cliente/$clienteId/habilitados');
      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.cast<Map<String, dynamic>>();
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  /// Obtiene instancias de procesos solo para los diseños habilitados del cliente.
  /// Combina getDesignosHabilitados + getActiveInstances filtrando por designId.
  Future<List<ProcessInstance>> getActiveInstancesParaCliente(String clienteId) async {
    try {
      // 1. Obtener diseños habilitados para este cliente
      final asignaciones = await getDesignosHabilitados(clienteId);
      final designIdsHabilitados = asignaciones.map((a) => a['designId'] as String).toSet();

      if (designIdsHabilitados.isEmpty) return [];

      // 2. Obtener todas las instancias activas
      final todasInstancias = await getActiveInstances();

      // 3. Filtrar solo las que correspondan a diseños habilitados
      return todasInstancias
          .where((inst) => designIdsHabilitados.contains(inst.designId))
          .toList();
    } catch (e) {
      return [];
    }
  }

  // ====================================================================
  // NUEVOS SERVICIOS DE IA LOCAL Y ELEVENLABS PARA MÓVIL
  // ====================================================================

  /// Envía texto al microservicio de IA local (Groq NLP) para procesar la intención del cliente
  Future<Map<String, dynamic>> nlpProcesarIntencion(String texto) async {
    // 10.0.2.2 es el alias IP para localhost del PC desde el emulador de Android
    final String iaUrl = kIsWeb ? 'http://localhost:8000' : 'http://10.0.2.2:8000';
    try {
      final response = await http.post(
        Uri.parse('$iaUrl/api/v1/nlp/chat-asesor'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'messages': [
            {'role': 'user', 'content': texto}
          ]
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Error en IA NLP: ${response.statusCode}');
      }
    } catch (e) {
      // Fallback offline si la IA no está activa
      return {
        'reply': 'Hola, soy tu asistente local. En este momento estoy operando en modo offline y he registrado tu requerimiento: "$texto". Procesaremos tu solicitud tan pronto recuperemos conexión de red completa.'
      };
    }
  }

  /// Genera audio usando ElevenLabs a través del microservicio de IA
  Future<String> ttsGenerarVoz(String texto) async {
    final String iaUrl = kIsWeb ? 'http://localhost:8000' : 'http://10.0.2.2:8000';
    try {
      final response = await http.post(
        Uri.parse('$iaUrl/api/v1/tts/generar-voz'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'text': texto
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        return data['audio_base64'] ?? '';
      } else {
        throw Exception('Error en ElevenLabs TTS: ${response.statusCode}');
      }
    } catch (e) {
      print('ElevenLabs Offline/Error fallback: $e');
      return '';
    }
  }

  Future<Usuario> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/usuarios/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return Usuario.fromJson(jsonDecode(response.body));
      } else {
        final Map<String, dynamic> err = jsonDecode(response.body);
        throw Exception(err['message'] ?? 'Credenciales incorrectas');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Usuario> register(String nombre, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/usuarios/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'nombre': nombre,
          'email': email,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return Usuario.fromJson(jsonDecode(response.body));
      } else {
        final Map<String, dynamic> err = jsonDecode(response.body);
        throw Exception(err['message'] ?? 'Error registrando usuario');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> solicitarAccesoDiseno(
      String designId, String designNombre, String projectId, String projectNombre, String clienteId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/asignaciones/solicitar'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'clienteId': clienteId,
          'designId': designId,
          'designNombre': designNombre,
          'projectId': projectId,
          'projectNombre': projectNombre,
        }),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Error al solicitar acceso: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<ProcessInstance>> getInstancesPorDiseno(String designId) async {
    try {
      final response = await _get('/instances/design/$designId');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.map((json) => ProcessInstance.fromJson(json)).toList();
      } else {
        throw Exception('Error cargando instancias: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<ProcessInstance> startProcess(String designId, String userId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/instances/start'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'designId': designId,
          'userId': userId,
        }),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200 || response.statusCode == 201) {
        return ProcessInstance.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Error iniciando proceso: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Resetea el acceso (habilitado=false, solicitado=false) tras iniciar un proceso.
  /// El cliente deberá solicitar nuevamente para la siguiente ejecución.
  Future<void> deshabilitarAccesoDiseno(String designId, String clienteId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/asignaciones/deshabilitar'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'clienteId': clienteId,
          'designId': designId,
        }),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode != 200) {
        // Non-critical: log but don't throw — process was already started
        debugPrint('Warning: no se pudo deshabilitar la asignación (${response.statusCode})');
      }
    } catch (e) {
      debugPrint('Warning: error al deshabilitar asignación: $e');
    }
  }

  Future<List<Map<String, dynamic>>> getAssignmentsForProject(String clienteId, String projectId) async {
    try {
      final response = await _get('/asignaciones/cliente/$clienteId/proyecto/$projectId');
      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        return jsonList.cast<Map<String, dynamic>>();
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getAsignacionesPorProyecto(String clienteId, String projectId) async {
    return getAssignmentsForProject(clienteId, projectId);
  }
}

