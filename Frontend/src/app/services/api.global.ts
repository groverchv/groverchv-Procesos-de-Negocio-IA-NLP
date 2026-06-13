const getIaBaseUrl = (): string => {
  const override = localStorage.getItem('IA_BACKEND_URL');
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  try {
    const configStr = localStorage.getItem('bpmnflow_config');
    if (configStr) {
      const config = JSON.parse(configStr);
      if (config.useLocalIA === false) {
        return 'https://backend-ia-nlp.up.railway.app';
      }
    }
  } catch {}
  return 'http://127.0.0.1:8000';
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

