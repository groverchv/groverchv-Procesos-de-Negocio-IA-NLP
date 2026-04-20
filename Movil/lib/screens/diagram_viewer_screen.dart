import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart' as types;

class DiagramViewerScreen extends StatefulWidget {
  final String designId;

  const DiagramViewerScreen({super.key, required this.designId});

  @override
  State<DiagramViewerScreen> createState() => _DiagramViewerScreenState();
}

class _DiagramViewerScreenState extends State<DiagramViewerScreen> {
  late Future<types.Modeling> _diagramFuture;
  late Future<List<types.ProcessInstance>> _processesFuture;
  types.ProcessInstance? _selectedProcess;
  String? _selectedNodeId;

  @override
  void initState() {
    super.initState();
    final api = Provider.of<ApiService>(context, listen: false);
    _diagramFuture = api.getModeling(widget.designId);
    _processesFuture = api.getProcessInstances(widget.designId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ruta del Proceso'),
      ),
      body: FutureBuilder<types.Modeling>(
        future: _diagramFuture,
        builder: (context, diagramSnapshot) {
          if (diagramSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (diagramSnapshot.hasError) {
            return _buildErrorWidget(diagramSnapshot.error.toString());
          }

          final modeling = diagramSnapshot.data;
          if (modeling == null) {
            return const Center(child: Text('No hay diagrama disponible'));
          }

          return FutureBuilder<List<types.ProcessInstance>>(
            future: _processesFuture,
            builder: (context, processSnapshot) {
              if (processSnapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (processSnapshot.hasError) {
                return _buildErrorWidget(processSnapshot.error.toString());
              }

              final processes = processSnapshot.data ?? <types.ProcessInstance>[];
              if (processes.isEmpty) {
                return const Center(child: Text('Sin procesos para este diagrama'));
              }

              var process = _selectedProcess;
              final needsReset =
                  process == null || !processes.any((p) => p.id == process?.id);
              if (needsReset) {
                final nextProcess = processes.first;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) {
                    return;
                  }
                  setState(() {
                    _selectedProcess = nextProcess;
                    _selectedNodeId = _pickCurrentActivity(nextProcess)?.nodeId;
                  });
                });
                process = nextProcess;
              }

              final activeProcess = process;
              return _buildOnlyRoadmap(modeling, activeProcess);
            },
          );
        },
      ),
    );
  }
  Widget _buildOnlyRoadmap(types.Modeling modeling, types.ProcessInstance process) {
    final orderedNodes = _buildOrderedNodes(modeling.nodes);
    final current = _pickCurrentActivity(process);

    if (_selectedNodeId == null && current != null) {
      _selectedNodeId = current.nodeId;
    }

    types.NodeData? selectedNode;
    types.ActivityInstance? selectedActivity;

    if (_selectedNodeId != null) {
      for (final node in orderedNodes) {
        if (node.id == _selectedNodeId) {
          selectedNode = node;
          selectedActivity = _activityForNode(process, node.id);
          break;
        }
      }
    }

    if (selectedNode == null && orderedNodes.isNotEmpty) {
      selectedNode = orderedNodes.first;
      selectedActivity = _activityForNode(process, selectedNode.id);
    }

    return Container(
      color: const Color(0xFFF7F8FA),
      child: Column(
        children: [
          Expanded(
            child: orderedNodes.isEmpty
                ? const Center(
                    child: Text(
                      'No hay actividades en este diagrama',
                      style: TextStyle(color: Colors.grey, fontSize: 16),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                    itemCount: orderedNodes.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final node = orderedNodes[index];
                      final activity = _activityForNode(process, node.id);
                      final selected = _selectedNodeId == node.id;

                      return _buildActivityCard(
                        node: node,
                        activity: activity,
                        selected: selected,
                        onTap: () {
                          setState(() {
                            _selectedNodeId = node.id;
                          });
                        },
                      );
                    },
                  ),
          ),
          _buildModernFormPanel(
            node: selectedNode,
            activity: selectedActivity,
            modeling: modeling,
          ),
        ],
      ),
    );
  }

  Widget _buildActivityCard({
    required types.NodeData node,
    required types.ActivityInstance? activity,
    required bool selected,
    required VoidCallback onTap,
  }) {
    final status = activity?.status ?? 'PENDING';
    final cardColor = _laneColor(status);
    final isDone = status.toUpperCase() == 'FINISHED' || status.toUpperCase() == 'COMPLETED';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? cardColor.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? cardColor : Colors.grey.shade200,
            width: selected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: cardColor.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isDone
                    ? Icons.check_circle_rounded
                    : (status == 'PENDING'
                        ? Icons.radio_button_unchecked_rounded
                        : Icons.play_circle_fill_rounded),
                color: cardColor,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    node.label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2D3142),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: cardColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _statusLabel(status),
                      style: TextStyle(
                        color: cardColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: selected ? cardColor : Colors.grey.shade400,
              size: 28,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModernFormPanel({
    required types.NodeData? node,
    required types.ActivityInstance? activity,
    required types.Modeling modeling,
  }) {
    if (node == null) return const SizedBox.shrink();

    final forms = node.forms ?? <types.Form>[];
    final prerequisites = _getPrerequisites(modeling, node.id);
    final status = activity?.status ?? 'PENDING';
    final color = _laneColor(status);

    return Container(
      height: MediaQuery.of(context).size.height * 0.42,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        children: [
          const SizedBox(height: 14),
          Container(
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    node.label,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF2D3142),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.info_outline_rounded, size: 18, color: color),
                      const SizedBox(width: 6),
                      Text(
                        'Estado: ${_statusLabel(status)}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'Prerequisitos',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF475069),
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (prerequisites.isEmpty)
                    const Text('Sin prerequisitos', style: TextStyle(color: Colors.black54))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: prerequisites
                          .map(
                            (p) => Chip(
                              label: Text(
                                p,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              backgroundColor: Colors.grey.shade100,
                              side: BorderSide.none,
                              padding: const EdgeInsets.all(8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  const SizedBox(height: 26),
                  const Text(
                    'Formulario de actividad',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF475069),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (forms.isEmpty)
                    const Text(
                      'Esta actividad no tiene campos configurados.',
                      style: TextStyle(color: Colors.black54),
                    )
                  else
                    ...forms.map((form) {
                      final value = activity?.formData[form.label];
                      final checked = value != null && value.toString().trim().isNotEmpty;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: checked ? Colors.green.shade50 : Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: checked ? Colors.green.shade100 : Colors.amber.shade100,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              checked ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                              color: checked ? Colors.green.shade600 : Colors.amber.shade700,
                              size: 26,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    form.label,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: checked ? Colors.green.shade900 : Colors.amber.shade900,
                                    ),
                                  ),
                                  if (checked) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      value.toString(),
                                      style: TextStyle(
                                        color: Colors.green.shade800,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<types.NodeData> _buildOrderedNodes(List<types.NodeData> nodes) {
    if (nodes.isEmpty) {
      return <types.NodeData>[];
    }

    final sorted = List<types.NodeData>.from(nodes)
      ..sort((a, b) {
        final byY = a.y.compareTo(b.y);
        if (byY != 0) {
          return byY;
        }
        return a.x.compareTo(b.x);
      });

    return sorted;
  }

  List<String> _getPrerequisites(types.Modeling modeling, String nodeId) {
    final sourceIds = <String>[];
    for (final edge in modeling.edges) {
      if (edge.target == nodeId) {
        sourceIds.add(edge.source);
      }
    }

    if (sourceIds.isEmpty) {
      return <String>[];
    }

    final labels = <String>[];
    for (final sourceId in sourceIds) {
      for (final node in modeling.nodes) {
        if (node.id == sourceId) {
          labels.add(node.label);
          break;
        }
      }
    }
    return labels;
  }

  types.ActivityInstance? _pickCurrentActivity(types.ProcessInstance process) {
    if (process.activities.isEmpty) {
      return null;
    }

    for (final a in process.activities) {
      if (a.status.toUpperCase() == 'IN_PROCESS') {
        return a;
      }
    }

    for (final a in process.activities) {
      if (a.status.toUpperCase() == 'IN_REVIEW') {
        return a;
      }
    }

    for (final a in process.activities) {
      if (a.status.toUpperCase() == 'PENDING') {
        return a;
      }
    }

    return process.activities.last;
  }

  types.ActivityInstance? _activityForNode(types.ProcessInstance process, String nodeId) {
    for (final a in process.activities) {
      if (a.nodeId == nodeId) {
        return a;
      }
    }
    return null;
  }

  Color _laneColor(String status) {
    switch (status.toUpperCase()) {
      case 'FINISHED':
      case 'COMPLETED':
        return const Color(0xFF2EC4B6); // Soft elegant green
      case 'IN_PROCESS':
      case 'IN_REVIEW':
        return const Color(0xFFFF9F1C); // Soft elegant orange
      case 'PENDING':
        return const Color(0xFFAAB2BD); // Neutral elegant grey for pending
      default:
        return const Color(0xFFE71D36); // Elegant red
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'IN_PROCESS':
        return 'En proceso';
      case 'IN_REVIEW':
        return 'En revisión';
      case 'FINISHED':
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELED':
        return 'Cancelada';
      case 'SKIPPED':
        return 'Omitida';
      default:
        return 'Pendiente';
    }
  }

  Widget _buildErrorWidget(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 40),
            const SizedBox(height: 8),
            Text(
              'Error: $error',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
