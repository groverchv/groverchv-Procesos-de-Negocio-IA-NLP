import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

// ── Paleta azul consistente con el resto de la app ──────────────────
const _kBlue       = Color(0xFF1565C0);
const _kBlueDark   = Color(0xFF0D47A1);
const _kBlueBright = Color(0xFF1976D2);
const _kBlueLight  = Color(0xFFE3F2FD);

class AsistenteVozClienteScreen extends StatefulWidget {
  @override
  _AsistenteVozClienteScreenState createState() => _AsistenteVozClienteScreenState();
}

class _AsistenteVozClienteScreenState extends State<AsistenteVozClienteScreen>
    with SingleTickerProviderStateMixin {
  String _textoDictado = '';
  String _respuestaIA = '';
  bool _estaEscuchando = false;
  bool _cargandoIA = false;
  bool _reproduciendoVoz = false;
  bool _tieneRespuesta = false;

  late ApiService _apiService;
  final TextEditingController _textController = TextEditingController();
  final AudioPlayer _audioPlayer = AudioPlayer();
  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 0.9, end: 1.1).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _audioPlayer.onPlayerComplete.listen((event) {
      if (mounted) setState(() => _reproduciendoVoz = false);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _apiService = Provider.of<ApiService>(context, listen: false);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _audioPlayer.dispose();
    _textController.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lógica
  // ─────────────────────────────────────────────────────────────────────────

  void _empezarDictado() {
    setState(() {
      _estaEscuchando = true;
      _textoDictado = '';
      _respuestaIA = '';
      _tieneRespuesta = false;
    });
    // Simulamos escucha por 3s (demo — integrar SpeechToText aquí)
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _estaEscuchando) _detenerDictado();
    });
  }

  void _detenerDictado() {
    setState(() => _estaEscuchando = false);
    if (_textoDictado.isNotEmpty) {
      _consultarIA(_textoDictado);
    }
  }

  void _consultarIA(String texto) async {
    if (texto.trim().isEmpty) return;

    setState(() {
      _textoDictado = texto.trim();
      _cargandoIA = true;
      _respuestaIA = '';
      _tieneRespuesta = false;
    });

    try {
      // Usa el mismo endpoint que funciona en el chat IA
      final String reply = await _apiService.nlpChatMovil(
        messages: [
          {'role': 'user', 'content': texto.trim()}
        ],
        procesoContext: null,
      );

      if (mounted) {
        setState(() {
          _respuestaIA = reply;
          _cargandoIA = false;
          _tieneRespuesta = true;
        });
        _generarAudioRespuesta(reply);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _respuestaIA =
              'No se pudo conectar con el motor de IA. Verifica que el backend esté activo e intenta de nuevo.';
          _cargandoIA = false;
          _tieneRespuesta = true;
        });
      }
    }
  }

  void _generarAudioRespuesta(String texto) async {
    if (mounted) setState(() => _reproduciendoVoz = true);
    try {
      final audioBytes = await _apiService.ttsGenerarVoz(texto);
      if (audioBytes != null && audioBytes.isNotEmpty) {
        await _audioPlayer.play(BytesSource(audioBytes));
      } else {
        if (mounted) setState(() => _reproduciendoVoz = false);
      }
    } catch (_) {
      if (mounted) setState(() => _reproduciendoVoz = false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F6FF),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App-style section header ───────────────────────────────────
            SliverToBoxAdapter(
              child: _buildTopBanner(),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    // Microfono principal
                    _buildMicrophoneSection(),
                    const SizedBox(height: 20),
                    // Solicitud actual
                    if (_textoDictado.isNotEmpty) ...[
                      _buildRequestCard(),
                      const SizedBox(height: 16),
                    ],
                    // Respuesta IA
                    _buildResponseCard(),
                    const SizedBox(height: 20),
                    // Input manual
                    _buildManualInput(),
                    const SizedBox(height: 24),
                    // Sugerencias rápidas
                    _buildQuickSuggestions(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_kBlueDark, _kBlue, _kBlueBright],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: _kBlue.withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.record_voice_over_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Asistente de Voz IA',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Habla o escribe tu requerimiento',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.75),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          // Estado
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF4ADE80),
                  ),
                ),
                const SizedBox(width: 4),
                const Text(
                  'En línea',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMicrophoneSection() {
    final Color micColor = _estaEscuchando
        ? Colors.redAccent
        : (_reproduciendoVoz ? const Color(0xFF10B981) : _kBlue);

    return Container(
      margin: const EdgeInsets.only(top: 20),
      child: Column(
        children: [
          // Botón micrófono con pulso
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (_, __) => Transform.scale(
              scale: (_estaEscuchando || _reproduciendoVoz) ? _pulseAnim.value : 1.0,
              child: GestureDetector(
                onTap: () {
                  if (_reproduciendoVoz) {
                    _audioPlayer.stop();
                    setState(() => _reproduciendoVoz = false);
                  } else if (_estaEscuchando) {
                    _detenerDictado();
                  } else {
                    _empezarDictado();
                  }
                },
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: _estaEscuchando
                          ? [Colors.redAccent, Colors.red.shade800]
                          : (_reproduciendoVoz
                              ? [const Color(0xFF10B981), const Color(0xFF059669)]
                              : [_kBlueDark, _kBlueBright]),
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: micColor.withOpacity(0.4),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    _estaEscuchando
                        ? Icons.stop_rounded
                        : (_reproduciendoVoz ? Icons.volume_up_rounded : Icons.mic_rounded),
                    color: Colors.white,
                    size: 44,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          // Estado del micrófono
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Text(
              _estaEscuchando
                  ? '🎙 Escuchando... Toca para detener'
                  : _reproduciendoVoz
                      ? '🔊 Reproduciendo respuesta...'
                      : _cargandoIA
                          ? '🤔 Analizando tu solicitud...'
                          : 'Toca el micrófono para hablar',
              key: ValueKey(_estaEscuchando || _reproduciendoVoz || _cargandoIA),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _estaEscuchando
                    ? Colors.redAccent
                    : _reproduciendoVoz
                        ? const Color(0xFF10B981)
                        : const Color(0xFF64748B),
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBlueLight),
        boxShadow: [
          BoxShadow(
            color: _kBlue.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _kBlueLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.person_rounded, color: _kBlue, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tu solicitud',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _textoDictado,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResponseCard() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBlueLight),
        boxShadow: [
          BoxShadow(
            color: _kBlue.withOpacity(0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: _kBlueLight,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: _kBlue,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 14),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Análisis y Respuesta IA',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                    color: _kBlueDark,
                  ),
                ),
                const Spacer(),
                if (_reproduciendoVoz)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.volume_up_rounded, color: Colors.white, size: 10),
                        SizedBox(width: 3),
                        Text('Audio', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: _cargandoIA
                ? _buildLoadingState()
                : _tieneRespuesta
                    ? _buildResponseText()
                    : _buildEmptyState(),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Column(
      children: [
        const SizedBox(height: 12),
        const CircularProgressIndicator(
          strokeWidth: 2.5,
          color: _kBlue,
        ),
        const SizedBox(height: 16),
        Text(
          'Analizando tu requerimiento...',
          style: TextStyle(
            fontSize: 13,
            color: Colors.blueGrey.shade500,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildResponseText() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SelectableText(
          _respuestaIA,
          style: const TextStyle(
            fontSize: 14,
            height: 1.65,
            color: Color(0xFF334155),
            fontWeight: FontWeight.w500,
          ),
        ),
        if (_tieneRespuesta && !_cargandoIA) ...[
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _generarAudioRespuesta(_respuestaIA),
                icon: const Icon(Icons.volume_up_rounded, size: 14),
                label: const Text('Escuchar', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(foregroundColor: _kBlue),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildEmptyState() {
    return Column(
      children: [
        const SizedBox(height: 8),
        Icon(Icons.waving_hand_rounded, size: 36, color: Colors.amber.shade400),
        const SizedBox(height: 12),
        const Text(
          'Aquí aparecerá la respuesta de la IA',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Usa el micrófono o escribe tu solicitud abajo para comenzar.',
          style: TextStyle(fontSize: 12, color: Colors.blueGrey.shade400, height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildManualInput() {
    return Row(
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _kBlueLight),
              boxShadow: [
                BoxShadow(color: _kBlue.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2)),
              ],
            ),
            child: TextField(
              controller: _textController,
              style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'Escribe tu requerimiento aquí...',
                hintStyle: TextStyle(color: Colors.blueGrey.shade300, fontSize: 13),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: InputBorder.none,
              ),
              onSubmitted: (val) {
                if (val.trim().isNotEmpty) {
                  _textController.clear();
                  _consultarIA(val);
                }
              },
            ),
          ),
        ),
        const SizedBox(width: 10),
        GestureDetector(
          onTap: () {
            final val = _textController.text;
            if (val.trim().isNotEmpty) {
              _textController.clear();
              _consultarIA(val);
            }
          },
          child: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_kBlueDark, _kBlueBright],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: _kBlue.withOpacity(0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickSuggestions() {
    final suggestions = [
      '¿Qué procesos tengo disponibles?',
      '¿Cómo solicito una licencia?',
      '¿Cuál es el trámite más rápido?',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Sugerencias rápidas',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: Color(0xFF64748B),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: suggestions
              .map(
                (s) => GestureDetector(
                  onTap: () => _consultarIA(s),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _kBlueLight),
                      boxShadow: [
                        BoxShadow(
                          color: _kBlue.withOpacity(0.05),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bolt_rounded, size: 13, color: _kBlue),
                        const SizedBox(width: 6),
                        Text(
                          s,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
