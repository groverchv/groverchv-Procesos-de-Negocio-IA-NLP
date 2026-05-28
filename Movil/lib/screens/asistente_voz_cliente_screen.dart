import 'package:flutter/material.dart';

class AsistenteVozClienteScreen extends StatefulWidget {
  @override
  _AsistenteVozClienteScreenState createState() => _AsistenteVozClienteScreenState();
}

class _AsistenteVozClienteScreenState extends State<AsistenteVozClienteScreen> {
  String _textoDictado = 'Mantén presionado para hablar o escribe tu requerimiento...';
  bool _estaEscuchando = false;
  // TODO: Instanciar libreria speech_to_text aquí internamente

  void _empezarDictado() {
    setState(() {
      _estaEscuchando = true;
      _textoDictado = 'Escuchando tu trámite...';
    });
    // lógica del micrófono -> NLP
  }

  void _detenerDictado() {
    setState(() {
      _estaEscuchando = false;
      _textoDictado = 'Quiero aplicar a vacaciones del proximo mes'; // Simulación
    });
    
    _consultarIAPorPolitica(_textoDictado);
  }

  void _consultarIAPorPolitica(String texto) {
    // Aquí invocamos a Spring Boot -> FastAPI
    print('Enviando texto a NLP: $texto');
    // ...
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Tu Asistente Virtual IA'),
        backgroundColor: Colors.indigo,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _estaEscuchando ? Icons.mic : Icons.mic_none,
              size: 100,
              color: _estaEscuchando ? Colors.red : Colors.grey,
            ),
            SizedBox(height: 30),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Text(
                _textoDictado,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _estaEscuchando ? _detenerDictado : _empezarDictado,
        backgroundColor: Colors.indigo,
        child: Icon(_estaEscuchando ? Icons.stop : Icons.mic),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
