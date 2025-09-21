import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

import '../models/user.dart' as app_user;
import '../models/api_response.dart';
import '../config/app_config.dart';
import 'logger_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final http.Client _httpClient = http.Client();

  static const String _jwtTokenKey = 'jwt_token';
  static const String _userDataKey = 'user_data';
  static const String _collegeEmailDomain = '@college.edu';

  // Stream of authentication state changes
  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  // Current Firebase user
  User? get currentFirebaseUser => _firebaseAuth.currentUser;

  // Check if user is signed in
  bool get isSignedIn => currentFirebaseUser != null;

  /// Sign in with Google
  Future<ApiResponse<app_user.User>> signInWithGoogle() async {
    try {
      LoggerService.info('Starting Google Sign-In process');

      // Trigger the authentication flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        LoggerService.warning('Google Sign-In cancelled by user');
        return ApiResponse.error(
          const ApiError(
            code: 'SIGN_IN_CANCELLED',
            message: 'Sign-in was cancelled by the user',
          ),
        );
      }

      // Check email domain
      if (!googleUser.email.endsWith(_collegeEmailDomain)) {
        LoggerService.warning('Invalid email domain: ${googleUser.email}');
        await _googleSignIn.signOut();
        return ApiResponse.error(
          ApiError(
            code: 'INVALID_EMAIL_DOMAIN',
            message: 'Access denied: $_collegeEmailDomain required',
            details: {
              'providedDomain': googleUser.email.split('@').last,
              'requiredDomain': _collegeEmailDomain.substring(1),
            },
          ),
        );
      }

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // Create a new credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      final UserCredential userCredential = 
          await _firebaseAuth.signInWithCredential(credential);

      if (userCredential.user == null) {
        LoggerService.error('Firebase sign-in failed: user is null');
        return ApiResponse.error(
          const ApiError(
            code: 'FIREBASE_SIGN_IN_FAILED',
            message: 'Firebase authentication failed',
          ),
        );
      }

      // Get Firebase ID token
      final String? idToken = await userCredential.user!.getIdToken();
      if (idToken == null) {
        LoggerService.error('Failed to get Firebase ID token');
        return ApiResponse.error(
          const ApiError(
            code: 'TOKEN_GENERATION_FAILED',
            message: 'Failed to generate authentication token',
          ),
        );
      }

      LoggerService.info('Firebase sign-in successful, authenticating with backend');

      // Authenticate with backend
      final backendResponse = await _signInWithFirebaseBackend(idToken);
      
      if (!backendResponse.success || backendResponse.data == null) {
        LoggerService.error('Backend authentication failed: ${backendResponse.error}');
        await signOut(); // Clean up Firebase session
        return ApiResponse.error(
          backendResponse.error ?? const ApiError(
            code: 'BACKEND_AUTH_FAILED',
            message: 'Backend authentication failed',
          ),
        );
      }

      // Store JWT token and user data
      await _storeAuthData(
        backendResponse.data!['token'] as String,
        backendResponse.data!['user'] as Map<String, dynamic>,
      );

      final user = app_user.User.fromJson(backendResponse.data!['user']);
      LoggerService.info('Authentication successful for user: ${user.studentId}');

      return ApiResponse.success(user, 'Sign-in successful');

    } on FirebaseAuthException catch (e, stackTrace) {
      LoggerService.error('Firebase Auth error: ${e.code} - ${e.message}', e, stackTrace);
      return ApiResponse.error(
        ApiError(
          code: 'FIREBASE_AUTH_ERROR',
          message: e.message ?? 'Firebase authentication error',
          details: {'code': e.code},
        ),
      );
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during sign-in', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred during sign-in',
        ),
      );
    }
  }

  /// Link student ID to account
  Future<ApiResponse<app_user.User>> linkStudentId(String studentId) async {
    try {
      LoggerService.info('Linking student ID: $studentId');

      final response = await _linkStudentIdBackend(studentId);
      
      if (!response.success || response.data == null) {
        LoggerService.error('Student ID linking failed: ${response.error}');
        return ApiResponse.error(
          response.error ?? const ApiError(
            code: 'STUDENT_ID_LINK_FAILED',
            message: 'Failed to link student ID',
          ),
        );
      }

      // Update stored user data
      await _secureStorage.write(
        key: _userDataKey,
        value: jsonEncode(response.data),
      );

      final user = app_user.User.fromJson(response.data!);
      LoggerService.info('Student ID linked successfully: ${user.studentId}');

      return ApiResponse.success(user, 'Student ID linked successfully');

    } catch (e, stackTrace) {
      LoggerService.error('Error linking student ID', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred while linking student ID',
        ),
      );
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      LoggerService.info('Signing out user');

      // Sign out from Google
      await _googleSignIn.signOut();
      
      // Sign out from Firebase
      await _firebaseAuth.signOut();
      
      // Clear stored auth data
      await _clearAuthData();

      LoggerService.info('Sign-out successful');

    } catch (e, stackTrace) {
      LoggerService.error('Error during sign-out', e, stackTrace);
      // Continue with clearing local data even if remote sign-out fails
      await _clearAuthData();
    }
  }

  /// Get stored JWT token
  Future<String?> getJwtToken() async {
    try {
      return await _secureStorage.read(key: _jwtTokenKey);
    } catch (e, stackTrace) {
      LoggerService.error('Error reading JWT token', e, stackTrace);
      return null;
    }
  }

  /// Get stored user data
  Future<app_user.User?> getStoredUser() async {
    try {
      final userDataString = await _secureStorage.read(key: _userDataKey);
      if (userDataString == null) return null;

      final userData = jsonDecode(userDataString) as Map<String, dynamic>;
      return app_user.User.fromJson(userData);
    } catch (e, stackTrace) {
      LoggerService.error('Error reading stored user data', e, stackTrace);
      return null;
    }
  }

  /// Check if user has valid authentication
  Future<bool> isAuthenticated() async {
    final token = await getJwtToken();
    return token != null && isSignedIn;
  }

  /// Store authentication data securely
  Future<void> _storeAuthData(String jwtToken, Map<String, dynamic> userData) async {
    await Future.wait([
      _secureStorage.write(key: _jwtTokenKey, value: jwtToken),
      _secureStorage.write(key: _userDataKey, value: jsonEncode(userData)),
    ]);
  }

  /// Clear stored authentication data
  Future<void> _clearAuthData() async {
    await Future.wait([
      _secureStorage.delete(key: _jwtTokenKey),
      _secureStorage.delete(key: _userDataKey),
    ]);
  }

  /// Sign in with Firebase ID token (backend API call)
  Future<ApiResponse<Map<String, dynamic>>> _signInWithFirebaseBackend(String idToken) async {
    try {
      LoggerService.info('Authenticating with backend using Firebase token');

      final response = await _httpClient.post(
        Uri.parse('${AppConfig.baseUrl}/auth/firebaseSignIn'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'idToken': idToken,
        }),
      );

      LoggerService.debug('Backend auth response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.success(data);
      } else {
        final errorData = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.error(ApiError.fromJson(errorData['error']));
      }

    } on SocketException catch (e, stackTrace) {
      LoggerService.error('Network error during backend authentication', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your internet connection.',
        ),
      );
    } on FormatException catch (e, stackTrace) {
      LoggerService.error('Invalid response format from backend', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'INVALID_RESPONSE',
          message: 'Invalid response from server',
        ),
      );
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during backend authentication', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred',
        ),
      );
    }
  }

  /// Link student ID to account (backend API call)
  Future<ApiResponse<Map<String, dynamic>>> _linkStudentIdBackend(String studentId) async {
    try {
      LoggerService.info('Linking student ID with backend: $studentId');

      final token = await getJwtToken();
      if (token == null) {
        return ApiResponse.error(
          const ApiError(
            code: 'NO_AUTH_TOKEN',
            message: 'Authentication token not found',
          ),
        );
      }

      final response = await _httpClient.post(
        Uri.parse('${AppConfig.baseUrl}/auth/linkStudentId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'studentId': studentId,
        }),
      );

      LoggerService.debug('Student ID link response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.success(data);
      } else {
        final errorData = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.error(ApiError.fromJson(errorData['error']));
      }

    } on SocketException catch (e, stackTrace) {
      LoggerService.error('Network error during student ID linking', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your internet connection.',
        ),
      );
    } on FormatException catch (e, stackTrace) {
      LoggerService.error('Invalid response format from backend', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'INVALID_RESPONSE',
          message: 'Invalid response from server',
        ),
      );
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during student ID linking', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred',
        ),
      );
    }
  }

  /// Dispose resources
  void dispose() {
    _httpClient.close();
  }
}