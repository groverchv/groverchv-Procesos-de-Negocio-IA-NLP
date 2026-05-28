import 'package:hive/hive.hive';

part 'tramite_local.g.dart';

@HiveType(typeId: 0)
class TramiteLocal extends HiveObject {
  @HiveField(0)
  late String id;

  @HiveField(1)
  late String estado;

  @HiveField(2)
  late String tipoPolitica;

  @HiveField(3)
  late bool estaSincronizado;

  @HiveField(4)
  late Map<String, dynamic> datosFormulario;

  TramiteLocal({
    required this.id,
    required this.estado,
    required this.tipoPolitica,
    this.estaSincronizado = true,
    required this.datosFormulario,
  });
}
