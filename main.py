from fastapi import FastAPI

app = FastAPI(title="Hello World API", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    """Return a hello world greeting."""
    return {"message": "Hello, World!"}


@app.get("/health")
def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
