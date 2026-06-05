// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tramite_local.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class TramiteLocalAdapter extends TypeAdapter<TramiteLocal> {
  @override
  final int typeId = 0;

  @override
  TramiteLocal read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return TramiteLocal(
      id: fields[0] as String,
      estado: fields[1] as String,
      tipoPolitica: fields[2] as String,
      estaSincronizado: fields[3] as bool,
      datosFormulario: (fields[4] as Map).cast<String, dynamic>(),
    );
  }

  @override
  void write(BinaryWriter writer, TramiteLocal obj) {
    writer
      ..writeByte(5)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.estado)
      ..writeByte(2)
      ..write(obj.tipoPolitica)
      ..writeByte(3)
      ..write(obj.estaSincronizado)
      ..writeByte(4)
      ..write(obj.datosFormulario);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TramiteLocalAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
