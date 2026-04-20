import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import 'dart:async';

class WebSocketService {
  static const String baseUrl = 'ws://10.0.2.2:8080/ws-bpmn';
  
  WebSocketChannel? _channel;
  late String _userId;
  late String _designId;
  
  final StreamController<ProcessUpdate> _processUpdateController = 
      StreamController<ProcessUpdate>.broadcast();
  
  final StreamController<DiagramUpdate> _diagramUpdateController = 
      StreamController<DiagramUpdate>.broadcast();
  
  final StreamController<int> _connectedCountController = 
      StreamController<int>.broadcast();

  Stream<ProcessUpdate> get processUpdates => _processUpdateController.stream;
  Stream<DiagramUpdate> get diagramUpdates => _diagramUpdateController.stream;
  Stream<int> get connectedCount => _connectedCountController.stream;

  bool get isConnected => _channel != null;

  WebSocketService() {
    _userId = 'user_mobile_${DateTime.now().millisecondsSinceEpoch}';
  }

  void connect(String designId) {
    _designId = designId;
    
    try {
      _channel = WebSocketChannel.connect(Uri.parse(baseUrl));
      
      _channel?.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onError: (error) {
          print('WebSocket error: $error');
          _processUpdateController.addError(error);
        },
        onDone: () {
          print('WebSocket desconectado');
          _channel = null;
        },
      );

      // Enviar suscripción a actualizaciones del diagrama
      _sendSubscription('/app/modeler/$designId');
      
      // Enviar suscripción a actualizaciones de presencia
      _sendSubscription('/app/presence/$designId');
      
      // Unirse al canal de presencia
      _joinPresence();
    } catch (e) {
      print('Error conectando WebSocket: $e');
      _processUpdateController.addError(e);
    }
  }

  void _sendSubscription(String destination) {
    if (_channel == null) return;
    
    final message = {
      'command': 'SUBSCRIBE',
      'id': DateTime.now().millisecondsSinceEpoch,
      'destination': destination,
    };
    
    _channel!.sink.add(jsonEncode(message));
  }

  void _joinPresence() {
    if (_channel == null) return;
    
    final message = {
      'action': 'join',
      'userId': _userId,
      'designId': _designId,
    };
    
    _channel!.sink.add(jsonEncode(message));
  }

  void _handleMessage(dynamic message) {
    try {
      final data = jsonDecode(message is String ? message : message.toString());
      
      // Actualización de diagrama (BPMN)
      if (data.containsKey('nodes') && data.containsKey('edges')) {
        _diagramUpdateController.add(
          DiagramUpdate.fromJson(data),
        );
      }
      
      // Actualización de proceso
      if (data.containsKey('activities')) {
        _processUpdateController.add(
          ProcessUpdate.fromJson(data),
        );
      }
      
      // Actualización de presencia
      if (data.containsKey('count')) {
        _connectedCountController.add(data['count'] as int);
      }
    } catch (e) {
      print('Error procesando mensaje WebSocket: $e');
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    disconnect();
    _processUpdateController.close();
    _diagramUpdateController.close();
    _connectedCountController.close();
  }
}

class ProcessUpdate {
  final String id;
  final String status;
  final List<ActivityUpdate> activities;
  final Map<String, dynamic> variables;
  final String? completedAt;

  ProcessUpdate({
    required this.id,
    required this.status,
    required this.activities,
    required this.variables,
    this.completedAt,
  });

  factory ProcessUpdate.fromJson(Map<String, dynamic> json) {
    return ProcessUpdate(
      id: json['id'] ?? '',
      status: json['status'] ?? 'ACTIVE',
      activities: (json['activities'] as List?)
              ?.map((a) => ActivityUpdate.fromJson(a))
              .toList() ??
          [],
      variables: json['variables'] ?? {},
      completedAt: json['completedAt'],
    );
  }
}

class ActivityUpdate {
  final String nodeId;
  final String nodeLabel;
  final String nodeType;
  final String status;
  final String? assignedTo;
  final Map<String, dynamic> formData;
  final String? startedAt;
  final String? completedAt;

  ActivityUpdate({
    required this.nodeId,
    required this.nodeLabel,
    required this.nodeType,
    required this.status,
    this.assignedTo,
    required this.formData,
    this.startedAt,
    this.completedAt,
  });

  factory ActivityUpdate.fromJson(Map<String, dynamic> json) {
    return ActivityUpdate(
      nodeId: json['nodeId'] ?? '',
      nodeLabel: json['nodeLabel'] ?? '',
      nodeType: json['nodeType'] ?? '',
      status: json['status'] ?? 'PENDING',
      assignedTo: json['assignedTo'],
      formData: json['formData'] ?? {},
      startedAt: json['startedAt'],
      completedAt: json['completedAt'],
    );
  }
}

class DiagramUpdate {
  final List<dynamic> nodes;
  final List<dynamic> edges;
  final String? version;

  DiagramUpdate({
    required this.nodes,
    required this.edges,
    this.version,
  });

  factory DiagramUpdate.fromJson(Map<String, dynamic> json) {
    return DiagramUpdate(
      nodes: json['nodes'] ?? [],
      edges: json['edges'] ?? [],
      version: json['version'],
    );
  }
}
