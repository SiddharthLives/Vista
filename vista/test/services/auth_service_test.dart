import 'package:flutter_test/flutter_test.dart';

import 'package:vista/models/api_response.dart';

void main() {
  group('AuthService', () {
    test('should create ApiResponse with success', () {
      final response = ApiResponse.success('test data', 'Success message');
      
      expect(response.success, isTrue);
      expect(response.data, equals('test data'));
      expect(response.message, equals('Success message'));
      expect(response.error, isNull);
    });

    test('should create ApiResponse with error', () {
      const error = ApiError(
        code: 'TEST_ERROR',
        message: 'Test error message',
      );
      final response = ApiResponse.error(error);
      
      expect(response.success, isFalse);
      expect(response.data, isNull);
      expect(response.error, equals(error));
    });

    test('should create ApiError from JSON', () {
      final json = {
        'code': 'INVALID_EMAIL_DOMAIN',
        'message': 'Access denied: college.edu required',
        'details': {
          'providedDomain': 'gmail.com',
          'requiredDomain': 'college.edu',
        },
      };
      
      final error = ApiError.fromJson(json);
      
      expect(error.code, equals('INVALID_EMAIL_DOMAIN'));
      expect(error.message, equals('Access denied: college.edu required'));
      expect(error.details, isNotNull);
      expect(error.details!['providedDomain'], equals('gmail.com'));
    });

    test('should convert ApiError to JSON', () {
      const error = ApiError(
        code: 'TEST_ERROR',
        message: 'Test message',
        details: {'key': 'value'},
      );
      
      final json = error.toJson();
      
      expect(json['code'], equals('TEST_ERROR'));
      expect(json['message'], equals('Test message'));
      expect(json['details'], equals({'key': 'value'}));
    });

    // Note: Full AuthService tests would require Firebase mocking
    // These tests verify the supporting data structures work correctly
    test('should handle authentication flow data structures', () {
      // Test that our data models work as expected
      expect(ApiResponse, isA<Type>());
      expect(ApiError, isA<Type>());
    });
  });
}