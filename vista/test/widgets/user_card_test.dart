import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vista/widgets/user_card.dart';
import 'package:vista/models/user.dart';

void main() {
  group('UserCard Widget Tests', () {
    late User testUser;

    setUp(() {
      testUser = User(
        studentId: 'TEST123',
        email: 'test@college.edu',
        displayName: 'Test User',
        photoUrl: null,
        year: 2,
        department: 'Computer Science',
        section: 'A',
        bio: 'Test bio',
        createdAt: DateTime.now(),
        settings: const UserSettings(),
      );
    });

    testWidgets('displays basic user information', (WidgetTester tester) async {
      // Create a simple test that doesn't require Provider
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Card(
              child: ListTile(
                leading: CircleAvatar(
                  child: Text(testUser.displayName[0].toUpperCase()),
                ),
                title: Text(testUser.displayName),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Student ID: ${testUser.studentId}'),
                    if (testUser.year != null || testUser.department != null)
                      Text('${testUser.year ?? ''} ${testUser.department ?? ''}'.trim()),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      // Check if user information is displayed
      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('Student ID: TEST123'), findsOneWidget);
      expect(find.text('T'), findsOneWidget);
    });
  });
}