/*
  Configuración principal.
  1. Despliega apps-script/Code.gs como Google Apps Script Web App.
  2. Pega aquí la URL terminada en /exec.
  3. Pega la URL publica del Web App, no la URL del Google Sheet.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbwGfSCwYliqFxmHws_Kcf9aiMsvaGU8vZ_UPZ3lEREtBqCgjCifC8nDaUfqNWXZfXPjqA/exec";
const DEMO_MODE = false;

const APP_CONFIG = {
  appName: "Bogotá Alerta Urbana",
  logoText: "BAU",
  city: "Bogotá",
  defaultRoute: "#/feed",
  postsDefaultStatus: "active", // Cambia a "pending" si quieres revisión previa por admin.
  sessionKey: "bau_session",
  ageGateKey: "bau_age_confirmed_18",
  reactions: ["Me impacta", "Alerta", "Confirmo", "No confirmado", "Cuidado", "Apoyo"],
  categories: [
    "Accidente",
    "Pelea",
    "Manifestación",
    "Movilidad",
    "Robo / inseguridad",
    "Problema en la calle",
    "Emergencia",
    "Otro"
  ],
  localities: [
    "Usaquén", "Chapinero", "Santa Fe", "San Cristóbal", "Usme", "Tunjuelito", "Bosa",
    "Kennedy", "Fontibón", "Engativá", "Suba", "Barrios Unidos", "Teusaquillo", "Los Mártires",
    "Antonio Nariño", "Puente Aranda", "La Candelaria", "Rafael Uribe Uribe", "Ciudad Bolívar", "Sumapaz", "Zona no especificada"
  ],
  reportReasons: [
    "Menores involucrados",
    "Contenido sexual",
    "Violencia contra menores",
    "Datos personales",
    "Amenaza o incitación",
    "Contenido falso",
    "Contenido demasiado gráfico",
    "Otro"
  ]
};
