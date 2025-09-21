import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/user.dart' as app_user;
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final ApiService _apiService = ApiService();
  
  bool _isAuthenticated = false;
  bool _isLoading = false;
  bool _isInitialized = false;
  String? _error;
  app_user.User? _user;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  bool get isInitialized => _isInitialized;
  String? get error => _error;
  app_user.User? get user => _user;

  AuthProvider() {
    _initializeAuth();
  }

  /// Initialize authentication state
  Future<void> _initializeAuth() async {
    setLoading(true);
    
    try {
      // Listen to Firebase auth state changes
      _authService.authStateChanges.listen(_onAuthStateChanged);
      
      // Check if user is already authenticated
      final isAuth = await _authService.isAuthenticated();
      if (isAuth) {
        final storedUser = await _authService.getStoredUser();
        if (storedUser != null) {
          _user = storedUser;
          _isAuthenticated = true;
          
          // Set JWT token in API service
          final token = await _authService.getJwtToken();
          _apiService.setJwtToken(token);
        }
      }
      
      _isInitialized = true;
      LoggerService.info('Auth provider initialized. Authenticated: $isAuthenticated');
      
    } catch (e, stackTrace) {
      LoggerService.error('Error initializing auth provider', e, stackTrace);
      setError('Failed to initialize authentication');
    } finally {
      setLoading(false);
    }
  }

  /// Handle Firebase auth state changes
  void _onAuthStateChanged(User? firebaseUser) {
    LoggerService.info('Firebase auth state changed. User: ${firebaseUser?.email}');
    
    if (firebaseUser == null && _isAuthenticated) {
      // User signed out
      _user = null;
      _isAuthenticated = false;
      notifyListeners();
    }
  }

  /// Sign in with Google
  Future<bool> signInWithGoogle() async {
    setLoading(true);
    setError(null);

    try {
      final response = await _authService.signInWithGoogle();
      
      if (response.success && response.data != null) {
        _user = response.data;
        _isAuthenticated = true;
        
        // Set JWT token in API service for authenticated requests
        final token = await _authService.getJwtToken();
        _apiService.setJwtToken(token);
        
        LoggerService.info('Sign-in successful for user: ${_user?.studentId}');
        return true;
      } else {
        setError(response.error?.message ?? 'Sign-in failed');
        LoggerService.warning('Sign-in failed: ${response.error?.message}');
        return false;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during sign-in', e, stackTrace);
      setError('An unexpected error occurred during sign-in');
      return false;
    } finally {
      setLoading(false);
    }
  }

  /// Link student ID
  Future<bool> linkStudentId(String studentId) async {
    setLoading(true);
    setError(null);

    try {
      final response = await _authService.linkStudentId(studentId);
      
      if (response.success && response.data != null) {
        _user = response.data;
        
        // Update JWT token in API service
        final token = await _authService.getJwtToken();
        _apiService.setJwtToken(token);
        
        LoggerService.info('Student ID linked successfully: ${_user?.studentId}');
        return true;
      } else {
        setError(response.error?.message ?? 'Failed to link student ID');
        LoggerService.warning('Student ID linking failed: ${response.error?.message}');
        return false;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during student ID linking', e, stackTrace);
      setError('An unexpected error occurred while linking student ID');
      return false;
    } finally {
      setLoading(false);
    }
  }

  /// Sign out
  Future<void> signOut() async {
    setLoading(true);
    
    try {
      await _authService.signOut();
      _user = null;
      _isAuthenticated = false;
      
      // Clear JWT token from API service
      _apiService.setJwtToken(null);
      
      setError(null);
      LoggerService.info('User signed out successfully');
    } catch (e, stackTrace) {
      LoggerService.error('Error during sign-out', e, stackTrace);
      setError('Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  /// Clear error
  void clearError() {
    setError(null);
  }

  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void setError(String? error) {
    _error = error;
    notifyListeners();
  }
}