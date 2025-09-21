// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:vista/config/app_config.dart';
import 'package:vista/models/user.dart';
import 'package:vista/models/api_response.dart';

void main() {
  group('App Configuration', () {
    test('should have correct app name', () {
      expect(AppConfig.appName, 'Vista');
    });

    test('should have correct package name', () {
      expect(AppConfig.packageName, 'com.college.vista');
    });

    test('should return development base URL in development', () {
      expect(AppConfig.baseUrl, contains('localhost'));
    });
  });

  group('User Model', () {
    test('should create user from JSON correctly', () {
      final json = {
        'studentId': '2025CS1001',
        'email': 'student@college.edu',
        'displayName': 'John Doe',
        'year': 3,
        'department': 'Computer Science',
        'section': 'A',
        'createdAt': '2024-01-01T00:00:00.000Z',
        'settings': {'notifications': true},
      };

      final user = User.fromJson(json);

      expect(user.studentId, '2025CS1001');
      expect(user.email, 'student@college.edu');
      expect(user.displayName, 'John Doe');
      expect(user.year, 3);
      expect(user.department, 'Computer Science');
      expect(user.section, 'A');
      expect(user.settings.notifications, true);
    });

    test('should convert user to JSON correctly', () {
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

      expect(json['studentId'], '2025CS1001');
      expect(json['email'], 'student@college.edu');
      expect(json['displayName'], 'John Doe');
      expect(json['year'], 3);
      expect(json['department'], 'Computer Science');
      expect(json['section'], 'A');
    });
  });

  group('API Response', () {
    test('should create success response', () {
      final response = ApiResponse.success('test data', 'Success message');

      expect(response.success, true);
      expect(response.data, 'test data');
      expect(response.message, 'Success message');
      expect(response.error, null);
    });

    test('should create error response', () {
      final error = ApiError(code: 'TEST_ERROR', message: 'Test error message');
      final response = ApiResponse.error(error);

      expect(response.success, false);
      expect(response.data, null);
      expect(response.error, error);
    });
  });
}
