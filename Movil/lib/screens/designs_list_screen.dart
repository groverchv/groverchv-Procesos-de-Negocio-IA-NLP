import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../models/types.dart';
import 'design_processes_screen.dart';
import 'sugerencias_ia_screen.dart';

class DesignsListScreen extends StatefulWidget {
  final String projectId;
  final String projectName;

  const DesignsListScreen({
    Key? key,
    required this.projectId,
    required this.projectName,
  }) : super(key: key);

  @override
  State<DesignsListScreen> createState() => _DesignsListScreenState();
}

class _DesignsListScreenState extends State<DesignsListScreen> {
  late Future<Map<String, dynamic>> _dataFuture;
  StreamSubscription? _assignmentsSub;

  @override
  void initState() {
    super.initState();
    _loadData();
    _connectWebSocket();
  }

  void _loadData() {
    _dataFuture = _loadAllData();
  }

  void _connectWebSocket() {
    final user = ApiService.currentUser;
    if (user != null && user.id != null) {
      final ws = Provider.of<WebSocketService>(context, listen: false);
      ws.connect(null, clienteId: user.id);
      
      _assignmentsSub?.cancel();
      _assignmentsSub = ws.assignmentsUpdates.listen((event) {
        print('DEBUG: WebSocket assignment update event received: $event');
        if (mounted) {
          setState(() {
            _loadData();
          });
        }
      });
    }
  }

  @override
  void dispose() {
    _assignmentsSub?.cancel();
    final ws = Provider.of<WebSocketService>(context, listen: false);
    ws.disconnect();
    super.dispose();
  }

  Future<Map<String, dynamic>> _loadAllData() async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;

    // Safety check: ensure WebSocket is connected once user is available
    if (user != null && user.id != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _connectWebSocket();
      });
    }

    print('DEBUG: _loadAllData user: $user');
    if (user != null) {
      print('DEBUG: _loadAllData user.id: ${user.id}, email: ${user.email}, rol: ${user.rol}');
    }
    print('DEBUG: _loadAllData projectId: ${widget.projectId}');

    List<Design> designs = [];
    List<Map<String, dynamic>> assignments = [];

    try {
      designs = await api.getDesignsByProject(widget.projectId);
      print('DEBUG: _loadAllData designs fetched: ${designs.length}');
      for (var d in designs) {
        print('  - Design id: ${d.id}, name: ${d.nombre}');
      }
    } catch (e) {
      print('DEBUG: _loadAllData Error fetching designs: $e');
    }

    try {
      if (user != null && user.id != null) {
        assignments = await api.getAsignacionesPorProyecto(user.id!, widget.projectId);
        print('DEBUG: _loadAllData assignments fetched: ${assignments.length}');
        for (var a in assignments) {
          print('  - Assignment designId: ${a['designId']}, habilitado: ${a['habilitado']}, solicitado: ${a['solicitado']}');
        }
      } else {
        print('DEBUG: _loadAllData skipped assignments fetch because user or user.id is null');
      }
    } catch (e) {
      print('DEBUG: _loadAllData Error fetching assignments: $e');
    }

    return {
      'designs': designs,
      'assignments': assignments,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Slate 50
      appBar: AppBar(
        title: Text(
          widget.projectName,
          style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -0.5),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8, left: 4),
            child: GestureDetector(
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => SugerenciasIAScreen(
                    initialPrompt: 'Estoy viendo las carpetas del proyecto "${widget.projectName}". ¿Qué procesos están disponibles para iniciar o solicitar?',
                    extraContext: 'El usuario está explorando los diseños/carpetas del proyecto "${widget.projectName}".',
                    customSuggestions: const [
                      {
                        'texto': '¿Cómo pido acceso a una carpeta bloqueada?',
                        'icono': Icons.lock_open_rounded,
                        'color': Color(0xFF4F46E5),
                      },
                      {
                        'texto': '¿Cuáles son los requisitos de las licencias?',
                        'icono': Icons.article_rounded,
                        'color': Color(0xFF10B981),
                      },
                      {
                        'texto': '¿Qué diferencia hay entre los procesos?',
                        'icono': Icons.compare_arrows_rounded,
                        'color': Color(0xFF8B5CF6),
                      },
                    ],
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4F46E5).withOpacity(0.3),
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
                      'Asesor IA',
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
          const SizedBox(width: 12),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF4F46E5),
        onRefresh: () async {
          setState(() {
            _loadData();
          });
          _connectWebSocket();
        },
        child: FutureBuilder<Map<String, dynamic>>(
          future: _dataFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator(strokeWidth: 2));
            }

            if (snapshot.hasError) {
              return _buildErrorState(snapshot.error.toString());
            }

            final data = snapshot.data!;
            final List<Design> designs = data['designs'] as List<Design>;
            final List<Map<String, dynamic>> assignments =
                data['assignments'] as List<Map<String, dynamic>>;

            if (designs.isEmpty) {
              return _buildEmptyState();
            }

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // ── Header ──────────────────────────────────────
                SliverToBoxAdapter(
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF4F46E5).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.source_rounded,
                                  color: Color(0xFF4F46E5), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'DISEÑOS DEL PROYECTO',
                                    style: TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.projectName,
                                    style: const TextStyle(
                                      color: Color(0xFF0F172A),
                                      fontSize: 20,
                                      fontWeight: FontWeight.w900,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${designs.length} carpeta${designs.length != 1 ? 's' : ''} de diseño',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Folder Grid ──────────────────────────────────
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 14,
                      crossAxisSpacing: 14,
                      childAspectRatio: 0.88,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final design = designs[index];
                        final assignment = assignments.firstWhere(
                          (a) => a['designId'] == design.id,
                          orElse: () => <String, dynamic>{},
                        );
                        return DesignFolderCard(
                          design: design,
                          projectName: widget.projectName,
                          assignment: assignment.isEmpty ? null : assignment,
                          onRefresh: () {
                            setState(() {
                              _loadData();
                            });
                            _connectWebSocket();
                          },
                        );
                      },
                      childCount: designs.length,
                    ),
                  ),
                ),

                const SliverToBoxAdapter(child: SizedBox(height: 40)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildErrorState(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 60, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text('Error: $error', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _loadData()),
              child: const Text('REINTENTAR'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.folder_off_rounded, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 24),
          Text(
            'No hay diseños disponibles',
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.w800, color: Colors.blueGrey.shade300),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
// DESIGN FOLDER CARD
// ══════════════════════════════════════════════════════════

class DesignFolderCard extends StatelessWidget {
  final Design design;
  final String projectName;
  final Map<String, dynamic>? assignment;
  final VoidCallback onRefresh;

  const DesignFolderCard({
    Key? key,
    required this.design,
    required this.projectName,
    this.assignment,
    required this.onRefresh,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;

    final bool isHabilitado = assignment != null && assignment!['habilitado'] == true;
    final bool isSolicitado = assignment != null && assignment!['solicitado'] == true;

    // Status configuration
    Color accentColor;
    Color folderColor;
    IconData statusIcon;
    String statusLabel;

    if (isHabilitado) {
      accentColor = const Color(0xFF10B981);  // green
      folderColor = const Color(0xFF059669);
      statusIcon = Icons.check_circle_rounded;
      statusLabel = 'HABILITADO';
    } else if (isSolicitado) {
      accentColor = const Color(0xFFF59E0B);  // amber
      folderColor = const Color(0xFFD97706);
      statusIcon = Icons.schedule_rounded;
      statusLabel = 'PENDIENTE';
    } else {
      accentColor = const Color(0xFF94A3B8);  // slate
      folderColor = const Color(0xFF64748B);
      statusIcon = Icons.lock_rounded;
      statusLabel = 'BLOQUEADO';
    }

    return GestureDetector(
      onTap: () async {
        if (isHabilitado) {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DesignProcessesScreen(
                designId: design.id!,
                designNombre: design.nombre,
                projectNombre: projectName,
              ),
            ),
          );
          // Refresh when coming back so assignment state is up to date
          onRefresh();
        } else if (isSolicitado) {
          _showPendingDialog(context);
        } else {
          _showSolicitarDialog(context, api, user);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: isHabilitado
              ? Border.all(color: accentColor.withOpacity(0.3), width: 1.5)
              : isSolicitado
                  ? Border.all(color: accentColor.withOpacity(0.4), width: 1.5)
                  : null,
          boxShadow: [
            BoxShadow(
              color: accentColor.withOpacity(0.08),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Folder Icon Area ──────────────────────────
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accentColor.withOpacity(0.08),
                      accentColor.withOpacity(0.03),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Folder icon – mimics a file folder shape
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Icon(
                          Icons.folder_rounded,
                          size: 72,
                          color: accentColor.withOpacity(0.25),
                        ),
                        Icon(
                          Icons.folder_rounded,
                          size: 60,
                          color: accentColor,
                        ),
                        Positioned(
                          bottom: 10,
                          child: Icon(statusIcon, size: 18, color: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Info Area ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    design.nombre,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: accentColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          statusLabel,
                          style: TextStyle(
                            color: accentColor,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      const Spacer(),
                      // Action button / indicator
                      if (!isHabilitado && !isSolicitado)
                        GestureDetector(
                          onTap: () => _showSolicitarDialog(context, api, user),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF4F46E5).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.send_rounded,
                                size: 14, color: Color(0xFF4F46E5)),
                          ),
                        )
                      else if (isHabilitado)
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: accentColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(Icons.arrow_forward_ios_rounded,
                              size: 12, color: accentColor),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPendingDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.schedule_rounded, color: Colors.amber.shade600),
            const SizedBox(width: 8),
            const Text('Solicitud Pendiente', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
            'Tu solicitud está pendiente de aprobación por el funcionario. '
            'Recibirás acceso una vez que sea habilitada.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar'),
          )
        ],
      ),
    );
  }

  void _showSolicitarDialog(BuildContext context, ApiService api, dynamic user) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: const [
            Icon(Icons.folder_special_rounded, color: Color(0xFF4F46E5)),
            SizedBox(width: 8),
            Text('Solicitar Acceso', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          '¿Deseas solicitar acceso para el diseño "${design.nombre}"?\n\n'
          'Un funcionario revisará tu solicitud y habilitará la carpeta.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              if (user == null) return;

              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (context) => const Center(child: CircularProgressIndicator()),
              );

              try {
                await api.solicitarAccesoDiseno(
                  design.id!,
                  design.nombre,
                  design.projectId,
                  projectName,
                  user.id!,
                );
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Solicitud enviada correctamente'),
                    backgroundColor: Colors.orange,
                  ),
                );
                onRefresh();
              } catch (e) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Error al solicitar acceso: $e'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4F46E5),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Solicitar Acceso'),
          ),
        ],
      ),
    );
  }
}
