import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:provider/provider.dart';

import 'package:vista/screens/auth/sign_in_screen.dart';
import 'package:vista/providers/auth_provider.dart';
import 'package:vista/config/app_config.dart';

import '../../test_setup.dart';

// Generate mock
@GenerateMocks([AuthProvider])
import 'sign_in_screen_test.mocks.dart';

void main() {
  group('SignInScreen Widget Tests', () {
    late MockAuthProvider mockAuthProvider;

    setUp(() {
      mockAuthProvider = MockAuthProvider();
      
      // Default mock behavior
      when(mockAuthProvider.isLoading).thenReturn(false);
      when(mockAuthProvider.error).thenReturn(null);
      when(mockAuthProvider.isAuthenticated).thenReturn(false);
      when(mockAuthProvider.user).thenReturn(null);
      when(mockAuthProvider.clearError()).thenReturn(null);
      when(mockAuthProvider.signInWithGoogle()).thenAnswer((_) async => false);
    });

    Widget createTestWidget() {
      return MaterialApp(
        home: ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuthProvider,
          child: const SignInScreen(),
        ),
      );
    }

    testWidgets('displays app logo and title', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Verify app logo is displayed
      expect(find.byIcon(Icons.school), findsOneWidget);
      
      // Verify app name is displayed
      expect(find.text(AppConfig.appName), findsOneWidget);
      
      // Verify subtitle is displayed
      expect(find.text('College Social Network'), findsOneWidget);
    });

    testWidgets('displays welcome message and description', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('Welcome to your college community'), findsOneWidget);
      expect(find.text('Connect with classmates, share moments, and stay updated with campus life.'), findsOneWidget);
    });

    testWidgets('displays sign in button when not loading', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      // Look for the button text instead of the specific button type
      expect(find.text('Sign in with Google'), findsOneWidget);
      expect(find.byType(ElevatedButton), findsOneWidget);
    });

    testWidgets('displays loading state when signing in', (WidgetTester tester) async {
      when(mockAuthProvider.isLoading).thenReturn(true);
      
      await tester.pumpWidget(createTestWidget());

      // Verify loading text is displayed
      expect(find.text('Signing in...'), findsOneWidget);
      
      // Verify loading indicator is displayed
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays error message when sign in fails', (WidgetTester tester) async {
      const errorMessage = 'Access denied: school-domain required';
      when(mockAuthProvider.error).thenReturn(errorMessage);
      
      await tester.pumpWidget(createTestWidget());

      // Verify error message is displayed
      expect(find.text(errorMessage), findsOneWidget);
      
      // Verify error icon is displayed
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });

    testWidgets('displays college email requirement info', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());

      expect(find.text('College Email Required'), findsOneWidget);
      expect(find.text('You must sign in with your @college.edu email address to access the app.'), findsOneWidget);
      expect(find.byIcon(Icons.info_outline), findsOneWidget);
    });

    testWidgets('calls signInWithGoogle when sign in button is tapped', (WidgetTester tester) async {
      when(mockAuthProvider.signInWithGoogle()).thenAnswer((_) async => true);
      
      // Set a larger screen size to avoid off-screen issues
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Find and tap the button
      final button = find.byType(ElevatedButton);
      expect(button, findsOneWidget);
      
      await tester.tap(button);
      await tester.pump();

      // Verify signInWithGoogle was called
      verify(mockAuthProvider.signInWithGoogle()).called(1);
      
      // Reset screen size
      addTearDown(tester.view.resetPhysicalSize);
    });

    testWidgets('calls clearError when sign in button is tapped', (WidgetTester tester) async {
      when(mockAuthProvider.signInWithGoogle()).thenAnswer((_) async => true);
      
      // Set a larger screen size to avoid off-screen issues
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Find and tap the button
      final button = find.byType(ElevatedButton);
      await tester.tap(button);
      await tester.pump();

      // Verify clearError was called
      verify(mockAuthProvider.clearError()).called(1);
      
      // Reset screen size
      addTearDown(tester.view.resetPhysicalSize);
    });

    testWidgets('is responsive on wide screens', (WidgetTester tester) async {
      // Set a wide screen size
      tester.view.physicalSize = const Size(800, 600);
      tester.view.devicePixelRatio = 1.0;
      
      await tester.pumpWidget(createTestWidget());

      // Verify the content is displayed (basic responsiveness check)
      expect(find.text(AppConfig.appName), findsOneWidget);
      expect(find.text('Sign in with Google'), findsOneWidget);
      
      // Reset the screen size
      addTearDown(tester.view.resetPhysicalSize);
    });
  });
}