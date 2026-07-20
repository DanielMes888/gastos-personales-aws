import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")
presupuestos_table = dynamodb.Table(os.environ.get("PRESUPUESTOS_TABLE", "PresupuestosDB"))
gastos_table = dynamodb.Table(os.environ.get("GASTOS_TABLE", "GastosDB"))

CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
}


def decimal_default(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError


def json_response(status_code, data=None, error=None):
    payload = {"ok": error is None, "data": data} if error is None else {"ok": False, "error": error}
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False, default=decimal_default),
    }


def error_response(status_code, code, message):
    return json_response(status_code, error={"code": code, "message": message})


def parse_body(event):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("El cuerpo debe ser JSON válido.") from exc
    if not isinstance(body, dict):
        raise ValueError("El cuerpo debe ser un objeto JSON.")
    return body


def validate_month(value):
    month = str(value or "").strip()
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError as exc:
        raise ValueError("mes debe usar el formato YYYY-MM.") from exc
    return month


def query_month_expenses(usuario_id, month):
    items = []
    params = {"KeyConditionExpression": Key("usuarioId").eq(usuario_id)}
    while True:
        result = gastos_table.query(**params)
        items.extend(item for item in result.get("Items", []) if item.get("fecha", "").startswith(month))
        if "LastEvaluatedKey" not in result:
            return items
        params["ExclusiveStartKey"] = result["LastEvaluatedKey"]


def calculate_status(percentage, alert_percentage):
    if percentage > 100:
        return "PRESUPUESTO_SUPERADO"
    if percentage >= alert_percentage:
        return "CERCA_DEL_LIMITE"
    return "DENTRO_DEL_PRESUPUESTO"


def lambda_handler(event, _context):
    method = event.get("httpMethod", "").upper()
    path = event.get("resource") or event.get("path", "")

    if method == "OPTIONS":
        return json_response(200, {})

    try:
        if method == "POST" and path == "/presupuestos":
            body = parse_body(event)
            usuario_id = str(body.get("usuarioId", "")).strip()
            month = validate_month(body.get("mes"))
            raw_limit = body.get("limiteMensual", body.get("monto"))
            raw_alert = body.get("porcentajeAlerta", 80)
            if not usuario_id or raw_limit is None:
                return error_response(400, "VALIDATION_ERROR", "usuarioId, mes y limiteMensual son requeridos.")
            limit = Decimal(str(raw_limit))
            alert_percentage = Decimal(str(raw_alert))
            if not limit.is_finite() or limit <= 0:
                return error_response(400, "INVALID_LIMIT", "limiteMensual debe ser mayor que cero.")
            if not alert_percentage.is_finite() or not 1 <= alert_percentage <= 100:
                return error_response(400, "INVALID_ALERT", "porcentajeAlerta debe estar entre 1 y 100.")

            key = {"usuarioId": usuario_id, "mes": month}
            exists = "Item" in presupuestos_table.get_item(Key=key, ConsistentRead=True)
            item = {
                **key,
                "limiteMensual": limit,
                "porcentajeAlerta": alert_percentage,
                "actualizadoEn": datetime.now(timezone.utc).isoformat(),
            }
            presupuestos_table.put_item(Item=item)
            return json_response(200 if exists else 201, item)

        if method == "GET" and path == "/presupuestos/{usuarioId}":
            usuario_id = (event.get("pathParameters") or {}).get("usuarioId")
            if not usuario_id:
                return error_response(400, "VALIDATION_ERROR", "usuarioId es requerido.")
            query = event.get("queryStringParameters") or {}
            month = validate_month(query.get("mes") or datetime.now(timezone.utc).strftime("%Y-%m"))
            item = presupuestos_table.get_item(
                Key={"usuarioId": usuario_id, "mes": month},
                ConsistentRead=True,
            ).get("Item")
            if not item:
                return error_response(404, "BUDGET_NOT_FOUND", "No existe un presupuesto para el mes solicitado.")

            expenses = query_month_expenses(usuario_id, month)
            total_spent = sum((Decimal(str(expense.get("monto", 0))) for expense in expenses), Decimal("0"))
            limit = Decimal(str(item["limiteMensual"]))
            percentage = ((total_spent / limit) * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            alert_percentage = Decimal(str(item.get("porcentajeAlerta", 80)))
            result = {
                **item,
                "totalGastado": total_spent,
                "porcentajeUsado": percentage,
                "estado": calculate_status(percentage, alert_percentage),
                "cantidadGastos": len(expenses),
                "disponible": max(limit - total_spent, Decimal("0")),
            }
            return json_response(200, result)

        return error_response(405, "METHOD_NOT_ALLOWED", "Método o ruta no permitidos.")
    except (ValueError, ArithmeticError) as exc:
        return error_response(400, "INVALID_REQUEST", str(exc))
    except (KeyError, TypeError):
        return error_response(400, "INVALID_REQUEST", "La solicitud contiene datos inválidos.")
    except ClientError:
        logger.exception("Error de AWS en PresupuestosService")
        return error_response(500, "INTERNAL_ERROR", "No fue posible procesar la solicitud.")
    except Exception:
        logger.exception("Error inesperado en PresupuestosService")
        return error_response(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.")
