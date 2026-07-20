# Arquitectura inicial

El frontend React consume una API REST expuesta por Amazon API Gateway. Cada grupo de rutas invoca una Lambda independiente para mantener límites claros entre usuarios, gastos, presupuestos y reportes.

```text
React + Vite -> API Gateway -> UsuariosService     -> UsuariosDB
                            -> GastosService       -> GastosDB
                            -> PresupuestosService -> PresupuestosDB
                            -> ReportesService     -> GastosDB + S3
```

Las tablas usan capacidad bajo demanda. `GastosDB` y `PresupuestosDB` agrupan registros por `usuarioId`; sus claves de ordenamiento son `gastoId` y `mes`. `UsuariosDB` incluye el índice `EmailIndex` para registro e inicio de sesión. Los reportes CSV se guardan de forma privada en S3 y se entregan mediante una URL temporal.

## Límites actuales

Este es un punto de partida, no un sistema listo para producción. El login valida credenciales, pero aún no emite tokens ni protege rutas de API Gateway. Antes de desplegar se debe definir autenticación, validación más estricta, pruebas, dominios permitidos para CORS y una estrategia de observabilidad.
