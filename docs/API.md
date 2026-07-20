# API del Sistema de Gastos Personales

La API usa JSON y se publica bajo el output `ApiBaseUrl` de AWS SAM, por ejemplo `https://{apiId}.execute-api.{region}.amazonaws.com/dev`. Todos los errores tienen la forma:

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Detalle del error." } }
```

## UsuariosService

### POST `/usuarios`

Crea un usuario. Acepta `correo`/`email` y `contraseña`/`contrasena`/`password`.

```json
{ "nombre": "Ana Pérez", "correo": "ana@example.com", "contraseña": "segura123" }
```

Respuesta `201`:

```json
{
  "ok": true,
  "data": {
    "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
    "nombre": "Ana Pérez",
    "email": "ana@example.com",
    "creadoEn": "2026-07-19T15:30:00+00:00"
  }
}
```

### POST `/login`

Valida correo y contraseña. No emite token; la autenticación definitiva queda pendiente.

```json
{ "correo": "ana@example.com", "contraseña": "segura123" }
```

Respuesta `200`:

```json
{
  "ok": true,
  "data": {
    "autenticado": true,
    "usuario": {
      "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
      "nombre": "Ana Pérez",
      "email": "ana@example.com",
      "creadoEn": "2026-07-19T15:30:00+00:00"
    }
  }
}
```

Credenciales incorrectas devuelven `401` con `INVALID_CREDENTIALS`.

### GET `/usuarios/{usuarioId}`

Consulta el perfil público. No requiere body. Devuelve `200` con el mismo objeto de usuario de la creación, o `404` con `USER_NOT_FOUND`.

## GastosService

### POST `/gastos`

Registra un gasto. `monto` debe ser positivo y `fecha` debe usar `YYYY-MM-DD`.

```json
{
  "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
  "monto": 85.5,
  "categoria": "Alimentación",
  "descripcion": "Supermercado",
  "fecha": "2026-07-19"
}
```

Respuesta `201`:

```json
{
  "ok": true,
  "data": {
    "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
    "gastoId": "0711259d-6fc3-4528-b8e7-b5a549e55f36",
    "monto": 85.5,
    "categoria": "Alimentación",
    "descripcion": "Supermercado",
    "fecha": "2026-07-19",
    "creadoEn": "2026-07-19T15:35:00+00:00"
  }
}
```

### GET `/gastos/{usuarioId}`

Lista gastos. No requiere body. Filtros opcionales: `mes=7`, `anio=2026`, `categoria=Alimentación`; también se acepta `mes=2026-07`.

Respuesta `200`:

```json
{
  "ok": true,
  "data": {
    "gastos": [
      {
        "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
        "gastoId": "0711259d-6fc3-4528-b8e7-b5a549e55f36",
        "monto": 85.5,
        "categoria": "Alimentación",
        "descripcion": "Supermercado",
        "fecha": "2026-07-19",
        "creadoEn": "2026-07-19T15:35:00+00:00"
      }
    ],
    "cantidad": 1,
    "filtros": { "mes": "07", "anio": "2026", "categoria": "Alimentación" }
  }
}
```

## PresupuestosService

### POST `/presupuestos`

Crea o actualiza un presupuesto. `mes` usa `YYYY-MM`; `porcentajeAlerta` debe estar entre 1 y 100.

```json
{
  "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
  "mes": "2026-07",
  "limiteMensual": 100,
  "porcentajeAlerta": 80
}
```

Devuelve `201` al crear y `200` al actualizar:

```json
{
  "ok": true,
  "data": {
    "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
    "mes": "2026-07",
    "limiteMensual": 100,
    "porcentajeAlerta": 80,
    "actualizadoEn": "2026-07-19T15:40:00+00:00"
  }
}
```

### GET `/presupuestos/{usuarioId}?mes=2026-07`

Consulta el presupuesto y suma los gastos del mes. Si `mes` se omite usa el mes UTC actual. Estados posibles: `DENTRO_DEL_PRESUPUESTO`, `CERCA_DEL_LIMITE` y `PRESUPUESTO_SUPERADO`.

Respuesta `200` con alerta:

```json
{
  "ok": true,
  "data": {
    "usuarioId": "f9cf7bee-7a12-4a82-a7da-a89529c94d90",
    "mes": "2026-07",
    "limiteMensual": 100,
    "porcentajeAlerta": 80,
    "actualizadoEn": "2026-07-19T15:40:00+00:00",
    "totalGastado": 85.5,
    "porcentajeUsado": 85.5,
    "estado": "CERCA_DEL_LIMITE",
    "cantidadGastos": 1,
    "disponible": 14.5
  }
}
```

Si no existe presupuesto devuelve `404` con `BUDGET_NOT_FOUND`.

## ReportesService

### GET `/reportes/{usuarioId}`

Genera un CSV, lo guarda cifrado en S3 y devuelve su ubicación. Acepta los mismos filtros opcionales de gastos y no requiere body.

Respuesta `200`:

```json
{
  "ok": true,
  "data": {
    "bucket": "stack-reportesbucket-abcd1234",
    "key": "f9cf7bee-7a12-4a82-a7da-a89529c94d90/2026-07/reporte-20260719T154500Z.csv",
    "cantidadRegistros": 1,
    "contentType": "text/csv"
  }
}
```

## CORS y códigos comunes

API Gateway permite `GET`, `POST` y `OPTIONS`, con los headers `Content-Type` y `Authorization`. Los códigos habituales son `200`, `201`, `400`, `401`, `404`, `405`, `409` y `500`.
