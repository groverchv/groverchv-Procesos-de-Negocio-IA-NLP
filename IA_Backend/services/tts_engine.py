import os
import httpx
from fastapi import HTTPException
from fastapi.responses import Response

class MotorTTS:
    def __init__(self):
        self.elevenlabs_url = "https://api.elevenlabs.io/v1/text-to-speech"
        self.default_voice_id = "21m00Tcm4TlvDq8ikWAM" # Rachel voice (Soporte técnico) o Tonny (Guía)

    async def generar_voz(self, text: str, voice_id: str = None):
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta la API Key de ElevenLabs en la variable de entorno ELEVENLABS_API_KEY")

        if not text:
            raise HTTPException(status_code=400, detail="El texto no puede estar vacío")

        target_voice_id = voice_id if voice_id else self.default_voice_id

        headers = {
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }

        body = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.elevenlabs_url}/{target_voice_id}", json=body, headers=headers, timeout=30.0)
                response.raise_for_status()
                return Response(content=response.content, media_type="audio/mpeg")
            except Exception as e:
                print(f"[ElevenLabs Fallback] Error en ElevenLabs: {e}. Usando Google Translate TTS...")
                try:
                    google_tts_url = "https://translate.google.com/translate_tts"
                    params = {
                        "ie": "UTF-8",
                        "tl": "es",
                        "client": "tw-ob",
                        "q": text[:200]
                    }
                    fallback_response = await client.get(google_tts_url, params=params, timeout=15.0)
                    fallback_response.raise_for_status()
                    return Response(content=fallback_response.content, media_type="audio/mpeg")
                except Exception as ex:
                    print(f"[ElevenLabs Fallback] Google TTS también falló: {ex}")
                    raise HTTPException(status_code=500, detail=f"Ambos motores de voz fallaron: {ex}")

motor_tts = MotorTTS()
