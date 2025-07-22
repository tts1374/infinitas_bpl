import os
from alembic.config import Config
from alembic import command

from utils.common import resource_path

def run_migrations():
    alembic_ini_path = resource_path("alembic.ini")
    alembic_cfg = Config(alembic_ini_path)
    command.upgrade(alembic_cfg, "head")