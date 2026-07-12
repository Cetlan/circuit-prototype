from flask import Flask
import json
from pathlib import Path
from werkzeug.exceptions import InternalServerError

app = Flask("component server", instance_relative_config=True)


@app.route("/components")
def components():
    return "<p>Connection successful</p>"


@app.route("/descriptor/<string:name>")
def descriptor(name: str):
    filename = Path(app.instance_path, f"{name}.json")
    try:
        with open(filename) as fp:
            return json.load(fp)
    except FileNotFoundError as e:
        raise
    except (json.JSONDecodeError, IOError) as e:
        raise
