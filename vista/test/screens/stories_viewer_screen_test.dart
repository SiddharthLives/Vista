import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:vista/screens/stories_viewer_screen.dart';
import 'package:vista/providers/stories_provider.dart';
import 'package:vista/models/story.dart';
import 'package:vista/models/user.dart';

import 'stories_viewer_screen_test.mocks.dart';

@GenerateMocks([StoriesProvider])
void main() {
  group('StoriesViewerScreen Widget Tests', () {
    late MockStoriesProvider mockStoriesProvider;
    late List<Story> testStories;

    setUp(() {
      mockStoriesProvider = MockStoriesProvider();
      
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

      testStories = [
        Story(
          id: 'story1',
          authorStudentId: 'TEST001',
          media: const StoryMedia(
            url: 'https://example.com/image1.jpg',
            cloudinaryPublicId: 'test_image1',
            type: StoryMediaType.image,
          ),
          createdAt: DateTime.now().subtract(const Duration(hours: 2)),
          expiresAt: DateTime.now().add(const Duration(hours: 22)),
          author: testUser,
          viewsCount: 5,
        ),
        Story(
          id: 'story2',
          authorStudentId: 'TEST001',
          media: const StoryMedia(
            url: 'https://example.com/video1.mp4',
            cloudinaryPublicId: 'test_video1',
            type: StoryMediaType.video,
            duration: 15.0,
          ),
          createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          expiresAt: DateTime.now().add(const Duration(hours: 23)),
          author: testUser,
          viewsCount: 3,
        ),
      ];
    });

    Widget createTestWidget({int initialIndex = 0}) {
      return MaterialApp(
        home: ChangeNotifierProvider<StoriesProvider>.value(
          value: mockStoriesProvider,
          child: StoriesViewerScreen(
            stories: testStories,
            initialIndex: initialIndex,
          ),
        ),
      );
    }

    testWidgets('displays story content correctly', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump(); // Allow animations to settle

      // Assert
      expect(find.byType(PageView), findsOneWidget);
      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('2h ago'), findsOneWidget);
      expect(find.text('5'), findsOneWidget); // View count
    });

    testWidgets('displays progress indicators for multiple stories', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump();

      // Assert
      expect(find.byType(LinearProgressIndicator), findsNWidgets(2)); // Two stories
    });

    testWidgets('displays close button', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump();

      // Assert
      expect(find.byIcon(Icons.close), findsOneWidget);
    });

    testWidgets('closes screen when close button is tapped', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump();
      await tester.tap(find.byIcon(Icons.close));
      await tester.pumpAndSettle();

      // Assert
      expect(find.byType(StoriesViewerScreen), findsNothing);
    });

    testWidgets('displays video play icon for video stories', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(initialIndex: 1)); // Start with video story
      await tester.pump();

      // Assert
      expect(find.byIcon(Icons.play_circle_filled), findsOneWidget);
    });

    testWidgets('displays pause icon when story is paused', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump();
      
      // Tap in the middle to pause
      await tester.tapAt(tester.getCenter(find.byType(PageView)));
      await tester.pump();

      // Assert
      expect(find.byIcon(Icons.pause_circle_filled), findsOneWidget);
    });

    testWidgets('calls viewStory when story is viewed', (WidgetTester tester) async {
      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump();

      // Assert
      verify(mockStoriesProvider.viewStory('story1')).called(1);
    });

    testWidgets('formats time correctly for recent stories', (WidgetTester tester) async {
      // Arrange - Create a story from 30 minutes ago
      final recentStory = Story(
        id: 'recent_story',
        authorStudentId: 'TEST001',
        media: const StoryMedia(
          url: 'https://example.com/recent.jpg',
          cloudinaryPublicId: 'recent_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
        expiresAt: DateTime.now().add(const Duration(hours: 23, minutes: 30)),
        author: testStories[0].author,
      );

      // Act
      await tester.pumpWidget(MaterialApp(
        home: ChangeNotifierProvider<StoriesProvider>.value(
          value: mockStoriesProvider,
          child: StoriesViewerScreen(
            stories: [recentStory],
            initialIndex: 0,
          ),
        ),
      ));
      await tester.pump();

      // Assert
      expect(find.text('30m ago'), findsOneWidget);
    });

    testWidgets('handles stories without author gracefully', (WidgetTester tester) async {
      // Arrange
      final storyWithoutAuthor = Story(
        id: 'no_author_story',
        authorStudentId: 'UNKNOWN001',
        media: const StoryMedia(
          url: 'https://example.com/unknown.jpg',
          cloudinaryPublicId: 'unknown_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(hours: 1)),
        expiresAt: DateTime.now().add(const Duration(hours: 23)),
        author: null, // No author
      );

      // Act
      await tester.pumpWidget(MaterialApp(
        home: ChangeNotifierProvider<StoriesProvider>.value(
          value: mockStoriesProvider,
          child: StoriesViewerScreen(
            stories: [storyWithoutAuthor],
            initialIndex: 0,
          ),
        ),
      ));
      await tester.pump();

      // Assert
      expect(find.text('Unknown'), findsOneWidget);
    });

    testWidgets('does not display view count when zero', (WidgetTester tester) async {
      // Arrange
      final storyWithoutViews = Story(
        id: 'no_views_story',
        authorStudentId: 'TEST001',
        media: const StoryMedia(
          url: 'https://example.com/no_views.jpg',
          cloudinaryPublicId: 'no_views_image',
          type: StoryMediaType.image,
        ),
        createdAt: DateTime.now().subtract(const Duration(hours: 1)),
        expiresAt: DateTime.now().add(const Duration(hours: 23)),
        author: testStories[0].author,
        viewsCount: 0,
      );

      // Act
      await tester.pumpWidget(MaterialApp(
        home: ChangeNotifierProvider<StoriesProvider>.value(
          value: mockStoriesProvider,
          child: StoriesViewerScreen(
            stories: [storyWithoutViews],
            initialIndex: 0,
          ),
        ),
      ));
      await tester.pump();

      // Assert
      expect(find.byIcon(Icons.visibility), findsNothing);
    });
  });
}