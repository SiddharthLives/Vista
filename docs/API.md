# Vista API Documentation

This document provides comprehensive documentation for the Vista College Social Media Platform API.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.yourdomain.com`

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Getting a JWT Token

1. Sign in with Firebase to get an ID token
2. Exchange the Firebase ID token for an app JWT token using `/auth/firebaseSignIn`

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

## Authentication Endpoints

### Sign In with Firebase

Exchange Firebase ID token for app JWT token.

**Endpoint**: `POST /auth/firebaseSignIn`

**Request Body**:

```json
{
  "idToken": "firebase_id_token_here"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "studentId": "2025CS1001",
      "email": "john.doe@college.edu",
      "displayName": "John Doe",
      "photoUrl": "https://example.com/photo.jpg",
      "year": 1,
      "department": "CS",
      "section": "A",
      "bio": "Computer Science student",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes**:

- `INVALID_TOKEN`: Firebase token verification failed
- `INVALID_EMAIL_DOMAIN`: Email domain not allowed
- `USER_NOT_FOUND`: User not in roster

### Link Student ID

Link a student ID to an existing user account.

**Endpoint**: `POST /auth/linkStudentId`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "studentId": "2025CS1001"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "studentId": "2025CS1001",
      "email": "john.doe@college.edu",
      "displayName": "John Doe"
    }
  }
}
```

### Get User Profile

Get the current user's profile information.

**Endpoint**: `GET /auth/profile`

**Headers**: `Authorization: Bearer <jwt_token>`

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "studentId": "2025CS1001",
      "email": "john.doe@college.edu",
      "displayName": "John Doe",
      "photoUrl": "https://example.com/photo.jpg",
      "year": 1,
      "department": "CS",
      "section": "A",
      "bio": "Computer Science student",
      "badges": ["early_adopter"],
      "settings": {
        "notifications": true
      }
    }
  }
}
```

## Posts Endpoints

### Get Posts Feed

Retrieve posts for the user's feed with pagination.

**Endpoint**: `GET /posts`

**Headers**: `Authorization: Bearer <jwt_token>`

**Query Parameters**:

- `cursor` (optional): Timestamp for pagination
- `limit` (optional): Number of posts to return (default: 20, max: 50)
- `visibility` (optional): Filter by visibility (`public`, `year`, `dept`, `section`)
- `year` (optional): Filter by author's year
- `department` (optional): Filter by author's department
- `section` (optional): Filter by author's section

**Example**: `GET /posts?limit=10&visibility=public&year=1`

**Response**:

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "_id": "post_id_here",
        "authorStudentId": "2025CS1001",
        "author": {
          "displayName": "John Doe",
          "photoUrl": "https://example.com/photo.jpg",
          "year": 1,
          "department": "CS",
          "section": "A"
        },
        "type": "image",
        "text": "Beautiful sunset on campus!",
        "media": [
          {
            "url": "https://res.cloudinary.com/example/image.jpg",
            "cloudinaryPublicId": "college/year-1/dept-CS/section-A/student-2025CS1001/image_id",
            "width": 1080,
            "height": 1080
          }
        ],
        "visibility": "public",
        "tags": ["campus", "sunset"],
        "likesCount": 15,
        "commentsCount": 3,
        "isLiked": false,
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "2024-01-01T11:30:00.000Z"
  }
}
```

### Create Post

Create a new post.

**Endpoint**: `POST /posts`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "type": "image",
  "text": "Beautiful sunset on campus!",
  "media": [
    {
      "url": "https://res.cloudinary.com/example/image.jpg",
      "cloudinaryPublicId": "college/year-1/dept-CS/section-A/student-2025CS1001/image_id",
      "width": 1080,
      "height": 1080
    }
  ],
  "visibility": "public",
  "tags": ["campus", "sunset"]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "post": {
      "_id": "new_post_id",
      "authorStudentId": "2025CS1001",
      "type": "image",
      "text": "Beautiful sunset on campus!",
      "media": [...],
      "visibility": "public",
      "tags": ["campus", "sunset"],
      "likesCount": 0,
      "commentsCount": 0,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### Like/Unlike Post

Toggle like status on a post.

**Endpoint**: `POST /posts/:postId/like`

**Headers**: `Authorization: Bearer <jwt_token>`

**Response**:

```json
{
  "success": true,
  "data": {
    "isLiked": true,
    "likesCount": 16
  }
}
```

### Comment on Post

Add a comment to a post.

**Endpoint**: `POST /posts/:postId/comment`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "text": "Amazing photo! Where was this taken?"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "comment": {
      "_id": "comment_id",
      "authorStudentId": "2025CS1002",
      "author": {
        "displayName": "Jane Smith",
        "photoUrl": "https://example.com/jane.jpg"
      },
      "text": "Amazing photo! Where was this taken?",
      "createdAt": "2024-01-01T12:30:00.000Z"
    },
    "commentsCount": 4
  }
}
```

## Stories Endpoints

### Get Stories

Retrieve active stories (not expired).

**Endpoint**: `GET /stories`

**Headers**: `Authorization: Bearer <jwt_token>`

**Query Parameters**:

- `year` (optional): Filter by author's year
- `department` (optional): Filter by author's department
- `section` (optional): Filter by author's section

**Response**:

```json
{
  "success": true,
  "data": {
    "stories": [
      {
        "_id": "story_id",
        "authorStudentId": "2025CS1001",
        "author": {
          "displayName": "John Doe",
          "photoUrl": "https://example.com/photo.jpg"
        },
        "media": {
          "url": "https://res.cloudinary.com/example/story.jpg",
          "cloudinaryPublicId": "college/stories/story_id",
          "duration": 5
        },
        "createdAt": "2024-01-01T12:00:00.000Z",
        "expiresAt": "2024-01-02T12:00:00.000Z"
      }
    ]
  }
}
```

### Create Story

Create a new story.

**Endpoint**: `POST /stories`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "media": {
    "url": "https://res.cloudinary.com/example/story.jpg",
    "cloudinaryPublicId": "college/stories/story_id",
    "duration": 5
  }
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "story": {
      "_id": "new_story_id",
      "authorStudentId": "2025CS1001",
      "media": {...},
      "createdAt": "2024-01-01T12:00:00.000Z",
      "expiresAt": "2024-01-02T12:00:00.000Z"
    }
  }
}
```

## Topics Endpoints

### Get Topics

Retrieve discussion topics with filtering and pagination.

**Endpoint**: `GET /topics`

**Headers**: `Authorization: Bearer <jwt_token>`

**Query Parameters**:

- `cursor` (optional): Timestamp for pagination
- `limit` (optional): Number of topics to return (default: 20, max: 50)
- `sort` (optional): Sort order (`recent`, `votes`, `comments`)
- `tags` (optional): Filter by tags (comma-separated)
- `search` (optional): Search in title and body

**Example**: `GET /topics?sort=votes&tags=academics,campus&limit=10`

**Response**:

```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "_id": "topic_id",
        "title": "Best study spots on campus?",
        "body": "Looking for quiet places to study. Any recommendations?",
        "authorStudentId": "2025CS1001",
        "author": {
          "displayName": "John Doe",
          "photoUrl": "https://example.com/photo.jpg"
        },
        "votes": 15,
        "tags": ["academics", "campus"],
        "commentsCount": 8,
        "userVote": 1,
        "createdAt": "2024-01-01T10:00:00.000Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "2024-01-01T09:30:00.000Z"
  }
}
```

### Create Topic

Create a new discussion topic.

**Endpoint**: `POST /topics`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "title": "Best study spots on campus?",
  "body": "Looking for quiet places to study. Any recommendations?",
  "tags": ["academics", "campus"]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "topic": {
      "_id": "new_topic_id",
      "title": "Best study spots on campus?",
      "body": "Looking for quiet places to study. Any recommendations?",
      "authorStudentId": "2025CS1001",
      "votes": 0,
      "tags": ["academics", "campus"],
      "commentsCount": 0,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### Vote on Topic

Upvote or downvote a topic.

**Endpoint**: `POST /topics/:topicId/vote`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "vote": 1 // 1 for upvote, -1 for downvote, 0 to remove vote
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "votes": 16,
    "userVote": 1
  }
}
```

### Comment on Topic

Add a comment to a topic.

**Endpoint**: `POST /topics/:topicId/comment`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "text": "The library on the 3rd floor is really quiet!"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "comment": {
      "_id": "comment_id",
      "authorStudentId": "2025CS1002",
      "author": {
        "displayName": "Jane Smith",
        "photoUrl": "https://example.com/jane.jpg"
      },
      "text": "The library on the 3rd floor is really quiet!",
      "createdAt": "2024-01-01T12:30:00.000Z"
    },
    "commentsCount": 9
  }
}
```

## Chat Endpoints

### Get Conversations

Retrieve user's conversations.

**Endpoint**: `GET /conversations`

**Headers**: `Authorization: Bearer <jwt_token>`

**Response**:

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "_id": "conversation_id",
        "participants": [
          {
            "studentId": "2025CS1001",
            "displayName": "John Doe",
            "photoUrl": "https://example.com/john.jpg"
          },
          {
            "studentId": "2025CS1002",
            "displayName": "Jane Smith",
            "photoUrl": "https://example.com/jane.jpg"
          }
        ],
        "lastMessage": {
          "text": "See you at the library!",
          "senderStudentId": "2025CS1002",
          "createdAt": "2024-01-01T12:00:00.000Z"
        },
        "unreadCount": 2,
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

### Create Conversation

Start a new conversation.

**Endpoint**: `POST /conversations`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "participantStudentId": "2025CS1002"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "conversation": {
      "_id": "new_conversation_id",
      "participants": [...],
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### Get Messages

Retrieve messages from a conversation.

**Endpoint**: `GET /conversations/:conversationId/messages`

**Headers**: `Authorization: Bearer <jwt_token>`

**Query Parameters**:

- `cursor` (optional): Message ID for pagination
- `limit` (optional): Number of messages to return (default: 50, max: 100)

**Response**:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "message_id",
        "conversationId": "conversation_id",
        "senderStudentId": "2025CS1001",
        "text": "Hey, want to study together?",
        "media": null,
        "readBy": ["2025CS1001"],
        "createdAt": "2024-01-01T11:30:00.000Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "message_id_for_pagination"
  }
}
```

### Send Message

Send a message in a conversation.

**Endpoint**: `POST /conversations/:conversationId/messages`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "text": "Sure! What time works for you?",
  "media": {
    "url": "https://res.cloudinary.com/example/image.jpg",
    "cloudinaryPublicId": "chat/image_id"
  }
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "new_message_id",
      "conversationId": "conversation_id",
      "senderStudentId": "2025CS1002",
      "text": "Sure! What time works for you?",
      "media": {...},
      "readBy": ["2025CS1002"],
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

## Media Endpoints

### Get Signed Upload Parameters

Get signed parameters for direct Cloudinary upload.

**Endpoint**: `POST /media/sign`

**Headers**: `Authorization: Bearer <jwt_token>`

**Request Body**:

```json
{
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "folder": "posts" // or "stories", "chat"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "signature": "cloudinary_signature",
    "timestamp": 1640995200,
    "api_key": "cloudinary_api_key",
    "folder": "college/year-1/dept-CS/section-A/student-2025CS1001/posts",
    "upload_url": "https://api.cloudinary.com/v1_1/cloud_name/image/upload"
  }
}
```

## User Endpoints

### Search Users

Search for users by name, student ID, or academic info.

**Endpoint**: `GET /users/search`

**Headers**: `Authorization: Bearer <jwt_token>`

**Query Parameters**:

- `q` (optional): Search query (name or student ID)
- `year` (optional): Filter by year
- `department` (optional): Filter by department
- `section` (optional): Filter by section
- `limit` (optional): Number of results (default: 20, max: 50)

**Example**: `GET /users/search?q=john&year=1&department=CS`

**Response**:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "studentId": "2025CS1001",
        "displayName": "John Doe",
        "photoUrl": "https://example.com/john.jpg",
        "year": 1,
        "department": "CS",
        "section": "A",
        "bio": "Computer Science student"
      }
    ]
  }
}
```

### Get User Profile

Get a specific user's public profile.

**Endpoint**: `GET /users/:studentId`

**Headers**: `Authorization: Bearer <jwt_token>`

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "studentId": "2025CS1001",
      "displayName": "John Doe",
      "photoUrl": "https://example.com/john.jpg",
      "year": 1,
      "department": "CS",
      "section": "A",
      "bio": "Computer Science student",
      "badges": ["early_adopter"],
      "stats": {
        "postsCount": 15,
        "topicsCount": 3,
        "commentsCount": 42
      },
      "joinedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Admin Endpoints

### Upload Roster

Upload student roster via CSV file.

**Endpoint**: `POST /admin/roster`

**Headers**: `Authorization: Bearer <admin_jwt_token>`

**Request**: Multipart form data with CSV file

**CSV Format**:

```csv
studentId,email,year,department,section
2025CS1001,john.doe@college.edu,1,CS,A
2025CS1002,jane.smith@college.edu,1,CS,A
```

**Response**:

```json
{
  "success": true,
  "data": {
    "processed": 150,
    "created": 145,
    "updated": 5,
    "errors": []
  }
}
```

### Moderate Content

Remove or flag content.

**Endpoint**: `POST /admin/moderate`

**Headers**: `Authorization: Bearer <admin_jwt_token>`

**Request Body**:

```json
{
  "contentType": "post", // or "topic", "comment"
  "contentId": "content_id_here",
  "action": "remove", // or "flag", "warn"
  "reason": "Inappropriate content"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "action": "remove",
    "contentId": "content_id_here",
    "moderatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Get Reports

Get platform analytics and reports.

**Endpoint**: `GET /admin/reports`

**Headers**: `Authorization: Bearer <admin_jwt_token>`

**Query Parameters**:

- `period` (optional): Time period (`day`, `week`, `month`)
- `startDate` (optional): Start date (ISO string)
- `endDate` (optional): End date (ISO string)

**Response**:

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "active": 890,
      "newThisWeek": 45
    },
    "content": {
      "posts": 3420,
      "topics": 156,
      "comments": 8930,
      "stories": 1240
    },
    "engagement": {
      "likes": 15600,
      "votes": 2340,
      "messages": 12800
    }
  }
}
```

## Socket.IO Events

### Client Events (Emit)

#### Join Conversation

```javascript
socket.emit("join_conversation", {
  conversationId: "conversation_id_here",
});
```

#### Send Message

```javascript
socket.emit("send_message", {
  conversationId: "conversation_id_here",
  text: "Hello!",
  media: null,
});
```

#### Typing Indicator

```javascript
socket.emit("typing", {
  conversationId: "conversation_id_here",
  isTyping: true,
});
```

### Server Events (Listen)

#### Message Received

```javascript
socket.on("message_received", (data) => {
  // data contains message object
});
```

#### User Typing

```javascript
socket.on("user_typing", (data) => {
  // data: { studentId, conversationId, isTyping }
});
```

#### Notification

```javascript
socket.on("notification", (data) => {
  // data: { type, meta, createdAt }
});
```

## Error Codes

### Authentication Errors

- `INVALID_TOKEN`: Invalid or expired JWT token
- `INVALID_FIREBASE_TOKEN`: Firebase token verification failed
- `INVALID_EMAIL_DOMAIN`: Email domain not allowed
- `USER_NOT_FOUND`: User not found in system
- `STUDENT_ID_NOT_FOUND`: Student ID not in roster

### Validation Errors

- `INVALID_INPUT`: Request validation failed
- `MISSING_REQUIRED_FIELD`: Required field missing
- `INVALID_FILE_TYPE`: Unsupported file type
- `FILE_TOO_LARGE`: File exceeds size limit
- `INVALID_VISIBILITY`: Invalid visibility setting

### Authorization Errors

- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `ACCESS_DENIED`: Access to resource denied
- `RATE_LIMIT_EXCEEDED`: Too many requests

### System Errors

- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_SERVICE_ERROR`: Third-party service unavailable
- `CLOUDINARY_ERROR`: Media upload/processing failed
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Rate Limits

- **Authentication**: 5 requests per minute per IP
- **Posts**: 10 posts per hour per user
- **Comments**: 30 comments per hour per user
- **Messages**: 100 messages per hour per user
- **General API**: 1000 requests per hour per user

## Pagination

Most list endpoints support cursor-based pagination:

- Use `cursor` parameter for the next page
- Use `limit` parameter to control page size
- Response includes `hasMore` boolean and `nextCursor` value

Example:

```
GET /posts?cursor=2024-01-01T12:00:00.000Z&limit=20
```

## Content Types

All requests should use `Content-Type: application/json` unless uploading files (multipart/form-data).

## CORS

The API supports CORS for web applications. Allowed origins are configured per environment.

## Webhooks

The API supports webhooks for real-time integrations:

- **Message sent**: Triggered when a new message is sent
- **Post created**: Triggered when a new post is created
- **User registered**: Triggered when a new user registers

Contact administrators for webhook configuration.
