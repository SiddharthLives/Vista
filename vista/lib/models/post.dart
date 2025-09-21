import 'user.dart';

class Post {
  final String id;
  final String authorStudentId;
  final PostType type;
  final List<MediaItem> media;
  final String text;
  final PostVisibility visibility;
  final List<String> tags;
  final int likesCount;
  final int commentsCount;
  final DateTime createdAt;
  final User? author;

  const Post({
    required this.id,
    required this.authorStudentId,
    required this.type,
    this.media = const [],
    this.text = '',
    required this.visibility,
    this.tags = const [],
    this.likesCount = 0,
    this.commentsCount = 0,
    required this.createdAt,
    this.author,
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['_id'] as String,
      authorStudentId: json['authorStudentId'] as String,
      type: PostType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => PostType.text,
      ),
      media: (json['media'] as List<dynamic>?)
              ?.map((item) => MediaItem.fromJson(item))
              .toList() ??
          [],
      text: json['text'] as String? ?? '',
      visibility: PostVisibility.values.firstWhere(
        (e) => e.name == json['visibility'],
        orElse: () => PostVisibility.public,
      ),
      tags: List<String>.from(json['tags'] ?? []),
      likesCount: json['likesCount'] as int? ?? 0,
      commentsCount: json['commentsCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      author: json['author'] != null ? User.fromJson(json['author']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'authorStudentId': authorStudentId,
      'type': type.name,
      'media': media.map((item) => item.toJson()).toList(),
      'text': text,
      'visibility': visibility.name,
      'tags': tags,
      'likesCount': likesCount,
      'commentsCount': commentsCount,
      'createdAt': createdAt.toIso8601String(),
      'author': author?.toJson(),
    };
  }
}

enum PostType { image, video, text }

enum PostVisibility { public, year, dept, section }

class MediaItem {
  final String url;
  final String cloudinaryPublicId;
  final int? width;
  final int? height;

  const MediaItem({
    required this.url,
    required this.cloudinaryPublicId,
    this.width,
    this.height,
  });

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      url: json['url'] as String,
      cloudinaryPublicId: json['cloudinaryPublicId'] as String,
      width: json['width'] as int?,
      height: json['height'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'cloudinaryPublicId': cloudinaryPublicId,
      'width': width,
      'height': height,
    };
  }
}

class CreatePostRequest {
  final PostType type;
  final String? text;
  final List<MediaItem>? media;
  final PostVisibility visibility;
  final List<String>? tags;

  const CreatePostRequest({
    required this.type,
    this.text,
    this.media,
    this.visibility = PostVisibility.public,
    this.tags,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type.name,
      'text': text,
      'media': media?.map((item) => item.toJson()).toList(),
      'visibility': visibility.name,
      'tags': tags,
    };
  }
}