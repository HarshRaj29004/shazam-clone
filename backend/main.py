from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from route.route import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # frontend url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def home():
    return {"message": "Audio Fingerprinting Server is Running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)