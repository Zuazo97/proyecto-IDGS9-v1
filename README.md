# proyecto-IDGS9-v1

API REST **única** para los tres proyectos del *Proyecto Final Integrador* de 9° cuatrimestre IDGS (UTR):

| Proyecto | Sistema | Rutas |
|---|---|---|
| — | Auth y gestión de usuarios (todos) | `/api/auth/*`, `/api/users/*` |
| **A** | Biblioteca Universitaria | `/api/books`, `/api/loans/books` |
| **B** | Préstamo de Material Deportivo | `/api/sports/items`, `/api/sports/loans` |
| **C** | Laboratorios de Cómputo | `/api/labs/computers`, `/api/labs/equipment`, `/api/labs/assignments` |

**Stack:** Node.js 22+, Express 5, MongoDB Atlas (Mongoose), JWT, zod y Swagger UI. Se despliega en Render (plan gratuito).

- 📘 Documentación interactiva: **`<URL>/api/docs`**
- 📦 Especificación OpenAPI para importar en Postman o Insomnia: **`<URL>/api/docs.json`**
- ❤️ Salud del servicio: **`<URL>/api/health`**

---

## 🧑‍🎓 Guía para alumnos

### 1. Lo que te entrega el docente
| Dato | Ejemplo | Dónde va |
|---|---|---|
| URL base | `https://proyecto-idgs9-v1.onrender.com` | `VITE_API_URL` / `EXPO_PUBLIC_API_URL` |
| `x-api-token` de tu equipo | `utr-idgs9-equipo-a1-…` | `VITE_API_APP_TOKEN` / `EXPO_PUBLIC_API_APP_TOKEN` |
| Usuario ADMIN | `admin@equipo-a1.utr` + contraseña | Para probar el panel de administrador |
| Usuario demo | `alumno@equipo-a1.utr` + contraseña | Para probar las vistas de USER |

Cada equipo tiene **su propia base de datos lógica**: sus usuarios, libros, préstamos, etc. no se mezclan con los de otros equipos. Tu token solo abre los endpoints de **tu proyecto**. Si llamas a otro proyecto recibes `403 PROJECT_NOT_ALLOWED`.

### 2. Headers en cada petición
```http
x-api-token: utr-idgs9-equipo-a1-xxxxxxxx        ← siempre
Authorization: Bearer eyJhbGciOi...              ← después del login
Content-Type: application/json
```

### 3. Ejemplo de cliente HTTP genérico (Web / Vite)
```js
// src/services/apiFetch.js
const BASE = import.meta.env.VITE_API_URL;          // Expo: process.env.EXPO_PUBLIC_API_URL
const APP_TOKEN = import.meta.env.VITE_API_APP_TOKEN;

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');      // Expo: SecureStore.getItemAsync('token')
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-token': APP_TOKEN,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) { localStorage.clear(); window.location.href = '/login'; }
  if (!res.ok) throw { status: res.status, ...data };   // data = { message, code, errors? }
  return data;
}
```

### 4. Errores
Todas las respuestas de error tienen la forma `{ "message": "...", "code": "...", "errors": [{ "campo": "...", "mensaje": "..." }] }`.

| HTTP | Qué hacer en la app |
|---|---|
| 400 | Mostrar `errors` junto a cada input |
| 401 | Limpiar la sesión y redirigir al Login |
| 403 | Mostrar alerta o pantalla de "Acceso restringido" |
| 404 | "No encontrado" |
| 409 | Mostrar `message` (ej. "No hay ejemplares disponibles", "La PC no está disponible") |
| 429 | Esperar un minuto |

> ⏱️ **Primera petición lenta:** en el plan gratuito, si nadie usa la API por 15 min, el servidor se duerme y la primera petición tarda unos 50 s en despertarlo. Usa un `ActivityIndicator` o spinner y un timeout amplio.

### 5. Reglas de negocio importantes
- **Registro:** siempre crea rol `USER`. Solo un ADMIN puede promover a otro usuario con `PATCH /api/users/:id/role`.
- **IDs:** son numéricos (`1`, `2`, `3`…). Las rutas usan `/:id`.
- **Préstamos y asignaciones:** si eres USER, el `userId` del body se ignora y se usa el de tu token. Un ADMIN puede crear a nombre de otro.
- **A · Biblioteca:** sin stock → `409 OUT_OF_STOCK`. No puedes pedir el mismo libro dos veces sin devolverlo. `fechaDevolucionEstimada` usa formato `YYYY-MM-DD` y no puede ser anterior a hoy. El préstamo trae `vencido: true` si ya pasó la fecha.
- **B · Deportes:** `cantidad` ≤ `disponibles`. Al recibir con `BUENO` el material regresa a disponibles. Con `DANADO` (también acepta `DAÑADO`) se da de baja del inventario.
- **C · Laboratorios:** una PC activa por usuario. Para "Mi sesión activa" usa `GET /api/labs/assignments?estatus=ASIGNADA`. Si liberas con `reporteFalla: true`, la PC pasa a `MANTENIMIENTO` y `descripcionFalla` es obligatoria. El ADMIN la regresa con `PATCH /api/labs/computers/:id { "estatus": "DISPONIBLE" }`.

### 6. Endpoints extra (opcionales)
No están en el documento del proyecto, pero te pueden facilitar algunas pantallas:
`GET /api/auth/me`, `PATCH /api/users/:id/status`, `GET /api/books/:id`, `GET /api/books/categories`, `GET /api/sports/items/:id`, `GET /api/sports/items/sports`, `GET /api/labs/computers/:id`, `GET /api/labs/computers/labs`, `PATCH /api/labs/computers/:id`, `GET /api/labs/equipment`, `PATCH /api/labs/equipment/:id`.

---

## 👨‍🏫 Guía del docente (administración y despliegue)

### Desarrollo local
```bash
cp .env.example .env          # llena MONGODB_URI y JWT_SECRET
npm install
npm run seed                  # crea equipos, tokens, usuarios y datos de ejemplo
npm run dev                   # http://localhost:3000/api/docs
npm test                      # 55 pruebas con MongoDB en memoria (no toca Atlas)
```

### Gestión de equipos
```bash
npm run seed                                  # equipo-a1 (A), equipo-b1 (B), equipo-c1 (C), docente (A,B,C)
npm run app:create -- equipo-a2 A             # nuevo equipo del proyecto A con datos de ejemplo
npm run app:create -- equipo-x A,B --sin-datos
npm run app:list                              # tabla con equipos y tokens
```
- Los scripts son **idempotentes**: si el equipo ya existe, no cambian su token ni sus contraseñas.
- Las contraseñas se generan al azar y se imprimen **una sola vez**. También se guardan en `seed-output-*.json`, que está en `.gitignore`: no lo subas al repo.
- Para correr los scripts contra producción, pon en tu `.env` local la misma `MONGODB_URI` de Atlas que usa Render.

### Despliegue gratuito (Atlas M0 + Render)
1. **MongoDB Atlas** (<https://cloud.mongodb.com>)
   1. Crea un cluster **M0 (Free)** en AWS **N. Virginia (us-east-1)**.
   2. En *Database Access*, crea un usuario con rol *Read and write to any database*.
   3. En *Network Access*, agrega `0.0.0.0/0`. Render no tiene IP fija; la seguridad la dan el usuario y la contraseña.
   4. En *Connect → Drivers*, copia la URI y agrega el nombre de la base: `…mongodb.net/idgs9?retryWrites=true&w=majority`.
2. **Render** (<https://dashboard.render.com>)
   1. Ve a *New → Blueprint* y conecta este repo de GitHub. Render lee `render.yaml`.
   2. Captura `MONGODB_URI`. `JWT_SECRET` se genera solo.
   3. Cada push a `main` vuelve a desplegar. Verifica con `https://<servicio>.onrender.com/api/health`.
3. **Seed en producción:** desde tu máquina, con la URI de Atlas en `.env`, corre `npm run seed`.
4. **Keep-alive (opcional):** en GitHub ve a *Settings → Secrets and variables → Actions → Variables* y crea `API_URL=https://<servicio>.onrender.com`. El workflow `keep-alive` hace ping cada 10 min de 7:00 a 23:00 (hora del centro de México).

### Seguridad
- El `x-api-token` identifica al **equipo**, no es un secreto fuerte: viaja en el bundle de Vite y del APK. Si un token se filtra, desactiva el equipo (`activo: false` en la colección `apps`) y crea otro.
- Contraseñas con bcrypt y JWT con expiración de 8 h. El rol se valida contra la base de datos en cada petición, así que un cambio de rol aplica de inmediato.
- Rate limit: 600 peticiones/min por equipo y 20 intentos de login/min por equipo + email.

### Estructura
```
src/
├── app.js / server.js
├── config/        env, conexión a Mongo
├── middlewares/   appToken (x-api-token + proyecto), auth (JWT + roles), validate (zod), errorHandler
├── models/        App, User, Counter (ids numéricos), library, sports, labs
├── modules/       auth, users, library (A), sports (B), labs (C)
├── docs/          openapi.yaml + Swagger UI
└── utils/
scripts/           seed, app:create, app:list
tests/             node:test + supertest + mongodb-memory-server
```

### Gitflow
`main` (producción, Render) ← `release/*` ← `develop` ← `feature/*`. Para correcciones: `bugfix/*` desde `develop`, o `hotfix/*` desde `main` si urge en producción.
