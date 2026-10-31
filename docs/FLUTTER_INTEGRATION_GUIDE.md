# Easy Check-In: Flutter Mobile Application Integration Guide

This guide provides a production-grade architecture and implementation blueprint for building the **Easy Check-In** companion mobile application with **Flutter**.

---

## 1. Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Flutter App (UI)                │
                      │  - Interactive Map (flutter_map)             │
                      │  - 1-Tap Check-in Ring Button                │
                      │  - Visit History & Profile                   │
                      └──────────────────────┬───────────────────────┘
                                             │
                      ┌──────────────────────┴───────────────────────┐
                      │    State Management (Riverpod / Bloc)        │
                      └──────────────┬───────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
┌──────────▼───────────────┐                       ┌───────────▼──────────────┐
│   Offline Sync Service   │                       │       Dio HTTP Client    │
│  - SQLite / Drift / Isar │                       │  - Auth Bearer Interceptor│
│  - Sync Queue Table      │                       │  - Retry / Backoff       │
└──────────┬───────────────┘                       └───────────┬──────────────┘
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     │ Network
                                     ▼
                      ┌──────────────────────────────┐
                      │    Easy Check-In Backend     │
                      │   (Next.js + Better Auth)    │
                      └──────────────────────────────┘
```

---

## 2. Recommended Flutter Dependencies

Add the following packages to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.6.1

  # Networking
  dio: ^5.7.0
  connectivity_plus: ^6.1.0

  # Secure Storage & Persistence
  flutter_secure_storage: ^9.2.2
  shared_preferences: ^2.3.2
  drift: ^2.22.0          # High-performance SQLite ORM
  sqlite3_flutter_libs: ^0.5.26
  path_provider: ^2.1.5

  # Location & Sensors
  geolocator: ^13.0.2

  # Maps
  flutter_map: ^7.0.2     # OpenStreetMap Leaflet-equivalent for Flutter
  latlong2: ^0.9.1
  flutter_map_cache: ^1.6.0 # Offline tile caching

  # Background Geofencing (Optional native superpower)
  flutter_background_geolocation: ^4.16.2

  # UI & Utilities
  uuid: ^4.5.1
  intl: ^0.19.0
```

---

## 3. Better Auth Bearer Token Interceptor (Dio)

The backend accepts `Authorization: Bearer <session_token>`. Create a Dio interceptor to automatically attach the stored token:

```dart
// lib/core/network/auth_interceptor.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String tokenKey = 'auth_session_token';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    options.headers['Accept'] = 'application/json';
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    // If sign-in or sign-up returns 'set-auth-token' header, persist it
    final setAuthToken = response.headers.value('set-auth-token');
    if (setAuthToken != null && setAuthToken.isNotEmpty) {
      await _storage.write(key: tokenKey, value: setAuthToken);
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Handle expired session / token invalidation
      _storage.delete(key: tokenKey);
      // Trigger navigation to login screen via your router/state provider
    }
    handler.next(err);
  }
}
```

### Dio Client Setup:
```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'auth_interceptor.dart';

Dio createApiClient({required String baseUrl}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Content-Type': 'application/json'},
  ));

  dio.interceptors.add(AuthInterceptor());
  dio.interceptors.add(LogInterceptor(responseBody: true));
  return dio;
}
```

---

## 4. Location & Geospatial Calculations

Create a location service that requests hardware GPS readings and matches the backend's Haversine algorithm:

```dart
// lib/core/services/location_service.dart
import 'dart:math';
import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Ensures high accuracy position reading
  static Future<Position> getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services are turned off on your device.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Location permission was denied.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permissions are permanently denied. Please enable in Settings.');
    }

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
  }

  /// Exact client-side Haversine distance in meters (matches backend haversine.ts)
  static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    const double earthRadiusM = 6371000.0;
    final double phi1 = lat1 * pi / 180;
    final double phi2 = lat2 * pi / 180;
    final double deltaPhi = (lat2 - lat1) * pi / 180;
    final double deltaLambda = (lon2 - lon1) * pi / 180;

    final double a = sin(deltaPhi / 2) * sin(deltaPhi / 2) +
        cos(phi1) * cos(phi2) * sin(deltaLambda / 2) * sin(deltaLambda / 2);

    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusM * c;
  }
}
```

---

## 5. Offline Queue & Sync Engine (Drift / SQLite)

When the user is in a gym basement or area with no cell service, check-ins are saved locally into SQLite and synced once internet connectivity resumes.

### SQLite Table Schema (Drift):
```dart
// lib/core/database/tables/sync_events.dart
import 'package:drift/drift.dart';

class SyncEvents extends Table {
  TextColumn get id => text()(); // UUID
  TextColumn get type => text()(); // 'check_in', 'store_location', 'check_out'
  TextColumn get placeId => text().nullable()();
  RealColumn get latitude => real().nullable()();
  RealColumn get longitude => real().nullable()();
  RealColumn get accuracyM => real().nullable()();
  DateTimeColumn get timestamp => dateTime()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}
```

### Sync Service:
```dart
// lib/core/services/sync_service.dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

class SyncService {
  final Dio _dio;
  // Reference to your local SQLite / Drift database
  final dynamic _db;

  SyncService(this._dio, this._db);

  /// Queue check-in locally when offline
  Future<void> queueOfflineCheckIn({
    required String placeId,
    required double lat,
    required double lng,
    required double? accuracy,
  }) async {
    final eventId = const Uuid().v4();
    await _db.insertSyncEvent(
      id: eventId,
      type: 'check_in',
      placeId: placeId,
      latitude: lat,
      longitude: lng,
      accuracyM: accuracy,
      timestamp: DateTime.now().toUtc(),
    );
  }

  /// Sync all pending events when back online
  Future<int> syncPendingEvents() async {
    final pending = await _db.getPendingSyncEvents();
    if (pending.isEmpty) return 0;

    final eventsPayload = pending.map((e) => {
      'id': e.id,
      'type': e.type,
      'placeId': e.placeId,
      'latitude': e.latitude,
      'longitude': e.longitude,
      'accuracyM': e.accuracyM,
      'timestamp': e.timestamp.toIso8601String(),
    }).toList();

    try {
      final response = await _dio.post(
        '/api/v1/check-in/sync',
        data: {'events': eventsPayload},
      );

      if (response.data['ok'] == true) {
        final List results = response.data['results'] ?? [];
        for (final res in results) {
          if (res['ok'] == true) {
            await _db.markEventSynced(res['id']);
          }
        }
        return response.data['syncedCount'] as int;
      }
    } catch (e) {
      // Still offline or server error, retain in queue for next retry
    }
    return 0;
  }
}
```

---

## 6. Interactive Flutter Map with OpenStreetMap

Here is how to render the interactive map matching the web app:

```dart
// lib/features/map/presentation/check_in_map.dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class CheckInMapView extends StatelessWidget {
  final LatLng userPosition;
  final List<dynamic> places; // Places loaded from /api/v1/places
  final Function(dynamic place) onPlaceSelected;

  const CheckInMapView({
    super.key,
    required this.userPosition,
    required this.places,
    required this.onPlaceSelected,
  });

  @override
  Widget build(BuildContext context) {
    return FlutterMap(
      options: MapOptions(
        initialCenter: userPosition,
        initialZoom: 16.0,
      ),
      children: [
        // OpenStreetMap Tile Layer
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.easycheckin.app',
        ),

        // Geofence Circles around places
        CircleLayer(
          circles: places.map((place) {
            return CircleMarker(
              point: LatLng(place['latitude'], place['longitude']),
              radius: (place['radiusM'] as num).toDouble(),
              useRadiusInMeter: true,
              color: const Color(0x3300C49F), // Semi-transparent green
              borderColor: const Color(0xFF00C49F),
              borderStrokeWidth: 2,
            );
          }).toList(),
        ),

        // User Position Marker
        MarkerLayer(
          markers: [
            Marker(
              point: userPosition,
              width: 24,
              height: 24,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.blueAccent,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [
                    BoxShadow(color: Colors.black26, blurRadius: 6),
                  ],
                ),
              ),
            ),

            // Place Markers
            ...places.map((place) {
              return Marker(
                point: LatLng(place['latitude'], place['longitude']),
                width: 36,
                height: 36,
                child: GestureDetector(
                  onTap: () => onPlaceSelected(place),
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFF0C1F26),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.fitness_center,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ],
    );
  }
}
```

---

## 7. Native Background Geofencing (Flutter Exclusive Superpower)

Unlike mobile browsers which kill background tasks within seconds, Flutter apps can use `flutter_background_geolocation` to wake up the phone when entering a gym or place:

```dart
// lib/core/services/geofence_manager.dart
import 'package:flutter_background_geolocation/flutter_background_geolocation.dart' as bg;

class GeofenceManager {
  static Future<void> registerPlaceGeofences(List<dynamic> places) async {
    for (final place in places) {
      await bg.BackgroundGeolocation.addGeofence(
        bg.Geofence(
          identifier: place['id'],
          radius: (place['radiusM'] as num).toDouble(),
          latitude: place['latitude'],
          longitude: place['longitude'],
          notifyOnEntry: true,
          notifyOnExit: false,
        ),
      );
    }

    bg.BackgroundGeolocation.onGeofence((bg.GeofenceEvent event) {
      if (event.action == 'ENTER') {
        // Show native local notification:
        // "You have arrived at Iron Gym! Tap to check in."
      }
    });

    await bg.BackgroundGeolocation.start();
  }
}
```

---

## 8. Summary Checklist for Flutter Development

1. Setup `dio` with `AuthInterceptor` pointing to `POST /api/auth/sign-in/email`.
2. Cache all user places from `GET /api/v1/places` in local SQLite (`drift`).
3. Render interactive OSM map with `flutter_map` showing geofence circles and current location.
4. Implement one-tap Check In using `POST /api/v1/check-in` when online.
5. Store check-in locally in `SyncEvents` table when offline, and sync via `POST /api/v1/check-in/sync` when online.
6. Optional: Register background geofences for instant check-in notifications when entering a gym or workplace.

