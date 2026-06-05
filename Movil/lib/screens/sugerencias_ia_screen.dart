import 'dart:convert';
import 'dart:js' as js;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../services/api_service.dart';

// ─── Chat Message Model ────────────────────────────────────────────────────
class ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  bool isLoading;

  ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.isLoading = false,
  });
}

// ─── Bottom Sheet / Modal View ─────────────────────────────────────────────
class SugerenciasIAScreen extends StatefulWidget {
  const SugerenciasIAScreen({Key? key}) : super(key: key);

  @override
  State<SugerenciasIAScreen> createState() => _SugerenciasIAScreenState();
}

class _SugerenciasIAScreenState extends State<SugerenciasIAScreen>
    with TickerProviderStateMixin {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  final List<Map<String, String>> _historial = [];

  bool _cargando = false;
  bool _hablandoVoz = false;
  bool _contextoCargado = false;
  String _contextoIA = '';

  // Audio & Speech
  final AudioPlayer _audioPlayer = AudioPlayer();
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _speechEnabled = false;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;

  static const List<Map<String, dynamic>> _sugerencias = [
    {
      'texto': '¿Qué procesos tengo disponibles para pedir licencia?',
      'icono': Icons.folder_open_rounded,
      'color': Color(0xFF3B82F6),
    },
    {
      'texto': '¿Cuál es la opción más rápida para completar mi trámite?',
      'icono': Icons.speed_rounded,
      'color': Color(0xFF10B981),
    },
    {
      'texto': '¿Cómo solicito acceso a un proceso nuevo?',
      'icono': Icons.help_outline_rounded,
      'color': Color(0xFFF59E0B),
    },
    {
      'texto': 'Manual de funcionamiento del modelador',
      'icono': Icons.info_outline_rounded,
      'color': Color(0xFFEF4444),
    },
  ];

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 0.85, end: 1.1).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Cargar contexto e inicializar dictado por voz
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _cargarContexto();
      _initSpeech();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _inputController.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _initSpeech() async {
    try {
      _speechEnabled = await _speech.initialize(
        onStatus: (status) {
          debugPrint('Speech status: $status');
          if (status == 'notListening' || status == 'done') {
            if (mounted) setState(() => _isListening = false);
          }
        },
        onError: (errorNotification) {
          debugPrint('Speech error: $errorNotification');
          if (mounted) setState(() => _isListening = false);
        },
      );
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Speech initialization error: $e');
    }
  }

  Future<void> _toggleListening() async {
    if (_isListening) {
      await _speech.stop();
      setState(() => _isListening = false);
    } else {
      if (!_speechEnabled) {
        await _initSpeech();
      }
      if (_speechEnabled) {
        setState(() => _isListening = true);
        await _speech.listen(
          onResult: (result) {
            setState(() {
              _inputController.text = result.recognizedWords;
            });
          },
          localeId: 'es_ES',
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dictado por voz no disponible en este dispositivo/navegador.'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Future<void> _cargarContexto() async {
    final api = Provider.of<ApiService>(context, listen: false);
    final user = ApiService.currentUser;
    if (user == null) return;

    final buffer = StringBuffer();
    buffer.writeln('=== CONTEXTO DEL SISTEMA ===');
    buffer.writeln('Usuario: ${user.nombre}, Rol: ${user.rol}');
    buffer.writeln('');

    try {
      final proyectos = await api.getProjects();
      buffer.writeln('PROYECTOS:');
      for (final p in proyectos) {
        buffer.writeln('  - "${p.nombre}": ${p.descripcion}');
      }
      buffer.writeln('');

      final asignaciones = await api.getDesignosHabilitados(user.id!);
      buffer.writeln('PROCESOS HABILITADOS:');
      for (final a in asignaciones) {
        buffer.writeln('  - Nombre: ${a['designNombre']}, Habilitado: ${a['habilitado']}');
      }
      buffer.writeln('');

      final instancias = await api.getInstancesByStartedBy(user.id!);
      buffer.writeln('INSTANCIAS EN CURSO:');
      for (final inst in instancias) {
        buffer.writeln('  - Proceso: "${inst.designName}", Estado: ${inst.status}');
      }
    } catch (e) {
      buffer.writeln('(Error al cargar contexto)');
    }

    buffer.writeln('');
    buffer.writeln('=== MANUAL RÁPIDO DE OPERACIÓN ===');
    buffer.writeln('- Solicitar licencia: Ve a Proyectos → selecciona el diseño → toca "Solicitar Acceso". Tras la aprobación del funcionario, podrás iniciar el proceso.');
    buffer.writeln('- Trámite rápido: El proceso de "Licencias Cortas" no requiere firma notarial, por ende es el más veloz.');
    buffer.writeln('- Estados: PENDING (pendiente de iniciar), IN_PROCESS (en curso), FINISHED (concluido).');

    setState(() {
      _contextoIA = buffer.toString();
      _contextoCargado = true;
    });

    _agregarMensajeIA(
      '¡Hola! 👋 Soy tu asistente de voz. Pregúntame sobre tus procesos o mantén presionado el micrófono para hablar.',
    );
  }

  void _agregarMensajeIA(String texto) {
    setState(() {
      _messages.add(ChatMessage(
        text: texto,
        isUser: false,
        timestamp: DateTime.now(),
      ));
    });
    _scrollAbajo();
  }

  void _scrollAbajo() {
    Future.delayed(const Duration(milliseconds: 150), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _enviarMensaje(String texto) async {
    if (texto.trim().isEmpty || _cargando) return;

    final api = Provider.of<ApiService>(context, listen: false);
    _inputController.clear();
    FocusScope.of(context).unfocus();

    final userMsg = ChatMessage(
      text: texto.trim(),
      isUser: true,
      timestamp: DateTime.now(),
    );
    setState(() {
      _messages.add(userMsg);
      _historial.add({'role': 'user', 'content': texto.trim()});
      _cargando = true;
    });
    _scrollAbajo();

    final loadingMsg = ChatMessage(
      text: '...',
      isUser: false,
      timestamp: DateTime.now(),
      isLoading: true,
    );
    setState(() => _messages.add(loadingMsg));
    _scrollAbajo();

    try {
      final historialReciente = _historial.length > 6
          ? _historial.sublist(_historial.length - 6)
          : List<Map<String, String>>.from(_historial);

      final String reply = await api.nlpChatMovil(
        messages: historialReciente,
        procesoContext: _contextoCargado ? _contextoIA : null,
      );

      _historial.add({'role': 'assistant', 'content': reply});

      setState(() {
        _messages.remove(loadingMsg);
        _messages.add(ChatMessage(
          text: reply,
          isUser: false,
          timestamp: DateTime.now(),
        ));
        _cargando = false;
      });
      _scrollAbajo();

      // Audio automático a través de ElevenLabs
      _generarVoz(reply);
    } catch (e) {
      setState(() {
        _messages.remove(loadingMsg);
        _messages.add(ChatMessage(
          text: 'En este momento no tengo conexión con el servidor de IA. Por favor, verifica que el backend de IA esté activo en el puerto 8000 e intenta nuevamente.',
          isUser: false,
          timestamp: DateTime.now(),
        ));
        _cargando = false;
      });
      _scrollAbajo();
    }
  }

  Future<void> _generarVoz(String texto) async {
    final api = Provider.of<ApiService>(context, listen: false);
    if (mounted) setState(() => _hablandoVoz = true);

    try {
      if (!kIsWeb) {
        try {
          await _audioPlayer.stop();
        } catch (_) {}
      }
      final audioBytes = await api.ttsGenerarVoz(texto);
      if (audioBytes != null && audioBytes.isNotEmpty) {
        if (kIsWeb) {
          _playBytesWeb(audioBytes, texto);
        } else {
          await _audioPlayer.play(BytesSource(audioBytes));
        }
      } else {
        if (kIsWeb) {
          _speakNativeWeb(texto);
        } else {
          if (mounted) setState(() => _hablandoVoz = false);
        }
      }
    } catch (e) {
      debugPrint('Error ElevenLabs TTS: $e');
      if (kIsWeb) {
        _speakNativeWeb(texto);
      } else {
        if (mounted) setState(() => _hablandoVoz = false);
      }
    }

    if (!kIsWeb) {
      _audioPlayer.onPlayerComplete.first.then((_) {
        if (mounted) setState(() => _hablandoVoz = false);
      }).catchError((_) {
        if (mounted) setState(() => _hablandoVoz = false);
      });
    }
  }

  void _playBytesWeb(Uint8List bytes, String texto) {
    try {
      final base64String = base64Encode(bytes);
      js.context.callMethod('eval', [
        "window.speechSynthesis.cancel(); "
        "var audio = new Audio('data:audio/mpeg;base64,' + '$base64String'); "
        "audio.play().catch(function(e) { console.log('Audio playback failed: ' + e); });"
      ]);
    } catch (e) {
      debugPrint('Web audio playback failed: $e');
    }
    // Simular que habla durante una duración razonable
    final duracion = (texto.length * 65).clamp(2000, 8000);
    Future.delayed(Duration(milliseconds: duracion), () {
      if (mounted) setState(() => _hablandoVoz = false);
    });
  }

  void _speakNativeWeb(String texto) {
    try {
      js.context.callMethod('eval', [
        "window.speechSynthesis.cancel(); "
        "var utterance = new SpeechSynthesisUtterance(${jsonEncode(texto)}); "
        "utterance.lang = 'es-ES'; "
        "utterance.rate = 1.0; "
        "window.speechSynthesis.speak(utterance);"
      ]);
    } catch (e) {
      debugPrint('Native Web TTS failed: $e');
    }
    // Simular estado hablando
    final duracion = (texto.length * 60).clamp(2000, 6000);
    Future.delayed(Duration(milliseconds: duracion), () {
      if (mounted) setState(() => _hablandoVoz = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final double bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      height: MediaQuery.of(context).size.height * 0.48,
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Header
          _buildHeader(),
          // Chat Area
          Expanded(child: _buildChatArea()),
          // Suggested questions
          if (_messages.length <= 1) _buildSugerencias(),
          // Input row
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (_, child) => Transform.scale(
              scale: _hablandoVoz ? _pulseAnim.value : 1.0,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: _hablandoVoz
                        ? [const Color(0xFF10B981), const Color(0xFF059669)]
                        : [const Color(0xFF6366F1), const Color(0xFF8B5CF6)],
                  ),
                ),
                child: Icon(
                  _hablandoVoz ? Icons.volume_up_rounded : Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Asistente Inteligente',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  _hablandoVoz
                      ? 'Respondiendo por voz...'
                      : _cargando
                          ? 'IA pensando...'
                          : 'Asistente de Voz · Online',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF10B981),
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

  Widget _buildChatArea() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: _messages.length,
          itemBuilder: (context, index) {
            final msg = _messages[index];
            if (msg.isLoading) {
              return _buildLoadingBubble();
            }
            return _buildBubble(msg);
          },
        ),
      ),
    );
  }

  Widget _buildLoadingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
          ),
        ),
        child: const SizedBox(
          width: 20,
          height: 10,
          child: LinearProgressIndicator(
            backgroundColor: Colors.transparent,
            color: Color(0xFF6366F1),
          ),
        ),
      ),
    );
  }

  Widget _buildBubble(ChatMessage msg) {
    final isUser = msg.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          bottom: 12,
          left: isUser ? 50 : 0,
          right: isUser ? 0 : 50,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          gradient: isUser
              ? const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF4F46E5)])
              : null,
          color: isUser ? null : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            )
          ],
        ),
        child: Text(
          msg.text,
          style: TextStyle(
            color: isUser ? Colors.white : const Color(0xFF1E293B),
            fontSize: 13.5,
            fontWeight: FontWeight.w500,
            height: 1.4,
          ),
        ),
      ),
    );
  }

  Widget _buildSugerencias() {
    return Container(
      color: const Color(0xFFF8FAFC),
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(
        height: 48,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _sugerencias.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, i) {
            final s = _sugerencias[i];
            return ActionChip(
              avatar: Icon(s['icono'] as IconData, size: 14, color: s['color'] as Color),
              label: Text(
                s['texto'] as String,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
              ),
              backgroundColor: Colors.white,
              onPressed: () => _enviarMensaje(s['texto'] as String),
            );
          },
        ),
      ),
    );
  }

  Widget _buildInput() {
    return Container(
      color: const Color(0xFFF8FAFC),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Row(
        children: [
          // Voice Microphone Button
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (_, child) => Transform.scale(
              scale: _isListening ? _pulseAnim.value : 1.0,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isListening ? Colors.red : const Color(0xFFE2E8F0),
                ),
                child: IconButton(
                  icon: Icon(
                    _isListening ? Icons.mic : Icons.mic_none,
                    color: _isListening ? Colors.white : const Color(0xFF64748B),
                    size: 20,
                  ),
                  onPressed: _toggleListening,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Text input
          Expanded(
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: TextField(
                controller: _inputController,
                style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B)),
                decoration: const InputDecoration(
                  hintText: 'Escribe o presiona el micro...',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onSubmitted: (val) => _enviarMensaje(val),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Send button
          GestureDetector(
            onTap: () => _enviarMensaje(_inputController.text),
            child: Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF4F46E5)]),
              ),
              child: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}
