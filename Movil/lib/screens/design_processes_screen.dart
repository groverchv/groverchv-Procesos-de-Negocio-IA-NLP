import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart';
import 'diagram_viewer_screen.dart';

class DesignProcessesScreen extends StatefulWidget {
  final String designId;
  final String designNombre;
  final String? projectNombre;

  const DesignProcessesScreen({
    Key? key,
    required this.designId,
    required this.designNombre,
    this.projectNombre,
  }) : super(key: key);

  @override
  State<DesignProcessesScreen> createState() => _DesignProcessesScreenState();
}

class _DesignProcessesScreenState extends State<DesignProcessesScreen> {
  late Future<List<ProcessInstance>> _instancesFuture;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    _instancesFuture = Provider.of<ApiService>(context, listen: false)
        .getInstancesPorDiseno(widget.designId);
  }

  Future<void> _startNewProcess() async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error: No se encontró sesión de usuario')),
      );
      return;
    }

    // Confirmation dialog before starting
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.play_circle_filled_rounded,
                  color: Color(0xFF3B82F6), size: 20),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text('Iniciar Proceso',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
        content: Text(
          'Se iniciará una nueva instancia de "${widget.designNombre}".\n\n'
          '⚠️ Nota: Una vez iniciado, necesitarás solicitar acceso nuevamente para ejecutar este proceso en el futuro.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3B82F6),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Iniciar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final newInst = await api.startProcess(widget.designId, user.id ?? 'client');

      // Reset the assignment so re-request is needed for next run
      await api.deshabilitarAccesoDiseno(widget.designId, user.id ?? '');

      Navigator.pop(context); // Close loading dialog

      // Show success + navigate to diagram viewer, then pop designs list
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => DiagramViewerScreen(
            designId: widget.designId,
            processInstanceId: newInst.id,
          ),
        ),
      );

      // After returning from the diagram, go back to designs list
      // (access is now revoked, so designs list will show BLOQUEADO)
      if (mounted) {
        Navigator.pop(context); // pop back to designs list
      }
    } catch (e) {
      Navigator.pop(context); // Close loading dialog
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al iniciar proceso: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: Text(
          widget.designNombre,
          style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Row(
              children: [
                const Icon(Icons.home_rounded, size: 12, color: Color(0xFF3B82F6)),
                const SizedBox(width: 4),
                const Text('Proyectos', style: TextStyle(color: Color(0xFF3B82F6), fontSize: 11, fontWeight: FontWeight.w700)),
                if (widget.projectNombre != null) ...[
                  Icon(Icons.chevron_right_rounded, size: 12, color: Colors.grey.shade400),
                  Text(widget.projectNombre!, style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                ],
                Icon(Icons.chevron_right_rounded, size: 12, color: Colors.grey.shade400),
                Expanded(
                  child: Text(
                    widget.designNombre,
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF3B82F6),
        onRefresh: () async {
          setState(() {
            _loadData();
          });
        },
        child: FutureBuilder<List<ProcessInstance>>(
          future: _instancesFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator(strokeWidth: 2));
            }

            if (snapshot.hasError) {
              return _buildErrorState(snapshot.error.toString());
            }

            final instances = snapshot.data ?? [];
            if (instances.isEmpty) {
              return _buildEmptyState();
            }

            // Sort by date (descending)
            instances.sort((a, b) {
              final dateA = DateTime.tryParse(a.startedAt ?? '') ?? DateTime(2000);
              final dateB = DateTime.tryParse(b.startedAt ?? '') ?? DateTime(2000);
              return dateB.compareTo(dateA);
            });

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // ── Section Header ──────────────────────────────
                SliverToBoxAdapter(
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF3B82F6).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.account_tree_rounded,
                                  color: Color(0xFF3B82F6), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'FLUJOS DE TRABAJO',
                                    style: TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.designNombre,
                                    style: const TextStyle(
                                      color: Color(0xFF0F172A),
                                      fontSize: 18,
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
                        const SizedBox(height: 12),
                        Text(
                          '${instances.length} instancia${instances.length != 1 ? "s" : ""} registrada${instances.length != 1 ? "s" : ""}',
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
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final inst = instances[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: InstanceCard(
                            instance: inst,
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => DiagramViewerScreen(
                                    designId: widget.designId,
                                    processInstanceId: inst.id,
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                      childCount: instances.length,
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 100)),
              ],
            );
          },
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Container(
        height: 60,
        margin: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: const LinearGradient(
              colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF3B82F6).withOpacity(0.4),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: ElevatedButton.icon(
            onPressed: _startNewProcess,
            icon: const Icon(Icons.play_circle_filled_rounded, color: Colors.white, size: 24),
            label: const Text(
              'INICIAR NUEVO PROCESO',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.2,
                fontSize: 14,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 60, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text('Error al cargar instancias:\n$error', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _loadData()),
              child: const Text('Reintentar'),
            )
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
          Icon(Icons.assignment_turned_in_rounded, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 24),
          const Text(
            'No hay instancias iniciadas para este proceso',
            style: TextStyle(fontWeight: FontWeight.w800, color: Colors.blueGrey, fontSize: 16),
          ),
          const SizedBox(height: 8),
          const Text(
            'Presiona el botón de abajo para iniciar una ejecución',
            style: TextStyle(color: Colors.grey, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class InstanceCard extends StatelessWidget {
  final ProcessInstance instance;
  final VoidCallback onTap;

  const InstanceCard({
    Key? key,
    required this.instance,
    required this.onTap,
  }) : super(key: key);

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return const Color(0xFF3B82F6);
      case 'COMPLETED':
        return const Color(0xFF10B981);
      case 'CANCELED':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF64748B);
    }
  }

  String _getStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'ACTIVO';
      case 'COMPLETED':
        return 'COMPLETADO';
      case 'CANCELED':
        return 'CANCELADO';
      default:
        return status.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(instance.status);
    final dateStr = instance.startedAt != null
        ? instance.startedAt!.substring(0, 10) + ' ' + instance.startedAt!.substring(11, 16)
        : '—';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.rocket_launch_rounded, color: statusColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Instancia ID: ${instance.id?.substring(0, 8)}...',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.calendar_today_rounded, size: 12, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        dateStr,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _getStatusLabel(instance.status),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Icon(Icons.chevron_right_rounded, color: Colors.grey, size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
