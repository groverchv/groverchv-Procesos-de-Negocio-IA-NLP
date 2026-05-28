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
                
                # Devolver el archivo de audio directamente
                return Response(content=response.content, media_type="audio/mpeg")
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Error de ElevenLabs: {e.response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

motor_tts = MotorTTS()
