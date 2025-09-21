import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import 'auth/sign_in_screen.dart';
import 'auth/student_id_link_screen.dart';
import 'home_feed_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Wait for auth provider to initialize
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    // Wait for initialization to complete
    while (!authProvider.isInitialized) {
      await Future.delayed(const Duration(milliseconds: 100));
    }
    
    // Add minimum splash duration for better UX
    await Future.delayed(const Duration(seconds: 1));
    
    if (mounted) {
      _navigateToAppropriateScreen();
    }
  }

  void _navigateToAppropriateScreen() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    if (authProvider.isAuthenticated) {
      final user = authProvider.user;
      if (user?.studentId == null || user!.studentId!.isEmpty) {
        // User is authenticated but needs to link student ID
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const StudentIdLinkScreen()),
        );
      } else {
        // User is fully authenticated, navigate to home
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeFeedScreen()),
        );
      }
    } else {
      // User is not authenticated, show sign-in screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const SignInScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.school,
              size: 80,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 24),
            Text(
              AppConfig.appName,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'College Social Network',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 48),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

