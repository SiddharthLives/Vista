import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:vista/widgets/stories_carousel.dart';
import 'package:vista/providers/stories_provider.dart';
import 'package:vista/providers/auth_provider.dart';
import 'package:vista/models/story.dart';
import 'package:vista/models/user.dart';

import 'stories_carousel_test.mocks.dart';

@GenerateMocks([StoriesProvider, AuthProvider])
void main() {
  group('StoriesCarousel Widget Tests', () {
    late MockStoriesProvider mockStoriesProvider;
    late MockAuthProvider mockAuthProvider;

    setUp(() {
      mockStoriesProvider = MockStoriesProvider();
      mockAuthProvider = MockAuthProvider();
    });

    Widget createTestWidget() {
      return MaterialApp(
        home: MultiProvider(
          providers: [
            ChangeNotifierProvider<StoriesProvider>.value(value: mockStoriesProvider),
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
          ],
          child: const Scaffold(
            body: StoriesCarousel(),
          ),
        ),
      );
    }

    testWidgets('displays loading indicator when stories are loading', (WidgetTester tester) async {
      // Arrange
      when(mockStoriesProvider.isLoading).thenReturn(true);
      when(mockStoriesProvider.stories).thenReturn([]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({});

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays add story button when no stories exist', (WidgetTester tester) async {
      // Arrange
      when(mockStoriesProvider.isLoading).thenReturn(false);
      when(mockStoriesProvider.stories).thenReturn([]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({});
      when(mockAuthProvider.user).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Your Story'), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
    });

    testWidgets('displays stories when available', (WidgetTester tester) async {
      // Arrange
      final testUser = User(
        studentId: 'TEST001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );

      final testStory = Story(
        id: 'story1',
        authorStudentId: 'TEST001',
        media: const StoryMedia(
          url: 'https://example.com/image.jpg',
          cloudinaryPublicId: 'test_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        expiresAt: DateTime.now().add(const Duration(hours: 22)),
        author: testUser,
      );

      when(mockStoriesProvider.isLoading).thenReturn(false);
      when(mockStoriesProvider.stories).thenReturn([testStory]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({
        'TEST001': [testStory],
      });
      when(mockAuthProvider.user).thenReturn(testUser);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Your Story'), findsOneWidget); // Add story button
      expect(find.text('You'), findsOneWidget); // Current user's story
    });

    testWidgets('shows story creation options when add button is tapped', (WidgetTester tester) async {
      // Arrange
      when(mockStoriesProvider.isLoading).thenReturn(false);
      when(mockStoriesProvider.stories).thenReturn([]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({});
      when(mockAuthProvider.user).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.tap(find.byIcon(Icons.add));
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Create Story'), findsOneWidget);
      expect(find.text('Camera'), findsOneWidget);
      expect(find.text('Gallery'), findsOneWidget);
      expect(find.text('Video'), findsOneWidget);
    });

    testWidgets('displays correct author name for other users', (WidgetTester tester) async {
      // Arrange
      final currentUser = User(
        studentId: 'CURRENT001',
        email: 'current@college.edu',
        displayName: 'Current User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );

      final otherUser = User(
        studentId: 'OTHER001',
        email: 'other@college.edu',
        displayName: 'Other User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );

      final testStory = Story(
        id: 'story1',
        authorStudentId: 'OTHER001',
        media: const StoryMedia(
          url: 'https://example.com/image.jpg',
          cloudinaryPublicId: 'test_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        expiresAt: DateTime.now().add(const Duration(hours: 22)),
        author: otherUser,
      );

      when(mockStoriesProvider.isLoading).thenReturn(false);
      when(mockStoriesProvider.stories).thenReturn([testStory]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({
        'OTHER001': [testStory],
      });
      when(mockAuthProvider.user).thenReturn(currentUser);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Other User'), findsOneWidget);
    });

    testWidgets('handles missing author gracefully', (WidgetTester tester) async {
      // Arrange
      final testStory = Story(
        id: 'story1',
        authorStudentId: 'UNKNOWN001',
        media: const StoryMedia(
          url: 'https://example.com/image.jpg',
          cloudinaryPublicId: 'test_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        expiresAt: DateTime.now().add(const Duration(hours: 22)),
        author: null, // No author data
      );

      when(mockStoriesProvider.isLoading).thenReturn(false);
      when(mockStoriesProvider.stories).thenReturn([testStory]);
      when(mockStoriesProvider.storiesByAuthor).thenReturn({
        'UNKNOWN001': [testStory],
      });
      when(mockAuthProvider.user).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Unknown'), findsOneWidget);
    });
  });
}