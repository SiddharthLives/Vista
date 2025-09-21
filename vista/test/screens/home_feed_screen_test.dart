import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:provider/provider.dart';

import 'package:vista/screens/home_feed_screen.dart';
import 'package:vista/providers/auth_provider.dart';
import 'package:vista/providers/feed_provider.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/user.dart';

import 'home_feed_screen_test.mocks.dart';

@GenerateMocks([AuthProvider, FeedProvider])
void main() {
  group('HomeFeedScreen', () {
    late MockAuthProvider mockAuthProvider;
    late MockFeedProvider mockFeedProvider;

    setUp(() {
      mockAuthProvider = MockAuthProvider();
      mockFeedProvider = MockFeedProvider();
    });

    Widget createTestWidget() {
      return MaterialApp(
        home: MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
          ],
          child: const HomeFeedScreen(),
        ),
      );
    }

    testWidgets('displays loading indicator when initially loading', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(true);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Loading feed...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays error message when loading fails', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn('Failed to load posts');

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Oops! Something went wrong'), findsOneWidget);
      expect(find.text('Failed to load posts'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });

    testWidgets('displays empty state when no posts available', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('No posts yet'), findsOneWidget);
      expect(find.text('Be the first to share something!'), findsOneWidget);
      expect(find.text('Create Post'), findsOneWidget);
    });

    testWidgets('displays posts when available', (tester) async {
      // Arrange
      final mockPosts = [
        Post(
          id: '1',
          authorStudentId: 'student1',
          type: PostType.text,
          text: 'Test post 1',
          visibility: PostVisibility.public,
          createdAt: DateTime.now(),
          author: User(
            studentId: 'student1',
            displayName: 'Test User',
            email: 'test@college.edu',
            year: 3,
            department: 'Computer Science',
            section: 'A',
            createdAt: DateTime.now(),
            settings: const UserSettings(),
          ),
        ),
        Post(
          id: '2',
          authorStudentId: 'student2',
          type: PostType.text,
          text: 'Test post 2',
          visibility: PostVisibility.public,
          createdAt: DateTime.now(),
          author: User(
            studentId: 'student2',
            displayName: 'Another User',
            email: 'another@college.edu',
            year: 2,
            department: 'Engineering',
            section: 'B',
            createdAt: DateTime.now(),
            settings: const UserSettings(),
          ),
        ),
      ];

      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn(mockPosts);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Test post 1'), findsOneWidget);
      expect(find.text('Test post 2'), findsOneWidget);
      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('Another User'), findsOneWidget);
    });

    testWidgets('shows floating action button for creating posts', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.byType(FloatingActionButton), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
    });

    testWidgets('shows app bar with title and logout button', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());

      // Assert
      expect(find.text('Vista'), findsOneWidget);
      expect(find.byIcon(Icons.logout), findsOneWidget);
    });

    testWidgets('calls signOut when logout button is tapped', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.tap(find.byIcon(Icons.logout));
      await tester.pump();

      // Assert
      verify(mockAuthProvider.signOut()).called(1);
    });

    testWidgets('opens post composer when FAB is tapped', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Create Post'), findsOneWidget);
    });

    testWidgets('calls loadInitialPosts on initialization', (tester) async {
      // Arrange
      when(mockFeedProvider.isInitialLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.error).thenReturn(null);

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pump(); // Allow post frame callback to execute

      // Assert
      verify(mockFeedProvider.loadInitialPosts()).called(1);
    });
  });
}