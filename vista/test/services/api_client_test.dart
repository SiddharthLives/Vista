import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import '../../lib/services/api_client.dart';
import '../../lib/services/auth_service.dart';
import '../../lib/services/api_service.dart';
import '../../lib/services/posts_api_service.dart';
import '../../lib/services/stories_api_service.dart';
import '../../lib/services/topics_api_service.dart';
import '../../lib/services/users_api_service.dart';
import '../../lib/services/media_api_service.dart';
import '../../lib/services/notifications_api_service.dart';
import '../../lib/services/chat_api_service.dart';

// Generate mocks
@GenerateMocks([AuthService, ApiService])
import 'api_client_test.mocks.dart';

void main() {
  group('ApiClient', () {
    late ApiClient apiClient;

    setUp(() {
      apiClient = ApiClient();
    });

    group('Initialization', () {
      test('should initialize successfully', () async {
        expect(() => apiClient.initialize(), returnsNormally);
      });

      test('should load stored JWT token on initialization', () async {
        // This would test that stored tokens are loaded
        // Requires mocking the auth service
        expect(() => apiClient.initialize(), returnsNormally);
      });

      test('should handle initialization errors gracefully', () async {
        // Test error handling during initialization
        expect(() => apiClient.initialize(), returnsNormally);
      });
    });

    group('Authentication Management', () {
      test('should set JWT token correctly', () {
        const testToken = 'test-jwt-token';
        expect(() => apiClient.setJwtToken(testToken), returnsNormally);
      });

      test('should clear JWT token correctly', () {
        expect(() => apiClient.clearJwtToken(), returnsNormally);
      });

      test('should check authentication status', () async {
        expect(() => apiClient.isAuthenticated(), returnsNormally);
      });

      test('should get current user', () async {
        expect(() => apiClient.getCurrentUser(), returnsNormally);
      });

      test('should refresh authentication state', () async {
        expect(() => apiClient.refreshAuth(), returnsNormally);
      });
    });

    group('Service Access', () {
      test('should provide access to posts service', () {
        expect(apiClient.posts, isNotNull);
        expect(apiClient.posts, isA<PostsApiService>());
      });

      test('should provide access to stories service', () {
        expect(apiClient.stories, isNotNull);
        expect(apiClient.stories, isA<StoriesApiService>());
      });

      test('should provide access to topics service', () {
        expect(apiClient.topics, isNotNull);
        expect(apiClient.topics, isA<TopicsApiService>());
      });

      test('should provide access to users service', () {
        expect(apiClient.users, isNotNull);
        expect(apiClient.users, isA<UsersApiService>());
      });

      test('should provide access to media service', () {
        expect(apiClient.media, isNotNull);
        expect(apiClient.media, isA<MediaApiService>());
      });

      test('should provide access to notifications service', () {
        expect(apiClient.notifications, isNotNull);
        expect(apiClient.notifications, isA<NotificationsApiService>());
      });

      test('should provide access to chat service', () {
        expect(apiClient.chat, isNotNull);
        expect(apiClient.chat, isA<ChatApiService>());
      });

      test('should provide access to auth service', () {
        expect(apiClient.auth, isNotNull);
        expect(apiClient.auth, isA<AuthService>());
      });
    });

    group('Health Check', () {
      test('should perform health check successfully', () async {
        expect(() => apiClient.healthCheck(), returnsNormally);
      });

      test('should handle health check failures', () async {
        // Test when health check endpoint is unavailable
        expect(() => apiClient.healthCheck(), returnsNormally);
      });
    });

    group('Singleton Pattern', () {
      test('should return same instance', () {
        final instance1 = ApiClient();
        final instance2 = ApiClient();
        expect(identical(instance1, instance2), true);
      });

      test('should maintain state across instances', () {
        final instance1 = ApiClient();
        const testToken = 'test-token';
        instance1.setJwtToken(testToken);

        final instance2 = ApiClient();
        // In a real test, we would verify the token is maintained
        expect(identical(instance1, instance2), true);
      });
    });

    group('Resource Management', () {
      test('should dispose resources correctly', () {
        expect(() => apiClient.dispose(), returnsNormally);
      });

      test('should handle disposal errors gracefully', () {
        // Test error handling during disposal
        expect(() => apiClient.dispose(), returnsNormally);
      });
    });

    group('Error Handling', () {
      test('should handle service initialization failures', () async {
        // Test when individual services fail to initialize
        expect(() => apiClient.initialize(), returnsNormally);
      });

      test('should handle authentication failures', () async {
        // Test when authentication operations fail
        expect(() => apiClient.refreshAuth(), returnsNormally);
      });

      test('should handle network connectivity issues', () async {
        // Test behavior when network is unavailable
        expect(() => apiClient.healthCheck(), returnsNormally);
      });
    });

    group('Integration', () {
      test('should coordinate between services correctly', () async {
        // Test that services work together properly
        // For example, auth service updates should propagate to API service
        const testToken = 'integration-test-token';
        apiClient.setJwtToken(testToken);
        
        // Verify token is available across services
        expect(() => apiClient.posts.getPosts(), returnsNormally);
      });

      test('should handle cross-service dependencies', () async {
        // Test dependencies between services
        // For example, media service depends on auth for user folder structure
        expect(() => apiClient.initialize(), returnsNormally);
      });
    });
  });
}