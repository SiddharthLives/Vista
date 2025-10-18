import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:provider/provider.dart';
import 'package:vista/main.dart';
import 'package:vista/providers/auth_provider.dart';
import 'package:vista/providers/feed_provider.dart';
import 'package:vista/providers/chat_provider.dart';
import 'package:vista/providers/notifications_provider.dart';
import 'package:vista/models/user.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/notification.dart';
import '../test_setup.dart';

// Mock providers
class MockAuthProvider extends Mock implements AuthProvider {}
class MockFeedProvider extends Mock implements FeedProvider {}
class MockChatProvider extends Mock implements ChatProvider {}
class MockNotificationsProvider extends Mock implements NotificationsProvider {}

void main() {
  setUpAll(() async {
    await setupFirebaseForTesting();
  });

  group('User Flow Integration Tests', () {
    late MockAuthProvider mockAuthProvider;
    late MockFeedProvider mockFeedProvider;
    late MockChatProvider mockChatProvider;
    late MockNotificationsProvider mockNotificationsProvider;
    late User testUser;

    setUp(() {
      mockAuthProvider = MockAuthProvider();
      mockFeedProvider = MockFeedProvider();
      mockChatProvider = MockChatProvider();
      mockNotificationsProvider = MockNotificationsProvider();
      
      testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
      );

      // Setup default mock behaviors
      when(mockAuthProvider.isAuthenticated).thenReturn(true);
      when(mockAuthProvider.currentUser).thenReturn(testUser);
      when(mockAuthProvider.isLoading).thenReturn(false);
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockFeedProvider.isLoading).thenReturn(false);
      when(mockChatProvider.conversations).thenReturn([]);
      when(mockNotificationsProvider.notifications).thenReturn([]);
      when(mockNotificationsProvider.unreadCount).thenReturn(0);
    });

    testWidgets('Complete user authentication flow', (WidgetTester tester) async {
      // Start with unauthenticated state
      when(mockAuthProvider.isAuthenticated).thenReturn(false);
      when(mockAuthProvider.currentUser).thenReturn(null);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Should show sign-in screen
      expect(find.text('Sign In'), findsOneWidget);
      expect(find.text('Sign in with Google'), findsOneWidget);

      // Simulate successful sign-in
      when(mockAuthProvider.isAuthenticated).thenReturn(true);
      when(mockAuthProvider.currentUser).thenReturn(testUser);
      when(mockAuthProvider.signInWithGoogle()).thenAnswer((_) async => true);

      // Tap sign-in button
      await tester.tap(find.text('Sign in with Google'));
      await tester.pumpAndSettle();

      // Should navigate to main app
      verify(mockAuthProvider.signInWithGoogle()).called(1);
    });

    testWidgets('Feed browsing and interaction flow', (WidgetTester tester) async {
      final testPosts = [
        Post(
          id: 'post_1',
          authorId: '2025CS1002',
          authorName: 'Jane Doe',
          content: 'This is a test post',
          timestamp: DateTime.now(),
          likesCount: 5,
          commentsCount: 2,
          isLiked: false,
        ),
        Post(
          id: 'post_2',
          authorId: '2025CS1003',
          authorName: 'Bob Smith',
          content: 'Another test post with more content',
          timestamp: DateTime.now().subtract(const Duration(hours: 1)),
          likesCount: 10,
          commentsCount: 5,
          isLiked: true,
        ),
      ];

      when(mockFeedProvider.posts).thenReturn(testPosts);
      when(mockFeedProvider.loadPosts()).thenAnswer((_) async {});
      when(mockFeedProvider.likePost(any)).thenAnswer((_) async {});

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Should show feed with posts
      expect(find.text('This is a test post'), findsOneWidget);
      expect(find.text('Another test post with more content'), findsOneWidget);
      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('Bob Smith'), findsOneWidget);

      // Test liking a post
      final likeButton = find.byIcon(Icons.favorite_border).first;
      await tester.tap(likeButton);
      await tester.pumpAndSettle();

      verify(mockFeedProvider.likePost('post_1')).called(1);
    });

    testWidgets('Navigation between tabs flow', (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Should start on home/feed tab
      expect(find.byIcon(Icons.home), findsOneWidget);

      // Navigate to topics tab
      await tester.tap(find.byIcon(Icons.forum));
      await tester.pumpAndSettle();

      // Should show topics screen
      expect(find.text('Topics'), findsOneWidget);

      // Navigate to chat tab
      await tester.tap(find.byIcon(Icons.chat));
      await tester.pumpAndSettle();

      // Should show chat screen
      expect(find.text('Conversations'), findsOneWidget);

      // Navigate to notifications tab
      await tester.tap(find.byIcon(Icons.notifications));
      await tester.pumpAndSettle();

      // Should show notifications screen
      expect(find.text('Notifications'), findsOneWidget);

      // Navigate to profile tab
      await tester.tap(find.byIcon(Icons.person));
      await tester.pumpAndSettle();

      // Should show profile screen
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('Post creation flow', (WidgetTester tester) async {
      when(mockFeedProvider.createPost(any, any)).thenAnswer((_) async => true);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Tap create post button
      await tester.tap(find.byIcon(Icons.add));
      await tester.pumpAndSettle();

      // Should show post creation screen
      expect(find.text('Create Post'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);

      // Enter post content
      await tester.enterText(find.byType(TextField), 'This is my new post!');
      await tester.pumpAndSettle();

      // Tap share button
      await tester.tap(find.text('Share'));
      await tester.pumpAndSettle();

      // Should call create post
      verify(mockFeedProvider.createPost('This is my new post!', any)).called(1);
    });

    testWidgets('Notification interaction flow', (WidgetTester tester) async {
      final testNotifications = [
        NotificationModel(
          id: 'notif_1',
          type: NotificationType.like,
          title: 'New Like',
          message: 'Someone liked your post',
          timestamp: DateTime.now(),
          isRead: false,
          fromUser: 'Jane Doe',
          entityId: 'post_123',
        ),
        NotificationModel(
          id: 'notif_2',
          type: NotificationType.comment,
          title: 'New Comment',
          message: 'Someone commented on your post',
          timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
          isRead: true,
          fromUser: 'Bob Smith',
          entityId: 'post_456',
        ),
      ];

      when(mockNotificationsProvider.notifications).thenReturn(testNotifications);
      when(mockNotificationsProvider.unreadCount).thenReturn(1);
      when(mockNotificationsProvider.loadNotifications()).thenAnswer((_) async {});
      when(mockNotificationsProvider.markAsRead(any)).thenAnswer((_) async {});

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Navigate to notifications
      await tester.tap(find.byIcon(Icons.notifications));
      await tester.pumpAndSettle();

      // Should show notifications
      expect(find.text('New Like'), findsOneWidget);
      expect(find.text('New Comment'), findsOneWidget);

      // Tap on a notification
      await tester.tap(find.text('New Like'));
      await tester.pumpAndSettle();

      // Should mark notification as read
      verify(mockNotificationsProvider.markAsRead('notif_1')).called(1);
    });

    testWidgets('Search functionality flow', (WidgetTester tester) async {
      when(mockFeedProvider.searchPosts(any)).thenAnswer((_) async => []);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Tap search icon
      await tester.tap(find.byIcon(Icons.search));
      await tester.pumpAndSettle();

      // Should show search screen
      expect(find.text('Search'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);

      // Enter search query
      await tester.enterText(find.byType(TextField), 'test query');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      // Should perform search
      verify(mockFeedProvider.searchPosts('test query')).called(1);
    });

    testWidgets('Profile editing flow', (WidgetTester tester) async {
      when(mockAuthProvider.updateProfile(any)).thenAnswer((_) async => true);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Navigate to profile
      await tester.tap(find.byIcon(Icons.person));
      await tester.pumpAndSettle();

      // Tap edit profile button
      await tester.tap(find.text('Edit Profile'));
      await tester.pumpAndSettle();

      // Should show edit profile screen
      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.byType(TextField), findsAtLeastNWidgets(1));

      // Update display name
      await tester.enterText(find.byType(TextField).first, 'Updated Name');
      await tester.pumpAndSettle();

      // Save changes
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      // Should call update profile
      verify(mockAuthProvider.updateProfile(any)).called(1);
    });

    testWidgets('Error handling flow', (WidgetTester tester) async {
      // Simulate network error
      when(mockFeedProvider.loadPosts()).thenThrow(Exception('Network error'));
      when(mockFeedProvider.isLoading).thenReturn(false);
      when(mockFeedProvider.error).thenReturn('Failed to load posts');

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Should show error message
      expect(find.text('Failed to load posts'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      // Tap retry button
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      // Should attempt to reload
      verify(mockFeedProvider.loadPosts()).called(atLeastOnce);
    });

    testWidgets('Offline mode handling', (WidgetTester tester) async {
      // Simulate offline state
      when(mockFeedProvider.isOffline).thenReturn(true);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Should show offline indicator
      expect(find.text('Offline'), findsOneWidget);
      expect(find.byIcon(Icons.cloud_off), findsOneWidget);
    });
  });

  group('Performance Integration Tests', () {
    testWidgets('Should handle rapid navigation without issues', (WidgetTester tester) async {
      final mockAuthProvider = MockAuthProvider();
      final mockFeedProvider = MockFeedProvider();
      final mockChatProvider = MockChatProvider();
      final mockNotificationsProvider = MockNotificationsProvider();

      when(mockAuthProvider.isAuthenticated).thenReturn(true);
      when(mockAuthProvider.currentUser).thenReturn(User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
      ));
      when(mockFeedProvider.posts).thenReturn([]);
      when(mockChatProvider.conversations).thenReturn([]);
      when(mockNotificationsProvider.notifications).thenReturn([]);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: mockAuthProvider),
            ChangeNotifierProvider<FeedProvider>.value(value: mockFeedProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: mockChatProvider),
            ChangeNotifierProvider<NotificationsProvider>.value(value: mockNotificationsProvider),
          ],
          child: const MyApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Rapidly navigate between tabs
      for (int i = 0; i < 10; i++) {
        await tester.tap(find.byIcon(Icons.forum));
        await tester.pump();
        await tester.tap(find.byIcon(Icons.chat));
        await tester.pump();
        await tester.tap(find.byIcon(Icons.notifications));
        await tester.pump();
        await tester.tap(find.byIcon(Icons.person));
        await tester.pump();
        await tester.tap(find.byIcon(Icons.home));
        await tester.pump();
      }

      await tester.pumpAndSettle();

      // Should not crash or show errors
      expect(tester.takeException(), isNull);
    });
  });
}

enum NotificationType {
  like,
  comment,
  follow,
  message,
}