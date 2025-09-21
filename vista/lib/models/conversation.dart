class Conversation {
  final String id;
  final List<String> participants;
  final String? lastMessage;
  final DateTime updatedAt;

  const Conversation({
    required this.id,
    required this.participants,
    this.lastMessage,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['_id'] as String,
      participants: List<String>.from(json['participants'] ?? []),
      lastMessage: json['lastMessage'] as String?,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'participants': participants,
      'lastMessage': lastMessage,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

import 'user.dart';

class Conversation {
  final String id;
  final List<String> participants;
  final String? lastMessage;
  final DateTime updatedAt;

  const Conversation({
    required this.id,
    required this.participants,
    this.lastMessage,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['_id'] as String,
      participants: List<String>.from(json['participants'] ?? []),
      lastMessage: json['lastMessage'] as String?,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'participants': participants,
      'lastMessage': lastMessage,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

class Message {
  final String id;
  final String conversationId;
  final String senderStudentId;
  final String? text;
  final MessageMedia? media;
  final DateTime createdAt;
  final List<String> readBy;
  final User? sender;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderStudentId,
    this.text,
    this.media,
    required this.createdAt,
    this.readBy = const [],
    this.sender,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['_id'] as String,
      conversationId: json['conversationId'] as String,
      senderStudentId: json['senderStudentId'] as String,
      text: json['text'] as String?,
      media: json['media'] != null ? MessageMedia.fromJson(json['media']) : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      readBy: List<String>.from(json['readBy'] ?? []),
      sender: json['sender'] != null ? User.fromJson(json['sender']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'conversationId': conversationId,
      'senderStudentId': senderStudentId,
      'text': text,
      'media': media?.toJson(),
      'createdAt': createdAt.toIso8601String(),
      'readBy': readBy,
      'sender': sender?.toJson(),
    };
  }
}

class MessageMedia {
  final String url;
  final String cloudinaryPublicId;

  const MessageMedia({
    required this.url,
    required this.cloudinaryPublicId,
  });

  factory MessageMedia.fromJson(Map<String, dynamic> json) {
    return MessageMedia(
      url: json['url'] as String,
      cloudinaryPublicId: json['cloudinaryPublicId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'cloudinaryPublicId': cloudinaryPublicId,
    };
  }
}

class SendMessageRequest {
  final String? text;
  final MessageMedia? media;

  const SendMessageRequest({
    this.text,
    this.media,
  });

  Map<String, dynamic> toJson() {
    return {
      'text': text,
      'media': media?.toJson(),
    };
  }
}