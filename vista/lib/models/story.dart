import 'user.dart';

class Story {
  final String id;
  final String authorStudentId;
  final StoryMedia media;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int viewsCount;
  final List<StoryView> viewedBy;
  final User? author;

  const Story({
    required this.id,
    required this.authorStudentId,
    required this.media,
    required this.createdAt,
    required this.expiresAt,
    this.viewsCount = 0,
    this.viewedBy = const [],
    this.author,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    return Story(
      id: json['_id'] as String,
      authorStudentId: json['authorStudentId'] as String,
      media: StoryMedia.fromJson(json['media']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      viewsCount: json['viewsCount'] as int? ?? 0,
      viewedBy: (json['viewedBy'] as List<dynamic>?)
              ?.map((item) => StoryView.fromJson(item))
              .toList() ??
          [],
      author: json['author'] != null ? User.fromJson(json['author']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'authorStudentId': authorStudentId,
      'media': media.toJson(),
      'createdAt': createdAt.toIso8601String(),
      'expiresAt': expiresAt.toIso8601String(),
      'viewsCount': viewsCount,
      'viewedBy': viewedBy.map((view) => view.toJson()).toList(),
      'author': author?.toJson(),
    };
  }

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class StoryMedia {
  final String url;
  final String cloudinaryPublicId;
  final int? width;
  final int? height;
  final double? duration;
  final StoryMediaType type;

  const StoryMedia({
    required this.url,
    required this.cloudinaryPublicId,
    this.width,
    this.height,
    this.duration,
    required this.type,
  });

  factory StoryMedia.fromJson(Map<String, dynamic> json) {
    return StoryMedia(
      url: json['url'] as String,
      cloudinaryPublicId: json['cloudinaryPublicId'] as String,
      width: json['width'] as int?,
      height: json['height'] as int?,
      duration: json['duration'] as double?,
      type: StoryMediaType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => StoryMediaType.image,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'cloudinaryPublicId': cloudinaryPublicId,
      'width': width,
      'height': height,
      'duration': duration,
      'type': type.name,
    };
  }
}

enum StoryMediaType { image, video }

class StoryView {
  final String studentId;
  final DateTime viewedAt;

  const StoryView({
    required this.studentId,
    required this.viewedAt,
  });

  factory StoryView.fromJson(Map<String, dynamic> json) {
    return StoryView(
      studentId: json['studentId'] as String,
      viewedAt: DateTime.parse(json['viewedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'studentId': studentId,
      'viewedAt': viewedAt.toIso8601String(),
    };
  }
}

class CreateStoryRequest {
  final StoryMedia media;

  const CreateStoryRequest({
    required this.media,
  });

  Map<String, dynamic> toJson() {
    return {
      'media': media.toJson(),
    };
  }
}