package com.example.Procesos.service.push;

import org.springframework.stereotype.Service;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;

@Service
public class FirebasePushService {

    /**
     * Envía una notificación Push al celular del cliente (Flutter).
     * @param deviceToken El token FCM guardado en la base de datos del cliente
     * @param titulo   "Trámite Actualizado"
     * @param cuerpo   "Tu solicitud paso a estado: Aprobado"
     */
    public void enviarNotificacionACliente(String deviceToken, String titulo, String cuerpo) {
        try {
            Notification notification = Notification.builder()
                    .setTitle(titulo)
                    .setBody(cuerpo)
                    .build();

            Message message = Message.builder()
                    .setNotification(notification)
                    .setToken(deviceToken)
                    .build();

            // Despacha asincrónicamente el mensaje a los servidores de Google (FCM)
            String response = FirebaseMessaging.getInstance().send(message);
            System.out.println("Notificación push enviada con éxito: " + response);
        } catch (Exception e) {
            System.err.println("Error al enviar notificación push: " + e.getMessage());
        }
    }
}
