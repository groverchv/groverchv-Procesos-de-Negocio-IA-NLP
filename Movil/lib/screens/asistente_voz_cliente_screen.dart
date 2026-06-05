import 'package:flutter/material.dart';
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
      // Simulación de dictado de voz de alta fidelidad
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
      // 1. Enviar el requerimiento de voz a Groq NLP a través de FastAPI
      final res = await _apiService.nlpProcesarIntencion(texto);
      final String reply = res['reply'] ?? 'Lo siento, no pude procesar tu solicitud.';

      setState(() {
        _respuestaIA = reply;
        _cargandoIA = false;
      });

      // 2. Generar respuesta hablada a través de ElevenLabs TTS
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
      final base64Audio = await _apiService.ttsGenerarVoz(texto);
      if (base64Audio.isNotEmpty) {
        print('[ElevenLabs MÓVIL] Audio base64 recibido exitosamente. Listón para reproducirse.');
        // En ambiente real, aquí se decodifica y reproduce el audio usando la librería audioplayers
        // por ejemplo: await _audioPlayer.play(BytesSource(base64Decode(base64Audio)));
      }
    } catch (e) {
      print('Error al generar respuesta hablada con ElevenLabs: $e');
    }

    // Simular fin de reproducción de voz después de un breve periodo
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _reproduciendoVoz = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Colors.indigo[900]!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente de Voz Inteligente', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: primaryColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [primaryColor.withOpacity(0.05), Colors.white],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              // Área del Micrófono e Indicadores Visuales UI/UX
              Expanded(
                flex: 3,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          if (_estaEscuchando || _reproduciendoVoz)
                            Container(
                              width: 160,
                              height: 160,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: (_estaEscuchando ? Colors.red : Colors.green).withOpacity(0.15),
                              ),
                            ),
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _estaEscuchando
                                  ? Colors.red
                                  : (_reproduciendoVoz ? Colors.green : primaryColor),
                              boxShadow: [
                                BoxShadow(
                                  color: (_estaEscuchando ? Colors.red : primaryColor).withOpacity(0.3),
                                  blurRadius: 20,
                                  spreadRadius: 5,
                                )
                              ],
                            ),
                            child: IconButton(
                              iconSize: 56,
                              color: Colors.white,
                              icon: Icon(_estaEscuchando ? Icons.stop : (_reproduciendoVoz ? Icons.volume_up : Icons.mic)),
                              onPressed: () {
                                if (_estaEscuchando) {
                                  _detenerDictado();
                                } else {
                                  _empezarDictado();
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(
                        _estaEscuchando 
                            ? 'Escuchando activamente...' 
                            : (_reproduciendoVoz ? 'Hablando respuesta (ElevenLabs)...' : 'Asistente de Voz'),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _estaEscuchando ? Colors.red : (_reproduciendoVoz ? Colors.green : Colors.grey[700]),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Requerimiento Dictado por el Usuario
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.person, color: primaryColor, size: 20),
                          const SizedBox(width: 8),
                          const Text(
                            'Tu Solicitud:',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.grey),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _textoDictado,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Respuesta de la IA con ElevenLabs
              Expanded(
                flex: 4,
                child: Card(
                  elevation: 6,
                  shadowColor: primaryColor.withOpacity(0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.auto_awesome, color: primaryColor, size: 22),
                            const SizedBox(width: 8),
                            Text(
                              'Análisis y Respuesta IA:',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: primaryColor),
                            ),
                          ],
                        ),
                        const Divider(height: 20),
                        Expanded(
                          child: _cargandoIA
                              ? Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(primaryColor)),
                                      const SizedBox(height: 12),
                                      const Text('Analizando políticas de negocio...', style: TextStyle(fontSize: 13, color: Colors.grey)),
                                    ],
                                  ),
                                )
                              : SingleChildScrollView(
                                  child: Text(
                                    _respuestaIA.isNotEmpty
                                        ? _respuestaIA
                                        : 'Solicita un trámite diciendo por ejemplo: "Quiero iniciar mi solicitud de vacaciones" o "Necesito cotizar un software corporativo". La IA analizará la política asociada y responderá de inmediato por voz.',
                                    style: const TextStyle(fontSize: 15, height: 1.5, color: Colors.black87),
                                  ),
                                ),
                        ),
                      ],
                    ),
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
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      onSubmitted: (val) {
                        _textController.clear();
                        setState(() => _textoDictado = val);
                        _consultarIAPorPolitica(val);
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(Icons.send, color: primaryColor),
                    onPressed: () {
                      final val = _textController.text;
                      if (val.isNotEmpty) {
                        _textController.clear();
                        setState(() => _textoDictado = val);
                        _consultarIAPorPolitica(val);
                      }
                    },
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
