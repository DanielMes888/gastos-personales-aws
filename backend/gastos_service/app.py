import json
import logging
import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(logging.INFO)
table = boto3.resource("dynamodb").Table(os.environ.get("GASTOS_TABLE", "GastosDB"))

CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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


def query_all(usuario_id):
    items = []
    params = {"KeyConditionExpression": Key("usuarioId").eq(usuario_id)}
    while True:
        result = table.query(**params)
        items.extend(result.get("Items", []))
        if "LastEvaluatedKey" not in result:
            return items
        params["ExclusiveStartKey"] = result["LastEvaluatedKey"]


def normalize_filters(query):
    mes = str(query.get("mes", "")).strip()
    anio = str(query.get("anio", "")).strip()
    categoria = str(query.get("categoria", "")).strip()
    if len(mes) == 7 and mes[4] == "-":
        anio, mes = mes.split("-", 1)
    if mes:
        if not mes.isdigit() or not 1 <= int(mes) <= 12:
            raise ValueError("mes debe ser un número entre 1 y 12.")
        mes = mes.zfill(2)
    if anio and (not anio.isdigit() or len(anio) != 4):
        raise ValueError("anio debe tener cuatro dígitos.")
    return mes, anio, categoria


def lambda_handler(event, _context):
    method = event.get("httpMethod", "").upper()
    path = event.get("resource") or event.get("path", "")

    if method == "OPTIONS":
        return json_response(200, {})

    try:
        if method == "POST" and path == "/gastos":
            body = parse_body(event)
            usuario_id = str(body.get("usuarioId", "")).strip()
            descripcion = str(body.get("descripcion", "")).strip()
            categoria = str(body.get("categoria", "")).strip()
            fecha = str(body.get("fecha", "")).strip()
            if not all((usuario_id, descripcion, categoria, fecha)) or body.get("monto") is None:
                return error_response(400, "VALIDATION_ERROR", "usuarioId, monto, categoria, descripcion y fecha son requeridos.")
            monto = Decimal(str(body["monto"]))
            if not monto.is_finite() or monto <= 0:
                return error_response(400, "INVALID_AMOUNT", "El monto debe ser mayor que cero.")
            try:
                date.fromisoformat(fecha)
            except ValueError as exc:
                raise ValueError("fecha debe usar el formato YYYY-MM-DD.") from exc

            item = {
                "usuarioId": usuario_id,
                "gastoId": str(uuid.uuid4()),
                "monto": monto,
                "categoria": categoria,
                "descripcion": descripcion,
                "fecha": fecha,
                "creadoEn": datetime.now(timezone.utc).isoformat(),
            }
            table.put_item(Item=item)
            return json_response(201, item)

        if method == "GET" and path == "/gastos/{usuarioId}":
            usuario_id = (event.get("pathParameters") or {}).get("usuarioId")
            if not usuario_id:
                return error_response(400, "VALIDATION_ERROR", "usuarioId es requerido.")
            mes, anio, categoria = normalize_filters(event.get("queryStringParameters") or {})
            items = query_all(usuario_id)
            if anio:
                items = [item for item in items if item.get("fecha", "").startswith(f"{anio}-")]
            if mes:
                items = [item for item in items if item.get("fecha", "")[5:7] == mes]
            if categoria:
                items = [item for item in items if item.get("categoria", "").casefold() == categoria.casefold()]
            items.sort(key=lambda item: (item.get("fecha", ""), item.get("creadoEn", "")), reverse=True)
            return json_response(200, {"gastos": items, "cantidad": len(items), "filtros": {"mes": mes or None, "anio": anio or None, "categoria": categoria or None}})

        if method == "DELETE" and path == "/gastos/{usuarioId}/{gastoId}":
            path_parameters = event.get("pathParameters") or {}
            usuario_id = str(path_parameters.get("usuarioId", "")).strip()
            gasto_id = str(path_parameters.get("gastoId", "")).strip()
            if not usuario_id or not gasto_id:
                return error_response(400, "VALIDATION_ERROR", "usuarioId y gastoId son requeridos.")
            result = table.delete_item(
                Key={"usuarioId": usuario_id, "gastoId": gasto_id},
                ReturnValues="ALL_OLD",
            )
            if not result.get("Attributes"):
                return error_response(404, "EXPENSE_NOT_FOUND", "El gasto solicitado no existe.")
            return json_response(200, {"usuarioId": usuario_id, "gastoId": gasto_id, "eliminado": True})

        return error_response(405, "METHOD_NOT_ALLOWED", "Método o ruta no permitidos.")
    except (ValueError, ArithmeticError) as exc:
        return error_response(400, "INVALID_REQUEST", str(exc))
    except (KeyError, TypeError):
        return error_response(400, "INVALID_REQUEST", "La solicitud contiene datos inválidos.")
    except ClientError:
        logger.exception("Error de AWS en GastosService")
        return error_response(500, "INTERNAL_ERROR", "No fue posible procesar la solicitud.")
    except Exception:
        logger.exception("Error inesperado en GastosService")
        return error_response(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.")
