import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vista/models/topic.dart';
import 'package:vista/models/user.dart';
import 'package:vista/widgets/topic_card.dart';

void main() {
  group('TopicCard Widget Tests', () {
    late Topic testTopic;
    late User testUser;

    setUp(() {
      testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        photoUrl: null, // Remove photo URL to avoid network issues in tests
        year: 3,
        department: 'Computer Science',
        section: 'A',
        bio: 'Test bio',
        createdAt: DateTime.parse('2024-01-01T00:00:00.000Z'),
        settings: const UserSettings(),
      );

      testTopic = Topic(
        id: 'topic123',
        title: 'Test Topic Title',
        body: 'This is a test topic body with some content to display.',
        authorStudentId: '2025CS1001',
        votes: 5,
        tags: ['test', 'flutter'],
        commentsCount: 3,
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        author: testUser,
      );
    });

    testWidgets('displays topic information correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: testTopic),
          ),
        ),
      );

      // Check if title is displayed
      expect(find.text('Test Topic Title'), findsOneWidget);
      
      // Check if body preview is displayed
      expect(find.text('This is a test topic body with some content to display.'), findsOneWidget);
      
      // Check if author name is displayed
      expect(find.text('Test User'), findsOneWidget);
      
      // Check if votes count is displayed
      expect(find.text('5'), findsOneWidget);
      
      // Check if comments count is displayed
      expect(find.text('3'), findsOneWidget);
      
      // Check if tags are displayed
      expect(find.text('#test'), findsOneWidget);
      expect(find.text('#flutter'), findsOneWidget);
    });

    testWidgets('displays voting buttons', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: testTopic),
          ),
        ),
      );

      // Check if upvote and downvote buttons are present
      expect(find.byIcon(Icons.keyboard_arrow_up), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down), findsOneWidget);
    });

    testWidgets('calls onTap when card is tapped', (WidgetTester tester) async {
      bool tapped = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(
              topic: testTopic,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(TopicCard));
      expect(tapped, isTrue);
    });

    testWidgets('calls onVote when vote buttons are tapped', (WidgetTester tester) async {
      VoteType? votedType;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(
              topic: testTopic,
              onVote: (type) => votedType = type,
            ),
          ),
        ),
      );

      // Test upvote
      await tester.tap(find.byIcon(Icons.keyboard_arrow_up));
      expect(votedType, equals(VoteType.up));

      // Test downvote
      await tester.tap(find.byIcon(Icons.keyboard_arrow_down));
      expect(votedType, equals(VoteType.down));
    });

    testWidgets('displays time ago correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: testTopic),
          ),
        ),
      );

      // Should show "2h ago" for a topic created 2 hours ago
      expect(find.text('2h ago'), findsOneWidget);
    });

    testWidgets('handles topic without author', (WidgetTester tester) async {
      final topicWithoutAuthor = Topic(
        id: 'topic123',
        title: 'Test Topic',
        body: 'Test body',
        authorStudentId: '2025CS1001',
        votes: 0,
        tags: const [],
        commentsCount: 0,
        createdAt: DateTime.now(),
        author: null,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: topicWithoutAuthor),
          ),
        ),
      );

      // Should display student ID when no author info
      expect(find.text('2025CS1001'), findsOneWidget);
    });

    testWidgets('displays correct vote color based on vote count', (WidgetTester tester) async {
      // Test positive votes (should be green)
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: testTopic),
          ),
        ),
      );

      final voteText = tester.widget<Text>(find.text('5'));
      expect(voteText.style?.color, equals(Colors.green));
    });

    testWidgets('handles empty tags list', (WidgetTester tester) async {
      final topicWithoutTags = Topic(
        id: 'topic123',
        title: 'Test Topic',
        body: 'Test body',
        authorStudentId: '2025CS1001',
        votes: 0,
        tags: const [],
        commentsCount: 0,
        createdAt: DateTime.now(),
        author: testUser,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TopicCard(topic: topicWithoutTags),
          ),
        ),
      );

      // Should not display any tags
      expect(find.textContaining('#'), findsNothing);
    });
  });
}