import 'user.dart';

class Topic {
  final String id;
  final String title;
  final String body;
  final String authorStudentId;
  final int votes;
  final List<String> tags;
  final int commentsCount;
  final DateTime createdAt;
  final User? author;

  const Topic({
    required this.id,
    required this.title,
    required this.body,
    required this.authorStudentId,
    this.votes = 0,
    this.tags = const [],
    this.commentsCount = 0,
    required this.createdAt,
    this.author,
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['_id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      authorStudentId: json['authorStudentId'] as String,
      votes: json['votes'] as int? ?? 0,
      tags: List<String>.from(json['tags'] ?? []),
      commentsCount: json['commentsCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      author: json['author'] != null ? User.fromJson(json['author']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'body': body,
      'authorStudentId': authorStudentId,
      'votes': votes,
      'tags': tags,
      'commentsCount': commentsCount,
      'createdAt': createdAt.toIso8601String(),
      'author': author?.toJson(),
    };
  }
}

class CreateTopicRequest {
  final String title;
  final String body;
  final List<String>? tags;

  const CreateTopicRequest({
    required this.title,
    required this.body,
    this.tags,
  });

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'body': body,
      'tags': tags,
    };
  }
}

class VoteTopicRequest {
  final VoteType voteType;

  const VoteTopicRequest({
    required this.voteType,
  });

  Map<String, dynamic> toJson() {
    return {
      'voteType': voteType.name,
    };
  }
}

enum VoteType { up, down, remove_up, remove_down }