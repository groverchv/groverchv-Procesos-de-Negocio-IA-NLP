import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Controlador Global Background para Mensajes de Firebase
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("Mensaje Push recibido en background: ${message.messageId}");
}

class NotificacionesPushService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> inicializar() async {
    // 1. Inicializar Core de Firebase
    await Firebase.initializeApp();
    
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
      print('Mensaje Push recibido en primer plano: ${message.notification?.title}');
      _mostrarNotificacionLocal(message);
    });

    // 5. Obtener Token del dispositivo (Este token se debe enviar a Spring Boot)
    String? token = await _firebaseMessaging.getToken();
    print('Token FCM Dispositivo: $token');
    // TODO: Enviar token al Backend (Spring Boot) para vincularlo al Cliente/Tenant
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
