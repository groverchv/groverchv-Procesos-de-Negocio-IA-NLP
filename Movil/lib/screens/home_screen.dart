import 'package:flutter/material.dart';
import 'projects_list_screen.dart';
import 'active_processes_screen.dart';
import 'sugerencias_ia_screen.dart';
import 'asistente_voz_cliente_screen.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: const Color(0xFF4F46E5).withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.account_tree_rounded, color: Color(0xFF4F46E5), size: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          // ── Botón Sugerencias IA ──
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8, left: 4),
            child: GestureDetector(
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => const SugerenciasIAScreen(),
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
          // ── Usuario y logout ──
          if (ApiService.currentUser != null) ...[
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Chip(
                avatar: const Icon(Icons.person_rounded, size: 14, color: Color(0xFF4F46E5)),
                label: Text(
                  ApiService.currentUser!.nombre.split(' ').first,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF3730A3)),
                ),
                backgroundColor: const Color(0xFFEEF2F6),
                side: BorderSide.none,
                padding: EdgeInsets.zero,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
              tooltip: 'Cerrar sesión',
              onPressed: () {
                ApiService.currentUser = null;
                Navigator.pushReplacementNamed(context, '/auth');
              },
            ),
          ],
          const SizedBox(width: 4),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _buildBody(),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withOpacity(0.06),
              blurRadius: 24,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
             child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, Icons.folder_copy_rounded, 'Proyectos'),
                _buildNavItem(1, Icons.play_circle_filled_rounded, 'Activos'),
                _buildNavItem(2, Icons.mic_rounded, 'Asistente'),
                _buildNavItem(3, Icons.info_outline_rounded, 'Info'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _selectedIndex == index;
    final color = isSelected ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8);

    return GestureDetector(
      onTap: () => setState(() => _selectedIndex = index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.08) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            if (isSelected) ...[
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_selectedIndex) {
      case 0:
        return const ProjectsListScreen();
      case 1:
        return const ActiveProcessesScreen();
      case 2:
        return AsistenteVozClienteScreen();
      case 3:
        return _buildInfoScreen();
      default:
        return const ProjectsListScreen();
    }
  }

  Widget _buildInfoScreen() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CONFIGURACIÓN',
            style: TextStyle(
              color: Color(0xFF64748B),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Información del Sistema',
            style: TextStyle(
              color: Colors.blueGrey.shade900,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 32),
          _buildInfoCard(
            'Sobre la aplicación',
            'BPMN Flow Móvil v1.0\n\nEste sistema permite el monitoreo omnicanal de procesos de negocio diseñados en la plataforma principal.',
            Icons.rocket_launch_rounded,
            Colors.blue,
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            'Capacidades',
            '• Sincronización en tiempo real vía WebSockets\n'
            '• Visualización de roadmaps dinámicos\n'
            '• Monitoreo de estados de ejecución\n'
            '• Acceso rápido a formularios de actividad',
            Icons.bolt_rounded,
            Colors.amber,
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            'Conectividad',
            'Backend: http://10.0.2.2:8080\n'
            'WebSocket: ws://10.0.2.2:8080/ws-bpmn',
            Icons.lan_rounded,
            Colors.green,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.psychology_rounded, color: Colors.indigo, size: 24),
                    const SizedBox(width: 12),
                    const Text(
                      'Motor de IA (NLP)',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Elige la plataforma para procesar las consultas del asistente:',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.blueGrey.shade600,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Provider.of<ApiService>(context, listen: false).useLocalIA
                          ? ElevatedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.laptop_rounded, size: 16),
                              label: const Text('IA Local', style: TextStyle(fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF4F46E5),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            )
                          : OutlinedButton.icon(
                              onPressed: () {
                                setState(() {
                                  Provider.of<ApiService>(context, listen: false).useLocalIA = true;
                                });
                              },
                              icon: const Icon(Icons.laptop_rounded, size: 16),
                              label: const Text('IA Local'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: !Provider.of<ApiService>(context, listen: false).useLocalIA
                          ? ElevatedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.cloud_rounded, size: 16),
                              label: const Text('IA GROQ', style: TextStyle(fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF4F46E5),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            )
                          : OutlinedButton.icon(
                              onPressed: () {
                                setState(() {
                                  Provider.of<ApiService>(context, listen: false).useLocalIA = false;
                                });
                              },
                              icon: const Icon(Icons.cloud_rounded, size: 16),
                              label: const Text('IA GROQ'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Center(
            child: Text(
              'Modo Funcionario (Solo Lectura)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade400,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  Widget _buildInfoCard(String title, String content, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              color: Colors.blueGrey.shade600,
              height: 1.6,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
