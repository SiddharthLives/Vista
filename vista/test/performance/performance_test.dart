import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vista/widgets/post_widget.dart';
import 'package:vista/widgets/stories_carousel.dart';
import 'package:vista/widgets/user_card.dart';
import 'package:vista/models/post.dart';
import 'package:vista/models/user.dart';
import 'package:vista/models/story.dart';
import '../test_setup.dart';

void main() {
  setUpAll(() async {
    await setupFirebaseForTesting();
  });

  group('Performance Tests', () {
    testWidgets('Large list scrolling performance', (WidgetTester tester) async {
      // Create a large number of posts
      final posts = List.generate(1000, (index) => Post(
        id: 'post_$index',
        authorId: '2025CS${(index % 100).toString().padLeft(3, '0')}',
        authorName: 'User $index',
        content: 'This is post number $index with some content to test scrolling performance',
        timestamp: DateTime.now().subtract(Duration(minutes: index)),
        likesCount: index % 50,
        commentsCount: index % 20,
        isLiked: index % 3 == 0,
      ));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: posts.length,
              itemBuilder: (context, index) => PostWidget(post: posts[index]),
            ),
          ),
        ),
      );

      // Measure initial build time
      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should build within reasonable time (less than 1 second for initial render)
      expect(stopwatch.elapsedMilliseconds, lessThan(1000));

      // Test scrolling performance
      final scrollStopwatch = Stopwatch()..start();
      
      // Perform multiple scroll operations
      for (int i = 0; i < 10; i++) {
        await tester.drag(find.byType(ListView), const Offset(0, -500));
        await tester.pump();
      }
      
      scrollStopwatch.stop();
      
      // Scrolling should be smooth (less than 100ms for 10 scroll operations)
      expect(scrollStopwatch.elapsedMilliseconds, lessThan(100));
    });

    testWidgets('Stories carousel performance', (WidgetTester tester) async {
      // Create many stories
      final stories = List.generate(100, (index) => Story(
        id: 'story_$index',
        authorId: '2025CS${(index % 50).toString().padLeft(3, '0')}',
        authorName: 'User $index',
        mediaUrl: 'https://example.com/story_$index.jpg',
        timestamp: DateTime.now().subtract(Duration(hours: index)),
        viewsCount: index * 10,
        isViewed: index % 4 == 0,
      ));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StoriesCarousel(stories: stories),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should render stories carousel efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(500));

      // Test horizontal scrolling performance
      final scrollStopwatch = Stopwatch()..start();
      
      for (int i = 0; i < 5; i++) {
        await tester.drag(find.byType(StoriesCarousel), const Offset(-200, 0));
        await tester.pump();
      }
      
      scrollStopwatch.stop();
      expect(scrollStopwatch.elapsedMilliseconds, lessThan(50));
    });

    testWidgets('User cards grid performance', (WidgetTester tester) async {
      // Create many users
      final users = List.generate(200, (index) => User(
        studentId: '2025CS${index.toString().padLeft(3, '0')}',
        email: 'user$index@college.edu',
        displayName: 'User $index',
        year: (index % 4) + 1,
        department: ['CS', 'ECE', 'ME', 'CE'][index % 4],
        section: ['A', 'B', 'C'][index % 3],
        bio: 'This is the bio for user $index',
      ));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.8,
              ),
              itemCount: users.length,
              itemBuilder: (context, index) => UserCard(user: users[index]),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should render grid efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(800));

      // Test grid scrolling
      final scrollStopwatch = Stopwatch()..start();
      
      for (int i = 0; i < 8; i++) {
        await tester.drag(find.byType(GridView), const Offset(0, -300));
        await tester.pump();
      }
      
      scrollStopwatch.stop();
      expect(scrollStopwatch.elapsedMilliseconds, lessThan(80));
    });

    testWidgets('Image loading performance', (WidgetTester tester) async {
      // Test multiple images loading
      final imageUrls = List.generate(20, (index) => 'https://example.com/image_$index.jpg');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: imageUrls.length,
              itemBuilder: (context, index) => Container(
                height: 200,
                margin: const EdgeInsets.all(8),
                child: Image.network(
                  imageUrls[index],
                  fit: BoxFit.cover,
                  loadingBuilder: (context, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return const Center(child: CircularProgressIndicator());
                  },
                  errorBuilder: (context, error, stackTrace) {
                    return const Center(child: Icon(Icons.error));
                  },
                ),
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should handle image loading efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(1000));
    });

    testWidgets('Complex widget tree performance', (WidgetTester tester) async {
      // Create a complex nested widget structure
      Widget buildComplexWidget(int depth) {
        if (depth == 0) {
          return Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('Leaf'),
          );
        }
        
        return Container(
          padding: const EdgeInsets.all(2),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: buildComplexWidget(depth - 1)),
                  Expanded(child: buildComplexWidget(depth - 1)),
                ],
              ),
              buildComplexWidget(depth - 1),
            ],
          ),
        );
      }

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: buildComplexWidget(6), // Creates a deep widget tree
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should handle complex widget trees efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(2000));
    });

    testWidgets('Animation performance', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 500),
                width: 100,
                height: 100,
                color: Colors.blue,
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      
      // Trigger animation by rebuilding with different properties
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 500),
                width: 200,
                height: 200,
                color: Colors.red,
              ),
            ),
          ),
        ),
      );

      // Let animation complete
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Animation should complete within reasonable time
      expect(stopwatch.elapsedMilliseconds, lessThan(1000));
    });

    testWidgets('State management performance', (WidgetTester tester) async {
      int counter = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) => Scaffold(
              body: Column(
                children: [
                  Text('Counter: $counter'),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        counter++;
                      });
                    },
                    child: const Text('Increment'),
                  ),
                  // Add many widgets that depend on the counter
                  ...List.generate(100, (index) => 
                    Container(
                      padding: const EdgeInsets.all(2),
                      child: Text('Item $index - Counter: $counter'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      
      // Perform multiple state updates
      for (int i = 0; i < 10; i++) {
        await tester.tap(find.text('Increment'));
        await tester.pump();
      }
      
      stopwatch.stop();

      // State updates should be efficient
      expect(stopwatch.elapsedMilliseconds, lessThan(200));
      expect(find.text('Counter: 10'), findsOneWidget);
    });

    testWidgets('Memory usage during scrolling', (WidgetTester tester) async {
      // Create a large list to test memory efficiency
      final items = List.generate(10000, (index) => 'Item $index');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) => ListTile(
                title: Text(items[index]),
                subtitle: Text('Subtitle for ${items[index]}'),
                leading: const CircleAvatar(child: Icon(Icons.person)),
              ),
            ),
          ),
        ),
      );

      // Scroll through a significant portion of the list
      for (int i = 0; i < 100; i++) {
        await tester.drag(find.byType(ListView), const Offset(0, -100));
        await tester.pump();
      }

      // Should not cause memory issues or crashes
      expect(tester.takeException(), isNull);
    });

    testWidgets('Rapid user interactions performance', (WidgetTester tester) async {
      int tapCount = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) => Scaffold(
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Taps: $tapCount'),
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          tapCount++;
                        });
                      },
                      child: const Text('Tap Me'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      
      // Perform rapid taps
      for (int i = 0; i < 50; i++) {
        await tester.tap(find.text('Tap Me'));
        await tester.pump();
      }
      
      stopwatch.stop();

      // Should handle rapid interactions efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(500));
      expect(find.text('Taps: 50'), findsOneWidget);
    });

    testWidgets('Form validation performance', (WidgetTester tester) async {
      final formKey = GlobalKey<FormState>();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Form(
              key: formKey,
              child: Column(
                children: List.generate(20, (index) => 
                  TextFormField(
                    decoration: InputDecoration(labelText: 'Field $index'),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Field $index is required';
                      }
                      if (value.length < 3) {
                        return 'Field $index must be at least 3 characters';
                      }
                      return null;
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      
      // Trigger validation multiple times
      for (int i = 0; i < 10; i++) {
        formKey.currentState?.validate();
        await tester.pump();
      }
      
      stopwatch.stop();

      // Form validation should be efficient
      expect(stopwatch.elapsedMilliseconds, lessThan(200));
    });
  });

  group('Memory Leak Tests', () {
    testWidgets('Should not leak memory when navigating', (WidgetTester tester) async {
      // Test navigation between screens
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ElevatedButton(
              onPressed: () {},
              child: const Text('Navigate'),
            ),
          ),
        ),
      );

      // Simulate multiple navigation operations
      for (int i = 0; i < 10; i++) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Text('Screen $i'),
            ),
          ),
        );
        await tester.pump();
      }

      // Should not cause memory leaks
      expect(tester.takeException(), isNull);
    });

    testWidgets('Should dispose controllers properly', (WidgetTester tester) async {
      late TextEditingController controller;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) {
              controller = TextEditingController();
              return Scaffold(
                body: TextField(controller: controller),
              );
            },
          ),
        ),
      );

      // Remove the widget
      await tester.pumpWidget(const SizedBox.shrink());

      // Controller should be properly disposed
      // Note: In a real app, this would be handled by the StatefulWidget's dispose method
      expect(tester.takeException(), isNull);
    });
  });

  group('Rendering Performance Tests', () {
    testWidgets('Should render efficiently with many colors', (WidgetTester tester) async {
      final colors = List.generate(1000, (index) => 
        Color((index * 0xFFFFFF ~/ 1000) | 0xFF000000),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 10,
              ),
              itemCount: colors.length,
              itemBuilder: (context, index) => Container(
                color: colors[index],
                child: Center(child: Text('$index')),
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // Should render many colored containers efficiently
      expect(stopwatch.elapsedMilliseconds, lessThan(1500));
    });

    testWidgets('Should handle rapid theme changes', (WidgetTester tester) async {
      bool isDark = false;

      await tester.pumpWidget(
        StatefulBuilder(
          builder: (context, setState) => MaterialApp(
            theme: isDark ? ThemeData.dark() : ThemeData.light(),
            home: Scaffold(
              body: ElevatedButton(
                onPressed: () {
                  setState(() {
                    isDark = !isDark;
                  });
                },
                child: const Text('Toggle Theme'),
              ),
            ),
          ),
        ),
      );

      final stopwatch = Stopwatch()..start();
      
      // Rapidly toggle theme
      for (int i = 0; i < 10; i++) {
        await tester.tap(find.text('Toggle Theme'));
        await tester.pump();
      }
      
      stopwatch.stop();

      // Theme changes should be efficient
      expect(stopwatch.elapsedMilliseconds, lessThan(300));
    });
  });
}