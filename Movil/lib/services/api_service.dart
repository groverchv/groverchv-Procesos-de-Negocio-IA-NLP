import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/types.dart';

class ApiService {
  static const String _apiBaseEnv = String.fromEnvironment('API_BASE_URL');

  String get baseUrl {
    if (_apiBaseEnv.isNotEmpty) {
      return _apiBaseEnv;
    }

    // Web en localhost y Android emulator usan hosts distintos.
    return 'https://diagramador-de-actividades.up.railway.app/api';
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
}
