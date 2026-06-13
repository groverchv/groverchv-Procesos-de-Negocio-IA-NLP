import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart';
import 'diagram_viewer_screen.dart';

class ActiveProcessesScreen extends StatefulWidget {
  const ActiveProcessesScreen({Key? key}) : super(key: key);

  @override
  State<ActiveProcessesScreen> createState() => _ActiveProcessesScreenState();
}

class _ActiveProcessesScreenState extends State<ActiveProcessesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late Future<_ActivityData> _dataFuture;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadData() {
    _dataFuture = _fetchAll();
  }

  Future<_ActivityData> _fetchAll() async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;

    List<ProcessInstance> instances = [];
    List<Map<String, dynamic>> asignaciones = [];

    if (user != null && user.id != null) {
      try {
        instances = await api.getInstancesByStartedBy(user.id!);
      } catch (e) {
        debugPrint('Error cargando instancias: $e');
      }

      try {
        // Obtener TODAS las asignaciones del cliente (habilitadas, pendientes, deshabilitadas)
        asignaciones = await api.getAllAsignacionesCliente(user.id!);
      } catch (e) {
        debugPrint('Error cargando asignaciones: $e');
      }
    }

    return _ActivityData(instances: instances, asignaciones: asignaciones);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8FAFC),
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ACTIVIDAD',
                  style: TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Mis Solicitudes y Procesos',
                  style: TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 16),
                TabBar(
                  controller: _tabController,
                  labelColor: const Color(0xFF3B82F6),
                  unselectedLabelColor: const Color(0xFF94A3B8),
                  indicatorColor: const Color(0xFF3B82F6),
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 12),
                  tabs: const [
                    Tab(text: 'TODO'),
                    Tab(text: 'EN CURSO'),
                    Tab(text: 'TERMINADOS'),
                  ],
                ),
              ],
            ),
          ),

          // ── Content ─────────────────────────────────────────────
          Expanded(
            child: FutureBuilder<_ActivityData>(
              future: _dataFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                      child: CircularProgressIndicator(strokeWidth: 2));
                }
                if (snapshot.hasError) {
                  return _buildError(snapshot.error.toString());
                }

                final data = snapshot.data!;
                final items = _buildItems(data);

                final all = items;
                final active = items
                    .where((i) => i.tabCategory == _TabCategory.active)
                    .toList();
                final finished = items
                    .where((i) => i.tabCategory == _TabCategory.finished)
                    .toList();

                return RefreshIndicator(
                  color: const Color(0xFF3B82F6),
                  onRefresh: () async {
                    setState(() => _loadData());
                  },
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildList(all),
                      _buildList(active),
                      _buildList(finished),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<_ActivityItem> _buildItems(_ActivityData data) {
    final items = <_ActivityItem>[];

    // Agregar instancias de proceso
    for (final inst in data.instances) {
      final isCompleted = inst.status.toUpperCase() == 'COMPLETED';
      final isCanceled = inst.status.toUpperCase() == 'CANCELED';

      items.add(_ActivityItem(
        type: _ItemType.process,
        instance: inst,
        title: inst.designName,
        subtitle: 'Iniciado el ${_formatDate(inst.startedAt)}',
        status: inst.status,
        tabCategory: (isCompleted || isCanceled)
            ? _TabCategory.finished
            : _TabCategory.active,
      ));
    }

    // Agregar solicitudes que no tienen proceso iniciado
    final designIdsConInstancia =
        data.instances.map((i) => i.designId).toSet();

    for (final asig in data.asignaciones) {
      final designId = asig['designId'] as String? ?? '';
      if (designIdsConInstancia.contains(designId)) {
        // Ya tiene instancia → no duplicar
        continue;
      }

      final habilitado = asig['habilitado'] == true;
      final solicitado = asig['solicitado'] == true;

      String status;
      if (habilitado) {
        status = 'HABILITADO';
      } else if (solicitado) {
        status = 'PENDIENTE';
      } else {
        status = 'SIN_PERMISO';
      }

      items.add(_ActivityItem(
        type: _ItemType.solicitud,
        asignacion: asig,
        title: asig['designNombre'] as String? ?? 'Diseño',
        subtitle: solicitado
            ? 'Solicitud enviada el ${_formatDate(asig['fechaSolicitud'])}'
            : habilitado
                ? 'Acceso habilitado'
                : '${asig['projectNombre'] ?? 'Proyecto'}',
        status: status,
        tabCategory: _TabCategory.active,
      ));
    }

    // Ordenar: procesos activos primero, luego pendientes, luego terminados
    items.sort((a, b) {
      final order = {'ACTIVE': 0, 'HABILITADO': 1, 'PENDIENTE': 2, 'SIN_PERMISO': 3, 'COMPLETED': 4, 'CANCELED': 5};
      return (order[a.status.toUpperCase()] ?? 99)
          .compareTo(order[b.status.toUpperCase()] ?? 99);
    });

    return items;
  }

  Widget _buildList(List<_ActivityItem> items) {
    if (items.isEmpty) {
      return _buildEmpty();
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      itemCount: items.length,
      itemBuilder: (context, i) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: _ActivityCard(
          item: items[i],
          onTap: () => _onItemTap(items[i]),
        ),
      ),
    );
  }

  void _onItemTap(_ActivityItem item) {
    if (item.type == _ItemType.process && item.instance != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => DiagramViewerScreen(
            designId: item.instance!.designId,
            processInstanceId: item.instance!.id,
          ),
        ),
      );
    }
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inbox_rounded, size: 80, color: Colors.grey.shade200),
          const SizedBox(height: 24),
          Text(
            'Nada por aquí',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Colors.blueGrey.shade300,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tus solicitudes y procesos aparecerán aquí',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline_rounded,
              size: 60, color: Colors.red.shade300),
          const SizedBox(height: 16),
          Text('Error: $error', textAlign: TextAlign.center),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => setState(() => _loadData()),
            child: const Text('REINTENTAR'),
          ),
        ],
      ),
    );
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '—';
    try {
      final dt = DateTime.parse(dateStr.toString());
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr.toString().substring(0, 10);
    }
  }
}

// ══════════════════════════════════════════════════
// DATA MODELS
// ══════════════════════════════════════════════════

class _ActivityData {
  final List<ProcessInstance> instances;
  final List<Map<String, dynamic>> asignaciones;
  _ActivityData({required this.instances, required this.asignaciones});
}

enum _ItemType { process, solicitud }

enum _TabCategory { active, finished }

class _ActivityItem {
  final _ItemType type;
  final ProcessInstance? instance;
  final Map<String, dynamic>? asignacion;
  final String title;
  final String subtitle;
  final String status;
  final _TabCategory tabCategory;

  _ActivityItem({
    required this.type,
    this.instance,
    this.asignacion,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.tabCategory,
  });
}

// ══════════════════════════════════════════════════
// ACTIVITY CARD WIDGET
// ══════════════════════════════════════════════════

class _ActivityCard extends StatelessWidget {
  final _ActivityItem item;
  final VoidCallback onTap;

  const _ActivityCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cfg = _getConfig(item.status);

    return GestureDetector(
      onTap: item.type == _ItemType.process ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: cfg.color.withOpacity(0.15), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: cfg.color.withOpacity(0.06),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cfg.color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(cfg.icon, color: cfg.color, size: 22),
            ),
            const SizedBox(width: 16),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  // Progress bar for processes
                  if (item.type == _ItemType.process && item.instance != null)
                    _buildProgressBar(item.instance!, cfg.color),
                ],
              ),
            ),
            const SizedBox(width: 12),

            // Status badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: cfg.color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    cfg.label,
                    style: TextStyle(
                      color: cfg.color,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                if (item.type == _ItemType.process)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Icon(Icons.chevron_right_rounded,
                        color: Color(0xFF94A3B8), size: 18),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressBar(ProcessInstance inst, Color color) {
    final completed = inst.activities
        .where((a) =>
            a.status.toUpperCase() == 'FINISHED' ||
            a.status.toUpperCase() == 'COMPLETED')
        .length;
    final total = inst.activities.length;
    final progress = total > 0 ? completed / total : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$completed/$total pasos',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey.shade500),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: color),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: Colors.grey.shade100,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 5,
          ),
        ),
      ],
    );
  }

  _StatusConfig _getConfig(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return _StatusConfig(
          color: const Color(0xFF3B82F6),
          icon: Icons.play_circle_filled_rounded,
          label: 'EN CURSO',
        );
      case 'COMPLETED':
        return _StatusConfig(
          color: const Color(0xFF10B981),
          icon: Icons.check_circle_rounded,
          label: 'TERMINADO',
        );
      case 'CANCELED':
        return _StatusConfig(
          color: const Color(0xFFEF4444),
          icon: Icons.cancel_rounded,
          label: 'CANCELADO',
        );
      case 'HABILITADO':
        return _StatusConfig(
          color: const Color(0xFF10B981),
          icon: Icons.folder_special_rounded,
          label: 'HABILITADO',
        );
      case 'PENDIENTE':
        return _StatusConfig(
          color: const Color(0xFFF59E0B),
          icon: Icons.schedule_rounded,
          label: 'PENDIENTE',
        );
      case 'SIN_PERMISO':
      default:
        return _StatusConfig(
          color: const Color(0xFF94A3B8),
          icon: Icons.lock_outline_rounded,
          label: 'SIN PERMISO',
        );
    }
  }
}

class _StatusConfig {
  final Color color;
  final IconData icon;
  final String label;
  _StatusConfig(
      {required this.color, required this.icon, required this.label});
}
