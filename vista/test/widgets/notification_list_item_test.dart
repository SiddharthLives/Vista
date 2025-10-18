import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vista/widgets/notification_list_item.dart';
import 'package:vista/models/notification.dart';
import '../test_setup.dart';

void main() {
  setUpAll(() async {
    await setupFirebaseForTesting();
  });

  group('NotificationListItem Widget Tests', () {
    late NotificationModel testNotification;

    setUp(() {
      testNotification = NotificationModel(
        id: 'notif_1',
        type: NotificationType.like,
        title: 'New Like',
        message: 'Someone liked your post',
        timestamp: DateTime.now(),
        isRead: false,
        fromUser: 'John Doe',
        entityId: 'post_123',
      );
    });

    testWidgets('should display notification content correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: testNotification,
            ),
          ),
        ),
      );

      expect(find.text('New Like'), findsOneWidget);
      expect(find.text('Someone liked your post'), findsOneWidget);
      expect(find.text('John Doe'), findsOneWidget);
    });

    testWidgets('should show unread indicator for unread notifications', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: testNotification,
            ),
          ),
        ),
      );

      // Should have visual indicator for unread notification
      expect(find.byType(Container), findsAtLeastNWidgets(1));
      
      final container = tester.widget<Container>(
        find.descendant(
          of: find.byType(NotificationListItem),
          matching: find.byType(Container),
        ).first,
      );
      
      // Unread notifications should have different styling
      expect(container.decoration, isA<BoxDecoration>());
    });

    testWidgets('should not show unread indicator for read notifications', (WidgetTester tester) async {
      final readNotification = testNotification.copyWith(isRead: true);
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: readNotification,
            ),
          ),
        ),
      );

      // Read notifications should have different styling
      expect(find.byType(NotificationListItem), findsOneWidget);
    });

    testWidgets('should display correct icon for different notification types', (WidgetTester tester) async {
      final likeNotification = testNotification.copyWith(type: NotificationType.like);
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: likeNotification,
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.favorite), findsOneWidget);
    });

    testWidgets('should display comment icon for comment notifications', (WidgetTester tester) async {
      final commentNotification = testNotification.copyWith(
        type: NotificationType.comment,
        title: 'New Comment',
        message: 'Someone commented on your post',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: commentNotification,
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.comment), findsOneWidget);
      expect(find.text('New Comment'), findsOneWidget);
    });

    testWidgets('should display follow icon for follow notifications', (WidgetTester tester) async {
      final followNotification = testNotification.copyWith(
        type: NotificationType.follow,
        title: 'New Follower',
        message: 'Someone started following you',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: followNotification,
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.person_add), findsOneWidget);
      expect(find.text('New Follower'), findsOneWidget);
    });

    testWidgets('should display message icon for message notifications', (WidgetTester tester) async {
      final messageNotification = testNotification.copyWith(
        type: NotificationType.message,
        title: 'New Message',
        message: 'You have a new message',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: messageNotification,
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.message), findsOneWidget);
      expect(find.text('New Message'), findsOneWidget);
    });

    testWidgets('should display relative timestamp', (WidgetTester tester) async {
      final recentNotification = testNotification.copyWith(
        timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: recentNotification,
            ),
          ),
        ),
      );

      // Should display relative time like "5m ago"
      expect(find.textContaining('ago'), findsOneWidget);
    });

    testWidgets('should be tappable', (WidgetTester tester) async {
      bool tapped = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: testNotification,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(NotificationListItem));
      expect(tapped, isTrue);
    });

    testWidgets('should handle long notification messages', (WidgetTester tester) async {
      final longMessageNotification = testNotification.copyWith(
        message: 'This is a very long notification message that should be '
            'properly truncated or wrapped to fit within the available space '
            'without causing overflow issues in the UI layout.',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: longMessageNotification,
            ),
          ),
        ),
      );

      expect(find.byType(NotificationListItem), findsOneWidget);
      // Should not cause overflow
    });

    testWidgets('should support swipe to dismiss', (WidgetTester tester) async {
      bool dismissed = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: testNotification,
              onDismiss: () => dismissed = true,
            ),
          ),
        ),
      );

      await tester.drag(find.byType(NotificationListItem), const Offset(-300, 0));
      await tester.pumpAndSettle();
      
      expect(dismissed, isTrue);
    });

    testWidgets('should show action buttons when provided', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: testNotification,
              actions: [
                NotificationAction(
                  label: 'View',
                  onPressed: () {},
                ),
                NotificationAction(
                  label: 'Dismiss',
                  onPressed: () {},
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.text('View'), findsOneWidget);
      expect(find.text('Dismiss'), findsOneWidget);
    });
  });

  group('NotificationListItem Accessibility Tests', () {
    testWidgets('should have proper accessibility labels', (WidgetTester tester) async {
      final notification = NotificationModel(
        id: 'notif_1',
        type: NotificationType.like,
        title: 'New Like',
        message: 'Someone liked your post',
        timestamp: DateTime.now(),
        isRead: false,
        fromUser: 'John Doe',
        entityId: 'post_123',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: notification,
            ),
          ),
        ),
      );

      // Should have semantic information for screen readers
      expect(find.byType(Semantics), findsAtLeastNWidgets(1));
    });

    testWidgets('should announce read status to screen readers', (WidgetTester tester) async {
      final unreadNotification = NotificationModel(
        id: 'notif_1',
        type: NotificationType.like,
        title: 'New Like',
        message: 'Someone liked your post',
        timestamp: DateTime.now(),
        isRead: false,
        fromUser: 'John Doe',
        entityId: 'post_123',
      );
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationListItem(
              notification: unreadNotification,
            ),
          ),
        ),
      );

      // Should have accessibility hints for read/unread status
      final semantics = tester.widget<Semantics>(
        find.descendant(
          of: find.byType(NotificationListItem),
          matching: find.byType(Semantics),
        ).first,
      );
      
      expect(semantics.properties.label, contains('unread'));
    });
  });

  group('NotificationListItem Performance Tests', () {
    testWidgets('should render efficiently in long lists', (WidgetTester tester) async {
      final notifications = List.generate(50, (index) => 
        NotificationModel(
          id: 'notif_$index',
          type: NotificationType.values[index % NotificationType.values.length],
          title: 'Notification $index',
          message: 'This is notification number $index',
          timestamp: DateTime.now().subtract(Duration(minutes: index)),
          isRead: index % 3 == 0,
          fromUser: 'User $index',
          entityId: 'entity_$index',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (context, index) => NotificationListItem(
                notification: notifications[index],
              ),
            ),
          ),
        ),
      );

      // Should render without performance issues
      expect(find.byType(NotificationListItem), findsAtLeastNWidgets(1));
    });
  });
}

class NotificationAction {
  final String label;
  final VoidCallback onPressed;

  NotificationAction({
    required this.label,
    required this.onPressed,
  });
}

enum NotificationType {
  like,
  comment,
  follow,
  message,
}