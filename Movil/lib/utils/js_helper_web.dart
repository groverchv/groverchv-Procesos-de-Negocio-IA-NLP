import 'dart:convert';
import 'dart:typed_data';
import 'dart:js' as js;

void playBytesWeb(Uint8List bytes, String texto) {
  try {
    final base64String = base64Encode(bytes);
    js.context.callMethod('eval', [
      "window.speechSynthesis.cancel(); "
      "var audio = new Audio('data:audio/mpeg;base64,' + '$base64String'); "
      "audio.play().catch(function(e) { console.log('Audio playback failed: ' + e); });"
    ]);
  } catch (e) {
    print('Web audio playback failed: $e');
  }
}

void speakNativeWeb(String texto) {
  try {
    js.context.callMethod('eval', [
      "window.speechSynthesis.cancel(); "
      "var utterance = new SpeechSynthesisUtterance(${jsonEncode(texto)}); "
      "utterance.lang = 'es-ES'; "
      "utterance.rate = 1.0; "
      "window.speechSynthesis.speak(utterance);"
    ]);
  } catch (e) {
    print('Native Web TTS failed: $e');
  }
}
