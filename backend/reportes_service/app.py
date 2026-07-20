import csv
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")
gastos_table = dynamodb.Table(os.environ.get("GASTOS_TABLE", "GastosDB"))
s3 = boto3.client("s3")
bucket_name = os.environ["REPORTES_BUCKET"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
}


def json_response(status_code, data=None, error=None):
    payload = {"ok": error is None, "data": data} if error is None else {"ok": False, "error": error}
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
    }


def error_response(status_code, code, message):
    return json_response(status_code, error={"code": code, "message": message})


def query_all(usuario_id):
    items = []
    params = {"KeyConditionExpression": Key("usuarioId").eq(usuario_id)}
    while True:
        result = gastos_table.query(**params)
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


def decimal_text(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    return str(value)


def lambda_handler(event, _context):
    method = event.get("httpMethod", "").upper()
    path = event.get("resource") or event.get("path", "")

    if method == "OPTIONS":
        return json_response(200, {})

    try:
        if method != "GET" or path != "/reportes/{usuarioId}":
            return error_response(405, "METHOD_NOT_ALLOWED", "Método o ruta no permitidos.")

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
        items.sort(key=lambda item: (item.get("fecha", ""), item.get("creadoEn", "")))

        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["gastoId", "usuarioId", "fecha", "descripcion", "categoria", "monto"])
        for item in items:
            writer.writerow([
                item.get("gastoId", ""),
                item.get("usuarioId", ""),
                item.get("fecha", ""),
                item.get("descripcion", ""),
                item.get("categoria", ""),
                decimal_text(item.get("monto", 0)),
            ])

        safe_user_id = re.sub(r"[^A-Za-z0-9_-]", "_", usuario_id)
        period = f"{anio or 'todos'}-{mes or 'todos'}"
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        key = f"{safe_user_id}/{period}/reporte-{timestamp}.csv"
        s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=output.getvalue().encode("utf-8-sig"),
            ContentType="text/csv; charset=utf-8",
            ServerSideEncryption="AES256",
        )
        return json_response(200, {
            "bucket": bucket_name,
            "key": key,
            "cantidadRegistros": len(items),
            "contentType": "text/csv",
        })
    except ValueError as exc:
        return error_response(400, "INVALID_REQUEST", str(exc))
    except (KeyError, TypeError):
        return error_response(400, "INVALID_REQUEST", "La solicitud contiene datos inválidos.")
    except ClientError:
        logger.exception("Error de AWS en ReportesService")
        return error_response(500, "INTERNAL_ERROR", "No fue posible generar el reporte.")
    except Exception:
        logger.exception("Error inesperado en ReportesService")
        return error_response(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.")
