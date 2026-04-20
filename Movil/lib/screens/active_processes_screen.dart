import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart';
import 'process_details_screen.dart';

class ActiveProcessesScreen extends StatefulWidget {
  const ActiveProcessesScreen({Key? key}) : super(key: key);

  @override
  State<ActiveProcessesScreen> createState() => _ActiveProcessesScreenState();
}

class _ActiveProcessesScreenState extends State<ActiveProcessesScreen> {
  late Future<List<ProcessInstance>> _processesFuture;

  @override
  void initState() {
    super.initState();
    _processesFuture =
        Provider.of<ApiService>(context, listen: false).getActiveInstances();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        setState(() {
          _processesFuture = Provider.of<ApiService>(context, listen: false)
              .getActiveInstances();
        });
      },
      child: FutureBuilder<List<ProcessInstance>>(
        future: _processesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline,
                      size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Error: ${snapshot.error}'),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _processesFuture =
                            Provider.of<ApiService>(context, listen: false)
                                .getActiveInstances();
                      });
                    },
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }

          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.play_circle_outline,
                      size: 48, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No hay procesos activos en este momento'),
                ],
              ),
            );
          }

          final processes = snapshot.data!;
          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: processes.length,
            itemBuilder: (context, index) {
              return ProcessInstanceCard(process: processes[index]);
            },
          );
        },
      ),
    );
  }
}

class ProcessInstanceCard extends StatefulWidget {
  final ProcessInstance process;

  const ProcessInstanceCard({Key? key, required this.process})
      : super(key: key);

  @override
  State<ProcessInstanceCard> createState() => _ProcessInstanceCardState();
}

class _ProcessInstanceCardState extends State<ProcessInstanceCard> {
  late Future<ProcessInstance> _processDetailsFuture;
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _processDetailsFuture = Provider.of<ApiService>(context, listen: false)
        .getProcessInstance(widget.process.id!);
  }

  String _getProcessStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'Activo';
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status;
    }
  }

  Color _getProcessStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return Colors.green;
      case 'COMPLETED':
        return Colors.blue;
      case 'CANCELED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _getActivityStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'Pendiente';
      case 'IN_PROCESS':
        return 'En Proceso';
      case 'IN_REVIEW':
        return 'En Revisión';
      case 'FINISHED':
        return 'Finalizado';
      case 'CANCELED':
        return 'Cancelado';
      case 'SKIPPED':
        return 'Omitido';
      default:
        return status;
    }
  }

  Color _getActivityStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return Colors.grey;
      case 'IN_PROCESS':
        return Colors.blue;
      case 'IN_REVIEW':
        return Colors.orange;
      case 'FINISHED':
        return Colors.green;
      case 'CANCELED':
        return Colors.red;
      case 'SKIPPED':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: FutureBuilder<ProcessInstance>(
        future: _processDetailsFuture,
        builder: (context, snapshot) {
          final process = snapshot.data ?? widget.process;

          return Column(
            children: [
              ListTile(
                leading: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: _getProcessStatusColor(process.status),
                    shape: BoxShape.circle,
                  ),
                ),
                title: Text(process.designName),
                subtitle: Text(
                  'ID: ${process.id?.substring(0, 8)}... | Iniciado por: ${process.startedBy}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: Chip(
                  label: Text(
                    _getProcessStatusLabel(process.status),
                    style: const TextStyle(fontSize: 12, color: Colors.white),
                  ),
                  backgroundColor:
                      _getProcessStatusColor(process.status),
                  side: BorderSide.none,
                ),
                onTap: () {
                  setState(() {
                    _expanded = !_expanded;
                  });
                },
              ),
              if (_expanded && snapshot.hasData)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Divider(),
                      const Text(
                        'Estado de Actividades',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (process.activities.isEmpty)
                        const Text('No hay actividades registradas')
                      else
                        ...process.activities.map((activity) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                border: Border(
                                  left: BorderSide(
                                    color: _getActivityStatusColor(activity.status),
                                    width: 4,
                                  ),
                                ),
                                color: _getActivityStatusColor(activity.status)
                                    .withOpacity(0.05),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          activity.nodeLabel,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: _getActivityStatusColor(
                                                  activity.status)
                                              .withOpacity(0.2),
                                          borderRadius:
                                              BorderRadius.circular(2),
                                        ),
                                        child: Text(
                                          _getActivityStatusLabel(
                                              activity.status),
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: _getActivityStatusColor(
                                                activity.status),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Tipo: ${activity.nodeType}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  if (activity.assignedTo != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Asignado a: ${activity.assignedTo}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
