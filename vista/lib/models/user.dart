class User {
  final String studentId;
  final String email;
  final String displayName;
  final String? photoUrl;
  final int year;
  final String department;
  final String section;
  final String? bio;
  final DateTime createdAt;
  final DateTime? joinedAt;
  final List<String> badges;
  final UserSettings settings;

  const User({
    required this.studentId,
    required this.email,
    required this.displayName,
    this.photoUrl,
    required this.year,
    required this.department,
    required this.section,
    this.bio,
    required this.createdAt,
    this.joinedAt,
    this.badges = const [],
    required this.settings,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      studentId: json['studentId'] as String,
      email: json['email'] as String,
      displayName: json['displayName'] as String,
      photoUrl: json['photoUrl'] as String?,
      year: json['year'] as int,
      department: json['department'] as String,
      section: json['section'] as String,
      bio: json['bio'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      joinedAt: json['joinedAt'] != null 
          ? DateTime.parse(json['joinedAt'] as String) 
          : null,
      badges: List<String>.from(json['badges'] ?? []),
      settings: UserSettings.fromJson(json['settings'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'studentId': studentId,
      'email': email,
      'displayName': displayName,
      'photoUrl': photoUrl,
      'year': year,
      'department': department,
      'section': section,
      'bio': bio,
      'createdAt': createdAt.toIso8601String(),
      'joinedAt': joinedAt?.toIso8601String(),
      'badges': badges,
      'settings': settings.toJson(),
    };
  }

  User copyWith({
    String? studentId,
    String? email,
    String? displayName,
    String? photoUrl,
    int? year,
    String? department,
    String? section,
    String? bio,
    DateTime? createdAt,
    DateTime? joinedAt,
    List<String>? badges,
    UserSettings? settings,
  }) {
    return User(
      studentId: studentId ?? this.studentId,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      photoUrl: photoUrl ?? this.photoUrl,
      year: year ?? this.year,
      department: department ?? this.department,
      section: section ?? this.section,
      bio: bio ?? this.bio,
      createdAt: createdAt ?? this.createdAt,
      joinedAt: joinedAt ?? this.joinedAt,
      badges: badges ?? this.badges,
      settings: settings ?? this.settings,
    );
  }
}

class UserSettings {
  final bool notifications;

  const UserSettings({
    this.notifications = true,
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) {
    return UserSettings(
      notifications: json['notifications'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notifications': notifications,
    };
  }

  UserSettings copyWith({
    bool? notifications,
  }) {
    return UserSettings(
      notifications: notifications ?? this.notifications,
    );
  }
}