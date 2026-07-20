import importlib.util
import json
import os
import sys
import types
import unittest
from decimal import Decimal
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]


class FakeKey:
    def __init__(self, name):
        self.name = name

    def eq(self, value):
        return ("eq", self.name, value)


class FakeClientError(Exception):
    pass


class FakeTable:
    KEYS = {
        "UsuariosDB": ("usuarioId",),
        "GastosDB": ("usuarioId", "gastoId"),
        "PresupuestosDB": ("usuarioId", "mes"),
    }

    def __init__(self, name):
        self.name = name
        self.items = []

    def query(self, **kwargs):
        _, attribute, value = kwargs["KeyConditionExpression"]
        return {"Items": [item.copy() for item in self.items if item.get(attribute) == value]}

    def put_item(self, Item):
        keys = self.KEYS[self.name]
        self.items = [item for item in self.items if not all(item.get(key) == Item.get(key) for key in keys)]
        self.items.append(Item.copy())
        return {}

    def get_item(self, Key, **_kwargs):
        item = next((item for item in self.items if all(item.get(key) == value for key, value in Key.items())), None)
        return {"Item": item.copy()} if item else {}


class FakeDynamoResource:
    def __init__(self, tables):
        self.tables = tables

    def Table(self, name):
        return self.tables.setdefault(name, FakeTable(name))


class FakeS3:
    def __init__(self):
        self.objects = []

    def put_object(self, **kwargs):
        self.objects.append(kwargs)
        return {"ETag": "fake"}


class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables = {}
        cls.s3 = FakeS3()
        resource = FakeDynamoResource(cls.tables)

        boto3 = types.ModuleType("boto3")
        boto3.resource = lambda service: resource
        boto3.client = lambda service: cls.s3
        conditions = types.ModuleType("boto3.dynamodb.conditions")
        conditions.Key = FakeKey
        dynamodb = types.ModuleType("boto3.dynamodb")
        dynamodb.conditions = conditions
        boto3.dynamodb = dynamodb
        exceptions = types.ModuleType("botocore.exceptions")
        exceptions.ClientError = FakeClientError
        botocore = types.ModuleType("botocore")
        botocore.exceptions = exceptions

        sys.modules.update({
            "boto3": boto3,
            "boto3.dynamodb": dynamodb,
            "boto3.dynamodb.conditions": conditions,
            "botocore": botocore,
            "botocore.exceptions": exceptions,
        })
        os.environ["REPORTES_BUCKET"] = "reportes-test"
        cls.usuarios = cls.load_service("usuarios_service")
        cls.gastos = cls.load_service("gastos_service")
        cls.presupuestos = cls.load_service("presupuestos_service")
        cls.reportes = cls.load_service("reportes_service")

    @classmethod
    def load_service(cls, name):
        spec = importlib.util.spec_from_file_location(f"test_{name}", BACKEND / name / "app.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def setUp(self):
        for table in self.tables.values():
            table.items.clear()
        self.s3.objects.clear()

    @staticmethod
    def event(method, resource, body=None, user_id=None, query=None):
        return {
            "httpMethod": method,
            "resource": resource,
            "body": json.dumps(body) if body is not None else None,
            "pathParameters": {"usuarioId": user_id} if user_id else None,
            "queryStringParameters": query,
        }

    @staticmethod
    def body(response):
        return json.loads(response["body"])

    def test_usuarios_create_login_and_get(self):
        create = self.usuarios.lambda_handler(self.event("POST", "/usuarios", {
            "nombre": "Ana Pérez", "correo": "ana@example.com", "contraseña": "segura123",
        }), None)
        self.assertEqual(create["statusCode"], 201)
        user = self.body(create)["data"]
        self.assertNotIn("passwordHash", user)

        login = self.usuarios.lambda_handler(self.event("POST", "/login", {
            "correo": "ana@example.com", "contraseña": "segura123",
        }), None)
        self.assertTrue(self.body(login)["data"]["autenticado"])

        get_user = self.usuarios.lambda_handler(
            self.event("GET", "/usuarios/{usuarioId}", user_id=user["usuarioId"]), None,
        )
        self.assertEqual(self.body(get_user)["data"]["email"], "ana@example.com")
        self.assertEqual(get_user["headers"]["Access-Control-Allow-Origin"], "*")

    def test_gastos_create_and_filter(self):
        for date_value, category, amount in (
            ("2026-07-01", "Alimentación", 50),
            ("2026-08-01", "Transporte", 20),
            ("2025-07-01", "Alimentación", 30),
        ):
            response = self.gastos.lambda_handler(self.event("POST", "/gastos", {
                "usuarioId": "user-1", "monto": amount, "categoria": category,
                "descripcion": "Prueba", "fecha": date_value,
            }), None)
            self.assertEqual(response["statusCode"], 201)

        result = self.gastos.lambda_handler(
            self.event("GET", "/gastos/{usuarioId}", user_id="user-1", query={"mes": "7", "anio": "2026", "categoria": "alimentación"}), None,
        )
        payload = self.body(result)["data"]
        self.assertEqual(payload["cantidad"], 1)
        self.assertEqual(payload["gastos"][0]["monto"], 50)

    def test_presupuesto_calculates_warning_state(self):
        self.tables["GastosDB"].items.extend([
            {"usuarioId": "user-1", "gastoId": "1", "fecha": "2026-07-04", "monto": Decimal("60")},
            {"usuarioId": "user-1", "gastoId": "2", "fecha": "2026-07-08", "monto": Decimal("25")},
        ])
        create = self.presupuestos.lambda_handler(self.event("POST", "/presupuestos", {
            "usuarioId": "user-1", "mes": "2026-07", "limiteMensual": 100, "porcentajeAlerta": 80,
        }), None)
        self.assertEqual(create["statusCode"], 201)

        result = self.presupuestos.lambda_handler(
            self.event("GET", "/presupuestos/{usuarioId}", user_id="user-1", query={"mes": "2026-07"}), None,
        )
        payload = self.body(result)["data"]
        self.assertEqual(payload["totalGastado"], 85)
        self.assertEqual(payload["porcentajeUsado"], 85)
        self.assertEqual(payload["estado"], "CERCA_DEL_LIMITE")

    def test_presupuesto_supports_all_statuses(self):
        self.assertEqual(self.presupuestos.calculate_status(Decimal("20"), Decimal("80")), "DENTRO_DEL_PRESUPUESTO")
        self.assertEqual(self.presupuestos.calculate_status(Decimal("80"), Decimal("80")), "CERCA_DEL_LIMITE")
        self.assertEqual(self.presupuestos.calculate_status(Decimal("101"), Decimal("80")), "PRESUPUESTO_SUPERADO")

    def test_reporte_writes_csv_to_s3(self):
        self.tables["GastosDB"].items.append({
            "usuarioId": "user-1", "gastoId": "g-1", "fecha": "2026-07-04",
            "descripcion": "Café", "categoria": "Alimentación", "monto": Decimal("4.50"),
        })
        result = self.reportes.lambda_handler(
            self.event("GET", "/reportes/{usuarioId}", user_id="user-1", query={"mes": "07", "anio": "2026"}), None,
        )
        payload = self.body(result)["data"]
        self.assertEqual(payload["bucket"], "reportes-test")
        self.assertEqual(payload["cantidadRegistros"], 1)
        self.assertTrue(payload["key"].endswith(".csv"))
        csv_body = self.s3.objects[0]["Body"].decode("utf-8-sig")
        self.assertIn("Café", csv_body)


if __name__ == "__main__":
    unittest.main()
