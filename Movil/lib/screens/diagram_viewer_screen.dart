import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../models/types.dart' as types;

class DiagramViewerScreen extends StatefulWidget {
  final String designId;

  const DiagramViewerScreen({super.key, required this.designId});

  @override
  State<DiagramViewerScreen> createState() => _DiagramViewerScreenState();
}

class _DiagramViewerScreenState extends State<DiagramViewerScreen> {
  // State
  types.Modeling? _currentModeling;
  types.ProcessInstance? _selectedProcess;
  String? _selectedNodeId;
  bool _isLoading = true;
  String? _error;

  // Subscriptions
  StreamSubscription? _diagramSub;
  StreamSubscription? _processSub;

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    final api = Provider.of<ApiService>(context, listen: false);
    final ws = Provider.of<WebSocketService>(context, listen: false);

    try {
      // 1. Cargar datos iniciales
      final modeling = await api.getModeling(widget.designId);
      final processes = await api.getProcessInstances(widget.designId);
      
      if (!mounted) return;

      setState(() {
        _currentModeling = modeling;
        if (processes.isNotEmpty) {
            // Ordenar por fecha de inicio descendente (la más nueva primero)
            processes.sort((a, b) {
              final dateA = DateTime.tryParse(a.startedAt ?? '') ?? DateTime(2000);
              final dateB = DateTime.tryParse(b.startedAt ?? '') ?? DateTime(2000);
              return dateB.compareTo(dateA);
            });
            
            _selectedProcess = processes.first;
            print('DEBUG: Encontradas ${processes.length} instancias. Seleccionada la más nueva: ${_selectedProcess?.id}');
        }
        _isLoading = false;
      });

      // 2. Conectar WebSockets para actualizaciones en vivo con el ID correcto
      if (_selectedProcess != null) {
        ws.connect(widget.designId, instanceId: _selectedProcess!.id);
      } else {
        ws.connect(widget.designId);
      }
      
      _diagramSub = ws.diagramUpdates.listen((update) {
        if (!mounted) return;
        setState(() {
          // Actualizar nodos y edges manteniendo el ID de modeling
          _currentModeling = types.Modeling(
            id: _currentModeling?.id,
            nodes: update.nodes.map((n) => types.NodeData.fromJson(n)).toList(),
            edges: update.edges.map((e) => types.EdgeData.fromJson(e)).toList(),
          );
        });
      });

      _processSub = ws.processUpdates.listen((update) {
        print('UI: Recibida actualización de proceso para ID: ${update.id}');
        if (!mounted) return;
        
        // Forzamos la actualización si es el proceso actual
        if (_selectedProcess?.id == update.id) {
          setState(() {
            _selectedProcess = types.ProcessInstance(
               id: update.id,
               designId: _selectedProcess!.designId,
               modelingId: _selectedProcess!.modelingId,
               projectId: _selectedProcess!.projectId,
               designName: _selectedProcess!.designName,
               startedBy: _selectedProcess!.startedBy,
               status: update.status,
               activities: update.activities.map((a) => types.ActivityInstance(
                 nodeId: a.nodeId,
                 nodeLabel: a.nodeLabel,
                 nodeType: a.nodeType,
                 status: a.status,
                 formData: a.formData,
                 assignedTo: a.assignedTo,
                 startedAt: a.startedAt,
                 completedAt: a.completedAt,
               )).toList(),
               variables: update.variables,
               startedAt: _selectedProcess!.startedAt,
               completedAt: update.status == 'COMPLETED' ? DateTime.now().toIso8601String() : null,
            );
          });
        }
      });

    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _diagramSub?.cancel();
    _processSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            ),
          ),
          child: const Center(
            child: CircularProgressIndicator(color: Colors.blueAccent),
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Error')),
        body: _buildErrorWidget(_error!),
      );
    }

    if (_currentModeling == null || _selectedProcess == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sin datos')),
        body: const Center(child: Text('No hay información disponible')),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildSliverAppBar(),
          SliverToBoxAdapter(
            child: _buildProcessHeader(),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 100),
            sliver: _buildTimelineList(),
          ),
        ],
      ),
      bottomSheet: _selectedNodeId == null ? null : _buildModernDetailSheet(),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 120.0,
      floating: false,
      pinned: true,
      elevation: 0,
      backgroundColor: const Color(0xFF0F172A),
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          _selectedProcess?.designName ?? 'Diagrama',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0F172A), Color(0xFF334155)],
            ),
          ),
        ),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
        onPressed: () => Navigator.pop(context),
      ),
      actions: [
        StreamBuilder<bool>(
          stream: Provider.of<WebSocketService>(context, listen: false).connectionState,
          initialData: Provider.of<WebSocketService>(context, listen: false).isConnected,
          builder: (context, snapshot) {
            final isConnected = snapshot.data ?? false;
            return Container(
              margin: const EdgeInsets.only(right: 16, top: 12, bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: (isConnected ? Colors.green : Colors.red).withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: (isConnected ? Colors.greenAccent : Colors.redAccent).withOpacity(0.5)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isConnected ? Icons.wifi_tethering : Icons.wifi_tethering_off, 
                    color: isConnected ? Colors.greenAccent : Colors.redAccent, 
                    size: 14
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isConnected ? 'LIVE' : 'OFFLINE',
                    style: TextStyle(
                      color: isConnected ? Colors.greenAccent : Colors.redAccent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            );
          }
        ),
      ],
    );
  }

  Widget _buildProcessHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'HOJA DE RUTA',
            style: TextStyle(
              color: Color(0xFF64748B),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                'Progreso del proceso',
                style: TextStyle(
                  color: Colors.blueGrey.shade900,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              _buildStatusBadge(_selectedProcess!.status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _buildTimelineList() {
    final orderedNodes = _buildOrderedNodes(_currentModeling!.nodes);
    
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final node = orderedNodes[index];
          final activity = _activityForNode(_selectedProcess!, node.id);
          final isFirst = index == 0;
          final isLast = index == orderedNodes.length - 1;
          final isSelected = _selectedNodeId == node.id;

          return IntrinsicHeight(
            child: Row(
              children: [
                _buildTimelineIndicator(
                  status: activity?.status ?? 'PENDING',
                  isFirst: isFirst,
                  isLast: isLast,
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: _buildActivityCard(
                      node: node,
                      activity: activity,
                      isSelected: isSelected,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        childCount: orderedNodes.length,
      ),
    );
  }

  Widget _buildTimelineIndicator({
    required String status,
    required bool isFirst,
    required bool isLast,
  }) {
    final color = _getStatusColor(status);
    final isActive = status == 'IN_PROCESS' || status == 'IN_REVIEW';
    final isDone = status == 'FINISHED' || status == 'COMPLETED';

    return Column(
      children: [
        if (!isFirst)
          Container(
            width: 2,
            height: 20,
            color: Colors.grey.shade300,
          ),
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isDone ? color : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(
              color: isDone ? color : (isActive ? color : Colors.grey.shade300),
              width: 3,
            ),
            boxShadow: isActive ? [
              BoxShadow(
                color: color.withOpacity(0.4),
                blurRadius: 10,
                spreadRadius: 2,
              )
            ] : null,
          ),
          child: Center(
            child: isDone 
              ? const Icon(Icons.check, size: 18, color: Colors.white)
              : (isActive ? Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ) : null),
          ),
        ),
        if (!isLast)
          Expanded(
            child: Container(
              width: 2,
              color: Colors.grey.shade300,
            ),
          ),
      ],
    );
  }

  Widget _buildActivityCard({
    required types.NodeData node,
    required types.ActivityInstance? activity,
    required bool isSelected,
  }) {
    final status = activity?.status ?? 'PENDING';
    final color = _getStatusColor(status);
    
    return GestureDetector(
      onTap: () {
        setState(() => _selectedNodeId = node.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.white.withOpacity(0.6),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected ? color : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected 
                ? color.withOpacity(0.1) 
                : Colors.black.withOpacity(0.03),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      node.label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 2,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: isSelected ? Colors.black : Colors.blueGrey.shade700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.person_outline, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          node.responsible ?? 'Sin asignar',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            _buildMiniStatus(status),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniStatus(String status) {
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _statusLabel(status),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _buildModernDetailSheet() {
    final node = _currentModeling!.nodes.firstWhere(
      (n) => n.id == _selectedNodeId, 
      orElse: () => _currentModeling!.nodes.first,
    );
    final activity = _activityForNode(_selectedProcess!, node.id);
    final color = _getStatusColor(activity?.status ?? 'PENDING');

    return Container(
      height: 380,
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 40,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              node.label,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              'Tipo: ${node.type.toUpperCase()}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.grey.shade500,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => _selectedNodeId = null),
                        icon: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close_rounded, color: Colors.blueGrey, size: 20),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'REQUISITOS DEL PASO',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF64748B),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildFormList(node, activity),
                  const SizedBox(height: 24),
                  if (activity?.status == 'IN_PROCESS')
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(
                          backgroundColor: color,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: const Text(
                          'COMPLETAR ACTIVIDAD',
                          style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormList(types.NodeData node, types.ActivityInstance? activity) {
    final forms = node.forms ?? [];
    if (forms.isEmpty) {
      return Text(
        'No se requieren datos para este paso.',
        style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
      );
    }

    return Column(
      children: forms.map((f) {
        final val = activity?.formData[f.label];
        final isFilled = val != null && val.toString().isNotEmpty;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Icon(
                isFilled ? Icons.check_circle : Icons.circle_outlined,
                color: isFilled ? Colors.green : Colors.grey.shade400,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  f.label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isFilled ? Colors.blueGrey.shade900 : Colors.blueGrey.shade400,
                  ),
                ),
              ),
              if (isFilled)
                Text(
                  val.toString(),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blueAccent),
                ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // --- Helper Methods ---

  List<types.NodeData> _buildOrderedNodes(List<types.NodeData> nodes) {
    // Filtrar solo actividades y eventos relevantes para el roadmap
    final relevant = nodes.where((n) => n.type != 'swimlane' && n.type != 'note').toList();
    relevant.sort((a, b) {
      int cmp = a.y.compareTo(b.y);
      if (cmp == 0) cmp = a.x.compareTo(b.x);
      return cmp;
    });
    return relevant;
  }

  types.ActivityInstance? _pickCurrentActivity(types.ProcessInstance process) {
    for (var status in ['IN_PROCESS', 'IN_REVIEW', 'PENDING']) {
      try {
        return process.activities.firstWhere((a) => a.status.toUpperCase() == status);
      } catch (_) {}
    }
    return process.activities.isNotEmpty ? process.activities.first : null;
  }

  types.ActivityInstance? _activityForNode(types.ProcessInstance process, String nodeId) {
    try {
      return process.activities.firstWhere((a) => a.nodeId == nodeId);
    } catch (_) {
      return null;
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'FINISHED':
      case 'COMPLETED':
        return const Color(0xFF10B981);
      case 'IN_PROCESS':
      case 'IN_REVIEW':
        return const Color(0xFF3B82F6);
      case 'PENDING':
        return const Color(0xFF94A3B8);
      default:
        return const Color(0xFFEF4444);
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'IN_PROCESS': return 'En proceso';
      case 'IN_REVIEW': return 'Revisión';
      case 'FINISHED':
      case 'COMPLETED': return 'Completado';
      default: return 'Pendiente';
    }
  }

  Widget _buildErrorWidget(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 48),
          const SizedBox(height: 16),
          Text('Error: $error'),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => _initializeData(),
            child: const Text('Reintentar'),
          ),
        ],
      ),
    );
  }
}
