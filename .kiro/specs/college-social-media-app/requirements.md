# Requirements Document

## Introduction

This document outlines the requirements for a college-only social media application that combines Instagram-style feeds and stories with Reddit-style topics and real-time chat functionality. The app will be built using Flutter for cross-platform mobile and web deployment, with a Node.js backend, MongoDB database, and Firebase authentication restricted to college email domains. The system enforces privacy through college email verification and uses immutable student IDs as canonical identifiers.

## Requirements

### Requirement 1: Authentication and User Management

**User Story:** As a college student, I want to sign in using my college Google account so that I can access the social platform securely with my verified student identity.

#### Acceptance Criteria

1. WHEN a user attempts to sign in THEN the system SHALL verify the Firebase ID token server-side
2. WHEN a user's email domain is not the college domain THEN the system SHALL reject access with error "Access denied: school-domain required"
3. WHEN a user signs in for the first time THEN the system SHALL map their Google account to their pre-existing student record by email OR prompt for studentId verification
4. WHEN a studentId is assigned to a user THEN the system SHALL make it immutable and unchangeable
5. WHEN a user completes authentication THEN the system SHALL return an app JWT token for subsequent API calls

### Requirement 2: User Profile and Student Data

**User Story:** As a student, I want my profile to display my immutable student information (year, department, section) so that other students can identify and connect with me appropriately.

#### Acceptance Criteria

1. WHEN a user profile is created THEN the system SHALL include studentId, year, department, section, displayName, photoUrl, and bio fields
2. WHEN a user attempts to modify their studentId THEN the system SHALL prevent the change and maintain immutability
3. WHEN a user updates their profile THEN the system SHALL allow changes to displayName, photoUrl, and bio only
4. WHEN displaying user information THEN the system SHALL show year, department, and section for identification purposes
5. WHEN storing user data THEN the system SHALL maintain FCM tokens for push notifications and user settings

### Requirement 3: Content Creation and Media Management

**User Story:** As a student, I want to create posts with images, videos, and text so that I can share content with my college community.

#### Acceptance Criteria

1. WHEN a user creates a post THEN the system SHALL support image, video, and text content types
2. WHEN a user uploads media THEN the system SHALL use server-signed Cloudinary upload with folder structure: /collegeName/year-{year}/dept-{dept}/section-{section}/student-{studentId}/
3. WHEN media is uploaded THEN the system SHALL validate the public_id belongs to the permitted folder layout
4. WHEN a post is created THEN the system SHALL support visibility levels: public, year, department, or section
5. WHEN a post includes media THEN the system SHALL store Cloudinary public_id, secure_url, width, and height metadata
6. WHEN content is uploaded THEN the system SHALL enforce file size limits and return helpful errors for violations

### Requirement 4: Feed and Content Discovery

**User Story:** As a student, I want to view a personalized feed of posts from my college community so that I can stay connected with campus life and activities.

#### Acceptance Criteria

1. WHEN a user accesses the feed THEN the system SHALL display posts ordered by creation date (newest first)
2. WHEN loading the feed THEN the system SHALL implement cursor-based pagination for performance
3. WHEN filtering content THEN the system SHALL respect post visibility settings (public, year, dept, section)
4. WHEN a user searches THEN the system SHALL support filtering by year, department, section, and tags
5. WHEN displaying posts THEN the system SHALL show like count, comment count, and author information
6. WHEN a user interacts with posts THEN the system SHALL support liking and commenting functionality

### Requirement 5: Stories Feature

**User Story:** As a student, I want to share ephemeral stories that disappear after 24 hours so that I can share casual moments without permanent posting.

#### Acceptance Criteria

1. WHEN a user creates a story THEN the system SHALL set automatic expiration after 24 hours
2. WHEN stories expire THEN the system SHALL automatically delete them using MongoDB TTL indexes
3. WHEN uploading story media THEN the system SHALL use the same Cloudinary signed upload flow as posts
4. WHEN viewing stories THEN the system SHALL display them in a carousel format with full-screen viewing
5. WHEN stories are created THEN the system SHALL support image and video content with duration metadata

### Requirement 6: Topics and Discussions

**User Story:** As a student, I want to participate in Reddit-style topic discussions so that I can engage in structured conversations about campus life and academic subjects.

#### Acceptance Criteria

1. WHEN a user creates a topic THEN the system SHALL require title, body, and support optional tags
2. WHEN users interact with topics THEN the system SHALL support upvoting and downvoting with vote counts
3. WHEN topics are displayed THEN the system SHALL show vote count, comment count, and creation date
4. WHEN users comment on topics THEN the system SHALL maintain threaded comment structure
5. WHEN filtering topics THEN the system SHALL support filtering by tags and search functionality

### Requirement 7: Real-time Chat and Messaging

**User Story:** As a student, I want to send direct messages to other students so that I can have private conversations in real-time.

#### Acceptance Criteria

1. WHEN users send messages THEN the system SHALL deliver them in real-time using Socket.IO
2. WHEN messages are sent THEN the system SHALL persist conversation history in the database
3. WHEN users are offline THEN the system SHALL store messages and deliver when they come online
4. WHEN displaying conversations THEN the system SHALL show participant list, last message, and timestamp
5. WHEN messages include media THEN the system SHALL support image and text content
6. WHEN users read messages THEN the system SHALL track and display read receipts

### Requirement 8: Notifications System

**User Story:** As a student, I want to receive notifications for likes, comments, messages, and other interactions so that I can stay engaged with the community.

#### Acceptance Criteria

1. WHEN notification-worthy events occur THEN the system SHALL create notification records in the database
2. WHEN users are online THEN the system SHALL deliver notifications via Socket.IO in real-time
3. WHEN users are offline THEN the system SHALL send push notifications via Firebase Cloud Messaging
4. WHEN notifications are created THEN the system SHALL include type (like, comment, follow, message, topic), metadata, and read status
5. WHEN users access notifications THEN the system SHALL provide endpoints to mark notifications as read

### Requirement 9: Administrative Functions

**User Story:** As an administrator, I want to manage student rosters and moderate content so that I can maintain a safe and organized platform.

#### Acceptance Criteria

1. WHEN administrators upload roster data THEN the system SHALL accept CSV files with studentId, email, year, department, section fields
2. WHEN roster data is processed THEN the system SHALL create user records that can be linked during first sign-in
3. WHEN content moderation is needed THEN the system SHALL provide endpoints to remove or ban content and users
4. WHEN administrators need insights THEN the system SHALL provide basic metrics like daily active users and posts per day
5. WHEN managing users THEN the system SHALL support data export and deletion for privacy compliance

### Requirement 10: Security and Privacy

**User Story:** As a student, I want my data to be secure and private so that I can trust the platform with my personal information and college interactions.

#### Acceptance Criteria

1. WHEN any API request is made THEN the system SHALL verify Firebase ID tokens server-side for protected endpoints
2. WHEN handling sensitive data THEN the system SHALL never expose Cloudinary secrets to the client
3. WHEN users perform actions THEN the system SHALL implement rate limiting to prevent abuse
4. WHEN content is reported THEN the system SHALL maintain a reports collection for admin review
5. WHEN users request data deletion THEN the system SHALL provide endpoints for account deletion and data portability
6. WHEN logging security events THEN the system SHALL log all sign-in rejections and suspicious activities

### Requirement 11: Cross-Platform Frontend

**User Story:** As a student, I want to access the platform from both mobile and web so that I can stay connected regardless of my device.

#### Acceptance Criteria

1. WHEN the app is built THEN the system SHALL use a single Flutter codebase for Android and Web platforms
2. WHEN users sign in THEN the system SHALL implement Google sign-in using firebase_auth and google_sign_in packages
3. WHEN displaying content THEN the system SHALL provide responsive UI that works on mobile and web browsers
4. WHEN users interact with features THEN the system SHALL support all core functionality (feed, stories, topics, chat, profile) on both platforms
5. WHEN push notifications are needed THEN the system SHALL register FCM tokens and handle notifications appropriately

### Requirement 12: Performance and Scalability

**User Story:** As a user of the platform, I want fast loading times and reliable performance so that I can have a smooth experience while using the app.

#### Acceptance Criteria

1. WHEN querying data THEN the system SHALL use appropriate database indexes for optimal performance
2. WHEN loading feeds THEN the system SHALL implement cursor-based pagination to handle large datasets
3. WHEN scaling the system THEN the system SHALL support Redis adapter for Socket.IO across multiple instances
4. WHEN serving content THEN the system SHALL use HTTPS for all communications
5. WHEN handling media THEN the system SHALL leverage Cloudinary transformations for optimized delivery
