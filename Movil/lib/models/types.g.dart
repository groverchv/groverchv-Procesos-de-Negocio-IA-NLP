// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'types.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Project _$ProjectFromJson(Map<String, dynamic> json) => Project(
      id: json['id'] as String?,
      nombre: json['nombre'] as String,
      descripcion: json['descripcion'] as String,
      fechaCreacion: json['fechaCreacion'] as String?,
      ultimaActualizacion: json['ultimaActualizacion'] as String?,
      designIds: (json['designIds'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$ProjectToJson(Project instance) => <String, dynamic>{
      'id': instance.id,
      'nombre': instance.nombre,
      'descripcion': instance.descripcion,
      'fechaCreacion': instance.fechaCreacion,
      'ultimaActualizacion': instance.ultimaActualizacion,
      'designIds': instance.designIds,
    };

Design _$DesignFromJson(Map<String, dynamic> json) => Design(
      id: json['id'] as String?,
      nombre: json['nombre'] as String,
      projectId: json['projectId'] as String,
      modelingId: json['modelingId'] as String?,
      fechaCreacion: json['fechaCreacion'] as String?,
      ultimaActualizacion: json['ultimaActualizacion'] as String?,
      estado: json['estado'] as String,
      layoutType: json['layoutType'] as String?,
      locked: json['locked'] as bool?,
      lockedBy: json['lockedBy'] as String?,
    );

Map<String, dynamic> _$DesignToJson(Design instance) => <String, dynamic>{
      'id': instance.id,
      'nombre': instance.nombre,
      'projectId': instance.projectId,
      'modelingId': instance.modelingId,
      'fechaCreacion': instance.fechaCreacion,
      'ultimaActualizacion': instance.ultimaActualizacion,
      'estado': instance.estado,
      'layoutType': instance.layoutType,
      'locked': instance.locked,
      'lockedBy': instance.lockedBy,
    };

NodeData _$NodeDataFromJson(Map<String, dynamic> json) => NodeData(
      id: json['id'] as String,
      type: json['type'] as String,
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      label: json['label'] as String,
      policy: json['policy'] as String?,
      width: (json['width'] as num?)?.toDouble(),
      height: (json['height'] as num?)?.toDouble(),
      fontSize: (json['fontSize'] as num?)?.toDouble(),
      parentId: json['parentId'] as String?,
      forms: (json['forms'] as List<dynamic>?)
          ?.map((e) => Form.fromJson(e as Map<String, dynamic>))
          .toList(),
      responsible: json['responsible'] as String?,
    );

Map<String, dynamic> _$NodeDataToJson(NodeData instance) => <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'x': instance.x,
      'y': instance.y,
      'label': instance.label,
      'policy': instance.policy,
      'width': instance.width,
      'height': instance.height,
      'fontSize': instance.fontSize,
      'parentId': instance.parentId,
      'forms': instance.forms,
      'responsible': instance.responsible,
    };

EdgeData _$EdgeDataFromJson(Map<String, dynamic> json) => EdgeData(
      id: json['id'] as String,
      source: json['source'] as String,
      target: json['target'] as String,
      label: json['label'] as String?,
      color: json['color'] as String?,
      style: json['style'] as String?,
      strokeWidth: (json['strokeWidth'] as num?)?.toDouble(),
      opacity: (json['opacity'] as num?)?.toDouble(),
      waypoints: (json['waypoints'] as List<dynamic>?)
          ?.map((e) => WayPoint.fromJson(e as Map<String, dynamic>))
          .toList(),
      forms: (json['forms'] as List<dynamic>?)
          ?.map((e) => Form.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$EdgeDataToJson(EdgeData instance) => <String, dynamic>{
      'id': instance.id,
      'source': instance.source,
      'target': instance.target,
      'label': instance.label,
      'color': instance.color,
      'style': instance.style,
      'strokeWidth': instance.strokeWidth,
      'opacity': instance.opacity,
      'waypoints': instance.waypoints,
      'forms': instance.forms,
    };

WayPoint _$WayPointFromJson(Map<String, dynamic> json) => WayPoint(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
    );

Map<String, dynamic> _$WayPointToJson(WayPoint instance) => <String, dynamic>{
      'x': instance.x,
      'y': instance.y,
    };

Form _$FormFromJson(Map<String, dynamic> json) => Form(
      id: json['id'] as String?,
      modelingId: json['modelingId'] as String,
      label: json['label'] as String,
      type: json['type'] as String,
      defaultValue: json['defaultValue'] as String?,
      required: json['required'] as bool,
      estado: json['estado'] as String?,
      options: (json['options'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$FormToJson(Form instance) => <String, dynamic>{
      'id': instance.id,
      'modelingId': instance.modelingId,
      'label': instance.label,
      'type': instance.type,
      'defaultValue': instance.defaultValue,
      'required': instance.required,
      'estado': instance.estado,
      'options': instance.options,
    };

Modeling _$ModelingFromJson(Map<String, dynamic> json) => Modeling(
      id: json['id'] as String?,
      nodes: (json['nodes'] as List<dynamic>)
          .map((e) => NodeData.fromJson(e as Map<String, dynamic>))
          .toList(),
      edges: (json['edges'] as List<dynamic>)
          .map((e) => EdgeData.fromJson(e as Map<String, dynamic>))
          .toList(),
      version: json['version'] as String?,
      estado: json['estado'] as String?,
      senderId: json['senderId'] as String?,
      timestamp: json['timestamp'] as int?,
      isDragPulse: json['isDragPulse'] as bool?,
    );

Map<String, dynamic> _$ModelingToJson(Modeling instance) => <String, dynamic>{
      'id': instance.id,
      'nodes': instance.nodes,
      'edges': instance.edges,
      'version': instance.version,
      'estado': instance.estado,
      'senderId': instance.senderId,
      'timestamp': instance.timestamp,
      'isDragPulse': instance.isDragPulse,
    };

ActivityInstance _$ActivityInstanceFromJson(Map<String, dynamic> json) =>
    ActivityInstance(
      nodeId: json['nodeId'] as String,
      nodeLabel: json['nodeLabel'] as String,
      nodeType: json['nodeType'] as String,
      status: json['status'] as String,
      assignedTo: json['assignedTo'] as String?,
      formData: json['formData'] as Map<String, dynamic>,
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
    );

Map<String, dynamic> _$ActivityInstanceToJson(ActivityInstance instance) =>
    <String, dynamic>{
      'nodeId': instance.nodeId,
      'nodeLabel': instance.nodeLabel,
      'nodeType': instance.nodeType,
      'status': instance.status,
      'assignedTo': instance.assignedTo,
      'formData': instance.formData,
      'startedAt': instance.startedAt,
      'completedAt': instance.completedAt,
    };

ProcessInstance _$ProcessInstanceFromJson(Map<String, dynamic> json) =>
    ProcessInstance(
      id: json['id'] as String?,
      designId: json['designId'] as String,
      modelingId: json['modelingId'] as String,
      projectId: json['projectId'] as String,
      designName: json['designName'] as String,
      startedBy: json['startedBy'] as String,
      status: json['status'] as String,
      activities: (json['activities'] as List<dynamic>)
          .map((e) => ActivityInstance.fromJson(e as Map<String, dynamic>))
          .toList(),
      variables: json['variables'] as Map<String, dynamic>,
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
    );

Map<String, dynamic> _$ProcessInstanceToJson(ProcessInstance instance) =>
    <String, dynamic>{
      'id': instance.id,
      'designId': instance.designId,
      'modelingId': instance.modelingId,
      'projectId': instance.projectId,
      'designName': instance.designName,
      'startedBy': instance.startedBy,
      'status': instance.status,
      'activities': instance.activities,
      'variables': instance.variables,
      'startedAt': instance.startedAt,
      'completedAt': instance.completedAt,
    };
