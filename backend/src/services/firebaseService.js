const admin = require("firebase-admin");

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.collegeEmailDomain = process.env.COLLEGE_EMAIL_DOMAIN || "college.edu";
  }

  /**
   * Initialize Firebase Admin SDK with service account credentials
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Check if Firebase app is already initialized
      if (admin.apps.length === 0) {
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI,
          token_uri: process.env.FIREBASE_TOKEN_URI,
          auth_provider_x509_cert_url:
            process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }

      this.initialized = true;
      console.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK:", error.message);
      throw new Error("Firebase initialization failed");
    }
  }

  /**
   * Verify Firebase ID token and extract user information
   * @param {string} idToken - Firebase ID token from client
   * @returns {Promise<Object>} Decoded token with user information
   */
  async verifyIdToken(idToken) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!idToken) {
        throw new Error("ID token is required");
      }

      const decodedToken = await admin.auth().verifyIdToken(idToken);

      if (!decodedToken.email) {
        throw new Error("Email not found in token");
      }

      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture,
        iss: decodedToken.iss,
        aud: decodedToken.aud,
        authTime: decodedToken.auth_time,
        iat: decodedToken.iat,
        exp: decodedToken.exp,
      };
    } catch (error) {
      console.error("Token verification failed:", error.message);

      // Re-throw specific validation errors
      if (
        error.message === "ID token is required" ||
        error.message === "Email not found in token"
      ) {
        throw error;
      }

      // Provide specific error messages for different failure types
      if (error.code === "auth/id-token-expired") {
        throw new Error("Token has expired");
      } else if (error.code === "auth/id-token-revoked") {
        throw new Error("Token has been revoked");
      } else if (error.code === "auth/invalid-id-token") {
        throw new Error("Invalid token format");
      } else {
        throw new Error("Token verification failed");
      }
    }
  }

  /**
   * Validate if email domain matches the college domain
   * @param {string} email - Email address to validate
   * @returns {boolean} True if email domain is valid
   */
  validateEmailDomain(email) {
    if (!email || typeof email !== "string") {
      return false;
    }

    const parts = email.toLowerCase().split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }

    const emailDomain = parts[1];
    const requiredDomain = this.collegeEmailDomain.toLowerCase();

    return emailDomain === requiredDomain;
  }

  /**
   * Extract domain from email address
   * @param {string} email - Email address
   * @returns {string} Domain part of the email
   */
  extractEmailDomain(email) {
    if (!email || typeof email !== "string") {
      return null;
    }

    const parts = email.split("@");
    return parts.length === 2 && parts[0] && parts[1]
      ? parts[1].toLowerCase()
      : null;
  }

  /**
   * Get the required college email domain
   * @returns {string} College email domain
   */
  getCollegeEmailDomain() {
    return this.collegeEmailDomain;
  }

  /**
   * Verify token and validate email domain in one step
   * @param {string} idToken - Firebase ID token
   * @returns {Promise<Object>} Verified user data with domain validation
   */
  async verifyTokenAndDomain(idToken) {
    const decodedToken = await this.verifyIdToken(idToken);

    if (!this.validateEmailDomain(decodedToken.email)) {
      const providedDomain = this.extractEmailDomain(decodedToken.email);
      throw new Error(
        `Access denied: school-domain required. Provided: ${providedDomain}, Required: ${this.collegeEmailDomain}`
      );
    }

    return decodedToken;
  }

  /**
   * Send push notification to a single device
   * @param {string} fcmToken - FCM registration token
   * @param {Object} notification - Notification payload
   * @param {Object} data - Optional data payload
   * @returns {Promise<string>} Message ID if successful
   */
  async sendNotificationToDevice(fcmToken, notification, data = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!fcmToken) {
        throw new Error("FCM token is required");
      }

      if (!notification || !notification.title) {
        throw new Error("Notification title is required");
      }

      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body || "",
        },
        data: {
          ...data,
          // Ensure all data values are strings
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: "ic_notification",
            color: "#1976D2",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log("Successfully sent message:", response);
      return response;
    } catch (error) {
      console.error("Error sending FCM message:", error);

      // Handle specific FCM errors
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        throw new Error("Invalid or unregistered FCM token");
      } else if (error.code === "messaging/invalid-argument") {
        throw new Error("Invalid message payload");
      } else {
        throw new Error(`Failed to send push notification: ${error.message}`);
      }
    }
  }

  /**
   * Send push notification to multiple devices
   * @param {string[]} fcmTokens - Array of FCM registration tokens
   * @param {Object} notification - Notification payload
   * @param {Object} data - Optional data payload
   * @returns {Promise<Object>} Batch response with success/failure counts
   */
  async sendNotificationToMultipleDevices(fcmTokens, notification, data = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
        throw new Error("FCM tokens array is required and cannot be empty");
      }

      if (!notification || !notification.title) {
        throw new Error("Notification title is required");
      }

      // Filter out invalid tokens
      const validTokens = fcmTokens.filter(
        (token) => token && typeof token === "string"
      );

      if (validTokens.length === 0) {
        throw new Error("No valid FCM tokens provided");
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body || "",
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: "ic_notification",
            color: "#1976D2",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        tokens: validTokens,
      };

      const response = await admin.messaging().sendMulticast(message);

      console.log(`Successfully sent ${response.successCount} messages`);
      if (response.failureCount > 0) {
        console.log(`Failed to send ${response.failureCount} messages`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Error for token ${validTokens[idx]}:`, resp.error);
          }
        });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
        invalidTokens: this.extractInvalidTokens(
          response.responses,
          validTokens
        ),
      };
    } catch (error) {
      console.error("Error sending batch FCM messages:", error);
      throw new Error(
        `Failed to send batch push notifications: ${error.message}`
      );
    }
  }

  /**
   * Extract invalid tokens from batch response for cleanup
   * @param {Array} responses - FCM batch responses
   * @param {Array} tokens - Original tokens array
   * @returns {Array} Array of invalid tokens
   */
  extractInvalidTokens(responses, tokens) {
    const invalidTokens = [];

    responses.forEach((response, index) => {
      if (!response.success && response.error) {
        const errorCode = response.error.code;
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    return invalidTokens;
  }

  /**
   * Send notification to topic subscribers
   * @param {string} topic - FCM topic name
   * @param {Object} notification - Notification payload
   * @param {Object} data - Optional data payload
   * @returns {Promise<string>} Message ID if successful
   */
  async sendNotificationToTopic(topic, notification, data = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!topic) {
        throw new Error("Topic name is required");
      }

      if (!notification || !notification.title) {
        throw new Error("Notification title is required");
      }

      const message = {
        topic: topic,
        notification: {
          title: notification.title,
          body: notification.body || "",
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: "ic_notification",
            color: "#1976D2",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log("Successfully sent topic message:", response);
      return response;
    } catch (error) {
      console.error("Error sending FCM topic message:", error);
      throw new Error(`Failed to send topic notification: ${error.message}`);
    }
  }

  /**
   * Subscribe tokens to a topic
   * @param {string[]} tokens - Array of FCM tokens
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Subscription response
   */
  async subscribeToTopic(tokens, topic) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        throw new Error("Tokens array is required and cannot be empty");
      }

      if (!topic) {
        throw new Error("Topic name is required");
      }

      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      console.log(
        `Successfully subscribed ${response.successCount} tokens to topic ${topic}`
      );

      return response;
    } catch (error) {
      console.error("Error subscribing to topic:", error);
      throw new Error(`Failed to subscribe to topic: ${error.message}`);
    }
  }

  /**
   * Unsubscribe tokens from a topic
   * @param {string[]} tokens - Array of FCM tokens
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Unsubscription response
   */
  async unsubscribeFromTopic(tokens, topic) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        throw new Error("Tokens array is required and cannot be empty");
      }

      if (!topic) {
        throw new Error("Topic name is required");
      }

      const response = await admin
        .messaging()
        .unsubscribeFromTopic(tokens, topic);
      console.log(
        `Successfully unsubscribed ${response.successCount} tokens from topic ${topic}`
      );

      return response;
    } catch (error) {
      console.error("Error unsubscribing from topic:", error);
      throw new Error(`Failed to unsubscribe from topic: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new FirebaseService();
