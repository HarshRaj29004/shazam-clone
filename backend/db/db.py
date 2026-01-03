import os
import sqlalchemy as sql
import sqlalchemy.orm as orm
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("PSQL_DB")

engine = sql.create_engine(DATABASE_URL)

session_local = orm.sessionmaker(bind=engine,autocommit=False,autoflush=False)

Base = declarative_base()

def get_db():
    db = session_local()
    try:
        yield db
    finally:
        db.close()

def create_table():
    Base.metadata.create_all(engine)
