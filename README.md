# Sistema de Monitoreo de Gastos Personales

Base de una aplicación web de finanzas personales con frontend React + Vite y cuatro microservicios serverless en AWS Lambda. La infraestructura se describe con AWS SAM; este repositorio no despliega recursos automáticamente.

## Estructura

```text
frontend/                       Interfaz React y estilos CSS
backend/usuarios_service/       Registro, login y consulta de usuarios
backend/gastos_service/         Registro y consulta de gastos
backend/presupuestos_service/   Presupuestos mensuales
backend/reportes_service/       Generación de CSV privado en S3
infra/template.yaml             API Gateway, Lambdas, DynamoDB, S3 e IAM
docs/                           Arquitectura y contrato de API
```

## Ejecutar el frontend localmente

Requiere Node.js 20 o superior. Desde la raíz del repositorio:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

En macOS o Linux usa `cp .env.example .env`. Abre la URL que muestre Vite, normalmente `http://localhost:5173`.

Cuando `VITE_API_URL` está configurada, el frontend usa API Gateway como fuente principal para usuarios, gastos, presupuestos y reportes. `localStorage` conserva únicamente `usuarioId`, `nombre` y `correo` para restaurar la sesión. Las contraseñas solo se envían a `/usuarios` o `/login` durante la solicitud y nunca se guardan en el navegador. Sin `VITE_API_URL` no se permite crear cuentas ni iniciar sesión.

### Conectar el frontend después del despliegue

Cuando termine `sam deploy`, copia el valor del output `ApiBaseUrl` mostrado por CloudFormation. Crea `frontend/.env` a partir del ejemplo y reemplaza el marcador por esa URL, sin agregar una barra final:

```env
VITE_API_URL=<ApiBaseUrl>
```

Por ejemplo:

```env
VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev
```

Reinicia `npm run dev` después de modificar `.env`; Vite carga estas variables al iniciar.

## Descargar reportes

La sección **Reportes** permite descargar dos formatos:

- **CSV:** `ReportesService` genera el archivo, lo guarda cifrado en el bucket privado de S3 y devuelve una URL firmada temporal para descargarlo. Sin `VITE_API_URL`, el navegador genera el CSV localmente como fallback.
- **PDF:** el frontend genera el reporte mensual directamente en el navegador con el usuario, presupuesto, estado y detalle de gastos visibles. El PDF no se envía ni se guarda en AWS.

Los archivos PDF usan el nombre `reporte-gastos-YYYY-MM.pdf`.

## Mejoras de experiencia y visualización

- **Alertas visuales de presupuesto:** al registrar un gasto se recalcula el porcentaje mensual y se muestra un aviso según el nivel alcanzado.
- **Eliminación de gastos:** cada movimiento puede eliminarse desde el historial con confirmación previa; el dashboard y el presupuesto se actualizan después.
- **Gráficos simples:** el dashboard presenta el progreso del presupuesto y una distribución por categorías construida con CSS, sin dependencias de visualización adicionales.
- **Diseño fintech responsive:** la interfaz usa un tema oscuro azul/morado, tarjetas glassmorphism y controles adaptados para escritorio y móvil.

## Validar el backend y SAM

Con Python 3.12 y AWS SAM CLI instalados:

```bash
python -m compileall backend
python -m unittest discover -s backend/tests -v
sam validate --template-file infra/template.yaml
sam build --template-file infra/template.yaml
```

Las pruebas usan implementaciones en memoria de DynamoDB y S3, por lo que no requieren credenciales ni acceden a AWS. `sam build` prepara artefactos locales; no despliega. No ejecutes `sam deploy` hasta revisar autenticación, CORS, nombres de recursos y configuración del entorno.

Consulta [la arquitectura](docs/arquitectura.md), [el contrato de API](docs/API.md) y [la colección Postman](docs/postman/README.md) para conocer las decisiones iniciales y probar los endpoints.
