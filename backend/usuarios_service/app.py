import base64
import hashlib
import hmac
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(logging.INFO)
table = boto3.resource("dynamodb").Table(os.environ.get("USUARIOS_TABLE", "UsuariosDB"))

CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def json_response(status_code, data=None, error=None):
    payload = {"ok": error is None}
    if error is None:
        payload["data"] = data
    else:
        payload["error"] = error
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
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


def hash_password(password, salt=None):
    salt_bytes = base64.b64decode(salt) if salt else os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 210_000)
    return base64.b64encode(digest).decode(), base64.b64encode(salt_bytes).decode()


def public_user(item):
    return {key: item[key] for key in ("usuarioId", "nombre", "email", "creadoEn")}


def lambda_handler(event, _context):
    method = event.get("httpMethod", "").upper()
    path = event.get("resource") or event.get("path", "")

    if method == "OPTIONS":
        return json_response(200, {})

    try:
        if method == "POST" and path == "/usuarios":
            body = parse_body(event)
            nombre = str(body.get("nombre", "")).strip()
            email = str(body.get("correo") or body.get("email") or "").strip().lower()
            password = str(body.get("contraseña") or body.get("contrasena") or body.get("password") or "")
            if not nombre or not email or not password:
                return error_response(400, "VALIDATION_ERROR", "nombre, correo y contraseña son requeridos.")
            if not EMAIL_PATTERN.match(email):
                return error_response(400, "INVALID_EMAIL", "El correo no tiene un formato válido.")
            if len(password) < 8:
                return error_response(400, "WEAK_PASSWORD", "La contraseña debe tener al menos 8 caracteres.")

            existing = table.query(
                IndexName="EmailIndex",
                KeyConditionExpression=Key("email").eq(email),
                Limit=1,
            )
            if existing.get("Items"):
                return error_response(409, "EMAIL_ALREADY_EXISTS", "El correo ya está registrado.")

            password_hash, salt = hash_password(password)
            item = {
                "usuarioId": str(uuid.uuid4()),
                "nombre": nombre,
                "email": email,
                "passwordHash": password_hash,
                "passwordSalt": salt,
                "creadoEn": datetime.now(timezone.utc).isoformat(),
            }
            table.put_item(Item=item)
            return json_response(201, public_user(item))

        if method == "POST" and path == "/login":
            body = parse_body(event)
            email = str(body.get("correo") or body.get("email") or "").strip().lower()
            password = str(body.get("contraseña") or body.get("contrasena") or body.get("password") or "")
            if not email or not password:
                return error_response(400, "VALIDATION_ERROR", "correo y contraseña son requeridos.")

            result = table.query(
                IndexName="EmailIndex",
                KeyConditionExpression=Key("email").eq(email),
                Limit=1,
            )
            if not result.get("Items"):
                return error_response(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.")
            user = result["Items"][0]
            candidate, _ = hash_password(password, user["passwordSalt"])
            if not hmac.compare_digest(candidate, user["passwordHash"]):
                return error_response(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.")
            return json_response(200, {"autenticado": True, "usuario": public_user(user)})

        if method == "GET" and path == "/usuarios/{usuarioId}":
            usuario_id = (event.get("pathParameters") or {}).get("usuarioId")
            if not usuario_id:
                return error_response(400, "VALIDATION_ERROR", "usuarioId es requerido.")
            item = table.get_item(Key={"usuarioId": usuario_id}).get("Item")
            if not item:
                return error_response(404, "USER_NOT_FOUND", "Usuario no encontrado.")
            return json_response(200, public_user(item))

        return error_response(405, "METHOD_NOT_ALLOWED", "Método o ruta no permitidos.")
    except ValueError as exc:
        return error_response(400, "INVALID_REQUEST", str(exc))
    except (KeyError, TypeError):
        return error_response(400, "INVALID_REQUEST", "La solicitud contiene datos inválidos.")
    except ClientError:
        logger.exception("Error de AWS en UsuariosService")
        return error_response(500, "INTERNAL_ERROR", "No fue posible procesar la solicitud.")
    except Exception:
        logger.exception("Error inesperado en UsuariosService")
        return error_response(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.")
