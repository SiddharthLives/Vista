import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

import 'package:vista/providers/users_provider.dart';
import 'package:vista/models/user.dart';

import '../test_setup.dart';

void main() {
  group('UsersProvider', () {
    late UsersProvider usersProvider;
    late User testUser1;
    late User testUser2;

    setUp(() {
      usersProvider = UsersProvider();
      
      testUser1 = User(
        studentId: 'TEST123',
        email: 'test1@college.edu',
        displayName: 'Test User 1',
        photoUrl: null,
        year: 2,
        department: 'Computer Science',
        section: 'A',
        bio: 'Test bio 1',
        createdAt: DateTime.now(),
        joinedAt: DateTime.now(),
        settings: const UserSettings(),
      );

      testUser2 = User(
        studentId: 'TEST456',
        email: 'test2@college.edu',
        displayName: 'Test User 2',
        photoUrl: null,
        year: 3,
        department: 'Engineering',
        section: 'B',
        bio: 'Test bio 2',
        createdAt: DateTime.now(),
        joinedAt: DateTime.now(),
        settings: const UserSettings(),
      );
    });

    test('should initialize with empty state', () {
      expect(usersProvider.searchResults, isEmpty);
      expect(usersProvider.isSearching, false);
      expect(usersProvider.searchError, null);
      expect(usersProvider.currentQuery, '');
      expect(usersProvider.currentFilters, isEmpty);
    });

    test('should clear search results', () {
      // Manually set some state
      usersProvider.updateUserProfile(testUser1);
      
      // Clear search
      usersProvider.clearSearch();
      
      // Verify state is cleared
      expect(usersProvider.searchResults, isEmpty);
      expect(usersProvider.currentQuery, '');
      expect(usersProvider.currentFilters, isEmpty);
      expect(usersProvider.searchError, null);
    });

    test('should update user profile in cache', () {
      // Update user profile
      usersProvider.updateUserProfile(testUser1);
      
      // Verify user is cached
      final cachedUser = usersProvider.getUserProfile(testUser1.studentId);
      expect(cachedUser, equals(testUser1));
      expect(cachedUser?.displayName, equals('Test User 1'));
    });

    test('should return null for non-existent user profile', () {
      final user = usersProvider.getUserProfile('NONEXISTENT');
      expect(user, null);
    });

    test('should track loading state for profiles', () {
      const studentId = 'TEST123';
      
      // Initially not loading
      expect(usersProvider.isLoadingProfile(studentId), false);
      
      // No error initially
      expect(usersProvider.getProfileError(studentId), null);
    });

    test('should clear all cached data', () {
      // Add some test data
      usersProvider.updateUserProfile(testUser1);
      usersProvider.updateUserProfile(testUser2);
      
      // Clear all data
      usersProvider.clear();
      
      // Verify everything is cleared
      expect(usersProvider.searchResults, isEmpty);
      expect(usersProvider.getUserProfile(testUser1.studentId), null);
      expect(usersProvider.getUserProfile(testUser2.studentId), null);
      expect(usersProvider.currentQuery, '');
      expect(usersProvider.currentFilters, isEmpty);
      expect(usersProvider.isSearching, false);
      expect(usersProvider.searchError, null);
    });

    test('should update user in search results when profile is updated', () {
      // Add user to search results (simulate search)
      usersProvider.updateUserProfile(testUser1);
      
      // Create updated user
      final updatedUser = User(
        studentId: testUser1.studentId,
        email: testUser1.email,
        displayName: 'Updated Name',
        photoUrl: testUser1.photoUrl,
        year: testUser1.year,
        department: testUser1.department,
        section: testUser1.section,
        bio: 'Updated bio',
        createdAt: testUser1.createdAt,
        joinedAt: testUser1.joinedAt,
        settings: testUser1.settings,
      );
      
      // Update the user profile
      usersProvider.updateUserProfile(updatedUser);
      
      // Verify the cached user is updated
      final cachedUser = usersProvider.getUserProfile(testUser1.studentId);
      expect(cachedUser?.displayName, equals('Updated Name'));
      expect(cachedUser?.bio, equals('Updated bio'));
    });

    test('should handle multiple user profiles in cache', () {
      // Add multiple users
      usersProvider.updateUserProfile(testUser1);
      usersProvider.updateUserProfile(testUser2);
      
      // Verify both are cached
      expect(usersProvider.getUserProfile(testUser1.studentId), equals(testUser1));
      expect(usersProvider.getUserProfile(testUser2.studentId), equals(testUser2));
      
      // Verify they are different
      expect(
        usersProvider.getUserProfile(testUser1.studentId)?.displayName,
        equals('Test User 1'),
      );
      expect(
        usersProvider.getUserProfile(testUser2.studentId)?.displayName,
        equals('Test User 2'),
      );
    });
  });
}