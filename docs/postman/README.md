# Pruebas con Postman

1. Importa `gastos-personales.postman_collection.json` en Postman.
2. Cambia la variable de colección `baseUrl` por el output `ApiBaseUrl` del stack SAM, sin `/` final.
3. Ejecuta los requests del 1 al 8 en orden. El primer request guarda automáticamente `usuarioId` y el tercero consulta ese usuario.
4. Si repites el flujo, cambia `ana@example.com` porque el correo debe ser único.

Los ejemplos usan julio de 2026. El gasto de `85.50`, un límite de `100` y una alerta del `80%` producen el estado `CERCA_DEL_LIMITE`. La última prueba crea un objeto CSV real en el bucket de reportes.
