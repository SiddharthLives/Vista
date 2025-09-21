import 'package:flutter_test/flutter_test.dart';

import 'package:vista/models/user.dart';

void main() {
  group('AuthProvider Models', () {
    test('should create User from JSON', () {
      final json = {
        'studentId': '2025CS1001',
        'email': 'student@college.edu',
        'displayName': 'John Doe',
        'photoUrl': 'https://example.com/photo.jpg',
        'year': 3,
        'department': 'Computer Science',
        'section': 'A',
        'bio': 'CS student',
        'createdAt': '2024-01-01T00:00:00.000Z',
        'joinedAt': '2024-01-01T00:00:00.000Z',
        'badges': ['early_adopter'],
        'settings': {
          'notifications': true,
        },
      };
      
      final user = User.fromJson(json);
      
      expect(user.studentId, equals('2025CS1001'));
      expect(user.email, equals('student@college.edu'));
      expect(user.displayName, equals('John Doe'));
      expect(user.year, equals(3));
      expect(user.department, equals('Computer Science'));
      expect(user.section, equals('A'));
      expect(user.badges, contains('early_adopter'));
      expect(user.settings.notifications, isTrue);
    });

    test('should convert User to JSON', () {
      final user = User(
        studentId: '2025CS1001',
        email: 'student@college.edu',
        displayName: 'John Doe',
        year: 3,
        department: 'Computer Science',
        section: 'A',
        createdAt: DateTime.parse('2024-01-01T00:00:00.000Z'),
        settings: const UserSettings(notifications: true),
      );
      
      final json = user.toJson();
      
      expect(json['studentId'], equals('2025CS1001'));
      expect(json['email'], equals('student@college.edu'));
      expect(json['displayName'], equals('John Doe'));
      expect(json['year'], equals(3));
      expect(json['department'], equals('Computer Science'));
      expect(json['section'], equals('A'));
      expect(json['settings']['notifications'], isTrue);
    });

    test('should create User copy with changes', () {
      final user = User(
        studentId: '2025CS1001',
        email: 'student@college.edu',
        displayName: 'John Doe',
        year: 3,
        department: 'Computer Science',
        section: 'A',
        createdAt: DateTime.parse('2024-01-01T00:00:00.000Z'),
        settings: const UserSettings(notifications: true),
      );
      
      final updatedUser = user.copyWith(
        displayName: 'Jane Doe',
        bio: 'Updated bio',
      );
      
      expect(updatedUser.studentId, equals('2025CS1001')); // Unchanged
      expect(updatedUser.displayName, equals('Jane Doe')); // Changed
      expect(updatedUser.bio, equals('Updated bio')); // Changed
      expect(updatedUser.year, equals(3)); // Unchanged
    });

    test('should create UserSettings from JSON', () {
      final json = {
        'notifications': false,
      };
      
      final settings = UserSettings.fromJson(json);
      
      expect(settings.notifications, isFalse);
    });

    test('should have default UserSettings values', () {
      const settings = UserSettings();
      
      expect(settings.notifications, isTrue);
    });

    // Note: Full AuthProvider tests would require Firebase mocking
    // These tests verify the data models work correctly
    test('should handle user data structures', () {
      expect(User, isA<Type>());
      expect(UserSettings, isA<Type>());
    });
  });
}