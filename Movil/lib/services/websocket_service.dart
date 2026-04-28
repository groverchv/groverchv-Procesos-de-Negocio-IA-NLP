import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class WebSocketService {
  static const String baseUrl = 'wss://diagramador-de-actividades.up.railway.app/ws-bpmn';
  
  StompClient? _stompClient;
  String? _designId;
  String? _instanceId;
  
  final StreamController<ProcessUpdate> _processUpdateController = 
      StreamController<ProcessUpdate>.broadcast();
  
  final StreamController<DiagramUpdate> _diagramUpdateController = 
      StreamController<DiagramUpdate>.broadcast();
  
  final StreamController<bool> _connectionStateController = 
      StreamController<bool>.broadcast();

  Stream<ProcessUpdate> get processUpdates => _processUpdateController.stream;
  Stream<DiagramUpdate> get diagramUpdates => _diagramUpdateController.stream;
  Stream<bool> get connectionState => _connectionStateController.stream;

  bool get isConnected => _stompClient?.connected ?? false;

  void connect(String designId, {String? instanceId}) {
    if (isConnected && _designId == designId && _instanceId == instanceId) return;
    
    _designId = designId;
    _instanceId = instanceId;

    if (_stompClient != null) {
      _stompClient!.deactivate();
    }

    _stompClient = StompClient(
      config: StompConfig(
        url: baseUrl,
        onConnect: (frame) => _onConnect(frame),
        onWebSocketError: (dynamic error) => _onWebSocketError(error),
        onDisconnect: (frame) {
          _connectionStateController.add(false);
        },
        stompConnectHeaders: {
          'accept-version': '1.1,1.0',
        },
        heartbeatOutgoing: const Duration(seconds: 10),
        heartbeatIncoming: const Duration(seconds: 10),
      ),
    );

    _stompClient!.activate();
  }

  void _onConnect(StompFrame frame) {
    _connectionStateController.add(true);
    
    if (_designId != null) {
      _stompClient!.subscribe(
        destination: '/topic/modeler/$_designId',
        callback: (frame) {
          if (frame.body != null) {
            _diagramUpdateController.add(DiagramUpdate.fromJson(jsonDecode(frame.body!)));
          }
        },
      );
    }

    if (_instanceId != null) {
      _stompClient!.subscribe(
        destination: '/topic/instance/$_instanceId',
        callback: (frame) {
          if (frame.body != null) {
            print('STOMP DATA RECEIVED: ${frame.body}');
            try {
              final Map<String, dynamic> data = jsonDecode(frame.body!);
              _processUpdateController.add(ProcessUpdate.fromJson(data));
            } catch (e) {
              print('Error parseando JSON de STOMP: $e');
            }
          }
        },
      );
    }
  }

  void _onWebSocketError(dynamic error) {
    _connectionStateController.add(false);
  }

  void disconnect() {
    _stompClient?.deactivate();
    _stompClient = null;
    _connectionStateController.add(false);
  }
}

class ProcessUpdate {
  final String id;
  final String status;
  final List<ActivityUpdate> activities;
  final Map<String, dynamic> variables;

  ProcessUpdate({required this.id, required this.status, required this.activities, required this.variables});

  factory ProcessUpdate.fromJson(Map<String, dynamic> json) {
    return ProcessUpdate(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'ACTIVE',
      activities: (json['activities'] as List?)?.map((a) => ActivityUpdate.fromJson(a)).toList() ?? [],
      variables: json['variables'] ?? {},
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

  ActivityUpdate({required this.nodeId, required this.nodeLabel, required this.nodeType, required this.status, this.assignedTo, required this.formData, this.startedAt, this.completedAt});

  factory ActivityUpdate.fromJson(Map<String, dynamic> json) {
    return ActivityUpdate(
      nodeId: (json['nodeId'] ?? json['id'] ?? '').toString(),
      nodeLabel: json['nodeLabel'] ?? '',
      nodeType: json['nodeType'] ?? '',
      status: (json['status'] ?? 'PENDING').toString(),
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
  DiagramUpdate({required this.nodes, required this.edges});
  factory DiagramUpdate.fromJson(Map<String, dynamic> json) => DiagramUpdate(nodes: json['nodes'] ?? [], edges: json['edges'] ?? []);
}
