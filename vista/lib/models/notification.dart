class Notification {
  final String id;
  final String toStudentId;
  final NotificationType type;
  final NotificationMeta meta;
  final bool isRead;
  final DateTime createdAt;

  const Notification({
    required this.id,
    required this.toStudentId,
    required this.type,
    required this.meta,
    this.isRead = false,
    required this.createdAt,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['_id'] as String,
      toStudentId: json['toStudentId'] as String,
      type: NotificationType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => NotificationType.like,
      ),
      meta: NotificationMeta.fromJson(json['meta'] ?? {}),
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'toStudentId': toStudentId,
      'type': type.name,
      'meta': meta.toJson(),
      'isRead': isRead,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

enum NotificationType { like, comment, follow, message, topic }

class NotificationMeta {
  final String? postId;
  final String? fromStudentId;
  final String? topicId;
  final String? conversationId;

  const NotificationMeta({
    this.postId,
    this.fromStudentId,
    this.topicId,
    this.conversationId,
  });

  factory NotificationMeta.fromJson(Map<String, dynamic> json) {
    return NotificationMeta(
      postId: json['postId'] as String?,
      fromStudentId: json['fromStudentId'] as String?,
      topicId: json['topicId'] as String?,
      conversationId: json['conversationId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'postId': postId,
      'fromStudentId': fromStudentId,
      'topicId': topicId,
      'conversationId': conversationId,
    };
  }
}