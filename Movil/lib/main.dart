import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'screens/process_details_screen.dart';
import 'screens/auth_screen.dart';
import 'services/api_service.dart';
import 'services/websocket_service.dart';

// ── Brand Blue Palette ──────────────────────────────────────
// Primary:   #1565C0  (deep blue)
// Bright:    #1976D2  (material blue 700)
// Accent:    #42A5F5  (blue 400 — highlights)
// Surface:   #E3F2FD  (blue 50 — card backgrounds)
// Dark bg:   #0D47A1  (blue 900 — AppBar / gradient top)
// ─────────────────────────────────────────────────────────────

const kBluePrimary   = Color(0xFF1565C0);
const kBlueBright    = Color(0xFF1976D2);
const kBlueAccent    = Color(0xFF42A5F5);
const kBlueSurface   = Color(0xFFE3F2FD);
const kBlueDark      = Color(0xFF0D47A1);
const kBlueLight     = Color(0xFFBBDEFB); // blue 100

void main() {
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        Provider<WebSocketService>(create: (_) => WebSocketService()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Proceso de Negocio',
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: kBluePrimary,
          brightness: Brightness.light,
          primary:    kBluePrimary,
          secondary:  kBlueAccent,
          surface:    Colors.white,
          background: const Color(0xFFF0F6FF), // very-light blue-white
          onPrimary:  Colors.white,
          onSecondary: Colors.white,
          primaryContainer:   kBlueSurface,
          onPrimaryContainer: kBlueDark,
        ),
        // ── AppBar — blue gradient ───────────────────────────
        appBarTheme: const AppBarTheme(
          elevation: 0,
          centerTitle: false,
          backgroundColor: kBluePrimary,
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          iconTheme: IconThemeData(color: Colors.white),
          titleTextStyle: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 20,
            letterSpacing: -0.5,
            color: Colors.white,
          ),
        ),
        // ── Cards ────────────────────────────────────────────
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: kBlueLight, width: 1),
          ),
        ),
        // ── Buttons ──────────────────────────────────────────
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: kBluePrimary,
            foregroundColor: Colors.white,
            elevation: 3,
            shadowColor: kBluePrimary.withOpacity(0.4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: kBluePrimary,
            side: const BorderSide(color: kBluePrimary, width: 1.5),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        // ── Inputs ───────────────────────────────────────────
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: kBlueLight),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: kBlueLight),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: kBluePrimary, width: 2),
          ),
          prefixIconColor: kBlueAccent,
        ),
        // ── BottomNav ────────────────────────────────────────
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: kBlueSurface,
          iconTheme: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return const IconThemeData(color: kBluePrimary);
            }
            return const IconThemeData(color: Color(0xFF90A4AE));
          }),
          labelTextStyle: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return const TextStyle(color: kBluePrimary, fontWeight: FontWeight.w800, fontSize: 12);
            }
            return const TextStyle(color: Color(0xFF90A4AE), fontSize: 12);
          }),
        ),
        // ── Chips ────────────────────────────────────────────
        chipTheme: const ChipThemeData(
          backgroundColor: kBlueSurface,
          labelStyle: TextStyle(color: kBluePrimary, fontWeight: FontWeight.bold),
          side: BorderSide.none,
        ),
        // ── Progress indicator ───────────────────────────────
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: kBluePrimary,
        ),
      ),
      home: const AuthScreen(),
      routes: {
        '/auth': (context) => const AuthScreen(),
        '/home': (context) => const HomeScreen(),
        '/process-details': (context) => const ProcessDetailsScreen(),
      },
    );
  }
}
