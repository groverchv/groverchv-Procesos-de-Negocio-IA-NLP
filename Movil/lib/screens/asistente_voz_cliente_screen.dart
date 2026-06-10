import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import '../services/api_service.dart';

class AsistenteVozClienteScreen extends StatefulWidget {
  @override
  _AsistenteVozClienteScreenState createState() => _AsistenteVozClienteScreenState();
}

class _AsistenteVozClienteScreenState extends State<AsistenteVozClienteScreen> {
  String _textoDictado = 'Toca el micrófono para hablar o solicitar tu trámite por voz...';
  String _respuestaIA = '';
  bool _estaEscuchando = false;
  bool _cargandoIA = false;
  bool _reproduciendoVoz = false;
  
  final ApiService _apiService = ApiService();
  final TextEditingController _textController = TextEditingController();
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();
    // Apagar animación de reproducción al finalizar el audio
    _audioPlayer.onPlayerComplete.listen((event) {
      if (mounted) {
        setState(() {
          _reproduciendoVoz = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _textController.dispose();
    super.dispose();
  }

  void _empezarDictado() {
    setState(() {
      _estaEscuchando = true;
      _textoDictado = 'Escuchando tu requerimiento...';
      _respuestaIA = '';
    });
  }

  void _detenerDictado() {
    setState(() {
      _estaEscuchando = false;
      _textoDictado = 'Hola, necesito crear un trámite para solicitar vacaciones de 15 días a partir del próximo mes.';
    });
    
    _consultarIAPorPolitica(_textoDictado);
  }

  void _consultarIAPorPolitica(String texto) async {
    if (texto.isEmpty) return;

    setState(() {
      _cargandoIA = true;
      _respuestaIA = '';
    });

    try {
      final res = await _apiService.nlpProcesarIntencion(texto);
      final String reply = res['reply'] ?? 'Lo siento, no pude procesar tu solicitud.';

      setState(() {
        _respuestaIA = reply;
        _cargandoIA = false;
      });

      _generarAudioRespuesta(reply);

    } catch (e) {
      setState(() {
        _respuestaIA = 'Error al comunicar con el motor de IA local: $e';
        _cargandoIA = false;
      });
    }
  }

  void _generarAudioRespuesta(String texto) async {
    setState(() {
      _reproduciendoVoz = true;
    });

    try {
      final audioBytes = await _apiService.ttsGenerarVoz(texto);
      if (audioBytes != null && audioBytes.isNotEmpty) {
        print('[ElevenLabs MÓVIL] Audio recibido exitosamente. Reproduciendo...');
        await _audioPlayer.play(BytesSource(audioBytes));
      } else {
        setState(() {
          _reproduciendoVoz = false;
        });
      }
    } catch (e) {
      print('Error al generar respuesta hablada con ElevenLabs: $e');
      setState(() {
        _reproduciendoVoz = false;
      });
    }
  }


  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF4F46E5);
    const secondaryAccent = Color(0xFF06B6D4);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Asistente de Voz', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5)),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.white, Color(0xFFF8FAFC)],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            children: [
              // Área del Micrófono e Indicadores Visuales UI/UX
              Expanded(
                flex: 2,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          if (_estaEscuchando || _reproduciendoVoz)
                            Container(
                              width: 130,
                              height: 130,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: (_estaEscuchando ? Colors.redAccent : secondaryAccent).withOpacity(0.12),
                              ),
                            ),
                          Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: _estaEscuchando
                                    ? [Colors.redAccent, Colors.red]
                                    : (_reproduciendoVoz
                                        ? [secondaryAccent, const Color(0xFF0891B2)]
                                        : [primaryColor, const Color(0xFF3730A3)]),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: (_estaEscuchando
                                          ? Colors.redAccent
                                          : (_reproduciendoVoz ? secondaryAccent : primaryColor))
                                      .withOpacity(0.3),
                                  blurRadius: 20,
                                  offset: const Offset(0, 6),
                                )
                              ],
                            ),
                            child: IconButton(
                              iconSize: 44,
                              color: Colors.white,
                              icon: Icon(_estaEscuchando
                                  ? Icons.stop_rounded
                                  : (_reproduciendoVoz ? Icons.volume_up_rounded : Icons.mic_rounded)),
                              onPressed: () {
                                if (_estaEscuchando) {
                                  _detenerDictado();
                                } else if (_reproduciendoVoz) {
                                  _audioPlayer.stop();
                                  setState(() {
                                    _reproduciendoVoz = false;
                                  });
                                } else {
                                  _empezarDictado();
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        _estaEscuchando
                            ? 'Escuchando requerimiento...'
                            : (_reproduciendoVoz ? 'Reproduciendo respuesta por voz...' : 'Toca el micrófono para hablar'),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: _estaEscuchando
                              ? Colors.redAccent
                              : (_reproduciendoVoz ? secondaryAccent : const Color(0xFF64748B)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Requerimiento Dictado por el Usuario
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade100, width: 1),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.person_outline_rounded, color: primaryColor, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Tu solicitud',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _textoDictado,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Respuesta de la IA con ElevenLabs
              Expanded(
                flex: 3,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.grey.shade100, width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withOpacity(0.02),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.auto_awesome_rounded, color: primaryColor, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Análisis y Respuesta IA',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                      const Divider(height: 24),
                      Expanded(
                        child: _cargandoIA
                            ? const Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    CircularProgressIndicator(strokeWidth: 2, color: primaryColor),
                                    SizedBox(height: 16),
                                    Text('Analizando políticas de negocio...',
                                        style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                                  ],
                                ),
                              )
                            : SingleChildScrollView(
                                child: Text(
                                  _respuestaIA.isNotEmpty
                                      ? _respuestaIA
                                      : 'Solicita un trámite diciendo por ejemplo: "Quiero iniciar mi solicitud de vacaciones" o "Necesito cotizar un software corporativo". La IA analizará la política asociada y responderá de inmediato por voz.',
                                  style: const TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF334155)),
                                ),
                              ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Caja de Texto Manual Alternativa (Excelente UX)
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      decoration: InputDecoration(
                        hintText: 'O escribe tu requerimiento aquí...',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                        filled: true,
                        fillColor: Colors.white,
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(color: Colors.grey.shade200),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: primaryColor, width: 1.5),
                        ),
                      ),
                      onSubmitted: (val) {
                        _textController.clear();
                        if (val.trim().isNotEmpty) {
                          setState(() => _textoDictado = val);
                          _consultarIAPorPolitica(val);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    decoration: BoxDecoration(
                      color: primaryColor,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: primaryColor.withOpacity(0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.send_rounded, color: Colors.white),
                      onPressed: () {
                        final val = _textController.text;
                        if (val.trim().isNotEmpty) {
                          _textController.clear();
                          setState(() => _textoDictado = val);
                          _consultarIAPorPolitica(val);
                        }
                      },
                    ),
                  )
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
