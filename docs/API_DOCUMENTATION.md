# Easy Check-In: Mobile REST API Documentation

This documentation provides the complete specification for the REST API designed for the **Flutter mobile application** (and any other native/mobile client) connecting to the Easy Check-In backend.

---

## 1. Authentication Architecture

The backend uses **Better Auth** with the **Bearer token plugin** (`bearer()`).

### How Auth Works for Mobile Clients:
1. **Sign In**: The mobile client sends email and password to `/api/auth/sign-in/email`.
2. **Token Extraction**: The server issues a session token returned in the `set-auth-token` HTTP response header and/or the JSON session payload.
3. **Secure Storage**: The Flutter app saves this token in secure device storage (`flutter_secure_storage`).
4. **Bearer Header**: All subsequent API requests to `/api/v1/*` must include the header:
   ```http
   Authorization: Bearer <your_session_token>
   ```
5. **No Cookie Dependency**: The Flutter client does not need to manage browser cookies.

---

## 2. Base URL & Common Headers

- **Base URL (Local)**: `http://localhost:3000` (or `http://10.0.2.2:3000` for Android emulator)
- **Base URL (Production)**: `https://your-domain.com`

### Common Headers:
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <session_token>
```

---

## 3. Authentication Endpoints

### 3.1 Sign In with Email
- **Endpoint**: `POST /api/auth/sign-in/email`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword123"
  }
  ```
- **Success Response (200 OK)**:
  - **Headers**:
    `set-auth-token: <session_token>`
  - **Body**:
    ```json
    {
      "session": {
        "id": "sess_12345",
        "userId": "usr_abcde",
        "token": "token_xyz987...",
        "expiresAt": "2026-11-30T13:30:00.000Z"
      },
      "user": {
        "id": "usr_abcde",
        "email": "user@example.com",
        "name": "Alex Smith",
        "username": "alex",
        "image": null
      }
    }
    ```

### 3.2 Sign Up
- **Endpoint**: `POST /api/auth/sign-up/email`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword123",
    "name": "Alex Smith",
    "username": "alexsmith"
  }
  ```
- **Success Response (200 OK)**:
  Returns user and session with `set-auth-token` header.

### 3.3 Sign Out
- **Endpoint**: `POST /api/auth/sign-out`
- **Headers**: `Authorization: Bearer <session_token>`
- **Success Response (200 OK)**:
  ```json
  { "success": true }
  ```

---

## 4. User Profile & State

### 4.1 Get Current User State
- **Endpoint**: `GET /api/v1/me`
- **Description**: Returns current user profile, their organization memberships with roles, and any currently open active check-in.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "user": {
      "id": "usr_abcde",
      "name": "Alex Smith",
      "email": "user@example.com",
      "username": "alexsmith",
      "image": "https://example.com/avatar.jpg",
      "role": "admin"
    },
    "organizations": [
      {
        "organizationId": "org_gym123",
        "name": "Downtown Fitness Hub",
        "slug": "downtown-fitness",
        "role": "member",
        "isAdmin": false
      }
    ],
    "activeCheckIn": {
      "id": "chk_98765",
      "checkedInAt": "2026-10-30T10:15:00.000Z",
      "placeId": "plc_112233",
      "placeName": "Downtown Gym Floor",
      "placeTypeName": "Gym",
      "organizationName": "Downtown Fitness Hub",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radiusM": 150,
      "captureCount": 1
    }
  }
  ```
  *(If the user is not checked in, `"activeCheckIn"` will be `null`).*

---

## 5. Check-In & Proximity Endpoints

### 5.1 Find Nearby Places
- **Endpoint**: `POST /api/v1/check-in/nearby`
- **Description**: Given the device's current GPS coordinates and accuracy, calculates distance to all active places registered by the user's organizations and determines if the user is inside the geofence.
- **Request Body**:
  ```json
  {
    "latitude": 40.712800,
    "longitude": -74.006000,
    "accuracyM": 12.5
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "places": [
      {
        "id": "plc_112233",
        "name": "Downtown Gym Floor",
        "typeName": "Gym",
        "organizationName": "Downtown Fitness Hub",
        "radiusM": 150,
        "distanceM": 42.8,
        "inside": true,
        "canCheckIn": true,
        "reason": "ok"
      },
      {
        "id": "plc_445566",
        "name": "Midtown Branch",
        "typeName": "Gym",
        "organizationName": "Downtown Fitness Hub",
        "radiusM": 100,
        "distanceM": 320.4,
        "inside": false,
        "canCheckIn": false,
        "reason": "too_far"
      }
    ]
  }
  ```

### 5.2 Get Active Check-In
- **Endpoint**: `GET /api/v1/check-in`
- **Description**: Retrieves the currently open visit for the authenticated user, or `null`.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "activeCheckIn": {
      "id": "chk_98765",
      "checkedInAt": "2026-10-30T10:15:00.000Z",
      "placeId": "plc_112233",
      "placeName": "Downtown Gym Floor",
      "placeTypeName": "Gym",
      "organizationName": "Downtown Fitness Hub",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radiusM": 150,
      "captureCount": 2
    }
  }
  ```

### 5.3 Check In to a Place
- **Endpoint**: `POST /api/v1/check-in`
- **Description**: Verifies proximity on the server using Haversine calculation. If within radius and accuracy is acceptable, creates a check-in and logs a location capture.
- **Request Body**:
  ```json
  {
    "placeId": "plc_112233",
    "latitude": 40.712810,
    "longitude": -74.006010,
    "accuracyM": 14.0
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "ok": true,
    "activeCheckIn": {
      "id": "chk_98765",
      "checkedInAt": "2026-10-30T10:15:00.000Z",
      "placeId": "plc_112233",
      "placeName": "Downtown Gym Floor",
      "placeTypeName": "Gym",
      "organizationName": "Downtown Fitness Hub",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radiusM": 150,
      "captureCount": 1
    }
  }
  ```
- **Error Response (422 Unprocessable Entity)**:
  ```json
  {
    "ok": false,
    "error": "You are 210 m away, and check-in here needs 150 m."
  }
  ```

### 5.4 Mid-Visit Location Capture ("Store My Location")
- **Endpoint**: `POST /api/v1/check-in/store-location`
- **Description**: Records an additional location sample mid-visit to prove ongoing presence.
- **Request Body**:
  ```json
  {
    "latitude": 40.712790,
    "longitude": -74.006020,
    "accuracyM": 8.0
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "message": "Location stored"
  }
  ```

### 5.5 Check Out
- **Endpoint**: `POST /api/v1/check-in/check-out`
- **Description**: Closes the active check-in. Coordinates are optional (allows closing even if GPS is unavailable or permission declined).
- **Request Body** (Coordinates optional):
  ```json
  {
    "latitude": 40.712820,
    "longitude": -74.006015,
    "accuracyM": 10.0
  }
  ```
  *Or empty body `{}` if coordinates cannot be obtained.*
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "message": "Checked out successfully"
  }
  ```

### 5.6 Upload Photos for a Check-in
- **Endpoint**: `POST /api/v1/check-in/photos`
- **Content-Type**: `multipart/form-data`
- **Description**: Uploads one or multiple photos attached to an active check-in or specific `checkInId`.
- **Form Data Fields**:
  - `images`: One or more image binary files (JPEG, PNG, WebP, GIF, HEIC up to 10 MB each).
  - `checkInId` (optional): ID of the check-in; defaults to the current active check-in.
  - `caption` (optional): Text description for the photo(s).
- **Response (201 Created)**:
  ```json
  {
    "ok": true,
    "count": 2,
    "images": [
      {
        "id": "img_123",
        "checkInId": "chk_98765",
        "imageUrl": "/uploads/check-ins/photo-1.jpg",
        "caption": "Morning workout",
        "createdAt": "2026-10-31T01:30:00.000Z"
      },
      {
        "id": "img_124",
        "checkInId": "chk_98765",
        "imageUrl": "/uploads/check-ins/photo-2.jpg",
        "caption": "Morning workout",
        "createdAt": "2026-10-31T01:30:05.000Z"
      }
    ]
  }
  ```

---

## 6. Offline Batch Sync Endpoint

### 6.1 Sync Queued Offline Events
- **Endpoint**: `POST /api/v1/check-in/sync`
- **Description**: For mobile apps running offline. When network connectivity resumes, the Flutter client uploads queued events in chronological order.
- **Request Body**:
  ```json
  {
    "events": [
      {
        "id": "client-uuid-1",
        "type": "check_in",
        "placeId": "plc_112233",
        "latitude": 40.712810,
        "longitude": -74.006010,
        "accuracyM": 15.0,
        "timestamp": "2026-10-30T09:00:00.000Z"
      },
      {
        "id": "client-uuid-2",
        "type": "store_location",
        "latitude": 40.712815,
        "longitude": -74.006005,
        "accuracyM": 12.0,
        "timestamp": "2026-10-30T10:00:00.000Z"
      },
      {
        "id": "client-uuid-3",
        "type": "check_out",
        "latitude": 40.712800,
        "longitude": -74.006020,
        "accuracyM": 14.0,
        "timestamp": "2026-10-30T10:45:00.000Z"
      }
    ]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "syncedCount": 3,
    "results": [
      { "id": "client-uuid-1", "type": "check_in", "ok": true },
      { "id": "client-uuid-2", "type": "store_location", "ok": true },
      { "id": "client-uuid-3", "type": "check_out", "ok": true }
    ]
  }
  ```

---

## 7. Places & Visits Endpoints

### 7.1 List All Accessible Places
- **Endpoint**: `GET /api/v1/places`
- **Description**: Lists all active, approved places across the user's organizations. Essential for Flutter to cache locally in SQLite / Drift for offline geofencing and offline map markers.
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "places": [
      {
        "id": "plc_112233",
        "name": "Downtown Gym Floor",
        "address": "123 Broadway, New York, NY",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "radiusM": 150,
        "placeTypeId": 2,
        "typeName": "Gym",
        "typeIcon": "dumbbell",
        "organizationId": "org_gym123",
        "organizationName": "Downtown Fitness Hub"
      }
    ]
  }
  ```

### 7.2 List User Visits (History)
- **Endpoint**: `GET /api/v1/visits?limit=50`
- **Description**: Returns recent check-in history for the authenticated user.
- **Query Parameters**:
  - `limit`: Integer (1-100, default 50)
- **Response (200 OK)**:
  ```json
  {
    "ok": true,
    "visits": [
      {
        "id": "chk_98765",
        "placeName": "Downtown Gym Floor",
        "typeName": "Gym",
        "organizationName": "Downtown Fitness Hub",
        "checkedInAt": "2026-10-30T10:15:00.000Z",
        "checkedOutAt": "2026-10-30T11:45:00.000Z",
        "checkoutReason": "manual",
        "seconds": 5400
      }
    ]
  }
  ```

---

## 8. HTTP Status Codes & Error Format

All error responses return a standardized JSON structure:
```json
{
  "ok": false,
  "error": "Human readable error message"
}
```

- `200 OK`: Request succeeded.
- `201 Created`: Check-in created.
- `400 Bad Request`: Invalid request parameters or invalid JSON body.
- `401 Unauthorized`: Missing or invalid Bearer token.
- `404 Not Found`: Resource does not exist.
- `422 Unprocessable Entity`: Business logic rejection (e.g., outside geofence radius, location too inaccurate, or already checked in).
- `500 Internal Server Error`: Server failure.

