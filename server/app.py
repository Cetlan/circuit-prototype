from flask import Flask
import json
from pathlib import Path

app = Flask("component server", instance_relative_config=True)


def scan_components(path: Path):
    for file in Path(app.instance_path, "components").glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as fd:
                data = json.load(fd)
                yield {"name": data["name"], "href": f"/api/descriptor/{file.stem}"}
        except (json.JSONDecodeError, KeyError, PermissionError):
            continue


@app.route("/api/components")
def components():
    return list(scan_components(Path(app.instance_path, "components").glob("*.json")))


@app.route("/api/descriptor/<string:name>")
def descriptor(name: str):
    filename = Path(app.instance_path, "components", f"{name}.json")
    try:
        with open(filename, encoding="utf-8") as fp:
            return json.load(fp)
    except FileNotFoundError as e:
        raise
    except (json.JSONDecodeError, IOError) as e:
        raise
