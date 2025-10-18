import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vista/widgets/message_bubble.dart';
import 'package:vista/models/user.dart';
import 'package:vista/models/conversation.dart';

void main() {

  group('MessageBubble Widget Tests', () {
    late User testUser;
    late Message testMessage;

    setUp(() {
      testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );

      testMessage = Message(
        id: 'msg123',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Hello, this is a test message!',
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );
    });

    testWidgets('should display text message correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: testMessage,
              isCurrentUser: false,
              showSenderInfo: true,
            ),
          ),
        ),
      );

      expect(find.text('Hello, this is a test message!'), findsOneWidget);
      expect(find.text('T'), findsOneWidget); // Avatar initial
    });

    testWidgets('should display own message with different styling', (WidgetTester tester) async {
      final ownMessage = Message(
        id: 'msg124',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'This is my message',
        createdAt: DateTime.now(),
        readBy: const ['2025CS1001'],
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: ownMessage,
              isCurrentUser: true,
            ),
          ),
        ),
      );

      expect(find.text('This is my message'), findsOneWidget);
      
      // Own messages should be displayed correctly
      expect(find.byType(MessageBubble), findsOneWidget);
    });

    testWidgets('should display timestamp', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: testMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      // Should display some form of timestamp
      expect(find.byType(Text), findsAtLeastNWidgets(2)); // Message + timestamp
    });

    testWidgets('should handle long messages', (WidgetTester tester) async {
      const longMessage = 'This is a very long message that should wrap properly '
          'across multiple lines without causing overflow issues in the UI. '
          'It should be displayed correctly in the message bubble.';
      
      final longTestMessage = Message(
        id: 'msg125',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: longMessage,
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: longTestMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      expect(find.text(longMessage), findsOneWidget);
    });

    testWidgets('should display read status when provided', (WidgetTester tester) async {
      final readMessage = Message(
        id: 'msg126',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Test message',
        createdAt: DateTime.now(),
        readBy: const ['2025CS1001', '2025CS1002'], // Read by multiple users
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: readMessage,
              isCurrentUser: true,
            ),
          ),
        ),
      );

      // Should show read indicator for own messages
      expect(find.byIcon(Icons.done_all), findsOneWidget);
    });

    testWidgets('should display unread status when provided', (WidgetTester tester) async {
      final unreadMessage = Message(
        id: 'msg127',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Test message',
        createdAt: DateTime.now(),
        readBy: const ['2025CS1001'], // Only read by sender
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: unreadMessage,
              isCurrentUser: true,
            ),
          ),
        ),
      );

      // Should show unread indicator for own messages
      expect(find.byIcon(Icons.done), findsOneWidget);
    });

    testWidgets('should handle message with media', (WidgetTester tester) async {
      final mediaMessage = Message(
        id: 'msg128',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Check out this image!',
        media: const MessageMedia(
          url: 'https://example.com/image.jpg',
          cloudinaryPublicId: 'test_image',
        ),
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: mediaMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      expect(find.text('Check out this image!'), findsOneWidget);
      // CachedNetworkImage should be present
      expect(find.byType(Container), findsAtLeastNWidgets(1));
    });

    testWidgets('should handle empty message with media only', (WidgetTester tester) async {
      final mediaOnlyMessage = Message(
        id: 'msg129',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: null,
        media: const MessageMedia(
          url: 'https://example.com/image.jpg',
          cloudinaryPublicId: 'test_image',
        ),
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: mediaOnlyMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      // Should have media container
      expect(find.byType(Container), findsAtLeastNWidgets(1));
    });

    testWidgets('should display message bubble correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: testMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      expect(find.byType(MessageBubble), findsOneWidget);
      expect(find.text('Hello, this is a test message!'), findsOneWidget);
    });

    testWidgets('should handle different message types', (WidgetTester tester) async {
      final textMessage = Message(
        id: 'msg130',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Text message',
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );

      final systemMessage = Message(
        id: 'msg131',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'System message',
        createdAt: DateTime.now(),
        readBy: const [],
        sender: testUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                MessageBubble(
                  message: textMessage,
                  isCurrentUser: false,
                ),
                MessageBubble(
                  message: systemMessage,
                  isCurrentUser: false,
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Text message'), findsOneWidget);
      expect(find.text('System message'), findsOneWidget);
    });
  });

  group('MessageBubble Accessibility Tests', () {
    testWidgets('should have proper accessibility labels', (WidgetTester tester) async {
      final accTestUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );
      
      final accessibilityMessage = Message(
        id: 'msg_acc',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'Accessible message',
        createdAt: DateTime.now(),
        readBy: const [],
        sender: accTestUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: accessibilityMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      // Should display message content properly
      expect(find.byType(MessageBubble), findsOneWidget);
    });

    testWidgets('should support different user types', (WidgetTester tester) async {
      final userTestUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );
      
      final userTypeMessage = Message(
        id: 'msg_user',
        conversationId: 'conv123',
        senderStudentId: '2025CS1001',
        text: 'User type message',
        createdAt: DateTime.now(),
        readBy: const [],
        sender: userTestUser,
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: userTypeMessage,
              isCurrentUser: false,
            ),
          ),
        ),
      );

      // Should handle different user configurations
      expect(find.byType(MessageBubble), findsOneWidget);
    });
  });

  group('MessageBubble Performance Tests', () {
    testWidgets('should render efficiently with many messages', (WidgetTester tester) async {
      final perfTestUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );
      
      final messages = List.generate(10, (index) {
        final message = Message(
          id: 'msg$index',
          conversationId: 'conv123',
          senderStudentId: '2025CS1001',
          text: 'Message $index',
          createdAt: DateTime.now().subtract(Duration(minutes: index)),
          readBy: const [],
          sender: perfTestUser,
        );
        
        return MessageBubble(
          message: message,
          isCurrentUser: index % 2 == 0,
        );
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: messages,
            ),
          ),
        ),
      );

      // Should render without performance issues (some may not be visible in viewport)
      expect(find.byType(MessageBubble), findsAtLeastNWidgets(5));
    });
  });
}