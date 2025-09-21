import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vista/widgets/post_widget.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/user.dart';

void main() {
  group('PostWidget', () {
    late Post testPost;
    late User testUser;

    setUp(() {
      testUser = User(
        studentId: 'student1',
        displayName: 'Test User',
        email: 'test@college.edu',
        year: 3,
        department: 'Computer Science',
        section: 'A',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );

      testPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'This is a test post',
        visibility: PostVisibility.public,
        tags: ['test', 'flutter'],
        likesCount: 5,
        commentsCount: 3,
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        author: testUser,
      );
    });

    Widget createTestWidget(Post post, {
      VoidCallback? onLike,
      VoidCallback? onComment,
      VoidCallback? onShare,
    }) {
      return MaterialApp(
        home: Scaffold(
          body: PostWidget(
            post: post,
            onLike: onLike,
            onComment: onComment,
            onShare: onShare,
          ),
        ),
      );
    }

    testWidgets('displays post content correctly', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(testPost));

      // Assert
      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('This is a test post'), findsOneWidget);
      expect(find.text('Year 3 • Computer Science • Section A'), findsOneWidget);
      expect(find.text('5 likes'), findsOneWidget);
      expect(find.text('3 comments'), findsOneWidget);
    });

    testWidgets('displays user initials when no photo URL', (tester) async {
      // Arrange
      final postWithoutPhoto = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Test post',
        visibility: PostVisibility.public,
        createdAt: DateTime.now(),
        author: User(
          studentId: 'student1',
          displayName: 'John Doe',
          email: 'john@college.edu',
          year: 2,
          department: 'Engineering',
          section: 'B',
          createdAt: DateTime.now(),
          settings: const UserSettings(),
        ),
      );

      // Act
      await tester.pumpWidget(createTestWidget(postWithoutPhoto));

      // Assert
      expect(find.text('JD'), findsOneWidget);
    });

    testWidgets('displays visibility chip correctly', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(testPost));

      // Assert
      expect(find.text('Public'), findsOneWidget);
      expect(find.byIcon(Icons.public), findsOneWidget);
    });

    testWidgets('displays tags correctly', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(testPost));

      // Assert
      expect(find.text('#test'), findsOneWidget);
      expect(find.text('#flutter'), findsOneWidget);
    });

    testWidgets('calls onLike when like button is tapped', (tester) async {
      // Arrange
      bool likeCalled = false;
      void onLike() => likeCalled = true;

      // Act
      await tester.pumpWidget(createTestWidget(testPost, onLike: onLike));
      await tester.tap(find.byIcon(Icons.favorite_border));

      // Assert
      expect(likeCalled, true);
    });

    testWidgets('calls onComment when comment button is tapped', (tester) async {
      // Arrange
      bool commentCalled = false;
      void onComment() => commentCalled = true;

      // Act
      await tester.pumpWidget(createTestWidget(testPost, onComment: onComment));
      await tester.tap(find.byIcon(Icons.comment_outlined));

      // Assert
      expect(commentCalled, true);
    });

    testWidgets('calls onShare when share button is tapped', (tester) async {
      // Arrange
      bool shareCalled = false;
      void onShare() => shareCalled = true;

      // Act
      await tester.pumpWidget(createTestWidget(testPost, onShare: onShare));
      await tester.tap(find.byIcon(Icons.share_outlined));

      // Assert
      expect(shareCalled, true);
    });

    testWidgets('shows post options when more button is tapped', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(testPost));
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Share'), findsOneWidget);
      expect(find.text('Report'), findsOneWidget);
      expect(find.text('Hide'), findsOneWidget);
    });

    testWidgets('displays different visibility types correctly', (tester) async {
      // Test year visibility
      final yearPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Year post',
        visibility: PostVisibility.year,
        createdAt: DateTime.now(),
        author: testUser,
      );

      await tester.pumpWidget(createTestWidget(yearPost));
      expect(find.text('Year'), findsOneWidget);
      expect(find.byIcon(Icons.school), findsOneWidget);

      // Test department visibility
      final deptPost = Post(
        id: '2',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Dept post',
        visibility: PostVisibility.dept,
        createdAt: DateTime.now(),
        author: testUser,
      );

      await tester.pumpWidget(createTestWidget(deptPost));
      expect(find.text('Department'), findsOneWidget);
      expect(find.byIcon(Icons.group), findsOneWidget);

      // Test section visibility
      final sectionPost = Post(
        id: '3',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'Section post',
        visibility: PostVisibility.section,
        createdAt: DateTime.now(),
        author: testUser,
      );

      await tester.pumpWidget(createTestWidget(sectionPost));
      expect(find.text('Section'), findsOneWidget);
      expect(find.byIcon(Icons.people), findsOneWidget);
    });

    testWidgets('handles post with media', (tester) async {
      // Arrange
      final mediaPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.image,
        text: 'Post with image',
        visibility: PostVisibility.public,
        media: [
          const MediaItem(
            url: 'https://example.com/image.jpg',
            cloudinaryPublicId: 'test_image',
            width: 800,
            height: 600,
          ),
        ],
        createdAt: DateTime.now(),
        author: testUser,
      );

      // Act
      await tester.pumpWidget(createTestWidget(mediaPost));

      // Assert
      expect(find.text('Post with image'), findsOneWidget);
      // Note: We can't easily test the actual image loading in unit tests
      // but we can verify the widget structure is correct
    });

    testWidgets('handles empty stats correctly', (tester) async {
      // Arrange
      final emptyStatsPost = Post(
        id: '1',
        authorStudentId: 'student1',
        type: PostType.text,
        text: 'No stats post',
        visibility: PostVisibility.public,
        likesCount: 0,
        commentsCount: 0,
        createdAt: DateTime.now(),
        author: testUser,
      );

      // Act
      await tester.pumpWidget(createTestWidget(emptyStatsPost));

      // Assert
      expect(find.text('0 likes'), findsNothing);
      expect(find.text('0 comments'), findsNothing);
      expect(find.text('No stats post'), findsOneWidget);
    });
  });
}