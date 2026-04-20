import 'package:json_serializable/json_serializable.dart';

part 'types.g.dart';

// ═══ PROJECT & DESIGN MODELS ═══


class Project {
  final String? id;
  final String nombre;
  final String descripcion;
  final String? fechaCreacion;
  final String? ultimaActualizacion;
  final List<String>? designIds;

  Project({
    this.id,
    required this.nombre,
    required this.descripcion,
    this.fechaCreacion,
    this.ultimaActualizacion,
    this.designIds,
  });

  factory Project.fromJson(Map<String, dynamic> json) => _$ProjectFromJson(json);
  Map<String, dynamic> toJson() => _$ProjectToJson(this);
}


class Design {
  final String? id;
  final String nombre;
  final String projectId;
  final String? modelingId;
  final String? fechaCreacion;
  final String? ultimaActualizacion;
  final String estado;
  final String? layoutType;
  final bool? locked;
  final String? lockedBy;

  Design({
    this.id,
    required this.nombre,
    required this.projectId,
    this.modelingId,
    this.fechaCreacion,
    this.ultimaActualizacion,
    required this.estado,
    this.layoutType,
    this.locked,
    this.lockedBy,
  });

  factory Design.fromJson(Map<String, dynamic> json) => _$DesignFromJson(json);
  Map<String, dynamic> toJson() => _$DesignToJson(this);
}

// ═══ DIAGRAM MODELS ═══


class NodeData {
  final String id;
  final String type;
  final double x;
  final double y;
  final String label;
  final String? policy;
  final double? width;
  final double? height;
  final double? fontSize;
  final String? parentId;
  final List<Form>? forms;
  final String? responsible;

  NodeData({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
    required this.label,
    this.policy,
    this.width,
    this.height,
    this.fontSize,
    this.parentId,
    this.forms,
    this.responsible,
  });

  factory NodeData.fromJson(Map<String, dynamic> json) => _$NodeDataFromJson(json);
  Map<String, dynamic> toJson() => _$NodeDataToJson(this);
}


class EdgeData {
  final String id;
  final String source;
  final String target;
  final String? label;
  final String? color;
  final String? style;
  final double? strokeWidth;
  final double? opacity;
  final List<WayPoint>? waypoints;
  final List<Form>? forms;

  EdgeData({
    required this.id,
    required this.source,
    required this.target,
    this.label,
    this.color,
    this.style,
    this.strokeWidth,
    this.opacity,
    this.waypoints,
    this.forms,
  });

  factory EdgeData.fromJson(Map<String, dynamic> json) => _$EdgeDataFromJson(json);
  Map<String, dynamic> toJson() => _$EdgeDataToJson(this);
}


class WayPoint {
  final double x;
  final double y;

  WayPoint({required this.x, required this.y});

  factory WayPoint.fromJson(Map<String, dynamic> json) => _$WayPointFromJson(json);
  Map<String, dynamic> toJson() => _$WayPointToJson(this);
}


class Form {
  final String? id;
  final String modelingId;
  final String label;
  final String type;
  final String? defaultValue;
  final bool required;
  final String? estado;
  final List<String>? options;

  Form({
    this.id,
    required this.modelingId,
    required this.label,
    required this.type,
    this.defaultValue,
    required this.required,
    this.estado,
    this.options,
  });

  factory Form.fromJson(Map<String, dynamic> json) => _$FormFromJson(json);
  Map<String, dynamic> toJson() => _$FormToJson(this);
}


class Modeling {
  final String? id;
  final List<NodeData> nodes;
  final List<EdgeData> edges;
  final String? version;
  final String? estado;
  final String? senderId;
  final int? timestamp;
  final bool? isDragPulse;

  Modeling({
    this.id,
    required this.nodes,
    required this.edges,
    this.version,
    this.estado,
    this.senderId,
    this.timestamp,
    this.isDragPulse,
  });

  factory Modeling.fromJson(Map<String, dynamic> json) => _$ModelingFromJson(json);
  Map<String, dynamic> toJson() => _$ModelingToJson(this);
}

// ═══ WORKFLOW ENGINE MODELS ═══

enum ActivityStatus {
  pending,
  inProcess,
  inReview,
  finished,
  canceled,
  skipped,
}

enum ProcessStatus {
  active,
  completed,
  canceled,
}


class ActivityInstance {
  final String nodeId;
  final String nodeLabel;
  final String nodeType;
  final String status;
  final String? assignedTo;
  final Map<String, dynamic> formData;
  final String? startedAt;
  final String? completedAt;

  ActivityInstance({
    required this.nodeId,
    required this.nodeLabel,
    required this.nodeType,
    required this.status,
    this.assignedTo,
    required this.formData,
    this.startedAt,
    this.completedAt,
  });

  factory ActivityInstance.fromJson(Map<String, dynamic> json) =>
      _$ActivityInstanceFromJson(json);
  Map<String, dynamic> toJson() => _$ActivityInstanceToJson(this);
}


class ProcessInstance {
  final String? id;
  final String designId;
  final String modelingId;
  final String projectId;
  final String designName;
  final String startedBy;
  final String status;
  final List<ActivityInstance> activities;
  final Map<String, dynamic> variables;
  final String? startedAt;
  final String? completedAt;

  ProcessInstance({
    this.id,
    required this.designId,
    required this.modelingId,
    required this.projectId,
    required this.designName,
    required this.startedBy,
    required this.status,
    required this.activities,
    required this.variables,
    this.startedAt,
    this.completedAt,
  });

  factory ProcessInstance.fromJson(Map<String, dynamic> json) =>
      _$ProcessInstanceFromJson(json);
  Map<String, dynamic> toJson() => _$ProcessInstanceToJson(this);
}
