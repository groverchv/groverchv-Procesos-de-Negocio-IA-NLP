import 'package:hive_flutter/hive_flutter.dart';
import 'package:procesos_movil/models/tramite_local.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class SincronizacionLocalService {
  static const String cajaTramites = 'tramitesPendientes';

  // Inicializar Hive para Flutter y registrar el Adaptador de nuestro Modelo
  static Future<void> iniciarHive() async {
    await Hive.initFlutter();
    Hive.registerAdapter(TramiteLocalAdapter()); // Este archivo lo debe autogenerar el build_runner de Flutter
    await Hive.openBox<TramiteLocal>(cajaTramites);
  }

  // Guardar datos sin conexión (El cliente llenó un formulario sin internet)
  Future<void> guardarTramiteOffline(TramiteLocal tramite) async {
    final caja = Hive.box<TramiteLocal>(cajaTramites);
    tramite.estaSincronizado = false;
    await caja.put(tramite.id, tramite);
  }

  // Devolver todo lo que no se ha subido a AWS/Spring Boot
  List<TramiteLocal> obtenerTramitesNoSincronizados() {
    final caja = Hive.box<TramiteLocal>(cajaTramites);
    return caja.values.where((t) => !t.estaSincronizado).toList();
  }

  // Tarea de Background Sync para subir cuando haya Red
  Future<void> sincronizarConServidor() async {
    final conectividad = await Connectivity().checkConnectivity();
    
    // Si tenemos internet
    if (conectividad != ConnectivityResult.none) {
      final tramites = obtenerTramitesNoSincronizados();
      
      for (var tramite in tramites) {
        try {
          // Lógica de HTTP POST a Spring Boot enviando el formulario local
          // Ej: await http.post('http://tu-server/api/v1/tramites', body: jsonEncode(tramite.datosFormulario));

          // Si pasó con código 200:
          tramite.estaSincronizado = true;
          tramite.save(); // Salvar estado como "Sincronizado"
        } catch (e) {
          print('Fallo al subir trámite: ${tramite.id}');
        }
      }
    }
  }
}
