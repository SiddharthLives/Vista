import 'user.dart';

class Comment {
  final String id;
  final String authorStudentId;
  final String content;
  final String parentType;
  final String parentId;
  final String? parentCommentId;
  final int votes;
  final int repliesCount;
  final DateTime createdAt;
  final User? author;

  const Comment({
    required this.id,
    required this.authorStudentId,
    required this.content,
    required this.parentType,
    required this.parentId,
    this.parentCommentId,
    this.votes = 0,
    this.repliesCount = 0,
    required this.createdAt,
    this.author,
  });

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['_id'] as String,
      authorStudentId: json['authorStudentId'] as String,
      content: json['content'] as String,
      parentType: json['parentType'] as String,
      parentId: json['parentId'] as String,
      parentCommentId: json['parentCommentId'] as String?,
      votes: json['votes'] as int? ?? 0,
      repliesCount: json['repliesCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      author: json['author'] != null ? User.fromJson(json['author']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'authorStudentId': authorStudentId,
      'content': content,
      'parentType': parentType,
      'parentId': parentId,
      'parentCommentId': parentCommentId,
      'votes': votes,
      'repliesCount': repliesCount,
      'createdAt': createdAt.toIso8601String(),
      'author': author?.toJson(),
    };
  }
}

class CreateCommentRequest {
  final String content;
  final String? parentCommentId;

  const CreateCommentRequest({
    required this.content,
    this.parentCommentId,
  });

  Map<String, dynamic> toJson() {
    return {
      'content': content,
      'parentCommentId': parentCommentId,
    };
  }
}