import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import '../api_service.dart';

// Controlador Global Background para Mensajes de Firebase
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
    debugPrint("Mensaje Push recibido en background: ${message.messageId}");
  } catch (e) {
    debugPrint("Error en background handler: $e");
  }
}

class NotificacionesPushService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> inicializar(String userId, ApiService apiService) async {
    try {
      // 1. Inicializar Core de Firebase (si no está inicializado)
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      
      // En la web o plataformas no soportadas por ciertos métodos de firebase messaging,
      // evitamos que lance excepciones fatales.
      if (kIsWeb) {
        debugPrint('Notificaciones push no soportadas/configuradas en Web aún.');
        return;
      }

      // 2. Pedir permisos al Cliente (iOS/Android)
      await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      // 3. Inicializar Notificaciones Locales (para cuando la app está abierta)
      const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
      const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
      await _localNotifications.initialize(initializationSettings);

      // 4. Configurar handlers (Background y Foreground)
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('Mensaje Push recibido en primer plano: ${message.notification?.title}');
        _mostrarNotificacionLocal(message);
      });

      // 5. Obtener Token del dispositivo y enviarlo al Backend
      String? token = await _firebaseMessaging.getToken();
      debugPrint('Token FCM Dispositivo: $token');
      
      if (token != null) {
        await apiService.updateFcmToken(userId, token);
      }
    } catch (e) {
      debugPrint('Error al inicializar NotificacionesPushService: $e');
    }
  }

  static void _mostrarNotificacionLocal(RemoteMessage message) {
    if (message.notification != null) {
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'canal_tramites_bpm',
        'Notificaciones de Trámites',
        channelDescription: 'Alertas en tiempo real sobre cambios de estado en tus procesos',
        importance: Importance.max,
        priority: Priority.high,
      );
      
      const NotificationDetails platformChannelSpecifics = NotificationDetails(android: androidDetails);
      
      _localNotifications.show(
        message.hashCode,
        message.notification!.title,
        message.notification!.body,
        platformChannelSpecifics,
      );
    }
  }
}
