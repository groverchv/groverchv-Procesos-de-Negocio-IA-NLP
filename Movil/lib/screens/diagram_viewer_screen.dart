import 'dart:async';
import 'dart:io' as io;
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../models/types.dart' as types;
import 'sugerencias_ia_screen.dart';

class DiagramViewerScreen extends StatefulWidget {
  final String designId;
  final String? processInstanceId;

  const DiagramViewerScreen({super.key, required this.designId, this.processInstanceId});

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
  Map<String, dynamic> _localFormData = {};
  String? _projectName;
  String? _designName;

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
      
      String? projectName;
      String? designName;
      try {
        final design = await api.getDesignById(widget.designId);
        designName = design.nombre;
        final project = await api.getProjectById(design.projectId);
        projectName = project.nombre;
      } catch (e) {
        debugPrint('Error cargando nombres de diseno/proyecto para S3: $e');
      }
      
      if (!mounted) return;

      setState(() {
        _currentModeling = modeling;
        _projectName = projectName;
        _designName = designName;
        if (processes.isNotEmpty) {
          if (widget.processInstanceId != null) {
            try {
              _selectedProcess = processes.firstWhere((p) => p.id == widget.processInstanceId);
            } catch (_) {
              _selectedProcess = processes.first;
            }
          } else {
            // Ordenar por fecha de inicio descendente (la más nueva primero)
            processes.sort((a, b) {
              final dateA = DateTime.tryParse(a.startedAt ?? '') ?? DateTime(2000);
              final dateB = DateTime.tryParse(b.startedAt ?? '') ?? DateTime(2000);
              return dateB.compareTo(dateA);
            });
            _selectedProcess = processes.first;
          }
          print('DEBUG: Encontradas ${processes.length} instancias. Seleccionada: ${_selectedProcess?.id}');
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
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 8, left: 4),
          child: GestureDetector(
            onTap: () {
              final activeNodeText = _selectedNodeId != null
                  ? 'Tengo seleccionado el nodo con ID "$_selectedNodeId".'
                  : 'No tengo ningún nodo seleccionado.';
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (context) => SugerenciasIAScreen(
                  initialPrompt: 'Tengo abierto el progreso de mi trámite de "${_selectedProcess?.designName ?? 'Proceso'}". Su estado actual es: ${_selectedProcess?.status ?? ''}. ¿Me puedes guiar sobre qué camino tomar, cuál es el más rápido o qué requisitos necesito?',
                  extraContext: 'El usuario está visualizando el progreso en tiempo real de una instancia de proceso.\n'
                      'Diseño: ${_selectedProcess?.designName}\n'
                      'Instancia ID: ${_selectedProcess?.id}\n'
                      'Estado: ${_selectedProcess?.status}\n'
                      '$activeNodeText\n'
                      'Pasos del proceso en pantalla:\n'
                      '${_currentModeling?.nodes.map((n) => '  - ' + n.label + ' (Responsable: ' + (n.responsible ?? 'sin asignar') + ')').join('\n') ?? ''}',
                  customSuggestions: const [
                    {
                      'texto': '¿Qué camino me recomiendas tomar?',
                      'icono': Icons.assistant_direction_rounded,
                      'color': Color(0xFF8B5CF6),
                    },
                    {
                      'texto': '¿Cuál es la opción más rápida?',
                      'icono': Icons.speed_rounded,
                      'color': Color(0xFF10B981),
                    },
                    {
                      'texto': '¿Qué documentos son requeridos aquí?',
                      'icono': Icons.description_rounded,
                      'color': Color(0xFF3B82F6),
                    },
                  ],
                ),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 14),
                  SizedBox(width: 5),
                  Text(
                    'Sugerencias IA',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
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
        setState(() {
          _selectedNodeId = node.id;
          _localFormData = Map<String, dynamic>.from(activity?.formData ?? {});
        });
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
                        onPressed: () => _enviarRequisitos(node, activity!),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: color,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: const Text(
                          'ENVIAR REQUISITOS',
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

    final bool isEditable = _selectedProcess!.status == 'ACTIVE' && (activity == null || (activity.status != 'FINISHED' && activity.status != 'SKIPPED' && activity.status != 'CANCELED'));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: forms.map((f) {
        final val = _localFormData[f.label] ?? activity?.formData[f.label];
        final isFilled = val != null && val.toString().isNotEmpty;

        if (!isEditable) {
          // Vista de sólo lectura
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
                  Expanded(
                    child: Text(
                      val.toString(),
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blueAccent),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          );
        }

        // Vista de edición interactiva
        if (f.type.toLowerCase() == 'archivo' || f.type.toLowerCase() == 'file') {
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isFilled ? Icons.check_circle : Icons.cloud_queue_rounded,
                      color: isFilled ? Colors.green : Colors.grey.shade400,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      f.label + (f.required ? ' *' : ''),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (isFilled) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.file_present_rounded, color: Colors.green, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            val.toString().split('/').last,
                            style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _showS3UploadDialog(f.label),
                    icon: const Icon(Icons.cloud_upload_rounded),
                    label: Text(isFilled ? 'Cambiar Archivo' : 'Subir Archivo a S3'),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        // Vista de edición de texto/número
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: TextFormField(
            initialValue: val?.toString() ?? '',
            keyboardType: (f.type.toLowerCase() == 'número' || f.type.toLowerCase() == 'number') ? TextInputType.number : TextInputType.text,
            decoration: InputDecoration(
              labelText: f.label + (f.required ? ' *' : ''),
              border: InputBorder.none,
              prefixIcon: const Icon(Icons.edit_note_rounded, size: 20),
            ),
            onChanged: (text) {
              _localFormData[f.label] = text;
            },
          ),
        );
      }).toList(),
    );
  }

  Future<void> _showS3UploadDialog(String formLabel) async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;
    final tenantId = user?.tenantId ?? 'tenant_default';

    // 1. Pick file
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      withData: true,
    );

    if (result == null || result.files.isEmpty) {
      return;
    }

    final file = result.files.first;
    Uint8List? fileBytes = file.bytes;
    if (fileBytes == null && file.path != null) {
      if (!kIsWeb) {
        try {
          fileBytes = io.File(file.path!).readAsBytesSync();
        } catch (e) {
          debugPrint('Error leyendo archivo en movil: $e');
        }
      }
    }

    if (fileBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudieron leer los bytes del archivo')),
      );
      return;
    }

    // Determinar contentType de forma dinamica
    String contentType = 'application/octet-stream';
    final extension = file.extension?.toLowerCase() ?? file.name.split('.').last.toLowerCase();
    if (extension == 'txt') {
      contentType = 'text/plain';
    } else if (extension == 'pdf') {
      contentType = 'application/pdf';
    } else if (extension == 'png') {
      contentType = 'image/png';
    } else if (extension == 'jpg' || extension == 'jpeg') {
      contentType = 'image/jpeg';
    } else if (extension == 'json') {
      contentType = 'application/json';
    }    final sanitizedProject = (_projectName ?? 'proyecto_desconocido').replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
    final sanitizedDesign = (_designName ?? _selectedProcess?.designName ?? 'diseno_desconocido').replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
    final instanceId = widget.processInstanceId ?? _selectedProcess?.id ?? 'instancia_desconocida';
    final s3Path = '$sanitizedProject/$sanitizedDesign/$instanceId/${file.name}';

    // Get policy of the selected node
    final node = _currentModeling!.nodes.firstWhere((n) => n.id == _selectedNodeId);
    final policy = node.policy;

    setState(() {
      _isLoading = true;
    });

    try {
      // 2. Upload and Validate
      final response = await api.uploadAndValidateDocument(
        tenantId: tenantId,
        fileName: s3Path,
        fileBytes: fileBytes,
        contentType: contentType,
        policy: policy,
      );
      final validation = response['validation'] as Map<String, dynamic>?;
      final bool valido = validation?['valido'] ?? true;
      final String mensaje = validation?['mensaje'] ?? 'Validación exitosa';
      final String sugerencia = validation?['sugerencia'] ?? '';

      setState(() {
        _isLoading = false;
        if (valido) {
          _localFormData[formLabel] = file.name;
        }
      });

      // Show dialog or snackbar with validation result
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              Icon(
                valido ? Icons.check_circle : Icons.warning_rounded,
                color: valido ? Colors.green : Colors.red,
              ),
              const SizedBox(width: 10),
              Text(valido ? 'Archivo Válido' : 'Archivo No Válido'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(mensaje),
              if (!valido && sugerencia.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Sugerencia de la IA:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(sugerencia),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Entendido'),
            ),
          ],
        ),
      );

    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al subir y validar: $e')),
      );
    }
  }

  Future<void> _enviarRequisitos(types.NodeData node, types.ActivityInstance activity) async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay un usuario logueado')),
      );
      return;
    }

    // Validar campos requeridos
    final forms = node.forms ?? [];
    for (var f in forms) {
      if (f.required) {
        final val = _localFormData[f.label] ?? activity.formData[f.label];
        if (val == null || val.toString().trim().isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('El campo "${f.label}" es requerido.')),
          );
          return;
        }
      }
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final updatedProcess = await api.advanceActivity(
        instanceId: _selectedProcess!.id!,
        nodeId: node.id,
        status: 'IN_REVIEW',
        userId: user.id!,
        formData: _localFormData,
      );
      
      setState(() {
        _selectedProcess = updatedProcess;
        _selectedNodeId = null;
        _localFormData = {};
        _isLoading = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Requisitos enviados para revisión con éxito')),
      );
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al enviar requisitos: $e')),
      );
    }
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
