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
}

// Export singleton instance
module.exports = new FirebaseService();
