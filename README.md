# Bogotá Alerta Urbana

**Bogotá Alerta Urbana** es un MVP de red social urbana para reportes ciudadanos en Bogotá: accidentes, peleas, problemas en vía pública, manifestaciones, bloqueos, emergencias urbanas, alertas de movilidad, conflictos en calle y situaciones de interés público.

El proyecto usa:

- HTML
- CSS
- JavaScript puro
- Google Sheets como base de datos
- Google Apps Script como backend
- Sin MySQL
- Sin Node.js
- Sin PHP
- Sin frameworks pesados

> Advertencia: este proyecto es un MVP. No reemplaza moderación humana, asesoría legal, verificación periodística ni canales oficiales de emergencia. Google Sheets tampoco es ideal para alto tráfico.

---

## Estructura de carpetas

```txt
/index.html
/css/
    style.css
    auth.css
    feed.css
    responsive.css
/js/
    config.js
    api.js
    auth.js
    ageGate.js
    feed.js
    posts.js
    comments.js
    reactions.js
    moderation.js
    router.js
    ui.js
/view/
    login.html
    register.html
    feed.html
    create-post.html
    post-detail.html
    profile.html
    rules.html
    admin.html
/assets/
    logo.svg
    graffiti-bg.svg
    placeholder-post.svg
/apps-script/
    Code.gs
README.md
```

---

## Funcionalidades incluidas

### Confirmación 18+

- Modal obligatorio antes de entrar.
- Pregunta: “¿Confirmas que tienes 18 años o más?”
- Botones: “Sí, tengo 18+” y “No soy mayor de edad”.
- Si responde que no, se muestra pantalla de bloqueo durante esa visita. Al recargar, vuelve a aparecer el anuncio.
- La confirmación se guarda en `localStorage` con la clave `bau_age_confirmed_18`.
- Para resetear en consola:

```js
localStorage.removeItem('bau_age_confirmed_18')
```

### Registro

- No pide nombre real.
- No pide correo.
- No pide cédula.
- No pide teléfono.
- Solo pide usuario, contraseña, repetir contraseña, confirmación 18+ y aceptación de reglas.
- En Apps Script se guarda `passwordHash` y `salt`, no contraseña en texto plano.

### Inicio de sesión

- Usuario + contraseña.
- Guarda sesión en `localStorage` con token devuelto por backend.
- En backend se almacena `tokenHash` en la hoja `Sessions`.

### Feed

- Diseño tipo red social urbana.
- Barra lateral izquierda.
- Feed central.
- Barra derecha con tendencias, etiquetas y aviso de reglas.
- Responsive para móvil.
- Botón flotante para publicar.

### Publicaciones

Cada publicación incluye:

- usuario
- fecha
- categoría
- título
- descripción
- localidad o zona
- URL multimedia opcional
- etiquetas
- reacciones
- comentarios
- compartir
- reportar
- estado: `active`, `pending`, `hidden`, `reported`, `reviewed`

### Comentarios

- Comentarios por publicación.
- Moderación básica.
- Reporte de comentarios.

### Reacciones

Reacciones incluidas:

- Me impacta
- Alerta
- Confirmo
- No confirmado
- Cuidado
- Apoyo

### Reportes

Motivos:

- Menores involucrados
- Contenido sexual
- Violencia contra menores
- Datos personales
- Amenaza o incitación
- Contenido falso
- Contenido demasiado gráfico
- Otro

### Admin básico

Disponible en:

```txt
#/admin
```

Permite:

- ver publicaciones reportadas o pendientes
- activar publicación
- ocultar publicación
- marcar publicación como revisada
- ver reportes
- ver usuarios
- bloquear usuario
- activar usuario

La protección visual depende del rol, pero el backend también valida que el usuario tenga `role = admin`.

---

## Moderación básica

El archivo principal de moderación frontend está en:

```txt
/js/moderation.js
```

Incluye:

- lista de términos prohibidos
- detector básico de términos relacionados con menores
- detector de posibles datos personales: teléfonos, correos, cédulas/documentos, direcciones exactas
- `validatePostContent(data)`
- `validateComment(text)`

El backend en `apps-script/Code.gs` también repite validaciones básicas para que el control no dependa solo del navegador.

### Regla crítica

Se bloquea especialmente cualquier combinación de términos relacionados con menores y abuso, sexualidad, explotación, violencia o maltrato.

---

## Cómo probar sin backend

Mientras `js/config.js` tenga esta línea:

```js
const API_URL = "https://script.google.com/macros/s/AKfycbwGfSCwYliqFxmHws_Kcf9aiMsvaGU8vZ_UPZ3lEREtBqCgjCifC8nDaUfqNWXZfXPjqA/exec";
```

el proyecto funciona en **modo mock** usando `localStorage`.

Usuarios de prueba:

```txt
Usuario: demo
Contraseña: demo123
Rol: user
```

```txt
Usuario: admin
Contraseña: admin123
Rol: admin
```

Para borrar datos mock:

```js
localStorage.removeItem('bau_mock_db_v1')
localStorage.removeItem('bau_session')
```

### Importante para abrir el proyecto

No abras `index.html` con doble clic si tu navegador bloquea `fetch()` sobre archivos locales.

Usa un servidor local. Opciones:

1. Extensión **Live Server** en VS Code.
2. Python:

```bash
cd bogota-alerta-urbana
python -m http.server 5500
```

Luego entra a:

```txt
http://localhost:5500
```

---

## Configurar Google Sheets

Crea una hoja de cálculo en Google Sheets con estas hojas:

- Users
- Posts
- Comments
- Reactions
- Reports
- Sessions
- AuditLog

No es necesario crear las columnas manualmente si usas `setupSheets()` desde Apps Script.

### Columnas esperadas

#### Users

```txt
userId, username, passwordHash, salt, role, status, createdAt, lastLoginAt, ageConfirmed
```

#### Posts

```txt
postId, userId, username, category, title, description, location, mediaUrl, tags, createdAt, status, moderationFlags, reactionCount, commentCount, reportCount
```

#### Comments

```txt
commentId, postId, userId, username, text, createdAt, status, reportCount
```

#### Reactions

```txt
reactionId, targetType, targetId, userId, reaction, createdAt
```

#### Reports

```txt
reportId, targetType, targetId, userId, reason, details, createdAt, status
```

#### Sessions

```txt
sessionId, userId, tokenHash, createdAt, expiresAt, active
```

#### AuditLog

```txt
logId, userId, action, targetType, targetId, details, createdAt
```

---

## Desplegar Apps Script

1. Abre tu Google Sheet.
2. Ve a **Extensiones > Apps Script**.
3. Borra el contenido inicial.
4. Copia todo el archivo:

```txt
/apps-script/Code.gs
```

5. Guarda.
6. Ejecuta manualmente:

```js
setupSheets()
```

7. Autoriza permisos.
8. Opcional: crea un admin inicial editando y ejecutando:

```js
createAdminUser()
```

Antes de ejecutarla, cambia la contraseña dentro de `createAdminUser()`:

```js
const password = "CAMBIA_ESTA_CLAVE_ADMIN";
```

9. Ve a **Implementar > Nueva implementación**.
10. Tipo: **Aplicación web**.
11. Ejecutar como: **Yo**.
12. Quién tiene acceso: **Cualquier usuario con el enlace**.
13. Copia la URL `/exec`.
14. Pégala en:

```txt
/js/config.js
```

Ejemplo:

```js
const API_URL = "https://script.google.com/macros/s/AKfycbwGfSCwYliqFxmHws_Kcf9aiMsvaGU8vZ_UPZ3lEREtBqCgjCifC8nDaUfqNWXZfXPjqA/exec";
```

---

## Seguridad y límites del MVP

Este MVP implementa barreras razonables para una demo, pero no debe tratarse como sistema final de producción.

Pendiente para producción:

- moderación humana obligatoria
- revisión previa para categorías sensibles
- almacenamiento real de archivos, no solo URL multimedia
- logs de auditoría más completos
- rate limiting
- protección CSRF/CORS más estricta
- CAPTCHA o antispam
- sistema de apelaciones
- políticas legales y términos de uso reales
- eliminación segura de contenido prohibido
- migración a base de datos real si hay alto tráfico

Google Sheets sirve para prototipo, pruebas y baja escala. Para una red social pública con alto tráfico se recomienda migrar a una base de datos más robusta.

---

## Recomendación de configuración inicial

En `js/config.js` puedes cambiar:

```js
postsDefaultStatus: "active"
```

A:

```js
postsDefaultStatus: "pending"
```

Así toda publicación queda pendiente de revisión antes de aparecer en el feed.

Para un sitio real de contenido urbano sensible, se recomienda usar `pending`.
