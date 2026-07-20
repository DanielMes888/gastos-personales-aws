# Proyecto: Sistema de Monitoreo de Gastos Personales

## Objetivo
Crear una aplicación web distribuida en AWS usando arquitectura de microservicios.

## Funcionalidades
- Crear cuenta de usuario
- Iniciar sesión
- Registrar gastos
- Consultar historial de gastos
- Filtrar por categoría y mes
- Definir presupuesto mensual
- Mostrar alertas visuales de presupuesto
- Generar reporte CSV
- Guardar reportes en Amazon S3

## Arquitectura AWS
- Frontend: AWS Amplify
- API: Amazon API Gateway
- Backend: AWS Lambda con microservicios
- Base de datos: Amazon DynamoDB
- Reportes: Amazon S3
- Seguridad: AWS IAM
- Monitoreo: Amazon CloudWatch

## Microservicios
- UsuariosService
  - POST /usuarios
  - POST /login
  - GET /usuarios/{usuarioId}

- GastosService
  - POST /gastos
  - GET /gastos/{usuarioId}

- PresupuestosService
  - POST /presupuestos
  - GET /presupuestos/{usuarioId}

- ReportesService
  - GET /reportes/{usuarioId}

## Tablas DynamoDB
- UsuariosDB
- GastosDB
- PresupuestosDB

## Reglas importantes
- Mantener servicios dentro de Free Tier o free-plan eligible.
- No usar EC2, RDS, NAT Gateway, Load Balancer, QuickSight, Cognito, SES, SNS ni WAF.
- Usar código simple, limpio y documentado.
- Priorizar que funcione y que se vea bien.
- Frontend moderno y presentable.
- No agregar servicios no solicitados.