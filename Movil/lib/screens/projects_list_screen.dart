import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/types.dart';
import 'designs_list_screen.dart';

class ProjectsListScreen extends StatefulWidget {
  const ProjectsListScreen({Key? key}) : super(key: key);

  @override
  State<ProjectsListScreen> createState() => _ProjectsListScreenState();
}

class _ProjectsListScreenState extends State<ProjectsListScreen> {
  late Future<List<Project>> _projectsFuture;

  // Palette of folder colors to cycle through (Refined premium tones)
  static const List<Color> _folderColors = [
    Color(0xFF4F46E5), // Indigo
    Color(0xFF06B6D4), // Cyan
    Color(0xFF10B981), // Emerald
    Color(0xFFF59E0B), // Amber
    Color(0xFF8B5CF6), // Violet
    Color(0xFFEC4899), // Pink
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    _projectsFuture =
        Provider.of<ApiService>(context, listen: false).getProjects();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8FAFC), // Slate 50 ultra limpio
      child: RefreshIndicator(
        color: const Color(0xFF4F46E5),
        onRefresh: () async {
          setState(() => _loadData());
        },
        child: FutureBuilder<List<Project>>(
          future: _projectsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                  child: CircularProgressIndicator(strokeWidth: 2));
            }
            if (snapshot.hasError) {
              return _buildErrorState(snapshot.error.toString());
            }

            final projects = snapshot.data ?? [];
            if (projects.isEmpty) {
              return _buildEmptyState();
            }

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // ── Header Banner ──────────────────────────────
                SliverToBoxAdapter(
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MI ESPACIO',
                          style: TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Proyectos',
                          style: TextStyle(
                            color: Color(0xFF0F172A),
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${projects.length} proyecto${projects.length != 1 ? 's' : ''} disponible${projects.length != 1 ? 's' : ''}',
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

                // ── Breadcrumb path ────────────────────────────
                SliverToBoxAdapter(
                  child: Padding(
                    padding:
                        const EdgeInsets.fromLTRB(20, 16, 20, 4),
                    child: Row(
                      children: [
                        const Icon(Icons.home_rounded,
                            size: 14, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 4),
                        const Text(
                          'Inicio',
                          style: TextStyle(
                            color: Color(0xFF4F46E5),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded,
                            size: 14, color: Colors.grey.shade400),
                        Text(
                          'Proyectos',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Folder Grid ────────────────────────────────
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 14,
                      crossAxisSpacing: 14,
                      childAspectRatio: 0.88,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final project = projects[index];
                        final color =
                            _folderColors[index % _folderColors.length];
                        return ProjectFolderCard(
                          project: project,
                          folderColor: color,
                        );
                      },
                      childCount: projects.length,
                    ),
                  ),
                ),

                const SliverToBoxAdapter(child: SizedBox(height: 100)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildErrorState(String error) {
    return Center(
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
            'No hay proyectos',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Colors.blueGrey.shade300,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
// PROJECT FOLDER CARD
// ══════════════════════════════════════════════════════════

class ProjectFolderCard extends StatelessWidget {
  final Project project;
  final Color folderColor;

  const ProjectFolderCard({
    Key? key,
    required this.project,
    required this.folderColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => DesignsListScreen(
              projectId: project.id!,
              projectName: project.nombre,
            ),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: folderColor.withOpacity(0.1),
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
                      folderColor.withOpacity(0.1),
                      folderColor.withOpacity(0.04),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Icon(
                        Icons.folder_rounded,
                        size: 72,
                        color: folderColor.withOpacity(0.2),
                      ),
                      Icon(
                        Icons.folder_rounded,
                        size: 60,
                        color: folderColor,
                      ),
                      Positioned(
                        bottom: 12,
                        child: Icon(
                          Icons.source_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
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
                    project.nombre,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          project.descripcion,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: folderColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: Icon(Icons.arrow_forward_ios_rounded,
                            size: 10, color: folderColor),
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
}
