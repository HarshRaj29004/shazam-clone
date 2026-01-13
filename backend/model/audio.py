from sqlalchemy import Column, BigInteger, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

class Songs():
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    channel = Column(String)

class AudioHashes():
    __tablename__ = "audio_hashes"
    id = Column(BigInteger, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id", ondelete="CASCADE"))
    hash = Column(BigInteger, index=True, nullable=False)
    time_offset = Column(Integer, nullable=False)
    song = relationship("Songs")