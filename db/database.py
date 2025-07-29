from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
import models # type: ignore

DATABASE_URL = "sqlite:///result.db"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()