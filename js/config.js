/*
  Configuracion principal.
  1. Despliega apps-script/Code.gs como Google Apps Script Web App.
  2. Pega aqui la URL terminada en /exec.
  3. Pega la URL publica del Web App, no la URL del Google Sheet.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbwGfSCwYliqFxmHws_Kcf9aiMsvaGU8vZ_UPZ3lEREtBqCgjCifC8nDaUfqNWXZfXPjqA/exec";
const DEMO_MODE = false;

const APP_CONFIG = {
  appName: "Bogota Alerta Urbana",
  logoText: "BAU",
  city: "Bogota",
  defaultRoute: "#/feed",
  postsDefaultStatus: "active", // Cambia a "pending" si quieres revision previa por admin.
  sessionKey: "bau_session",
  ageGateKey: "bau_age_confirmed_18",
  reactions: ["Me impacta", "Alerta", "Confirmo", "No confirmado", "Cuidado", "Apoyo"],
  categories: [
    "Manifestacion",
    "Reporte ciudadano",
    "Incidente",
    "Pelea / contenido sensible",
    "Accidente",
    "Denuncia",
    "Alerta",
    "Evento",
    "Trafico",
    "Seguridad",
    "Comunidad",
    "Juego / entretenimiento",
    "Short",
    "Movilidad",
    "Emergencia",
    "Otro"
  ],
  sensitiveCategories: [
    "Incidente",
    "Pelea / contenido sensible",
    "Accidente",
    "Denuncia",
    "Seguridad",
    "Emergencia"
  ],
  localities: [
    "Usaquen", "Chapinero", "Santa Fe", "San Cristobal", "Usme", "Tunjuelito", "Bosa",
    "Kennedy", "Fontibon", "Engativa", "Suba", "Barrios Unidos", "Teusaquillo", "Los Martires",
    "Antonio Narino", "Puente Aranda", "La Candelaria", "Rafael Uribe Uribe", "Ciudad Bolivar", "Sumapaz", "Zona no especificada"
  ],
  reportReasons: [
    "Violencia explicita",
    "Acoso",
    "Datos personales",
    "Menores de edad",
    "Contenido falso",
    "Amenazas",
    "Incitacion a violencia",
    "Spam",
    "Otro"
  ],
  alertLevels: ["Bajo", "Medio", "Alto"],
  emergencyLinks: [
    { label: "Linea 123", detail: "Emergencias en Bogota" },
    { label: "Reportar contenido", detail: "Usa el boton Reportar en cada publicacion" },
    { label: "Ocultar sensible", detail: "Mantiene difuminado el material fuerte" }
  ]
};
