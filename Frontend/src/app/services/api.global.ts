const getIaBaseUrl = (): string => {
  const override = localStorage.getItem('IA_BACKEND_URL');
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  return 'https://backend-ia-nlp.up.railway.app';
};

export const API_GLOBAL = {
  get ia() {
    const base = getIaBaseUrl();
    return {
      comandoDiagrama: `${base}/api/v1/nlp/comando-diagrama`,
      chatAsesor: `${base}/api/v1/nlp/chat-asesor`,
      generarVoz: `${base}/api/v1/tts/generar-voz`,
      reporteDinamico: `${base}/api/v1/reportes/dinamico`
    };
  }
};

