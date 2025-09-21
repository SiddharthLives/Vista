import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:provider/provider.dart';
import 'package:vista/providers/topics_provider.dart';
import 'package:vista/providers/auth_provider.dart';
import 'package:vista/screens/topics_screen.dart';
import 'package:vista/models/topic.dart';
import 'package:vista/models/user.dart';

import 'topics_screen_test.mocks.dart';

@GenerateMocks([TopicsProvider, AuthProvider])
void main() {
  group('TopicsScreen Widget Tests', () {
    late MockTopicsProvider mockTopicsProvider;
    late MockAuthProvider mockAuthProvider;
    late List<Topic> testTopics;

    setUp(() {
      mockTopicsProvider = MockTopicsProvider();
      mockAuthProvider = MockAuthProvider();

      final testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        photoUrl: 'https://example.com/photo.jpg',
        year: 3,
        department: 'Computer Science',
        section: 'A',
        bio: 'Test bio',
        createdAt: DateTime.parse('2024-01-01T00:00:00.000Z'),
        settings: const UserSettings(),
      );

      testTopics = [
        Topic(
          id: 'topic1',
          title: 'First Topic',
          body: 'First topic body',
          authorStudentId: '2025CS1001',
          votes: 5,
          tags: const ['test'],
          commentsCount: 3,
          createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          author: testUser,
        ),
        Topic(
          id: 'topic2',
          title: 'Second Topic',
          body: 'Second topic body',
          authorStudentId: '2025CS1002',
          votes: 2,
          tags: const ['flutter'],
          commentsCount: 1,
          createdAt: DateTime.now().subtract(const Duration(hours: 2)),
          author: testUser,
        ),
      ];

      // Setup default mock behavior
      when(mockTopicsProvider.topics).thenReturn(testTopics);
      when(mockTopicsProvider.isLoadingTopics).thenReturn(false);
      when(mockTopicsProvider.hasMoreTopics).thenReturn(true);
      when(mockTopicsProvider.error).thenReturn(null);
      when(mockTopicsProvider.sortBy).thenReturn('recent');
      when(mockTopicsProvider.selectedTags).thenReturn([]);
      when(mockTopicsProvider.searchQuery).thenReturn('');
      
      when(mockAuthProvider.isAuthenticated).thenReturn(true);
    });

    Widget createTestWidget() {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<TopicsProvider>.value(value: mockTopicsProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
        ],
        child: const MaterialApp(
          home: TopicsScreen(),
        ),
      );
    }

    testWidgets('displays app bar with title and sort button', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('Topics'), findsOneWidget);
      expect(find.byIcon(Icons.sort), findsOneWidget);
    });

    testWidgets('displays search bar', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Search topics...'), findsOneWidget);
      expect(find.byIcon(Icons.search), findsOneWidget);
    });

    testWidgets('displays topics list when topics are available', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('First Topic'), findsOneWidget);
      expect(find.text('Second Topic'), findsOneWidget);
    });

    testWidgets('displays loading indicator when loading topics', (WidgetTester tester) async {
      when(mockTopicsProvider.topics).thenReturn([]);
      when(mockTopicsProvider.isLoadingTopics).thenReturn(true);

      await tester.pumpWidget(createTestWidget());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays error message when there is an error', (WidgetTester tester) async {
      when(mockTopicsProvider.topics).thenReturn([]);
      when(mockTopicsProvider.isLoadingTopics).thenReturn(false);
      when(mockTopicsProvider.error).thenReturn('Failed to load topics');

      await tester.pumpWidget(createTestWidget());

      expect(find.text('Failed to load topics'), findsOneWidget);
    });

    testWidgets('displays empty state when no topics available', (WidgetTester tester) async {
      when(mockTopicsProvider.topics).thenReturn([]);
      when(mockTopicsProvider.isLoadingTopics).thenReturn(false);
      when(mockTopicsProvider.error).thenReturn(null);

      await tester.pumpWidget(createTestWidget());

      expect(find.text('No topics found'), findsOneWidget);
      expect(find.text('Be the first to start a discussion!'), findsOneWidget);
      expect(find.byIcon(Icons.topic_outlined), findsOneWidget);
    });

    testWidgets('displays floating action button when authenticated', (WidgetTester tester) async {
      when(mockAuthProvider.isAuthenticated).thenReturn(true);

      await tester.pumpWidget(createTestWidget());

      expect(find.byType(FloatingActionButton), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
    });

    testWidgets('hides floating action button when not authenticated', (WidgetTester tester) async {
      when(mockAuthProvider.isAuthenticated).thenReturn(false);

      await tester.pumpWidget(createTestWidget());

      expect(find.byType(FloatingActionButton), findsNothing);
    });

    testWidgets('calls loadTopics on initialization', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      verify(mockTopicsProvider.loadTopics(refresh: true)).called(1);
    });

    testWidgets('calls setSearchQuery when search text changes', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      await tester.enterText(find.byType(TextField), 'test query');
      
      verify(mockTopicsProvider.setSearchQuery('test query')).called(1);
    });

    testWidgets('shows sort options when sort button is tapped', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      await tester.tap(find.byIcon(Icons.sort));
      await tester.pumpAndSettle();

      expect(find.text('Most Recent'), findsOneWidget);
      expect(find.text('Most Voted'), findsOneWidget);
      expect(find.text('Most Discussed'), findsOneWidget);
    });

    testWidgets('calls setSortBy when sort option is selected', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      await tester.tap(find.byIcon(Icons.sort));
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('Most Voted'));
      
      verify(mockTopicsProvider.setSortBy('votes')).called(1);
    });

    testWidgets('displays pagination loading indicator', (WidgetTester tester) async {
      when(mockTopicsProvider.hasMoreTopics).thenReturn(true);

      await tester.pumpWidget(createTestWidget());

      // Scroll to bottom to trigger pagination
      await tester.drag(find.byType(ListView), const Offset(0, -500));
      await tester.pumpAndSettle();

      // Should show loading indicator for pagination
      expect(find.byType(CircularProgressIndicator), findsWidgets);
    });

    testWidgets('calls loadTopics for pagination when scrolled near bottom', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Simulate scrolling near bottom
      final listView = find.byType(ListView);
      await tester.drag(listView, const Offset(0, -1000));
      await tester.pumpAndSettle();

      // Should call loadTopics for pagination (without refresh)
      verify(mockTopicsProvider.loadTopics()).called(greaterThan(0));
    });

    testWidgets('refreshes topics when pull to refresh is triggered', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      await tester.drag(find.byType(RefreshIndicator), const Offset(0, 300));
      await tester.pumpAndSettle();

      verify(mockTopicsProvider.loadTopics(refresh: true)).called(greaterThan(0));
    });

    testWidgets('clears search when clear button is tapped', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Enter search text first
      await tester.enterText(find.byType(TextField), 'test');
      await tester.pumpAndSettle();

      // Tap clear button
      await tester.tap(find.byIcon(Icons.clear));
      
      verify(mockTopicsProvider.setSearchQuery('')).called(1);
    });
  });
}