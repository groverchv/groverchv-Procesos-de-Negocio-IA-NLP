import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart';
import 'diagram_viewer_screen.dart';

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
  late Future<List<Design>> _designsFuture;

  @override
  void initState() {
    super.initState();
    _designsFuture = Provider.of<ApiService>(context, listen: false)
        .getDesignsByProject(widget.projectId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.projectName),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() {
            _designsFuture = Provider.of<ApiService>(context, listen: false)
                .getDesignsByProject(widget.projectId);
          });
        },
        child: FutureBuilder<List<Design>>(
          future: _designsFuture,
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
                  ],
                ),
              );
            }

            if (!snapshot.hasData || snapshot.data!.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.architecture,
                        size: 48, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No hay diseños en este proyecto'),
                  ],
                ),
              );
            }

            final designs = snapshot.data!;
            return ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: designs.length,
              itemBuilder: (context, index) {
                return DesignCard(design: designs[index]);
              },
            );
          },
        ),
      ),
    );
  }
}

class DesignCard extends StatelessWidget {
  final Design design;

  const DesignCard({Key? key, required this.design}) : super(key: key);

  String _getStateLabel(String estado) {
    switch (estado.toLowerCase()) {
      case 'draft':
        return 'Borrador';
      case 'active':
        return 'Activo';
      case 'archived':
        return 'Archivado';
      default:
        return estado;
    }
  }

  Color _getStateColor(String estado) {
    switch (estado.toLowerCase()) {
      case 'draft':
        return Colors.orange;
      case 'active':
        return Colors.green;
      case 'archived':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: const Icon(Icons.architecture, color: Colors.blue),
        title: Text(design.nombre),
        subtitle: Text('ID: ${design.id}'),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _getStateColor(design.estado).withOpacity(0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                _getStateLabel(design.estado),
                style: TextStyle(
                  fontSize: 12,
                  color: _getStateColor(design.estado),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DiagramViewerScreen(designId: design.id!),
            ),
          );
        },
      ),
    );
  }
}
