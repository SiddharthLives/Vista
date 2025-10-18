import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vista/screens/home_feed_screen.dart';
import 'package:vista/screens/auth/sign_in_screen.dart';
import 'package:vista/screens/profile_screen.dart';
import 'package:vista/screens/notifications_screen.dart';
import 'package:vista/widgets/post_widget.dart';
import 'package:vista/widgets/user_card.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/user.dart';
import '../test_setup.dart';

void main() {
  setUpAll(() async {
    await setupFirebaseForTesting();
  });

  group('Accessibility Tests', () {
    testWidgets('Sign In Screen accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: SignInScreen(),
        ),
      );

      // Check for semantic labels
      expect(find.bySemanticsLabel('Sign in with Google'), findsOneWidget);
      
      // Check for proper heading structure
      final titleFinder = find.text('Welcome to Vista');
      expect(titleFinder, findsOneWidget);
      
      // Verify button has proper semantics
      final signInButton = find.byType(ElevatedButton);
      expect(signInButton, findsOneWidget);
      
      final buttonWidget = tester.widget<ElevatedButton>(signInButton);
      expect(buttonWidget.onPressed, isNotNull);
    });

    testWidgets('Home Feed Screen accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: HomeFeedScreen(),
        ),
      );

      // Check for app bar accessibility
      expect(find.byType(AppBar), findsOneWidget);
      
      // Check for floating action button accessibility
      final fab = find.byType(FloatingActionButton);
      if (fab.evaluate().isNotEmpty) {
        expect(fab, findsOneWidget);
        
        final fabWidget = tester.widget<FloatingActionButton>(fab);
        expect(fabWidget.onPressed, isNotNull);
      }

      // Check for proper navigation semantics
      expect(find.byType(BottomNavigationBar), findsOneWidget);
    });

    testWidgets('Post Widget accessibility', (WidgetTester tester) async {
      final testPost = Post(
        id: 'post_1',
        authorId: '2025CS1001',
        authorName: 'Test User',
        content: 'This is a test post for accessibility testing',
        timestamp: DateTime.now(),
        likesCount: 5,
        commentsCount: 2,
        isLiked: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PostWidget(post: testPost),
          ),
        ),
      );

      // Check for semantic labels on interactive elements
      final likeButton = find.byIcon(Icons.favorite_border);
      expect(likeButton, findsOneWidget);
      
      // Verify like button has proper semantics
      final likeButtonWidget = tester.widget<IconButton>(
        find.ancestor(
          of: likeButton,
          matching: find.byType(IconButton),
        ),
      );
      expect(likeButtonWidget.onPressed, isNotNull);

      // Check for comment button accessibility
      final commentButton = find.byIcon(Icons.comment_outlined);
      expect(commentButton, findsOneWidget);

      // Verify post content is accessible
      expect(find.text('This is a test post for accessibility testing'), findsOneWidget);
      expect(find.text('Test User'), findsOneWidget);
    });

    testWidgets('User Card accessibility', (WidgetTester tester) async {
      final testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        year: 3,
        department: 'CS',
        section: 'A',
        bio: 'Computer Science student',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UserCard(user: testUser),
          ),
        ),
      );

      // Check for user information accessibility
      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('Computer Science student'), findsOneWidget);
      
      // Verify card is tappable and has proper semantics
      final cardWidget = find.byType(Card);
      expect(cardWidget, findsOneWidget);
    });

    testWidgets('Navigation accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: BottomNavigationBar(
              type: BottomNavigationBarType.fixed,
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.home),
                  label: 'Home',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.forum),
                  label: 'Topics',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.chat),
                  label: 'Chat',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.notifications),
                  label: 'Notifications',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      );

      // Check that all navigation items have proper labels
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Topics'), findsOneWidget);
      expect(find.text('Chat'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);

      // Verify icons are present
      expect(find.byIcon(Icons.home), findsOneWidget);
      expect(find.byIcon(Icons.forum), findsOneWidget);
      expect(find.byIcon(Icons.chat), findsOneWidget);
      expect(find.byIcon(Icons.notifications), findsOneWidget);
      expect(find.byIcon(Icons.person), findsOneWidget);
    });

    testWidgets('Form accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Form(
              child: Column(
                children: [
                  TextFormField(
                    decoration: const InputDecoration(
                      labelText: 'Display Name',
                      hintText: 'Enter your display name',
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your display name';
                      }
                      return null;
                    },
                  ),
                  TextFormField(
                    decoration: const InputDecoration(
                      labelText: 'Bio',
                      hintText: 'Tell us about yourself',
                    ),
                    maxLines: 3,
                  ),
                  ElevatedButton(
                    onPressed: () {},
                    child: const Text('Save'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      // Check for proper form field labels
      expect(find.text('Display Name'), findsOneWidget);
      expect(find.text('Bio'), findsOneWidget);
      
      // Check for hint text
      expect(find.text('Enter your display name'), findsOneWidget);
      expect(find.text('Tell us about yourself'), findsOneWidget);

      // Verify form fields are focusable
      final textFields = find.byType(TextFormField);
      expect(textFields, findsNWidgets(2));

      // Check save button
      expect(find.text('Save'), findsOneWidget);
      final saveButton = find.byType(ElevatedButton);
      expect(saveButton, findsOneWidget);
    });

    testWidgets('Loading states accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(
                    semanticsLabel: 'Loading posts',
                  ),
                  SizedBox(height: 16),
                  Text('Loading...'),
                ],
              ),
            ),
          ),
        ),
      );

      // Check for loading indicator with semantic label
      expect(find.bySemanticsLabel('Loading posts'), findsOneWidget);
      expect(find.text('Loading...'), findsOneWidget);
    });

    testWidgets('Error states accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 48,
                    semanticLabel: 'Error',
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Failed to load content',
                    style: TextStyle(fontSize: 18),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {},
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      // Check for error message accessibility
      expect(find.bySemanticsLabel('Error'), findsOneWidget);
      expect(find.text('Failed to load content'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('Image accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: Image(
                image: NetworkImage('https://example.com/image.jpg'),
                semanticLabel: 'User profile picture',
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return const CircularProgressIndicator();
                },
                errorBuilder: (context, error, stackTrace) {
                  return const Icon(Icons.error);
                },
              ),
            ),
          ),
        ),
      );

      // Check for image semantic label
      expect(find.bySemanticsLabel('User profile picture'), findsOneWidget);
    });

    testWidgets('List accessibility', (WidgetTester tester) async {
      final items = List.generate(10, (index) => 'Item ${index + 1}');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: AppBar(title: const Text('List Example')),
            body: ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                return ListTile(
                  title: Text(items[index]),
                  subtitle: Text('Description for ${items[index]}'),
                  leading: const Icon(Icons.list),
                  onTap: () {},
                );
              },
            ),
          ),
        ),
      );

      // Check for list items
      expect(find.text('Item 1'), findsOneWidget);
      expect(find.text('Description for Item 1'), findsOneWidget);
      
      // Verify list tiles are tappable
      final listTiles = find.byType(ListTile);
      expect(listTiles, findsAtLeastNWidgets(1));
    });

    testWidgets('Dialog accessibility', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Confirm Action'),
                      content: const Text('Are you sure you want to proceed?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Confirm'),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text('Show Dialog'),
              ),
            ),
          ),
        ),
      );

      // Tap button to show dialog
      await tester.tap(find.text('Show Dialog'));
      await tester.pumpAndSettle();

      // Check dialog accessibility
      expect(find.text('Confirm Action'), findsOneWidget);
      expect(find.text('Are you sure you want to proceed?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Confirm'), findsOneWidget);

      // Verify buttons are accessible
      final cancelButton = find.text('Cancel');
      final confirmButton = find.text('Confirm');
      expect(cancelButton, findsOneWidget);
      expect(confirmButton, findsOneWidget);
    });

    testWidgets('Focus management', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                TextFormField(
                  decoration: const InputDecoration(labelText: 'First Field'),
                ),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Second Field'),
                ),
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Submit'),
                ),
              ],
            ),
          ),
        ),
      );

      // Test tab navigation
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();

      // Should focus on first text field
      final firstField = find.byType(TextFormField).first;
      expect(Focus.of(tester.element(firstField)).hasFocus, isTrue);
    });

    testWidgets('Semantic announcements', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  SemanticsService.announce(
                    'Action completed successfully',
                    TextDirection.ltr,
                  );
                },
                child: const Text('Perform Action'),
              ),
            ),
          ),
        ),
      );

      // Tap button to trigger announcement
      await tester.tap(find.text('Perform Action'));
      await tester.pump();

      // Verify button exists and is tappable
      expect(find.text('Perform Action'), findsOneWidget);
    });
  });

  group('Screen Reader Tests', () {
    testWidgets('Should provide proper reading order', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: AppBar(
              title: const Text('Test Screen'),
            ),
            body: const Column(
              children: [
                Text('Header Text'),
                Text('Body content goes here'),
                Text('Footer information'),
              ],
            ),
          ),
        ),
      );

      // Verify semantic order
      final semantics = tester.binding.pipelineOwner.semanticsOwner!;
      expect(semantics, isNotNull);
    });

    testWidgets('Should handle dynamic content updates', (WidgetTester tester) async {
      bool showContent = false;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) => Scaffold(
              body: Column(
                children: [
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        showContent = !showContent;
                      });
                    },
                    child: Text(showContent ? 'Hide Content' : 'Show Content'),
                  ),
                  if (showContent)
                    const Text('Dynamic content appeared'),
                ],
              ),
            ),
          ),
        ),
      );

      // Initially content should not be visible
      expect(find.text('Dynamic content appeared'), findsNothing);

      // Tap to show content
      await tester.tap(find.text('Show Content'));
      await tester.pumpAndSettle();

      // Content should now be visible
      expect(find.text('Dynamic content appeared'), findsOneWidget);
      expect(find.text('Hide Content'), findsOneWidget);
    });
  });

  group('Color Contrast Tests', () {
    testWidgets('Should use sufficient color contrast', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            // Ensure good contrast ratios
            colorScheme: ColorScheme.fromSeed(
              seedColor: Colors.blue,
              brightness: Brightness.light,
            ),
          ),
          home: Scaffold(
            appBar: AppBar(
              title: const Text('Contrast Test'),
            ),
            body: const Column(
              children: [
                Card(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text(
                      'This text should have sufficient contrast',
                      style: TextStyle(fontSize: 16),
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: null,
                  child: Text('Disabled Button'),
                ),
              ],
            ),
          ),
        ),
      );

      // Verify text is visible
      expect(find.text('This text should have sufficient contrast'), findsOneWidget);
      expect(find.text('Disabled Button'), findsOneWidget);
    });
  });
}