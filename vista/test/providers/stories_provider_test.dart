import 'package:flutter_test/flutter_test.dart';

import 'package:vista/providers/stories_provider.dart';
import 'package:vista/models/story.dart';

void main() {
  group('StoriesProvider Tests', () {
    late StoriesProvider storiesProvider;

    setUp(() {
      storiesProvider = StoriesProvider();
    });

    group('storiesByAuthor', () {
      test('groups stories by author correctly', () {
        // Arrange
        final stories = [
          Story(
            id: 'story1',
            authorStudentId: 'USER001',
            media: const StoryMedia(
              url: 'https://example.com/image1.jpg',
              cloudinaryPublicId: 'test_image1',
              type: StoryMediaType.image,
            ),
            createdAt: DateTime.now(),
            expiresAt: DateTime.now().add(const Duration(hours: 24)),
          ),
          Story(
            id: 'story2',
            authorStudentId: 'USER002',
            media: const StoryMedia(
              url: 'https://example.com/image2.jpg',
              cloudinaryPublicId: 'test_image2',
              type: StoryMediaType.image,
            ),
            createdAt: DateTime.now(),
            expiresAt: DateTime.now().add(const Duration(hours: 24)),
          ),
          Story(
            id: 'story3',
            authorStudentId: 'USER001',
            media: const StoryMedia(
              url: 'https://example.com/image3.jpg',
              cloudinaryPublicId: 'test_image3',
              type: StoryMediaType.image,
            ),
            createdAt: DateTime.now(),
            expiresAt: DateTime.now().add(const Duration(hours: 24)),
          ),
        ];

        // Manually set stories for testing
        storiesProvider.stories.addAll(stories);

        // Act
        final grouped = storiesProvider.storiesByAuthor;

        // Assert
        expect(grouped.keys.length, equals(2));
        expect(grouped['USER001']?.length, equals(2));
        expect(grouped['USER002']?.length, equals(1));
      });

      test('returns empty map when no stories exist', () {
        // Act
        final grouped = storiesProvider.storiesByAuthor;

        // Assert
        expect(grouped, isEmpty);
      });
    });

    group('clearError', () {
      test('clears error state', () {
        // Act
        storiesProvider.clearError();

        // Assert
        expect(storiesProvider.error, isNull);
      });
    });

    group('initial state', () {
      test('has correct initial values', () {
        // Assert
        expect(storiesProvider.stories, isEmpty);
        expect(storiesProvider.isLoading, isFalse);
        expect(storiesProvider.isCreatingStory, isFalse);
        expect(storiesProvider.error, isNull);
        expect(storiesProvider.hasMore, isTrue);
      });
    });
  });
}