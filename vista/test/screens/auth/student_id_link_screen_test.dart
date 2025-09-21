import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:provider/provider.dart';

import 'package:vista/screens/auth/student_id_link_screen.dart';
import 'package:vista/providers/auth_provider.dart';

import '../../test_setup.dart';

// Generate mock
@GenerateMocks([AuthProvider])
import 'student_id_link_screen_test.mocks.dart';

void main() {
  group('StudentIdLinkScreen Widget Tests', () {
    late MockAuthProvider mockAuthProvider;

    setUp(() {
      mockAuthProvider = MockAuthProvider();
      
      // Default mock behavior
      when(mockAuthProvider.isLoading).thenReturn(false);
      when(mockAuthProvider.error).thenReturn(null);
      when(mockAuthProvider.isAuthenticated).thenReturn(true);
      when(mockAuthProvider.user).thenReturn(null);
      when(mockAuthProvider.clearError()).thenReturn(null);
      when(mockAuthProvider.linkStudentId(any)).thenAnswer((_) async => false);
      when(mockAuthProvider.signOut()).thenAnswer((_) async {});
    });

    Widget createTestWidget() {
      return MaterialApp(
        home: ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuthProvider,
          child: const StudentIdLinkScreen(),
        ),
      );
    }

    testWidgets('displays header and description', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Verify header icon is displayed
      expect(find.byIcon(Icons.badge_outlined), findsOneWidget);
      
      // Verify title is displayed
      expect(find.text('Link Your Student ID'), findsOneWidget);
      
      // Verify description is displayed
      expect(find.text('To complete your account setup, please enter your student ID. This will link your Google account to your student record.'), findsOneWidget);
    });

    testWidgets('displays student ID input field', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Verify input field is displayed
      final textField = find.byType(TextFormField);
      expect(textField, findsOneWidget);
      
      // Verify field has correct label and hint
      expect(find.text('Student ID'), findsOneWidget);
      expect(find.text('e.g., 2025CS1001'), findsOneWidget);
      
      // Verify prefix icon
      expect(find.byIcon(Icons.person), findsOneWidget);
    });

    testWidgets('displays link button when not loading', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      final linkButton = find.widgetWithText(ElevatedButton, 'Link Student ID');
      expect(linkButton, findsOneWidget);
      
      // Verify button is enabled
      final button = tester.widget<ElevatedButton>(linkButton);
      expect(button.onPressed, isNotNull);
    });

    testWidgets('displays loading state when linking', (WidgetTester tester) async {
      when(mockAuthProvider.isLoading).thenReturn(true);
      
      await tester.pumpWidget(createTestWidget());

      // Verify loading text is displayed
      expect(find.text('Linking...'), findsOneWidget);
      
      // Verify loading indicator is displayed
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      
      // Verify button is disabled
      final linkButton = find.widgetWithText(ElevatedButton, 'Linking...');
      final button = tester.widget<ElevatedButton>(linkButton);
      expect(button.onPressed, isNull);
    });

    testWidgets('displays error message when linking fails', (WidgetTester tester) async {
      const errorMessage = 'Student ID not found in roster';
      when(mockAuthProvider.error).thenReturn(errorMessage);
      
      await tester.pumpWidget(createTestWidget());

      // Verify error message is displayed
      expect(find.text(errorMessage), findsOneWidget);
      
      // Verify error icon is displayed
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });

    testWidgets('displays help information', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('Need Help?'), findsOneWidget);
      expect(find.text('Your student ID should be provided by your college administration. If you don\'t know your student ID, please contact the college office.'), findsOneWidget);
      expect(find.byIcon(Icons.help_outline), findsOneWidget);
    });

    testWidgets('displays format information', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('Student ID Format'), findsOneWidget);
      expect(find.text('Student IDs typically contain letters and numbers (e.g., 2025CS1001). Enter it exactly as provided by your college.'), findsOneWidget);
      expect(find.byIcon(Icons.format_list_numbered), findsOneWidget);
    });

    testWidgets('displays basic form validation', (WidgetTester tester) async {
      // Set a larger screen size to avoid off-screen issues
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Find the form field and button
      expect(find.byType(TextFormField), findsOneWidget);
      expect(find.text('Link Student ID'), findsOneWidget);
      
      // Reset screen size
      addTearDown(tester.view.resetPhysicalSize);
    });

    testWidgets('calls linkStudentId with valid input', (WidgetTester tester) async {
      when(mockAuthProvider.linkStudentId(any)).thenAnswer((_) async => true);
      
      // Set a larger screen size to avoid off-screen issues
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Enter valid student ID
      const studentId = '2025CS1001';
      await tester.enterText(find.byType(TextFormField), studentId);
      
      // Find and tap the button
      final button = find.byType(ElevatedButton);
      await tester.tap(button);
      await tester.pump();

      // Verify linkStudentId was called with uppercase version
      verify(mockAuthProvider.linkStudentId(studentId)).called(1);
      
      // Reset screen size
      addTearDown(tester.view.resetPhysicalSize);
    });

    testWidgets('calls clearError when linking', (WidgetTester tester) async {
      when(mockAuthProvider.linkStudentId(any)).thenAnswer((_) async => true);
      
      // Set a larger screen size to avoid off-screen issues
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Enter valid student ID
      await tester.enterText(find.byType(TextFormField), '2025CS1001');
      
      // Find and tap the button
      final button = find.byType(ElevatedButton);
      await tester.tap(button);
      await tester.pump();

      // Verify clearError was called
      verify(mockAuthProvider.clearError()).called(1);
      
      // Reset screen size
      addTearDown(tester.view.resetPhysicalSize);
    });

    testWidgets('shows sign out confirmation dialog', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Tap the sign out button
      await tester.tap(find.text('Sign Out'));
      await tester.pumpAndSettle();

      // Verify confirmation dialog is displayed
      expect(find.text('Are you sure you want to sign out? You\'ll need to sign in again to continue.'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('cancels sign out when cancel is tapped', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Tap the sign out button
      await tester.tap(find.text('Sign Out'));
      await tester.pumpAndSettle();

      // Tap cancel
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      // Verify signOut was not called
      verifyNever(mockAuthProvider.signOut());
    });

    testWidgets('is responsive on wide screens', (WidgetTester tester) async {
      // Set a wide screen size
      tester.view.physicalSize = const Size(800, 600);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Verify the content is displayed (basic responsiveness check)
      expect(find.text('Link Your Student ID'), findsOneWidget);
      expect(find.text('Link Student ID'), findsOneWidget);
      
      // Reset the screen size
      addTearDown(tester.view.resetPhysicalSize);
    });
  });
}