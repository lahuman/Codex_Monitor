import unittest

from source_inventory import SourceIndex


class SourceInventoryTests(unittest.TestCase):
    def test_imported_router_preserves_owner_prefix_and_contract(self):
        index = SourceIndex({
            "app/owner.py": 'router = APIRouter(prefix="/api/auth", dependencies=[Depends(auth)])\n',
            "app/oidc.py": 'from app.owner import router\nCALLBACK = "/callback"\n@router.get(CALLBACK, include_in_schema=False)\nasync def callback(request: Request): pass\n',
        })
        route, = index.collect()["route_declarations"]
        self.assertEqual(route["path"], "/api/auth/callback")
        self.assertIn("Depends(auth)", route["router_contract"])
        self.assertIn("include_in_schema=False", route["declaration"])
        self.assertEqual(route["verification"], "not-verified")

    def test_dynamic_prefix_is_unknown_and_retains_declaration(self):
        route, = SourceIndex({"app/api.py": 'router = APIRouter(prefix=get_prefix())\n@router.post("/items")\ndef items(): pass\n'}).collect()["route_declarations"]
        self.assertIsNone(route["path"])
        self.assertEqual(route["declared_path"], "/items")
        self.assertIn("get_prefix()", route["router_contract"])

    def test_alias_cycles_remain_unknown(self):
        route, = SourceIndex({"app/api.py": 'A = B\nB = A\nrouter = APIRouter(prefix=A)\n@router.get("/")\ndef index(): pass\n'}).collect()["route_declarations"]
        self.assertIsNone(route["path"])

    def test_websocket_and_multiple_decorators_remain_distinct(self):
        result = SourceIndex({"app/api.py": 'router = APIRouter(prefix="/v1")\n@router.post("/responses")\n@router.websocket("/responses")\ndef responses(): pass\n'}).collect()
        self.assertEqual({route["method"] for route in result["route_declarations"]}, {"POST", "WEBSOCKET"})

    def test_registration_prefix_is_preserved_without_claiming_mounted_path(self):
        result = SourceIndex({"app/main.py": 'def create_app():\n app = FastAPI()\n app.include_router(api.router, prefix="/extra")\n @app.get("/health")\n def health(): pass\n'}).collect()
        self.assertEqual(result["route_declarations"][0]["path"], "/health")
        self.assertIn("prefix='/extra'", result["registrations"][0]["expression"])


if __name__ == "__main__":
    unittest.main()
