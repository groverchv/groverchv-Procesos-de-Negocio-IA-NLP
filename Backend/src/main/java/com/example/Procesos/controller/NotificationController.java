package com.example.Procesos.controller;

import com.example.Procesos.model.Notification;
import com.example.Procesos.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping("/{userId}")
    public List<Notification> getByUser(@PathVariable String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/{userId}/unread")
    public List<Notification> getUnread(@PathVariable String userId) {
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/{userId}/count")
    public Map<String, Long> getUnreadCount(@PathVariable String userId) {
        return Map.of("count", notificationRepository.countByUserIdAndReadFalse(userId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable String id) {
        notificationRepository.findById(id).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{userId}/read-all")
    public ResponseEntity<Void> markAllRead(@PathVariable String userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok().build();
    }
}
