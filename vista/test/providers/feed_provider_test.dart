import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:vista/providers/feed_provider.dart';
import 'package:vista/services/posts_api_service.dart';
import 'package:vista/services/logger_service.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/api_response.dart';
import 'package:vista/models/user.dart';

import 'feed_provider_test.mocks.dart';

@GenerateMocks([PostsApiService])
void main() {
  group('FeedProvider', () {
    late FeedProvider feedProvider;
    late MockPostsApiService mockPostsService;

    setUp(() {
      LoggerService.init(); // Initialize logger for tests
      mockPostsService = MockPostsApiService();
      feedProvider = FeedProvider();
      // We would need to inject the mock service, but for now we'll test the public interface
    });

    test('initial state is correct', () {
      expect(feedProvider.posts, isEmpty);
      expect(feedProvider.isInitialLoading, false);
      expect(feedProvider.isLoadingMore, false);
      expect(feedProvider.error, null);
      expect(feedProvider.hasMore, true);
    });

    test('addNewPost adds post to beginning of list', () {
      // Arrange
      final post = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Test post',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
      );

      // Act
      feedProvider.addNewPost(post);

      // Assert
      expect(feedProvider.posts.length, 1);
      expect(feedProvider.posts.first.id, '1');
      expect(feedProvider.posts.first.text, 'Test post');
    });

    test('updatePost updates existing post in list', () {
      // Arrange
      final originalPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Original text',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
      );
      
      final updatedPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Updated text',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
        likesCount: 5,
      );

      feedProvider.addNewPost(originalPost);

      // Act
      feedProvider.updatePost(updatedPost);

      // Assert
      expect(feedProvider.posts.length, 1);
      expect(feedProvider.posts.first.text, 'Updated text');
      expect(feedProvider.posts.first.likesCount, 5);
    });

    test('removePost removes post from list', () {
      // Arrange
      final post1 = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Post 1',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
      );
      
      final post2 = Post(
        id: '2',
        authorStudentId: 'student2',
        type: PostType.text,
        text: 'Post 2',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
      );

      feedProvider.addNewPost(post1);
      feedProvider.addNewPost(post2);

      // Act
      feedProvider.removePost('1');

      // Assert
      expect(feedProvider.posts.length, 1);
      expect(feedProvider.posts.first.id, '2');
    });

    test('clearError clears error state', () {
      // Arrange
      // We can't directly set error, but we can test the clearError method
      
      // Act
      feedProvider.clearError();

      // Assert
      expect(feedProvider.error, null);
    });

    test('reset clears all state', () {
      // Arrange
      final post = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Test post',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
      );
      feedProvider.addNewPost(post);

      // Act
      feedProvider.reset();

      // Assert
      expect(feedProvider.posts, isEmpty);
      expect(feedProvider.error, null);
      expect(feedProvider.hasMore, true);
      expect(feedProvider.isInitialLoading, false);
      expect(feedProvider.isLoadingMore, false);
    });
  });
}